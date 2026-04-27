from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from middleware.auth import get_admin_user
from database import db
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None
    subscription_plan: Optional[str] = None


class UpdateQuoteRequest(BaseModel):
    status: str


@router.get("/stats")
async def get_stats(admin=Depends(get_admin_user)):
    """Platform overview using MongoDB aggregation."""
    # Users count
    users_count = await db.users.count_documents({})
    scans_count = await db.scans.count_documents({})

    # Vuln stats via aggregation
    pipeline = [
        {"$group": {
            "_id": None,
            "total_vulnerabilities": {"$sum": "$results.total"},
            "critical": {"$sum": "$results.critical"},
            "high": {"$sum": "$results.high"}
        }}
    ]
    vuln_stats = await db.scans.aggregate(pipeline).to_list(1)
    total_vulns = vuln_stats[0].get("total_vulnerabilities", 0) if vuln_stats else 0

    # Top vulnerability types
    vuln_types = {}
    async for scan in db.scans.find({}, {"results.vulnerabilities.type": 1}):
        for v in scan.get("results", {}).get("vulnerabilities", []):
            t = v.get("type", "Unknown")
            vuln_types[t] = vuln_types.get(t, 0) + 1

    top_vulns = sorted(vuln_types.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_users": users_count,
        "total_scans": scans_count,
        "total_vulnerabilities": total_vulns,
        "top_vulnerability_types": [{"type": t, "count": c} for t, c in top_vulns]
    }


@router.get("/users")
async def get_users(page: int = 1, limit: int = 20, admin=Depends(get_admin_user)):
    """List all users with scan count."""
    skip = (page - 1) * limit
    users = []
    cursor = db.users.find().skip(skip).limit(limit)
    async for user in cursor:
        scan_count = await db.scans.count_documents({"user_id": str(user["_id"])})
        role = user.get("role", "user")
        users.append({
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "role": role,
            "status": user.get("status", "active"),
            "subscription_plan": "admin_access" if role == "admin" else user.get("subscription_plan", "free"),
            "verified": user.get("verified", False),
            "scan_count": scan_count,
            "created_at": user["created_at"].strftime("%b %d, %Y") if user.get("created_at") else ""
        })
    total = await db.users.count_documents({})
    return {
        "data": users,
        "total": total,
        "page": page,
        "has_more": skip + len(users) < total
    }


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserRequest, admin=Depends(get_admin_user)):
    """Ban/unban a user or change their role."""
    update = {}
    if body.role in ["user", "admin"]:
        update["role"] = body.role
    if body.status in ["active", "banned"]:
        update["status"] = body.status
    if body.subscription_plan in ["free", "standard", "premium", "enterprise", "university"]:
        update["subscription_plan"] = body.subscription_plan
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")

    update["updated_at"] = __import__("datetime").datetime.utcnow()
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return {"message": "User updated", **update}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(get_admin_user)):
    """Delete user and all their scans."""
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await db.scans.delete_many({"user_id": user_id})
    return {"message": "User deleted"}


@router.get("/scans")
async def get_all_scans(page: int = 1, limit: int = 50, admin=Depends(get_admin_user)):
    """List scans across all users."""
    skip = (page - 1) * limit
    scans = []
    cursor = db.scans.find().sort("created_at", -1).skip(skip).limit(limit)
    async for scan in cursor:
        user_doc = None
        try:
            user_doc = await db.users.find_one({"_id": ObjectId(scan.get("user_id", ""))})
        except Exception:
            user_doc = None
        scans.append({
            "id": str(scan["_id"]),
            "user_id": scan.get("user_id", ""),
            "user_name": user_doc.get("name", "Unknown") if user_doc else "Unknown",
            "user_email": user_doc.get("email", "") if user_doc else "",
            "type": scan.get("type", ""),
            "target": scan.get("target", ""),
            "status": scan.get("status", ""),
            "total": scan.get("results", {}).get("total", 0),
            "critical": scan.get("results", {}).get("critical", 0),
            "high": scan.get("results", {}).get("high", 0),
            "date": scan["created_at"].strftime("%b %d, %Y") if scan.get("created_at") else ""
        })
    total = await db.scans.count_documents({})
    return {
        "data": scans,
        "total": total,
        "page": page,
        "has_more": skip + len(scans) < total
    }


@router.get("/billing/overview")
async def get_billing_overview(admin=Depends(get_admin_user)):
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    sub_status = await db.subscriptions.aggregate(pipeline).to_list(length=20)
    failed_payments = await db.invoices.count_documents({"status": {"$in": ["open", "uncollectible"]}})
    paid_invoices = await db.invoices.find({"status": {"$in": ["paid"]}}).to_list(length=500)
    revenue_cents = sum(inv.get("amount_paid", 0) for inv in paid_invoices)
    promo_usage = await db.subscriptions.count_documents({"promo_code": {"$nin": [None, ""]}})

    return {
        "subscription_statuses": sub_status,
        "failed_payments": failed_payments,
        "revenue_cents": revenue_cents,
        "promo_usage": promo_usage,
    }


@router.get("/billing/subscriptions")
async def list_subscriptions(plan: Optional[str] = None, page: int = 1, limit: int = 50, admin=Depends(get_admin_user)):
    skip = (page - 1) * limit
    query = {"plan": plan} if plan else {}
    cursor = db.subscriptions.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    data = []
    async for s in cursor:
        data.append({
            "id": str(s.get("_id")),
            "user_id": s.get("user_id"),
            "plan": s.get("plan", "free"),
            "billing_cycle": s.get("billing_cycle", "monthly"),
            "status": s.get("status", "active"),
            "cancel_at_period_end": s.get("cancel_at_period_end", False),
            "updated_at": s.get("updated_at").isoformat() if s.get("updated_at") else None,
        })
    total = await db.subscriptions.count_documents(query)
    return {"data": data, "total": total, "page": page, "has_more": skip + len(data) < total}


@router.get("/billing/quotes")
async def list_quote_requests(page: int = 1, limit: int = 50, admin=Depends(get_admin_user)):
    skip = (page - 1) * limit
    cursor = db.quote_requests.find().sort("created_at", -1).skip(skip).limit(limit)
    rows = []
    async for q in cursor:
        rows.append({
            "id": str(q["_id"]),
            "plan_type": q.get("plan_type"),
            "company_name": q.get("company_name"),
            "contact_name": q.get("contact_name"),
            "email": q.get("email"),
            "seats": q.get("seats", 0),
            "status": q.get("status", "new"),
            "created_at": q.get("created_at").isoformat() if q.get("created_at") else None,
        })
    total = await db.quote_requests.count_documents({})
    return {"data": rows, "total": total, "page": page, "has_more": skip + len(rows) < total}


@router.patch("/billing/quotes/{quote_id}")
async def update_quote_request(quote_id: str, body: UpdateQuoteRequest, admin=Depends(get_admin_user)):
    if body.status not in {"new", "reviewing", "won", "lost"}:
        raise HTTPException(status_code=400, detail="Invalid quote status")
    await db.quote_requests.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"status": body.status, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Quote updated"}
