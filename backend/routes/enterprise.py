from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from database import enterprise_projects_collection, organizations_collection,users_collection
from middleware.auth import get_current_user
from services.enterprise_service import (
    get_enterprise_dashboard_data,
    redeem_invite_code,
    create_project
)
from database import enterprise_projects_collection
from datetime import datetime, timezone

router = APIRouter(prefix="/api/enterprise", tags=["Enterprise"])
@router.options("/dashboard")
async def options_dashboard():
    return {}

class JoinRequest(BaseModel):
    code: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class EnterpriseSetupRequest(BaseModel):
    company_name: str
    contact_email: Optional[str] = None
    website: Optional[str] = None


@router.get("/dashboard")
async def enterprise_dashboard(current_user=Depends(get_current_user)):
    import traceback
    try:
        # Print user info for debugging
        print(f"Enterprise dashboard - user: {current_user.get('id')} / {current_user.get('_id')}")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        data = await get_enterprise_dashboard_data(user_id)
        if not data:
            raise HTTPException(403, "Not an enterprise member")
        return data
    except Exception as e:
        print("❌ Error in enterprise_dashboard:")
        traceback.print_exc()
        raise HTTPException(500, f"Internal error: {str(e)}")

@router.post("/join")
async def join_enterprise(req: JoinRequest, current_user=Depends(get_current_user)):
    result = await redeem_invite_code(req.code, current_user["id"])
    if not result["success"]:
        raise HTTPException(400, result["error"])
    return {"message": "Joined successfully"}

@router.post("/projects")
async def add_project(project: ProjectCreate, current_user=Depends(get_current_user)):
    user = current_user
    if not user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    project_id = await create_project(
        organization_id=user["organization_id"],
        name=project.name,
        description=project.description or "",
        created_by=user["id"]
    )
    return {"id": project_id, "name": project.name}

@router.get("/projects")
async def list_projects(current_user=Depends(get_current_user)):
    user = current_user
    if not user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    cursor = enterprise_projects_collection.find(
        {"organization_id": user["organization_id"], "is_archived": False}
    ).sort("created_at", -1)
    projects = []
    async for p in cursor:
        projects.append({
            "id": str(p["_id"]),
            "name": p["name"],
            "description": p.get("description"),
            "last_scan_date": p.get("last_scan_date"),
            "scan_status": p.get("scan_status"),
            "findings_summary": p.get("findings_summary", {})
        })
    return projects

@router.post("/sync")
async def sync_organization(current_user=Depends(get_current_user)):
    """Manually sync organization from Stripe subscription (for fallback)."""
    from services.payment_service import get_user_subscription, _stripe_call
    import stripe
    from services.enterprise_service import create_organization
    
    user_id = current_user["id"]
    
    # Check if user already has organization
    if current_user.get("organization_id"):
        return {"already_has_org": True, "organization_id": current_user["organization_id"]}
    
    # Get subscription from database or Stripe
    sub = await get_user_subscription(user_id)
    plan = sub.get("plan")
    if plan != "enterprise":
        return {"error": "User does not have an enterprise subscription"}
    
    # Try to create organization
    try:
        org_id, invite_code = await create_organization(user_id, None)
        return {"created": True, "organization_id": org_id, "invite_code": invite_code}
    except Exception as e:
        raise HTTPException(500, f"Failed to create organization: {str(e)}")
    
class OrgUpdate(BaseModel):
    name: str

@router.patch("/organization")
async def update_organization_name(
    update: OrgUpdate,
    current_user=Depends(get_current_user)
):
    user = current_user
    if not user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can update company name")
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    result = await organizations_collection.update_one(
        {"_id": ObjectId(org_id)},
        {"$set": {"name": update.name, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Organization not found")
    return {"message": "Company name updated"}
@router.post("/setup")
async def setup_enterprise(
    setup: EnterpriseSetupRequest,
    current_user=Depends(get_current_user)
):
    user_id = current_user["id"]
    full_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not full_user:
        raise HTTPException(404, "User not found")
    
    # Ensure user has an enterprise subscription and organization_id
    org_id = full_user.get("organization_id")
    if not org_id:
        # Fallback: create organization now if missing (e.g., webhook delayed)
        from services.enterprise_service import create_organization
        org_id, _ = await create_organization(user_id, setup.company_name)
    else:
        # Update existing organization
        await organizations_collection.update_one(
            {"_id": ObjectId(org_id)},
            {"$set": {
                "name": setup.company_name,
                "contact_email": setup.contact_email,
                "website": setup.website,
                "setup_completed": True,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    
    # Mark user as having completed setup (optional)
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"enterprise_setup_completed": True}}
    )
    
    return {"message": "Enterprise setup completed", "organization_id": org_id}