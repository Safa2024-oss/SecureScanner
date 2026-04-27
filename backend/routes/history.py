from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from middleware.auth import get_current_user
from database import scans_collection
from bson import ObjectId

router = APIRouter(prefix="/api/history", tags=["History"])


def format_scan(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "type": s.get("type", ""),
        "target": s.get("target", ""),
        "status": s.get("status", ""),
        "total": s.get("results", {}).get("total", 0),
        "critical": s.get("results", {}).get("critical", 0),
        "high": s.get("results", {}).get("high", 0),
        "medium": s.get("results", {}).get("medium", 0),
        "low": s.get("results", {}).get("low", 0),
        "date": s["created_at"].strftime("%b %d, %Y") if s.get("created_at") else "",
    }


@router.get("/")
async def get_history(page: int = 1, limit: int = 20, user=Depends(get_current_user)):
    skip = (page - 1) * limit
    cursor = scans_collection.find({"user_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit)
    total = await scans_collection.count_documents({"user_id": user["id"]})
    scans = await cursor.to_list(length=limit)
    return {
        "data": [format_scan(s) for s in scans],
        "total": total,
        "page": page,
        "has_more": skip + len(scans) < total
    }


@router.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": None,
            "total_scans": {"$sum": 1},
            "total_vulnerabilities": {"$sum": "$results.total"},
            "critical": {"$sum": "$results.critical"},
            "high": {"$sum": "$results.high"}
        }}
    ]
    stats = await scans_collection.aggregate(pipeline).to_list(1)

    if stats:
        s = stats[0]
        return {
            "total_scans": s.get("total_scans", 0),
            "total_vulnerabilities": s.get("total_vulnerabilities", 0),
            "critical": s.get("critical", 0),
            "high": s.get("high", 0),
        }
    return {"total_scans": 0, "total_vulnerabilities": 0, "critical": 0, "high": 0}


@router.get("/{scan_id}/full")
async def get_full_scan(scan_id: str, user=Depends(get_current_user)):
    scan = await scans_collection.find_one({
        "_id": ObjectId(scan_id),
        "user_id": user["id"]
    })
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {
        "id": str(scan["_id"]),
        "type": scan.get("type", ""),
        "target": scan.get("target", ""),
        "status": scan.get("status", ""),
        "results": scan.get("results", {}),
        "date": scan["created_at"].strftime("%b %d, %Y") if scan.get("created_at") else "",
    }
