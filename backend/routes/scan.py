from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import Response
from typing import List, Optional
from pydantic import BaseModel
from bson import ObjectId
from controllers.scan_controller import sast_scan, dast_scan, git_scan, DASTRequest, GitScanRequest
from services.report_service import generate_pdf_report
from middleware.auth import get_current_user
from database import users_collection, enterprise_projects_collection

router = APIRouter(prefix="/api/scan", tags=["Scanning"])

class SASTRequest(BaseModel):
    project_id: Optional[str] = None

@router.post("/sast")
async def sast_route(
    files: List[UploadFile] = File(...),
    project_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    
    project_name = None
    if project_id:
        project = await enterprise_projects_collection.find_one({"_id": ObjectId(project_id)})
        if not project:
            raise HTTPException(400, "Project not found")
        
       
        full_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
        if full_user.get("organization_id") != project.get("organization_id"):
            raise HTTPException(403, "You don't have access to this project")
        
        project_name = project.get("name")
    
    return await sast_scan(
        files=files,
        user_id=user["id"],
        user_role=user.get("role", "user"),
        project_id=project_id,
        project_name=project_name
    )

@router.post("/git")
async def git_route(request: GitScanRequest, user=Depends(get_current_user)):
    
    project_name = None
    if request.project_id:
        project = await enterprise_projects_collection.find_one({"_id": ObjectId(request.project_id)})
        if not project:
            raise HTTPException(400, "Project not found")
        
        full_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
        if full_user.get("organization_id") != project.get("organization_id"):
            raise HTTPException(403, "You don't have access to this project")
        
        project_name = project.get("name")
    
    return await git_scan(
        request=request,
        user_id=user["id"],
        user_role=user.get("role", "user"),
        project_id=request.project_id,
        project_name=project_name
    )

@router.post("/dast")
async def dast_route(request: DASTRequest, user=Depends(get_current_user)):
    
    project_name = None
    if request.project_id:
        project = await enterprise_projects_collection.find_one({"_id": ObjectId(request.project_id)})
        if not project:
            raise HTTPException(400, "Project not found")
        
        full_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
        if full_user.get("organization_id") != project.get("organization_id"):
            raise HTTPException(403, "You don't have access to this project")
        
        project_name = project.get("name")
    
    return await dast_scan(
        request=request,
        user_id=user["id"],
        user_role=user.get("role", "user"),
        project_id=request.project_id,
        project_name=project_name
    )

@router.post("/report")
async def report_route(scan_data: dict, user=Depends(get_current_user)):
    pdf = generate_pdf_report(scan_data)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=securescan-report.pdf"}
    )