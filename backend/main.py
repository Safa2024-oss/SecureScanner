import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import connect_db, close_db
from routes.auth import router as auth_router
from routes.scan import router as scan_router
from routes.history import router as history_router
from routes.admin import router as admin_router
from routes.payments import router as payments_router
from services.payment_service import handle_webhook
from config import APP_URL
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SecureScan API",
    description="Security vulnerability scanning platform with SAST, DAST, and AI-powered analysis",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Parse allowed origins from config
parsed = urlparse(APP_URL)
origins = [
    APP_URL,
    f"http://{parsed.hostname}:5173",
    f"http://{parsed.hostname}:5174",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    # Add production domains as needed
    "https://securescan.com",
    "https://app.securescan.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Stripe-Signature"],
    expose_headers=["X-Total-Count", "X-Rate-Limit-Remaining"],
)


@app.on_event("startup")
async def startup():
    """Initialize database connection on startup"""
    logger.info("Starting SecureScan API...")
    await connect_db()
    logger.info("Database connection established")


@app.on_event("shutdown")
async def shutdown():
    """Close database connection on shutdown"""
    logger.info("Shutting down SecureScan API...")
    await close_db()
    logger.info("Database connection closed")


# Include all routers
app.include_router(auth_router)
app.include_router(scan_router)
app.include_router(history_router)
app.include_router(admin_router)
app.include_router(payments_router)


@app.get("/")
def root():
    """Root endpoint - API information"""
    return {
        "name": "SecureScan API",
        "version": "2.0.0",
        "description": "Security vulnerability scanning platform",
        "docs": "/api/docs",
        "status": "operational",
        "endpoints": {
            "auth": "/api/auth",
            "scan": "/api/scan",
            "history": "/api/history",
            "admin": "/api/admin",
            "payments": "/api/payments"
        }
    }


@app.get("/health")
def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "SecureScan API",
        "version": "2.0.0",
        "timestamp": __import__("datetime").datetime.utcnow().isoformat()
    }


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint for handling payment events.
    This endpoint is called by Stripe when subscription events occur.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    logger.info("Received Stripe webhook event")
    
    try:
        success, message = await handle_webhook(payload, sig_header)
        if success:
            logger.info("Webhook processed successfully: %s", message)
            return {"status": "success", "message": message}

        logger.warning("Webhook processing failed: %s", message)
        raise HTTPException(status_code=400, detail=message)
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/version")
def get_version():
    """Get API version information"""
    return {
        "api_version": "2.0.0",
        "features": [
            "SAST scanning",
            "DAST scanning",
            "Git repository scanning",
            "AI-powered analysis",
            "PDF report generation",
            "User authentication",
            "Email verification",
            "Password reset",
            "Admin dashboard",
            "Payment integration (Stripe)",
            "Usage-based pricing"
        ]
    }


# Optional: Add rate limiting middleware (requires slowapi)
# from slowapi import Limiter, _rate_limit_exceeded_handler
# from slowapi.util import get_remote_address
# from slowapi.errors import RateLimitExceeded
# 
# limiter = Limiter(key_func=get_remote_address)
# app.state.limiter = limiter
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )