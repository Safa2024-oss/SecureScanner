import asyncio
import stripe
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from config import (
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_PORTAL_RETURN_URL,
    STRIPE_STANDARD_MONTHLY_PRICE_ID,
    STRIPE_STANDARD_QUARTERLY_PRICE_ID,
    STRIPE_STANDARD_YEARLY_PRICE_ID,
    STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
    STRIPE_PREMIUM_YEARLY_PRICE_ID,
    TRIAL_DAYS,
    SUBSCRIPTION_GRACE_DAYS,
)
from database import (
    subscriptions_collection,
    users_collection,
    usage_collection,
    invoices_collection,
    billing_events_collection,
    processed_webhook_events_collection,
)

stripe.api_key = STRIPE_SECRET_KEY

PLAN_LIMITS = {
    "free": {"scans": 5, "courses": 1, "labs": 1, "certifications": 0, "jobs": 0},
    "standard": {"scans": 100, "courses": 20, "labs": 20, "certifications": 1, "jobs": 10},
    "premium": {"scans": 500, "courses": 999999, "labs": 999999, "certifications": 999999, "jobs": 999999},
    "enterprise": {"scans": 999999, "courses": 999999, "labs": 999999, "certifications": 999999, "jobs": 999999},
    "university": {"scans": 999999, "courses": 999999, "labs": 999999, "certifications": 999999, "jobs": 999999},
}

PRICE_MAP = {
    ("standard", "monthly"): STRIPE_STANDARD_MONTHLY_PRICE_ID,
    ("standard", "quarterly"): STRIPE_STANDARD_QUARTERLY_PRICE_ID,
    ("standard", "annual"): STRIPE_STANDARD_YEARLY_PRICE_ID,
    ("premium", "monthly"): STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    ("premium", "quarterly"): STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
    ("premium", "annual"): STRIPE_PREMIUM_YEARLY_PRICE_ID,
}

STRIPE_TO_INTERNAL_STATUS = {
    "trialing": "trial",
    "active": "active",
    "past_due": "pending_payment",
    "incomplete": "pending_payment",
    "incomplete_expired": "expired",
    "unpaid": "expired",
    "canceled": "cancelled",
}


def _now():
    return datetime.now(timezone.utc)


def _dt_from_ts(ts):
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


def _get_limits(plan: str):
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


async def _log_billing_event(event_type: str, user_id: str | None, payload: dict):
    await billing_events_collection.insert_one(
        {
            "event_type": event_type,
            "user_id": user_id,
            "payload": payload,
            "created_at": _now(),
        }
    )


async def _stripe_call(fn, *args, **kwargs):
    return await asyncio.to_thread(fn, *args, **kwargs)


async def create_checkout_session(
    user_id: str,
    user_email: str,
    plan: str,
    billing_cycle: str,
    success_url: str,
    cancel_url: str,
    promo_code: str | None = None,
):
    """Create Stripe checkout session for paid plans."""
    if plan in {"enterprise", "university"}:
        return {"requires_quote": True}

    price_id = PRICE_MAP.get((plan, billing_cycle))
    if not price_id:
        return None

    subscription = await subscriptions_collection.find_one({"user_id": user_id})
    params = {
        "customer": subscription.get("stripe_customer_id") if subscription else None,
        "customer_email": user_email if not subscription else None,
        "payment_method_types": ["card"],
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": user_id,
            "plan": plan,
            "billing_cycle": billing_cycle,
            "promo_code": promo_code or "",
        },
        "allow_promotion_codes": True,
    }

    if promo_code:
        params["discounts"] = [{"promotion_code": promo_code}]

    try:
        session = await _stripe_call(stripe.checkout.Session.create, **params)
        await _log_billing_event(
            "checkout.session.created",
            user_id,
            {"session_id": session.id, "plan": plan, "billing_cycle": billing_cycle},
        )
        return {"session_id": session.id, "url": session.url}
    except Exception as e:
        await _log_billing_event("checkout.session.error", user_id, {"error": str(e)})
        return None


async def create_portal_session(user_id: str):
    subscription = await get_user_subscription(user_id)
    if not subscription or not subscription.get("stripe_customer_id"):
        return None

    try:
        session = await _stripe_call(
            stripe.billing_portal.Session.create,
            customer=subscription["stripe_customer_id"],
            return_url=STRIPE_PORTAL_RETURN_URL,
        )
        return {"url": session.url}
    except Exception as e:
        await _log_billing_event("billing.portal.error", user_id, {"error": str(e)})
        return None


async def cancel_subscription_at_period_end(user_id: str):
    subscription = await get_user_subscription(user_id)
    if not subscription or not subscription.get("stripe_subscription_id"):
        return False

    try:
        sub = await _stripe_call(
            stripe.Subscription.modify,
            subscription["stripe_subscription_id"],
            cancel_at_period_end=True,
        )
        await _apply_subscription_state(
            user_id=user_id,
            stripe_subscription_id=sub.id,
            stripe_customer_id=sub.customer,
            plan=subscription.get("plan", "free"),
            stripe_status=sub.status,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            trial_end=sub.trial_end,
            cancel_at_period_end=sub.cancel_at_period_end,
            promo_code=subscription.get("promo_code"),
            billing_cycle=subscription.get("billing_cycle", "monthly"),
        )
        return True
    except Exception as e:
        await _log_billing_event("subscription.cancel.error", user_id, {"error": str(e)})
        return False


async def _apply_subscription_state(
    *,
    user_id: str,
    stripe_subscription_id: str | None,
    stripe_customer_id: str | None,
    plan: str,
    stripe_status: str,
    current_period_start,
    current_period_end,
    trial_end,
    cancel_at_period_end: bool,
    promo_code: str | None,
    billing_cycle: str,
):
    now = _now()
    internal_status = STRIPE_TO_INTERNAL_STATUS.get(stripe_status, "active")
    grace_until = None
    if internal_status in {"pending_payment", "expired"}:
        grace_until = now + timedelta(days=SUBSCRIPTION_GRACE_DAYS)

    sub_doc = {
        "user_id": user_id,
        "stripe_customer_id": stripe_customer_id,
        "stripe_subscription_id": stripe_subscription_id,
        "plan": plan,
        "billing_cycle": billing_cycle,
        "status": internal_status,
        "trial_end": _dt_from_ts(trial_end),
        "current_period_start": _dt_from_ts(current_period_start),
        "current_period_end": _dt_from_ts(current_period_end),
        "cancel_at_period_end": cancel_at_period_end,
        "promo_code": promo_code,
        "grace_until": grace_until,
        "updated_at": now,
        "limits": _get_limits(plan),
    }
    await subscriptions_collection.update_one(
        {"user_id": user_id},
        {"$set": sub_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    # Keep role for RBAC only; store plan separately.
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"subscription_plan": plan, "updated_at": now}},
    )


async def _sync_stripe_subscription(stripe_subscription):
    user_id = stripe_subscription.get("metadata", {}).get("user_id")
    if not user_id:
        # Fallback by subscription id lookup
        existing = await subscriptions_collection.find_one(
            {"stripe_subscription_id": stripe_subscription["id"]}
        )
        user_id = existing.get("user_id") if existing else None
    if not user_id:
        return

    plan = stripe_subscription.get("metadata", {}).get("plan")
    billing_cycle = stripe_subscription.get("metadata", {}).get("billing_cycle", "monthly")
    if not plan:
        existing = await subscriptions_collection.find_one({"user_id": user_id})
        plan = existing.get("plan", "standard") if existing else "standard"

    await _apply_subscription_state(
        user_id=user_id,
        stripe_subscription_id=stripe_subscription["id"],
        stripe_customer_id=stripe_subscription.get("customer"),
        plan=plan,
        stripe_status=stripe_subscription.get("status", "active"),
        current_period_start=stripe_subscription.get("current_period_start"),
        current_period_end=stripe_subscription.get("current_period_end"),
        trial_end=stripe_subscription.get("trial_end"),
        cancel_at_period_end=stripe_subscription.get("cancel_at_period_end", False),
        promo_code=stripe_subscription.get("metadata", {}).get("promo_code"),
        billing_cycle=billing_cycle,
    )


async def _record_invoice(invoice):
    await invoices_collection.update_one(
        {"invoice_id": invoice["id"]},
        {
            "$set": {
                "invoice_id": invoice["id"],
                "customer_id": invoice.get("customer"),
                "subscription_id": invoice.get("subscription"),
                "status": invoice.get("status"),
                "amount_paid": invoice.get("amount_paid", 0),
                "amount_due": invoice.get("amount_due", 0),
                "currency": invoice.get("currency", "usd"),
                "hosted_invoice_url": invoice.get("hosted_invoice_url"),
                "invoice_pdf": invoice.get("invoice_pdf"),
                "created_at": _dt_from_ts(invoice.get("created")),
                "updated_at": _now(),
            }
        },
        upsert=True,
    )


async def handle_webhook(payload, sig_header):
    """Handle Stripe webhook events with idempotency safeguards."""
    if not sig_header:
        return False, "Missing stripe-signature header"
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        return False, f"Webhook signature error: {e}"

    event_id = event.get("id")
    if not event_id:
        return False, "Missing event id"

    already = await processed_webhook_events_collection.find_one({"event_id": event_id})
    if already:
        return True, "Already processed"

    await processed_webhook_events_collection.insert_one(
        {"event_id": event_id, "type": event.get("type"), "created_at": _now()}
    )

    event_type = event["type"]
    data_obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data_obj.get("metadata", {}).get("user_id")
        stripe_sub_id = data_obj.get("subscription")
        if stripe_sub_id:
            stripe_sub = await _stripe_call(stripe.Subscription.retrieve, stripe_sub_id)
            await _sync_stripe_subscription(stripe_sub)
        await _log_billing_event(event_type, user_id, {"session_id": data_obj.get("id")})

    elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        await _sync_stripe_subscription(data_obj)
        user_id = data_obj.get("metadata", {}).get("user_id")
        await _log_billing_event(event_type, user_id, {"subscription_id": data_obj.get("id")})

    elif event_type in {"invoice.created", "invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"}:
        await _record_invoice(data_obj)
        sub_id = data_obj.get("subscription")
        if sub_id:
            stripe_sub = await _stripe_call(stripe.Subscription.retrieve, sub_id)
            await _sync_stripe_subscription(stripe_sub)
        await _log_billing_event(event_type, None, {"invoice_id": data_obj.get("id")})

    else:
        await _log_billing_event("webhook.ignored", None, {"type": event_type})

    return True, "Processed"


async def get_user_subscription(user_id: str):
    """Get user's current subscription with free defaults."""
    sub = await subscriptions_collection.find_one({"user_id": user_id})
    if sub:
        return sub

    now = _now()
    return {
        "user_id": user_id,
        "plan": "free",
        "billing_cycle": "monthly",
        "status": "trial",
        "trial_end": now + timedelta(days=TRIAL_DAYS),
        "current_period_end": now + timedelta(days=TRIAL_DAYS),
        "cancel_at_period_end": False,
        "grace_until": None,
        "limits": _get_limits("free"),
    }


async def get_invoice_history(user_id: str, limit: int = 20):
    sub = await subscriptions_collection.find_one({"user_id": user_id})
    if not sub or not sub.get("stripe_customer_id"):
        return []
    cursor = invoices_collection.find({"customer_id": sub["stripe_customer_id"]}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def get_subscription_by_checkout_session(user_id: str, session_id: str):
    try:
        session = await _stripe_call(stripe.checkout.Session.retrieve, session_id)
    except Exception:
        return None

    if session.get("metadata", {}).get("user_id") != user_id:
        return None

    sub = await get_user_subscription(user_id)
    return {
        "plan": sub.get("plan", "free"),
        "status": sub.get("status", "trial"),
        "billing_cycle": sub.get("billing_cycle", "monthly"),
        "current_period_end": sub.get("current_period_end").isoformat() if sub.get("current_period_end") else None,
    }


async def get_usage_snapshot(user_id: str):
    subscription = await get_user_subscription(user_id)
    limits = _get_limits(subscription.get("plan", "free"))
    month_key = _now().strftime("%Y-%m")
    usage = await usage_collection.find_one({"user_id": user_id, "month": month_key})
    scans_used = usage.get("scans_used", 0) if usage else 0
    scans_limit = limits["scans"]
    remaining = max(0, scans_limit - scans_used)
    return {
        "plan": subscription.get("plan", "free"),
        "month": month_key,
        "scans_used": scans_used,
        "scans_limit": scans_limit,
        "scans_remaining": remaining,
        "courses_used": usage.get("courses_used", 0) if usage else 0,
        "courses_limit": limits["courses"],
        "labs_used": usage.get("labs_used", 0) if usage else 0,
        "labs_limit": limits["labs"],
        "certifications_used": usage.get("certifications_used", 0) if usage else 0,
        "certifications_limit": limits["certifications"],
        "jobs_used": usage.get("jobs_used", 0) if usage else 0,
        "jobs_limit": limits["jobs"],
    }


async def consume_scan_quota(user_id: str, user_role: str = "user"):
    """Atomically consume one scan quota; returns tuple(bool, details)."""
    if user_role == "admin":
        return True, {
            "plan": "admin",
            "limit": 999999,
            "used": 0,
            "remaining": 999999,
        }

    sub = await get_user_subscription(user_id)
    plan = sub.get("plan", "free")
    limit = _get_limits(plan)["scans"]
    month_key = _now().strftime("%Y-%m")

    await usage_collection.update_one(
        {"user_id": user_id, "month": month_key},
        {
            "$setOnInsert": {
                "user_id": user_id,
                "month": month_key,
                "scans_used": 0,
                "courses_used": 0,
                "labs_used": 0,
                "certifications_used": 0,
                "jobs_used": 0,
                "created_at": _now(),
            }
        },
        upsert=True,
    )

    result = await usage_collection.update_one(
        {"user_id": user_id, "month": month_key, "scans_used": {"$lt": limit}},
        {"$inc": {"scans_used": 1}, "$set": {"updated_at": _now()}},
    )
    if result.modified_count == 0:
        usage = await usage_collection.find_one({"user_id": user_id, "month": month_key})
        used = usage.get("scans_used", 0) if usage else 0
        return False, {
            "plan": plan,
            "limit": limit,
            "used": used,
            "remaining": max(0, limit - used),
        }

    usage = await usage_collection.find_one({"user_id": user_id, "month": month_key})
    used = usage.get("scans_used", 0) if usage else 1
    return True, {
        "plan": plan,
        "limit": limit,
        "used": used,
        "remaining": max(0, limit - used),
    }