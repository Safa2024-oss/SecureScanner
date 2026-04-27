from fastapi import APIRouter
from controllers.auth_controller import (
    register, login, forgot_password, reset_password,
    verify_email, resend_verification,
    RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, ResendVerificationRequest
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register")
async def register_route(request: RegisterRequest):
    return await register(request)


@router.post("/login")
async def login_route(request: LoginRequest):
    return await login(request)


@router.get("/verify")
async def verify_email_route(token: str):
    return await verify_email(token)


@router.post("/resend-verification")
async def resend_verification_route(request: ResendVerificationRequest):
    return await resend_verification(request)


@router.post("/forgot-password")
async def forgot_password_route(request: ForgotPasswordRequest):
    return await forgot_password(request)


@router.post("/reset-password")
async def reset_password_route(request: ResetPasswordRequest):
    return await reset_password(request)
