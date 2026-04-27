from fastapi import HTTPException, status
from pydantic import BaseModel
from services.auth_service import create_user, get_user_by_email, verify_password, format_user
from services.token_service import create_access_token
from services.email_service import send_verification_email, send_login_notification, send_reset_password_email
from database import users_collection, verification_tokens_collection, password_reset_tokens
from datetime import datetime, timedelta
from bson import ObjectId
import secrets


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: str


async def register(request: RegisterRequest):
    user = await create_user(request.name, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Generate and store verification token
    token = secrets.token_urlsafe(32)
    await verification_tokens_collection.insert_one({
        "user_id": str(user["_id"]),
        "token": token,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=24)
    })

    # Send verification email
    send_verification_email(request.email, request.name, token)

    return {"message": "Account created successfully. Please check your email to verify your account."}


async def verify_email(token: str):
    """Verify user email with token."""
    doc = await verification_tokens_collection.find_one({"token": token})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )

    # Idempotent behavior: if the token was already consumed, treat as success.
    if doc.get("used", False):
        return {"message": "Email already verified. You can log in."}

    if datetime.utcnow() > doc["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expired. Please register again."
        )

    # Mark user as verified
    await users_collection.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"verified": True, "verified_at": datetime.utcnow()}}
    )

    # Mark token as consumed (instead of deleting) so repeated requests stay successful.
    await verification_tokens_collection.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.utcnow()}}
    )

    return {"message": "Email verified successfully. You can now log in."}


async def login(request: LoginRequest):
    user = await get_user_by_email(request.email)
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Block unverified users
    if not user.get("verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox or request a new verification link."
        )

    # Check if user is banned
    if user.get("status") == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Contact support."
        )

    token = create_access_token({
        "sub": user["email"],
        "id": str(user["_id"]),
        "role": user.get("role", "user")
    })

    # Send login notification
    send_login_notification(request.email, user["name"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {**format_user(user), "role": user.get("role", "user")},
        "role": user.get("role", "user")
    }


async def forgot_password(request: ForgotPasswordRequest):
    user = await get_user_by_email(request.email)

    # Always return success (security best practice)
    if user:
        token = secrets.token_urlsafe(32)
        await password_reset_tokens.insert_one({
            "user_id": str(user["_id"]),
            "token": token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        })
        send_reset_password_email(request.email, user["name"], token)

    return {"message": "If this email exists, a reset link has been sent."}


async def reset_password(request: ResetPasswordRequest):
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )

    # Validate token
    doc = await password_reset_tokens.find_one({"token": request.token})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )

    if datetime.utcnow() > doc["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expired"
        )

    # Update password
    from services.auth_service import hash_password
    hashed = hash_password(request.new_password)
    await users_collection.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"password": hashed, "updated_at": datetime.utcnow()}}
    )

    # Delete used token
    await password_reset_tokens.delete_one({"token": request.token})

    return {"message": "Password reset successfully. You can now log in."}


async def resend_verification(request: ResendVerificationRequest):
    user = await get_user_by_email(request.email)

    # Always return success (prevent email enumeration)
    if user and not user.get("verified", False):
        # Delete old tokens
        await verification_tokens_collection.delete_many({"user_id": str(user["_id"])})

        # Create new token
        token = secrets.token_urlsafe(32)
        await verification_tokens_collection.insert_one({
            "user_id": str(user["_id"]),
            "token": token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=24)
        })

        send_verification_email(request.email, user["name"], token)

    return {"message": "If this email exists and is unverified, a verification link has been sent."}
