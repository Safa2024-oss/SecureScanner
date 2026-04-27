from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URL, DB_NAME
from pymongo import ASCENDING, DESCENDING

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]


# Collections
users_collection = db["users"]
scans_collection = db["scans"]
subscriptions_collection = db["subscriptions"]
usage_collection = db["usage"]
verification_tokens_collection = db["verification_tokens"]
password_reset_tokens = db["password_reset_tokens"]
invoices_collection = db["invoices"]
billing_events_collection = db["billing_events"]
processed_webhook_events_collection = db["processed_webhook_events"]
quote_requests_collection = db["quote_requests"]

async def connect_db():
    try:
        # Ping the database
        await client.admin.command("ping")
        # Ensure core indexes for billing consistency and webhook idempotency
        await subscriptions_collection.create_index([("user_id", ASCENDING)], unique=True)
        await usage_collection.create_index([("user_id", ASCENDING), ("month", ASCENDING)], unique=True)
        await invoices_collection.create_index([("invoice_id", ASCENDING)], unique=True)
        await processed_webhook_events_collection.create_index([("event_id", ASCENDING)], unique=True)
        await billing_events_collection.create_index([("created_at", DESCENDING)])
        await quote_requests_collection.create_index([("created_at", DESCENDING)])
        print("[INFO] Connected to MongoDB")
    except Exception as e:
        print("[ERROR] Failed to connect to MongoDB:", e)
async def close_db():
    client.close()