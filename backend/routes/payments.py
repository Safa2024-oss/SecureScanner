from fastapi import APIRouter, Depends, HTTPException,Request
from pydantic import BaseModel
from middleware.auth import get_current_user
from services.payment_service import (
    create_checkout_session,
    get_user_subscription,
    cancel_subscription_at_period_end,
    create_portal_session,
    get_invoice_history,
    get_usage_snapshot,
    get_subscription_by_checkout_session,
)
from config import APP_URL
from database import quote_requests_collection
from datetime import datetime
from database import users_collection
from bson import ObjectId
from services.payment_service import handle_webhook

async def _get_user_email(user_id: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id)}, {"email": 1})
    return user["email"] if user else None


router = APIRouter(prefix="/api/payments", tags=["Payments"])

class CheckoutRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"
    promo_code: str | None = None


class QuoteRequestBody(BaseModel):
    plan_type: str
    company_name: str
    contact_name: str
    email: str
    seats: int = 1
    message: str = ""

@router.post("/create-checkout")
async def create_checkout(request: CheckoutRequest, user=Depends(get_current_user)):
    plan_alias = {"pro": "standard", "team": "premium"}
    plan = plan_alias.get(request.plan, request.plan)
    if plan not in ["standard", "premium", "enterprise"]:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # Get user email from database
    user_email = await _get_user_email(user["id"])
    if not user_email:
        raise HTTPException(status_code=400, detail="User email not found")

    # Check if user already has a paid subscription
    current_sub = await get_user_subscription(user["id"])
    current_plan = current_sub.get("plan", "free")

    # If user has a paid plan and is trying to change to a different plan -> portal
    if current_plan != "free" and current_plan != plan:
        portal_result = await create_portal_session(user["id"])
        if portal_result and portal_result.get("url"):
            return portal_result
        else:
            raise HTTPException(status_code=400, detail="Could not open billing portal to change plan")

    # Otherwise create a new checkout session (free user or same plan – though same plan should be disabled in UI)
    success_url = f"{APP_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{APP_URL}/payment/cancelled"

    result = await create_checkout_session(
        user_id=user["id"],
        user_email=user_email,
        plan=plan,
        billing_cycle=request.billing_cycle,
        success_url=success_url,
        cancel_url=cancel_url,
        promo_code=request.promo_code,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Stripe price ID not configured for this plan/cycle")
    if result.get("requires_quote"):
        raise HTTPException(status_code=400, detail="Selected plan requires a sales quote")

    return result

@router.get("/subscription")
async def get_subscription(user=Depends(get_current_user)):
    """Get user's current subscription"""
    sub = await get_user_subscription(user["id"])
    return {
        "plan": sub.get("plan", "free"),
        "billing_cycle": sub.get("billing_cycle", "monthly"),
        "status": sub.get("status", "trial"),
        "trial_end": sub.get("trial_end").isoformat() if sub.get("trial_end") else None,
        "current_period_end": sub.get("current_period_end").isoformat() if sub.get("current_period_end") else None,
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "grace_until": sub.get("grace_until").isoformat() if sub.get("grace_until") else None,
        "limits": sub.get("limits", {}),
    }

@router.post("/cancel-subscription")
async def cancel_subscription_endpoint(user=Depends(get_current_user)):
    """Cancel subscription at period end"""
    success = await cancel_subscription_at_period_end(user["id"])
    if not success:
        raise HTTPException(status_code=400, detail="Could not cancel subscription")
    return {"message": "Subscription will cancel at end of period"}


@router.post("/portal-session")
async def create_portal_session_endpoint(user=Depends(get_current_user)):
    result = await create_portal_session(user["id"])
    if not result:
        raise HTTPException(status_code=400, detail="No active billing profile found")
    return result


@router.get("/invoices")
async def list_invoices(limit: int = 20, user=Depends(get_current_user)):
    invoices = await get_invoice_history(user["id"], limit=limit)
    return {
        "data": [
            {
                "invoice_id": inv.get("invoice_id"),
                "status": inv.get("status"),
                "amount_paid": inv.get("amount_paid", 0),
                "amount_due": inv.get("amount_due", 0),
                "currency": inv.get("currency", "usd"),
                "hosted_invoice_url": inv.get("hosted_invoice_url"),
                "invoice_pdf": inv.get("invoice_pdf"),
                "created_at": inv.get("created_at").isoformat() if inv.get("created_at") else None,
            }
            for inv in invoices
        ]
    }


@router.get("/usage")
async def get_usage(user=Depends(get_current_user)):
    usage = await get_usage_snapshot(user["id"])
    return usage


@router.get("/session/{session_id}")
async def verify_checkout_session(session_id: str, user=Depends(get_current_user)):
    sub = await get_subscription_by_checkout_session(user["id"], session_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Could not verify checkout session")
    return sub


@router.post("/quote-request")
async def create_quote_request(body: QuoteRequestBody, user=Depends(get_current_user)):
    if body.plan_type not in {"enterprise"}:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    payload = {
        "plan_type": body.plan_type,
        "company_name": body.company_name.strip(),
        "contact_name": body.contact_name.strip(),
        "email": body.email.strip().lower(),
        "seats": body.seats,
        "message": body.message.strip(),
        "status": "new",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "user_id": user.get("id"),
    }
    result = await quote_requests_collection.insert_one(payload)
    return {"id": str(result.inserted_id), "status": "submitted"}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    success, message = await handle_webhook(payload, sig_header)
    if not success:
        print(f"Webhook error: {message}")  # debug
        raise HTTPException(status_code=400, detail=message)
    return {"status": "ok"}

@router.post("/quote-request/public")
async def create_public_quote_request(body: QuoteRequestBody):
    if body.plan_type not in {"enterprise"}:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    payload = {
        "plan_type": body.plan_type,
        "company_name": body.company_name.strip(),
        "contact_name": body.contact_name.strip(),
        "email": body.email.strip().lower(),
        "seats": body.seats,
        "message": body.message.strip(),
        "status": "new",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "user_id": None,
    }
    result = await quote_requests_collection.insert_one(payload)
    return {"id": str(result.inserted_id), "status": "submitted"}