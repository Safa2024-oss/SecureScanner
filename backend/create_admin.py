"""
Create an admin user in the database.
Usage: python create_admin.py
"""
import asyncio
import bcrypt
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URL, DB_NAME

ADMIN_NAME = "Admin"
ADMIN_EMAIL = "admin@securescan.local"
ADMIN_PASSWORD = "Admin123!"

async def create_admin():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    users = db.users

    # Check if admin already exists
    existing = await users.find_one({"email": ADMIN_EMAIL})
    if existing:
        # Update to admin role if exists
        await users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"role": "admin", "verified": True, "status": "active"}}
        )
        print(f"✅ Updated existing user '{ADMIN_EMAIL}' to admin role.")
        return

    # Hash password
    hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    now = datetime.utcnow()

    user = {
        "name": ADMIN_NAME,
        "email": ADMIN_EMAIL,
        "password": hashed,
        "role": "admin",
        "status": "active",
        "verified": True,
        "verified_at": now,
        "created_at": now,
        "updated_at": now
    }

    result = await users.insert_one(user)
    print(f"✅ Admin user created successfully!")
    print(f"   Email:    {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print(f"   User ID:  {result.inserted_id}")
    print(f"\n🔐 You can now log in at http://localhost:5173/login")

if __name__ == "__main__":
    asyncio.run(create_admin())
