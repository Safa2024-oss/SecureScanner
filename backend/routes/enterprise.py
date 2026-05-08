from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from bson import ObjectId
from database import enterprise_projects_collection, organizations_collection, users_collection, organization_invites_collection
from middleware.auth import get_current_user
from services.enterprise_service import (
    get_enterprise_dashboard_data,
    redeem_invite_code,
    create_project
)
from datetime import datetime, timedelta, timezone
import os
import secrets
from services.email_service import send_enterprise_invite_email

router = APIRouter(prefix="/api/enterprise", tags=["Enterprise"])

# ========== OPTIONS HANDLERS ==========
@router.options("/dashboard")
async def options_dashboard():
    return {}

# ========== REQUEST MODELS ==========
class JoinRequest(BaseModel):
    code: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class EnterpriseSetupRequest(BaseModel):
    company_name: str
    contact_email: Optional[str] = None
    website: Optional[str] = None

class InviteByEmail(BaseModel):
    email: EmailStr

class OrgUpdate(BaseModel):
    name: str

# ========== DASHBOARD ==========
@router.get("/dashboard")
async def enterprise_dashboard(current_user=Depends(get_current_user)):
    import traceback
    try:
        # Fetch full user from database to ensure we have organization_id
        full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
        if not full_user:
            raise HTTPException(404, "User not found")
        
        print(f"Enterprise dashboard - user: {full_user.get('email')}, org_id: {full_user.get('organization_id')}")
        user_id = str(full_user["_id"])
        data = await get_enterprise_dashboard_data(user_id)
        if not data:
            raise HTTPException(403, "Not an enterprise member")
        return data
    except Exception as e:
        print("❌ Error in enterprise_dashboard:")
        traceback.print_exc()
        raise HTTPException(500, f"Internal error: {str(e)}")

# ========== JOIN WITH CODE ==========
@router.post("/join")
async def join_enterprise(req: JoinRequest, current_user=Depends(get_current_user)):
    result = await redeem_invite_code(req.code, current_user["id"])
    if not result["success"]:
        raise HTTPException(400, result["error"])
    return {"message": "Joined successfully"}

# ========== PROJECTS ==========
@router.post("/projects")
async def add_project(project: ProjectCreate, current_user=Depends(get_current_user)):
    # Fetch full user from database
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    project_id = await create_project(
        organization_id=full_user["organization_id"],
        name=project.name,
        description=project.description or "",
        created_by=current_user["id"]
    )
    return {"id": project_id, "name": project.name}

@router.get("/projects")
async def list_projects(current_user=Depends(get_current_user)):
    # Fetch full user from database
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    cursor = enterprise_projects_collection.find(
        {"organization_id": full_user["organization_id"], "is_archived": False}
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

# ========== SYNC ORGANIZATION ==========
@router.post("/sync")
async def sync_organization(current_user=Depends(get_current_user)):
    """Manually sync organization from Stripe subscription (for fallback)."""
    from services.payment_service import get_user_subscription
    from services.enterprise_service import create_organization
    from database import users_collection
    
    # Fetch fresh user from database
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    
    if full_user.get("organization_id"):
        return {"already_has_org": True, "organization_id": full_user["organization_id"]}
    
    sub = await get_user_subscription(current_user["id"])
    plan = sub.get("plan")
    if plan != "enterprise":
        return {"error": "User does not have an enterprise subscription"}
    
    try:
        org_id, invite_code = await create_organization(current_user["id"], None)
        return {"created": True, "organization_id": org_id, "invite_code": invite_code}
    except Exception as e:
        raise HTTPException(500, f"Failed to create organization: {str(e)}")

# ========== UPDATE ORGANIZATION NAME ==========
@router.patch("/organization")
async def update_organization_name(
    update: OrgUpdate,
    current_user=Depends(get_current_user)
):
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can update company name")
    org_id = full_user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    result = await organizations_collection.update_one(
        {"_id": ObjectId(org_id)},
        {"$set": {"name": update.name, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Organization not found")
    return {"message": "Company name updated"}

# ========== ENTERPRISE SETUP ==========
@router.post("/setup")
async def setup_enterprise(
    setup: EnterpriseSetupRequest,
    current_user=Depends(get_current_user)
):
    user_id = current_user["id"]
    full_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not full_user:
        raise HTTPException(404, "User not found")
    
    org_id = full_user.get("organization_id")
    if not org_id:
        from services.enterprise_service import create_organization
        org_id, _ = await create_organization(user_id, setup.company_name)
    else:
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
    
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"enterprise_setup_completed": True}}
    )
    
    return {"message": "Enterprise setup completed", "organization_id": org_id}

# ========== EMAIL INVITATIONS ==========
@router.post("/invite")
async def invite_by_email(
    invite: InviteByEmail,
    current_user=Depends(get_current_user)
):
    """Enterprise owner invites a new member by email"""
    user_id = current_user["id"]
    
    # Fetch the full user from database to check is_enterprise_owner
    full_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not full_user:
        raise HTTPException(404, "User not found")
    
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can invite members")
    
    org_id = full_user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    
    # Get organization name
    org = await organizations_collection.find_one({"_id": ObjectId(org_id)})
    org_name = org.get("name", "Enterprise") if org else "Enterprise"
    
    # Check if user already has an account and is in an organization
    existing_user = await users_collection.find_one({"email": invite.email})
    if existing_user and existing_user.get("organization_id"):
        raise HTTPException(400, "User already belongs to an organization")
    
    # Check for existing pending invite
    existing_invite = await organization_invites_collection.find_one({
        "email": invite.email,
        "organization_id": org_id,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if existing_invite:
        raise HTTPException(400, "This email already has a pending invitation")
    
    # Generate unique token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Store invite
    invite_doc = {
        "organization_id": org_id,
        "email": invite.email,
        "token": token,
        "invited_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "used": False,
        "org_name": org_name
    }
    await organization_invites_collection.insert_one(invite_doc)
    
    # Send email invitation
    frontend_url = os.getenv("APP_URL", "http://localhost:5173")
    accept_link = f"{frontend_url}/enterprise/accept-invite?token={token}"
    
    try:
        await send_enterprise_invite_email(
            to_email=invite.email,
            inviter_name=full_user.get("name", "Enterprise Owner"),
            org_name=org_name,
            accept_link=accept_link
        )
        print(f"✅ Invitation email sent to {invite.email}")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        print(f"📧 Manual link for {invite.email}: {accept_link}")
    
    return {"message": f"Invitation sent to {invite.email}"}

@router.get("/invite/verify/{token}")
async def verify_invite_token(token: str):
    """Verify if an invite token is valid (for frontend preview)"""
    invite = await organization_invites_collection.find_one({
        "token": token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if not invite:
        raise HTTPException(404, "Invalid or expired invitation")
    
    return {
        "valid": True,
        "email": invite["email"],
        "org_name": invite.get("org_name", "Enterprise"),
        "expires_at": invite["expires_at"].isoformat()
    }

@router.post("/invite/accept/{token}")
async def accept_invite(
    token: str,
    current_user=Depends(get_current_user)
):
    """Accept an email invitation and join the organization"""
    invite = await organization_invites_collection.find_one({
        "token": token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if not invite:
        raise HTTPException(400, "Invalid or expired invitation")
    
    # Verify email matches
    if current_user["email"] != invite["email"]:
        raise HTTPException(400, "This invitation was sent to a different email address")
    
    # Check if user already has an organization
    if current_user.get("organization_id"):
        raise HTTPException(400, "You already belong to an organization")
    
    # Add user to organization
    await users_collection.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {
            "organization_id": invite["organization_id"],
            "is_enterprise_owner": False
        }}
    )
    
    # Mark invite as used
    await organization_invites_collection.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
    )
    
    # Increment seat count
    await organizations_collection.update_one(
        {"_id": ObjectId(invite["organization_id"])},
        {"$inc": {"seats_used": 1}}
    )
    
    return {"message": "Successfully joined the organization"}

@router.get("/invites")
async def list_pending_invites(current_user=Depends(get_current_user)):
    """List all pending invites for the organization (owner only)"""
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can view invites")
    
    org_id = full_user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    
    cursor = organization_invites_collection.find(
        {"organization_id": org_id, "used": False, "expires_at": {"$gt": datetime.now(timezone.utc)}}
    ).sort("created_at", -1)
    
    invites = []
    async for inv in cursor:
        invites.append({
            "email": inv["email"],
            "token": inv["token"],
            "expires_at": inv["expires_at"].isoformat(),
            "created_at": inv["created_at"].isoformat()
        })
    
    return invites

@router.delete("/invite/{token}")
async def revoke_invite(token: str, current_user=Depends(get_current_user)):
    """Revoke a pending invite (owner only)"""
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can revoke invites")
    
    result = await organization_invites_collection.update_one(
        {"token": token, "organization_id": full_user["organization_id"]},
        {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(404, "Invite not found or already used")
    
    return {"message": "Invite revoked"}

@router.post("/invite-code")
async def generate_invite_code(current_user=Depends(get_current_user)):
    """Generate a new invite code for the organization (owner only)"""
    from services.enterprise_service import generate_owner_invite_code
    
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can generate invite code")
    
    org_id = full_user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    
    invite_code = await generate_owner_invite_code(org_id, current_user["id"])
    await organizations_collection.update_one(
        {"_id": ObjectId(org_id)},
        {"$set": {"active_invite_code": invite_code}}
    )
    
    return {"invite_code": invite_code}