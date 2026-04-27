from database import users_collection
import bcrypt
from bson import ObjectId
from datetime import datetime


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


async def get_user_by_email(email: str):
    return await users_collection.find_one({"email": email})


async def create_user(name: str, email: str, password: str):
    print("🚀 create_user called")
    existing = await get_user_by_email(email)
    if existing:
        print("❌ User already exists")
        return None

    hashed = hash_password(password)
    now = datetime.utcnow()
    user = {
        "name": name,
        "email": email,
        "password": hashed,
        "role": "user",
        "status": "active",
        "verified": False,
        "verified_at": None,
        "created_at": now,
        "updated_at": now
    }
    print("📦 About to insert user:", user)
    result = await users_collection.insert_one(user)
    print("✅ Inserted ID:", result.inserted_id)
    user["_id"] = result.inserted_id
    return user


def format_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "verified": user.get("verified", False),
        "role": user.get("role", "user"),
        "subscription_plan": user.get("subscription_plan", "free"),
    }
