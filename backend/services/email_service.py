import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import MAIL_EMAIL, MAIL_PASSWORD, APP_URL

def send_email(to: str, subject: str, html_content: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"SecureScan <{MAIL_EMAIL}>"
        msg["To"] = to

        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(MAIL_EMAIL, MAIL_PASSWORD)
            server.sendmail(MAIL_EMAIL, to, msg.as_string())

        print(f"✅ Email sent to {to}")
        return True
    except Exception as e:
        print(f"❌ Email error: {e}")
        return False


# ── EMAIL TEMPLATES ───────────────────────────────────────

def send_verification_email(to: str, name: str, token: str):
    verify_url = f"{APP_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family: 'DM Sans', sans-serif; max-width: 520px; margin: 0 auto; background: #f7f8fa; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e3e5ea;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px;">
                <span style="font-size: 20px; font-weight: 700; color: #0f1117;">🛡️ SecureScan</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 600; color: #0f1117; margin-bottom: 8px;">Verify your email</h2>
            <p style="color: #4a5060; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
                Hi {name}, welcome to SecureScan! Click the button below to verify your email address and activate your account.
            </p>
            <a href="{verify_url}" style="display: inline-block; background: #1a56db; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; margin-bottom: 24px;">
                Verify Email Address
            </a>
            <p style="color: #8a909e; font-size: 12px; margin-top: 24px; border-top: 1px solid #e3e5ea; padding-top: 16px;">
                This link expires in 24 hours. If you didn't create an account, ignore this email.
            </p>
        </div>
    </div>
    """
    return send_email(to, "Verify your SecureScan account", html)


def send_login_notification(to: str, name: str):
    from datetime import datetime
    time = datetime.now().strftime("%B %d, %Y at %H:%M")
    html = f"""
    <div style="font-family: 'DM Sans', sans-serif; max-width: 520px; margin: 0 auto; background: #f7f8fa; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e3e5ea;">
            <div style="margin-bottom: 28px;">
                <span style="font-size: 20px; font-weight: 700; color: #0f1117;">🛡️ SecureScan</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 600; color: #0f1117; margin-bottom: 8px;">New login detected</h2>
            <p style="color: #4a5060; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                Hi {name}, we detected a new login to your SecureScan account.
            </p>
            <div style="background: #f7f8fa; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e3e5ea;">
                <p style="margin: 0; font-size: 13px; color: #4a5060;">🕐 Time: <strong>{time}</strong></p>
            </div>
            <p style="color: #4a5060; font-size: 13px;">
                If this wasn't you, please change your password immediately.
            </p>
            <p style="color: #8a909e; font-size: 12px; margin-top: 24px; border-top: 1px solid #e3e5ea; padding-top: 16px;">
                This is an automated security notification from SecureScan.
            </p>
        </div>
    </div>
    """
    return send_email(to, "New login to your SecureScan account", html)


def send_reset_password_email(to: str, name: str, token: str):
    reset_url = f"{APP_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: 'DM Sans', sans-serif; max-width: 520px; margin: 0 auto; background: #f7f8fa; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e3e5ea;">
            <div style="margin-bottom: 28px;">
                <span style="font-size: 20px; font-weight: 700; color: #0f1117;">🛡️ SecureScan</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 600; color: #0f1117; margin-bottom: 8px;">Reset your password</h2>
            <p style="color: #4a5060; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
                Hi {name}, we received a request to reset your password. Click the button below to choose a new one.
            </p>
            <a href="{reset_url}" style="display: inline-block; background: #1a56db; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; margin-bottom: 24px;">
                Reset Password
            </a>
            <p style="color: #8a909e; font-size: 12px; margin-top: 24px; border-top: 1px solid #e3e5ea; padding-top: 16px;">
                This link expires in 1 hour. If you didn't request a password reset, ignore this email.
            </p>
        </div>
    </div>
    """
    return send_email(to, "Reset your SecureScan password", html)