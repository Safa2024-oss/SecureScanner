from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
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

class InviteByEmail(BaseModel):
    email: EmailStr

class OrgUpdate(BaseModel):
    name: str

class AssignMembersRequest(BaseModel):
    user_ids: List[str]

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

@router.post("/join")
async def join_enterprise(req: JoinRequest, current_user=Depends(get_current_user)):
    result = await redeem_invite_code(req.code, current_user["id"])
    if not result["success"]:
        raise HTTPException(400, result["error"])
    return {"message": "Joined successfully"}

@router.post("/projects")
async def add_project(project: ProjectCreate, current_user=Depends(get_current_user)):
    # Fetch full user from database
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    
    if not full_user:
        raise HTTPException(404, "User not found")
    
    if not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    # Only owner can create projects
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only enterprise owner can create projects")
    
    project_id = await create_project(
        organization_id=full_user["organization_id"],
        name=project.name,
        description=project.description or "",
        created_by=current_user["id"]
    )
    return {"id": project_id, "name": project.name}

@router.get("/projects")
async def list_projects(current_user=Depends(get_current_user)):
    """List projects – owner sees all, members see only assigned projects"""
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    org_id = full_user["organization_id"]
    is_owner = full_user.get("is_enterprise_owner", False)
    user_id = current_user["id"]
    
    if is_owner:
      
        cursor = enterprise_projects_collection.find(
            {"organization_id": org_id, "is_archived": False}
        ).sort("created_at", -1)
    else:
 
        cursor = enterprise_projects_collection.find(
            {
                "organization_id": org_id,
                "is_archived": False,
                "assigned_members": user_id
            }
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

@router.post("/projects/{project_id}/assign")
async def assign_members_to_project(
    project_id: str,
    request: AssignMembersRequest,
    current_user=Depends(get_current_user)
):
    """Assign members to a project (owner only)"""
    
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only enterprise owner can assign members to projects")
    
    org_id = full_user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    
    project = await enterprise_projects_collection.find_one({
        "_id": ObjectId(project_id),
        "organization_id": org_id
    })
    if not project:
        raise HTTPException(404, "Project not found")
    
    
    for user_id in request.user_ids:
        member = await users_collection.find_one({"_id": ObjectId(user_id), "organization_id": org_id})
        if not member:
            raise HTTPException(400, f"User {user_id} is not a member of this organization")
    
    await enterprise_projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"assigned_members": request.user_ids}}
    )
    
    return {"message": f"Assigned {len(request.user_ids)} members to project"}

@router.post("/sync")
async def sync_organization(current_user=Depends(get_current_user)):
    """Manually sync organization from Stripe subscription (for fallback)."""
    from services.payment_service import get_user_subscription
    from services.enterprise_service import create_organization
    
    
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

@router.get("/members")
async def list_members(current_user=Depends(get_current_user)):
    """List all members of the organization"""
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    cursor = users_collection.find(
        {"organization_id": full_user["organization_id"]},
        {"_id": 1, "name": 1, "email": 1, "is_enterprise_owner": 1}
    )
    members = []
    async for user in cursor:
        members.append({
            "user_id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user["email"],
            "is_owner": user.get("is_enterprise_owner", False)
        })
    return members

@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    current_user=Depends(get_current_user)
):
    """Enterprise owner removes a member from the organization"""
    
    owner = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not owner.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can remove members")
    
    org_id = owner.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
    
    
    if member_id == current_user["id"]:
        raise HTTPException(400, "Cannot remove yourself. Transfer ownership first.")
    
    
    member = await users_collection.find_one({"_id": ObjectId(member_id), "organization_id": org_id})
    if not member:
        raise HTTPException(404, "Member not found in this organization")
    
    await users_collection.update_one(
        {"_id": ObjectId(member_id)},
        {"$set": {"organization_id": None, "is_enterprise_owner": False}}
    )
    
    await enterprise_projects_collection.update_many(
        {"organization_id": org_id},
        {"$pull": {"assigned_members": member_id}}
    )
    
    
    await organizations_collection.update_one(
        {"_id": ObjectId(org_id)},
        {"$inc": {"seats_used": -1}}
    )
    
    return {"message": f"Member {member.get('name')} removed from organization"}


@router.post("/invite")
async def invite_by_email(
    invite: InviteByEmail,
    current_user=Depends(get_current_user)
):
    """Enterprise owner invites a new member by email"""
    user_id = current_user["id"]
    
    full_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not full_user:
        raise HTTPException(404, "User not found")
    
    if not full_user.get("is_enterprise_owner"):
        raise HTTPException(403, "Only owner can invite members")
    
    org_id = full_user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "Organization not found")
  
    org = await organizations_collection.find_one({"_id": ObjectId(org_id)})
    org_name = org.get("name", "Enterprise") if org else "Enterprise"
    
    existing_user = await users_collection.find_one({"email": invite.email})
    if existing_user and existing_user.get("organization_id"):
        raise HTTPException(400, "User already belongs to an organization")
    
    
    existing_invite = await organization_invites_collection.find_one({
        "email": invite.email,
        "organization_id": org_id,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if existing_invite:
        raise HTTPException(400, "This email already has a pending invitation")
    
 
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
   
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
   
    if current_user["email"] != invite["email"]:
        raise HTTPException(400, "This invitation was sent to a different email address")
    
    if current_user.get("organization_id"):
        raise HTTPException(400, "You already belong to an organization")
    
    
    await users_collection.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {
            "organization_id": invite["organization_id"],
            "is_enterprise_owner": False
        }}
    )
    
    
    await organization_invites_collection.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
    )
    
    
    await organizations_collection.update_one(
        {"_id": ObjectId(invite["organization_id"])},
        {"$inc": {"seats_used": 1}}
    )
    
    return {"message": "Successfully joined the organization"}

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

@router.get("/my-projects")
async def get_my_projects(current_user=Depends(get_current_user)):
    """Get projects that the current user can access"""
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    org_id = full_user.get("organization_id")
    
    if not org_id:
        return []  
    
    is_owner = full_user.get("is_enterprise_owner", False)
    user_id = current_user["id"]
    
    if is_owner:
        
        cursor = enterprise_projects_collection.find(
            {"organization_id": org_id, "is_archived": False}
        ).sort("created_at", -1)
    else:
        
        cursor = enterprise_projects_collection.find(
            {
                "organization_id": org_id,
                "is_archived": False,
                "assigned_members": user_id
            }
        ).sort("created_at", -1)
    
    projects = []
    async for p in cursor:
        projects.append({
            "id": str(p["_id"]),
            "name": p["name"],
            "description": p.get("description", "")
        })
    
    return projects


@router.get("/scans")
async def get_enterprise_scans(
    current_user=Depends(get_current_user),
    project_id: Optional[str] = None,
    member_id: Optional[str] = None,
    limit: int = 50
):
    """Get scans for the enterprise – can filter by project or member"""
    from database import scans_collection
    
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    org_id = full_user["organization_id"]
    is_owner = full_user.get("is_enterprise_owner", False)
    
    
    members_cursor = users_collection.find(
        {"organization_id": org_id},
        {"_id": 1}
    )
    member_ids = [str(m["_id"]) async for m in members_cursor]
    
  
    query = {"user_id": {"$in": member_ids}}
    
    if project_id:
        query["project_id"] = project_id
    
    if member_id and (is_owner or member_id == current_user["id"]):
        query["user_id"] = member_id
    
    cursor = scans_collection.find(query).sort("created_at", -1).limit(limit)
    
    scans = []
    async for scan in cursor:
       
        user = await users_collection.find_one({"_id": ObjectId(scan["user_id"])})
        scans.append({
            "id": str(scan["_id"]),
            "user_id": scan["user_id"],
            "user_name": user.get("name") if user else "Unknown",
            "type": scan.get("type", "Unknown"),
            "target": scan.get("target", ""),
            "created_at": scan.get("created_at").isoformat() if scan.get("created_at") else None,
            "critical": scan.get("results", {}).get("critical", 0),
            "high": scan.get("results", {}).get("high", 0),
            "medium": scan.get("results", {}).get("medium", 0),
            "low": scan.get("results", {}).get("low", 0),
            "total": scan.get("results", {}).get("total", 0),
            "project_id": scan.get("project_id"),
            "project_name": scan.get("project_name")
        })
    
    return scans

@router.get("/projects/{project_id}/scans")
async def get_project_scans(
    project_id: str,
    current_user=Depends(get_current_user),
    limit: int = 50
):
    """Get scans for a specific project"""
    from database import scans_collection
    
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    org_id = full_user["organization_id"]
    
  
    project = await enterprise_projects_collection.find_one({
        "_id": ObjectId(project_id),
        "organization_id": org_id
    })
    if not project:
        raise HTTPException(404, "Project not found")
    
    cursor = scans_collection.find({"project_id": project_id}).sort("created_at", -1).limit(limit)
    
    scans = []
    async for scan in cursor:
        user = await users_collection.find_one({"_id": ObjectId(scan["user_id"])})
        scans.append({
            "id": str(scan["_id"]),
            "user_name": user.get("name") if user else "Unknown",
            "type": scan.get("type", "Unknown"),
            "target": scan.get("target", ""),
            "created_at": scan.get("created_at").isoformat() if scan.get("created_at") else None,
            "critical": scan.get("results", {}).get("critical", 0),
            "high": scan.get("results", {}).get("high", 0),
            "medium": scan.get("results", {}).get("medium", 0),
            "low": scan.get("results", {}).get("low", 0),
            "total": scan.get("results", {}).get("total", 0)
        })
    
    return scans

@router.get("/members/{member_id}/scans")
async def get_member_scans(
    member_id: str,
    current_user=Depends(get_current_user),
    limit: int = 50
):
    """Get scans for a specific member (owner only or self)"""
    from database import scans_collection
    
    full_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not full_user or not full_user.get("organization_id"):
        raise HTTPException(403, "Not an enterprise member")
    
    org_id = full_user["organization_id"]
    is_owner = full_user.get("is_enterprise_owner", False)
    
   
    if not is_owner and member_id != current_user["id"]:
        raise HTTPException(403, "You can only view your own scans")
    
   
    member = await users_collection.find_one({"_id": ObjectId(member_id), "organization_id": org_id})
    if not member:
        raise HTTPException(404, "Member not found")
    
    cursor = scans_collection.find({"user_id": member_id}).sort("created_at", -1).limit(limit)
    
    scans = []
    async for scan in cursor:
        scans.append({
            "id": str(scan["_id"]),
            "type": scan.get("type", "Unknown"),
            "target": scan.get("target", ""),
            "created_at": scan.get("created_at").isoformat() if scan.get("created_at") else None,
            "critical": scan.get("results", {}).get("critical", 0),
            "high": scan.get("results", {}).get("high", 0),
            "medium": scan.get("results", {}).get("medium", 0),
            "low": scan.get("results", {}).get("low", 0),
            "total": scan.get("results", {}).get("total", 0),
            "project_id": scan.get("project_id"),
            "project_name": scan.get("project_name")
        })
    
    return scans