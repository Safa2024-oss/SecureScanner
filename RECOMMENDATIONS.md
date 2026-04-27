# 🔮 SecureScan — Enhancement Roadmap

Three focused tracks to transform this project into a production-ready, professional security platform.

---

# Track 1: 📐 Code Organization & Best Practices

## 1.1 Backend Restructure

### Current Problem
Services contain business logic + external tool calls + ML inference all mixed together. Controllers thin-pass through to services. No clear separation of concerns.

### Target Structure
```
backend/
├── main.py
├── database.py
├── config.py                 # NEW: centralized env var loading
├── dependencies.py            # NEW: shared FastAPI dependencies
├── core/
│   ├── security.py            # JWT, password hashing, rate limiting
│   ├── email.py               # SMTP setup + templates
│   └── exceptions.py          # Custom exception classes
├── models/
│   ├── user.py                # Pydantic schemas for request/response
│   ├── scan.py
│   └── token.py
├── repositories/
│   ├── user_repo.py           # All MongoDB user queries
│   └── scan_repo.py           # All MongoDB scan queries
├── services/
│   ├── auth_service.py        # Business logic only
│   ├── scan_service.py        # Unified scan orchestration
│   ├── sast_engine.py         # Bandit/Semgrep execution
│   ├── dast_engine.py         # DAST crawling + testing
│   ├── git_engine.py          # Clone + scan logic
│   ├── ml_analyzer.py         # ML model loading + inference
│   ├── report_generator.py    # PDF/JSON/CSV export
│   └── notification_service.py # Email + future webhooks
├── routes/
│   ├── auth.py
│   ├── scan.py
│   ├── history.py
│   └── admin.py
└── middleware/
    ├── auth.py                # get_current_user, get_admin_user
    └── rate_limiter.py        # Rate limiting middleware
```

### Actions
- [ ] Create `config.py` — load all env vars once at startup (no repeated `load_dotenv()` + `os.getenv()` calls scattered everywhere)
- [ ] Create `middleware/auth.py` — extract `get_current_user` and `get_admin_user` (currently duplicated in 3 route files)
- [ ] Create `repositories/` layer — isolate all MongoDB queries from business logic
- [ ] Split `sast_service.py` → `sast_engine.py` (tool execution) + `scan_service.py` (orchestration)
- [ ] Split `ai_service.py` → `ml_analyzer.py` (clean ML layer with proper error handling)
- [ ] Remove `SQLAlchemy` from `requirements.txt` (unused — project uses MongoDB)
- [ ] Add `__init__.py` files to all packages

---

## 1.2 Code Quality Fixes

### Error Handling
**Problem:** Bare `except:` clauses swallow all errors silently in `dast_service.py`, `git_service.py`, `sast_service.py`.

**Fix:**
```python
# Before (BAD)
except:
    continue

# After (GOOD)
import logging
logger = logging.getLogger(__name__)

except Exception as e:
    logger.warning(f"DAST crawl failed for {url}: {e}")
    continue
```

### Async/Await Correctness
**Problem:** Scan endpoints are `async def` but call entirely synchronous blocking functions (`run_scan`, `run_dast_scan`, `analyze_vulnerabilities`). This blocks the event loop and freezes the server under concurrent load.

**Fix:**
```python
# In scan_controller.py — run blocking code in thread pool
import asyncio

async def sast_scan(files, user_id):
    result = await asyncio.to_thread(_run_sast_sync, files, user_id)
    return result
```

Or make scan endpoints synchronous (`def` not `async def`) — FastAPI auto-runs them in a threadpool.

### Input Validation
**Problem:** File uploads trust the client `filename` directly. Malicious paths like `../../etc/crontab` could cause issues.

**Fix:**
```python
from pathlib import Path

filename = Path(file.filename).name  # strips directory traversal
if not filename.isalnum() and '.' not in filename:
    raise HTTPException(400, "Invalid filename")
```

### Zip Slip Fix
**Problem:** `extract_zip()` doesn't validate ZIP member paths.

**Fix:**
```python
import zipfile
from pathlib import Path

def extract_zip(zip_path: str, extract_to: str):
    extract_path = Path(extract_to).resolve()
    with zipfile.ZipFile(zip_path, 'r') as z:
        for member in z.namelist():
            member_path = (extract_path / member).resolve()
            if not str(member_path).startswith(str(extract_path)):
                raise ValueError(f"Zip-slip attack detected: {member}")
        z.extractall(extract_path)
```

### Configurable Git Path
**Problem:** Hardcoded `C:\Program Files\Git\bin\git.exe` in `git_service.py`.

**Fix:**
```python
import os
os.environ.setdefault('GIT_PYTHON_GIT_EXECUTABLE', os.getenv('GIT_EXECUTABLE', 'git'))
```

---

## 1.3 Security Hardening

### Rate Limiting
**Add `slowapi`:**
```python
# requirements.txt
slowapi==0.1.9

# main.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# middleware/rate_limiter.py
from slowapi import _rate_limit_exceeded_handler

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Too many requests"})
```

Apply limits:
- `POST /api/auth/login` — 5 per minute per IP
- `POST /api/auth/register` — 3 per minute per IP
- `POST /api/auth/forgot-password` — 2 per minute per IP
- `POST /api/scan/*` — 10 per minute per user

### CORS Tightening
**Before:**
```python
allow_methods=["*"],
allow_headers=["*"],
```

**After:**
```python
allow_methods=["GET", "POST", "PATCH", "DELETE"],
allow_headers=["Authorization", "Content-Type"],
```

### Exposed Credentials
- [ ] Add `.env` to `.gitignore`
- [ ] Create `.env.example` with placeholder values
- [ ] Rotate ALL exposed secrets (MongoDB password, Gmail app password, JWT secret)

---

## 1.4 Pagination & Performance

### Add Pagination to All List Endpoints
```python
# routes/history.py
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
```

### Fix Admin Stats with Aggregation
**Current:** Iterates ALL scans twice in Python — will be extremely slow.

**Fix:**
```python
@router.get("/stats")
async def get_stats(admin=Depends(get_admin_user)):
    pipeline = [
        {"$group": {
            "_id": None,
            "total_scans": {"$sum": 1},
            "total_vulns": {"$sum": "$results.total"},
            "critical": {"$sum": "$results.critical"},
            "high": {"$sum": "$results.high"}
        }}
    ]
    stats = await db.scans.aggregate(pipeline).to_list(1)
    # Single query, computed by MongoDB
```

---

# Track 2: ✉️ Email Confirmation & Auth Hardening

## 2.1 Store Verification Tokens in Database

### Create Tokens Collection
```python
# database.py — add new collections
verification_tokens_collection = db["verification_tokens"]
password_reset_tokens = db["password_reset_tokens"]
```

### Updated Registration Flow
```python
# controllers/auth_controller.py
import secrets
from datetime import datetime, timedelta
from database import verification_tokens_collection

async def register(request: RegisterRequest):
    user = await create_user(request.name, request.email, request.password)
    if not user:
        raise HTTPException(400, "Email already registered")

    # Generate and store verification token
    token = secrets.token_urlsafe(32)
    await verification_tokens_collection.insert_one({
        "user_id": str(user["_id"]),
        "token": token,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=24)
    })

    # Send verification email with token
    send_verification_email(request.email, request.name, token)

    return {"message": "Account created. Check your email to verify."}
```

## 2.2 Add Verification Endpoint

### Backend Route
```python
# routes/auth.py — add new endpoint
@router.get("/verify")
async def verify_email(token: str):
    # Find token
    doc = await verification_tokens_collection.find_one({"token": token})
    if not doc:
        raise HTTPException(400, "Invalid verification token")

    # Check expiry
    if datetime.utcnow() > doc["expires_at"]:
        raise HTTPException(400, "Token expired. Please register again.")

    # Mark user as verified
    await db.users.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"verified": True, "verified_at": datetime.utcnow()}}
    )

    # Delete used token
    await verification_tokens_collection.delete_one({"token": token})

    return {"message": "Email verified successfully. You can now log in."}
```

## 2.3 Block Login for Unverified Users

```python
# controllers/auth_controller.py — update login function
async def login(request: LoginRequest):
    user = await get_user_by_email(request.email)
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")

    # Block unverified users
    if not user.get("verified", False):
        raise HTTPException(
            403,
            "Email not verified. Please check your inbox or request a new verification link."
        )

    token = create_access_token({...})
    ...
```

## 2.4 Add Resend Verification Email Endpoint

```python
# routes/auth.py
class ResendVerificationRequest(BaseModel):
    email: str

@router.post("/resend-verification")
async def resend_verification(request: ResendVerificationRequest):
    user = await get_user_by_email(request.email)
    if not user:
        return {"message": "If this email exists, a verification link has been sent."}

    if user.get("verified", False):
        return {"message": "Email already verified."}

    # Delete old token
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
    return {"message": "Verification email sent."}
```

## 2.5 Fix Password Reset

### Store Reset Tokens in DB
```python
# controllers/auth_controller.py
from database import password_reset_tokens

async def forgot_password(request: ForgotPasswordRequest):
    user = await get_user_by_email(request.email)
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
        raise HTTPException(400, "Password must be at least 8 characters")

    # Validate token
    doc = await password_reset_tokens.find_one({"token": request.token})
    if not doc:
        raise HTTPException(400, "Invalid reset token")

    if datetime.utcnow() > doc["expires_at"]:
        raise HTTPException(400, "Token expired")

    # Update password
    hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"password": hashed}}
    )

    # Delete used token
    await password_reset_tokens.delete_one({"token": request.token})

    return {"message": "Password reset successfully."}
```

## 2.6 Update User Model

```python
# Updated user document structure
{
    "_id": ObjectId,
    "name": str,
    "email": str,
    "password": str (hashed),
    "role": str ("user" | "admin"),       # default: "user"
    "status": str ("active" | "banned"),  # default: "active"
    "verified": bool,                      # default: false
    "verified_at": datetime | null,
    "created_at": datetime,
    "updated_at": datetime
}
```

Update `create_user` to include defaults:
```python
async def create_user(name: str, email: str, password: str):
    hashed = hash_password(password)
    now = datetime.utcnow()
    user = {
        "name": name,
        "email": email,
        "password": hashed,
        "role": "user",
        "status": "active",
        "verified": False,
        "created_at": now,
        "updated_at": now
    }
    result = await users_collection.insert_one(user)
    user["_id"] = result.inserted_id
    return user
```

---

## 2.7 Frontend — Email Verification Flow

### VerifyEmail.jsx
```jsx
import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) return setStatus('missing')

    fetch(`http://127.0.0.1:8000/api/auth/verify?token=${token}`)
      .then(res => res.ok ? setStatus('success') : res.json().then(d => setStatus(d.detail)))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: 'white', padding: '48px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: '420px' }}>
        {status === 'loading' && <p>Verifying your email...</p>}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Email Verified!</h2>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>Your account is now active. You can log in.</p>
            <Link to="/login" style={{ display: 'inline-block', background: '#1a56db', color: 'white', padding: '12px 32px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500 }}>
              Go to Login
            </Link>
          </>
        )}
        {status === 'missing' && <p>No verification token found.</p>}
        {(status === 'error' || status === 'expired' || status === 'Invalid verification token') && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ color: '#b91c1c' }}>Verification Failed</h2>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>{status}</p>
            <Link to="/register" style={{ display: 'inline-block', background: '#1a56db', color: 'white', padding: '12px 32px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500 }}>
              Back to Register
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
```

### Add Resend Verification to Login Page
```jsx
// Add to Login.jsx — below the login form
{showUnverified && (
  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginTop: '16px' }}>
    <p style={{ color: '#92400e', fontSize: '13px', margin: 0 }}>
      Email not verified. <button onClick={resendVerification} style={{ color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Resend verification email</button>
    </p>
  </div>
)}
```

---

# Track 3: 🎨 UI/UX Enhancement

## 3.1 Design System

### Color Palette
```css
:root {
  /* Primary */
  --primary-50:  #eef2ff;
  --primary-100: #e0e7ff;
  --primary-500: #6366f1;
  --primary-600: #4f46e5;
  --primary-700: #4338ca;

  /* Neutrals */
  --gray-50:  #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;

  /* Semantic */
  --danger:  #dc2626;
  --warning: #f59e0b;
  --success: #16a34a;
  --info:    #2563eb;

  /* Background */
  --bg-app:    #f0f2f5;
  --bg-card:   #ffffff;
  --bg-sidebar: #111827;

  /* Spacing */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.12);
}
```

### Typography
```css
/* Import in index.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

body {
  font-family: 'Inter', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

## 3.2 Layout & Navigation Redesign

### Modern Sidebar
- Gradient dark background (`linear-gradient(180deg, #111827 0%, #1f2937 100%)`)
- Active indicator: left border accent + highlight
- User avatar + name at bottom
- Logo with icon + clean typography (fix "StackSafe" → "SecureScan")
- Smooth hover transitions
- Collapse to hamburger on mobile (< 768px)

### Top Header Bar
- Page title + breadcrumb
- Search bar (for scan history)
- Notification bell (with badge)
- User dropdown menu (Profile, Settings, Logout)

---

## 3.3 Dashboard Redesign

### Stats Cards (Top Row)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Total Scans  │ │   Vulns Found │ │   Critical   │ │  Security    │
│     142       │ │     1,847      │ │      23       │ │   Score: 72  │
│  ↑ 12% this mo │ │  ↓ 8% vs last  │ │  ↓ 2 vs last  │ │  ↗ +5 pts    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```
- Each card: icon, number, trend indicator, change percentage
- Color-coded borders (danger for critical, success for score)

### Security Score Widget
- Circular progress ring (0-100)
- Color gradient: red → yellow → green
- Trend line sparkline showing last 7 scans

### Recent Scans Table
- Status badges (completed/failed/scanning) with colored dots
- Severity badges (Critical/High/Medium/Low) with distinct colors
- Hover row: quick actions (View Report, Re-scan, Delete)
- Click row → detailed scan view

### Vulnerability Distribution Chart
- Horizontal bar chart showing Critical/High/Medium/Low breakdown
- Animated on page load

---

## 3.4 Scanner Pages Redesign

### File Upload Area
- Drag & drop zone with dashed border + icon animation
- Accept multiple files + ZIP
- Show file list with size, language detection icon
- Progress indicator during upload (real, not fake)

### Scan Configuration Panel
- Scan type selector (SAST / DAST / Git)
- Sensitivity slider (Quick scan → Deep scan)
- Rule filters: toggle categories (SQLi, XSS, Auth, Crypto, etc.)
- Exclude patterns input

### Results Display
- Summary header with total findings, severity breakdown
- Filter bar: search by type, filter by severity, filter by file
- Each finding as an expandable card:
  - Header: severity badge + type + file:line
  - Code snippet with syntax highlighting
  - Description + fix recommendation
  - AI confidence meter (visual bar)
  - Actions: Mark as false positive, Create issue, Copy code

### Loading State
- Replace fake progress bar with:
  - Skeleton screens for results area
  - Animated dots: "Scanning files..." → "Running AI analysis..." → "Generating report..."
  - Estimated time remaining

---

## 3.5 Replace All `alert()` Calls

### Create Toast Component
```jsx
// components/Toast.jsx
import { createContext, useContext, useState } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => removeToast(t.id)} style={{
            background: t.type === 'error' ? '#dc2626' : t.type === 'success' ? '#16a34a' : '#2563eb',
            color: 'white', padding: '12px 20px', borderRadius: '8px',
            marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer', animation: 'slideIn 0.3s ease', maxWidth: '360px',
            fontSize: '14px', fontWeight: 500
          }}>
            {t.type === 'error' && '❌ '}{t.type === 'success' && '✅ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

Usage:
```jsx
const { addToast } = useToast()

// Replace: alert('Scan failed')
addToast('Scan failed. Please try again.', 'error')

// Replace: alert('Success!')
addToast('Scan completed successfully!', 'success')
```

---

## 3.6 Login & Register Pages Redesign

### Split Layout
- Left panel: gradient background with illustration + value propositions
  - "AI-Powered Security Scanning"
  - "Detect vulnerabilities in Python, JS, Java & more"
  - "Generate professional PDF reports"
- Right panel: clean form with smooth inputs

### Form Improvements
- Show/hide password toggle
- Password strength meter (weak → strong)
- Real-time validation feedback
- Social login placeholders (Google, GitHub)
- "Remember me" checkbox
- Smooth focus states with ring outline

### Unverified User Flow
After login attempt with unverified email:
- Show yellow banner: "Email not verified"
- Button: "Resend verification email"
- Link: "Change email address"

---

## 3.7 Admin Dashboard Redesign

### Overview Cards
- Total users, Total scans, Total vulns, Active threats
- Line chart: scans over last 30 days
- Pie chart: vulnerability type distribution

### Users Table
- Avatar + name, email, role badge, status badge
- Scan count sparkline
- Actions: Promote/Demote, Ban/Unban, Delete (with confirmation modal)
- Search + filter by role/status

### Recent Scans Feed
- Latest scans across all users
- Username link, scan type badge, severity breakdown
- Click to view full details

---

## 3.8 Mobile Responsive Design

### Breakpoints
```css
/* Mobile */
@media (max-width: 640px) {
  /* Stack all cards vertically */
  /* Collapse sidebar to hamburger menu */
  /* Tables → card list layout */
}

/* Tablet */
@media (max-width: 1024px) {
  /* 2-column grid for stats cards */
  /* Narrower sidebar */
}

/* Desktop */
@media (min-width: 1025px) {
  /* Full layout */
}
```

### Mobile Sidebar
- Hamburger icon toggle
- Slide-in from left with backdrop overlay
- Close on route change or backdrop click

---

## 3.9 Animations & Micro-interactions

### CSS Animations
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.card { animation: fadeIn 0.4s ease; }
.toast { animation: slideIn 0.3s ease; }
.scanning { animation: pulse 1.5s infinite; }
```

### Hover Effects
- Cards: subtle lift (`transform: translateY(-2px)`, shadow increase)
- Buttons: scale + color shift
- Table rows: background tint
- Nav items: left border accent + text highlight

---

## 3.10 Accessibility

- [ ] Add `aria-label` to all icon-only buttons
- [ ] Ensure color contrast meets WCAG AA (4.5:1)
- [ ] Add `tabIndex` and keyboard handlers to clickable table rows
- [ ] Form inputs with associated `<label>` elements
- [ ] Focus visible outline for keyboard navigation
- [ ] Loading spinners with `aria-busy` and `role="status"`
- [ ] Error messages with `aria-live="polite"`

---

# 📋 Implementation Order

## Phase 1: Foundation (Week 1)
1. ✅ Fix email verification (backend + frontend)
2. ✅ Fix password reset with token validation
3. ✅ Extract shared auth middleware
4. ✅ Fix zip-slip vulnerability
5. ✅ Add `.env` to `.gitignore` + create `.env.example`
6. ✅ Fix branding ("StackSafe" → "SecureScan")

## Phase 2: Code Quality (Week 2)
7. ✅ Replace bare `except:` with proper logging
8. ✅ Fix async scan endpoints (thread pool)
9. ✅ Add pagination to all list endpoints
10. ✅ Fix admin stats with MongoDB aggregation
11. ✅ Add rate limiting with slowapi
12. ✅ Remove unused SQLAlchemy dependency

## Phase 3: UI/UX Overhaul (Week 3)
13. ✅ Create design system (CSS variables, typography)
14. ✅ Redesign sidebar + top header bar
15. ✅ Redesign dashboard with score + trend cards
16. ✅ Redesign scanner pages (drag & drop, real progress)
17. ✅ Replace all `alert()` with toast notifications
18. ✅ Redesign login/register with split layout
19. ✅ Add mobile responsive breakpoints
20. ✅ Add animations and hover effects

## Phase 4: Polish (Week 4)
21. ✅ Add toast notification system globally
22. ✅ Redesign admin dashboard with charts
23. ✅ Add accessibility improvements
24. ✅ Add loading skeletons and empty states
25. ✅ Fix critical count bug in report download
26. ✅ Add user settings page
