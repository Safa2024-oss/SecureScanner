import secrets
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from database import (
    users_collection,
    organizations_collection,
    organization_invites_collection,
    enterprise_projects_collection
)

async def create_organization(owner_id: str, company_name: str = None):
    """Create organization and generate owner invite code."""
    if not company_name:
        user = await users_collection.find_one({"_id": ObjectId(owner_id)})
        company_name = f"{user['email']}'s Company"

    org = {
        "name": company_name,
        "owner_id": owner_id,
        "subscription_plan": "enterprise",
        "seats_used": 1,
        "seats_limit": 100,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "active_invite_code": None   # will be set after code generation
    }
    result = await organizations_collection.insert_one(org)
    org_id = str(result.inserted_id)

   
    await users_collection.update_one(
        {"_id": ObjectId(owner_id)},
        {"$set": {"organization_id": org_id, "is_enterprise_owner": True}}
    )

    
    code = secrets.token_urlsafe(16)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    invite = {
        "organization_id": org_id,
        "code": code,
        "created_by": owner_id,
        "expires_at": expires_at,
        "revoked": False,
        "used_by": None,
        "used_at": None
    }
    await organization_invites_collection.insert_one(invite)

    
    await organizations_collection.update_one(
        {"_id": ObjectId(org_id)},
        {"$set": {"active_invite_code": code}}
    )

    return org_id, code

async def get_enterprise_dashboard_data(user_id: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("organization_id"):
        return None

    org = await organizations_collection.find_one({"_id": ObjectId(user["organization_id"])})
    if not org:
        return None

   
    members_cursor = users_collection.find(
        {"organization_id": user["organization_id"]},
        {"_id": 1, "name": 1, "email": 1, "is_enterprise_owner": 1}
    )
    members = []
    async for m in members_cursor:
        members.append({
            "id": str(m["_id"]),
            "name": m.get("name", ""),
            "email": m["email"],
            "is_owner": m.get("is_enterprise_owner", False)
        })

    projects_count = await enterprise_projects_collection.count_documents(
        {"organization_id": user["organization_id"], "is_archived": False}
    )

   
    from database import scans_collection
    member_ids = [str(m["id"]) for m in members]  # use the 'id' field we stored
    scans_count = await scans_collection.count_documents({"user_id": {"$in": member_ids}})

    invite_code = org.get("active_invite_code") if user.get("is_enterprise_owner") else None

    return {
        "organization_name": org["name"],
        "invite_code": invite_code,
        "members": members,
        "projects_count": projects_count,
        "scans_count": scans_count,
        "member_count": len(members),
        "is_owner": user.get("is_enterprise_owner", False)
    }

async def redeem_invite_code(code: str, user_id: str):
    invite = await organization_invites_collection.find_one({
        "code": code,
        "revoked": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if not invite:
        return {"success": False, "error": "Invalid or expired code"}

    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if user.get("organization_id"):
        return {"success": False, "error": "You are already in an organization"}

    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"organization_id": invite["organization_id"], "is_enterprise_owner": False}}
    )

    await organization_invites_collection.update_one(
        {"_id": invite["_id"]},
        {"$set": {"used_by": user_id, "used_at": datetime.now(timezone.utc)}}
    )

    await organizations_collection.update_one(
        {"_id": invite["organization_id"]},
        {"$inc": {"seats_used": 1}}
    )

    return {"success": True}


async def create_project(organization_id: str, name: str, description: str, created_by: str):
    project = {
        "organization_id": organization_id,
        "name": name,
        "description": description,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_scan_date": None,
        "scan_status": "pending",
        "findings_summary": {"critical": 0, "high": 0, "medium": 0, "low": 0},
        "is_archived": False
    }
    result = await enterprise_projects_collection.insert_one(project)
    return str(result.inserted_id)