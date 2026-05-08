import asyncio
from database import users_collection

async def migrate():
    result = await users_collection.update_many(
        {},
        {"$set": {"organization_id": None, "is_enterprise_owner": False}}
    )
    print(f"Updated {result.modified_count} users")

if __name__ == "__main__":
    asyncio.run(migrate())