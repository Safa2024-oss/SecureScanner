# 🛡️ SecureScan — AI-Powered Security Vulnerability Scanner

SecureScan is a full-stack web application that performs automated security vulnerability scanning of source code, web applications, and Git repositories. It combines industry-standard scanning tools with a custom machine learning pipeline to detect, classify, and assess the severity of security vulnerabilities.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Scanning Capabilities](#scanning-capabilities)
- [AI/ML Pipeline](#aiml-pipeline)
- [Authentication & Email](#authentication--email)
- [Admin Dashboard](#admin-dashboard)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Notes](#notes)

---

## ✨ Features

- **SAST (Static Application Security Testing)** — Upload source code files or ZIP archives and detect vulnerabilities in Python, JavaScript, TypeScript, Java, PHP, Go, Ruby, C, and C++.
- **DAST (Dynamic Application Security Testing)** — Scan live web applications for XSS, SQL injection, missing security headers, and more by providing a URL.
- **Git Repository Scanning** — Clone and scan public GitHub/GitLab repositories for security issues.
- **AI-Powered Analysis** — Four machine learning models analyze each finding for confidence, vulnerability type, risk level, and predicted severity.
- **PDF Report Generation** — Generate professional, formatted security reports with findings, severity breakdowns, and remediation guidance.
- **User Authentication** — Full registration, login, email verification, password reset, and JWT-based auth.
- **Role-Based Access Control** — Separate user and admin roles with dedicated dashboards.
- **Scan History** — Track all past scans with detailed results and statistics.
- **Admin Dashboard** — Manage users (ban/unban, role changes), view platform-wide statistics, and browse all scans.

---

## 🧰 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.10+** | Backend language |
| **FastAPI** | REST API framework |
| **MongoDB (Motor)** | Async database driver |
| **Pydantic** | Data validation & serialization |
| **python-jose + bcrypt** | JWT tokens & password hashing |
| **Bandit** | Python SAST scanner |
| **Semgrep** | Multi-language SAST scanner |
| **BeautifulSoup4 + requests** | DAST web crawling & testing |
| **GitPython** | Git repository cloning |
| **scikit-learn + joblib** | ML model loading & inference |
| **ReportLab** | PDF report generation |
| **python-dotenv** | Environment variable management |

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **React Router DOM 7** | Client-side routing |
| **Lucide React** | Icon library |
| **Custom CSS** | Styling (no external UI library) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React/Vite)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Login   │ │Dashboard │ │SAST Scan │ │  DAST Scan    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Register │ │ History  │ │ Reports  │ │  Admin Panel  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (JWT Auth)
┌───────────────────────────▼─────────────────────────────────┐
│                     BACKEND (FastAPI)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Routes  │►│Controllers│►│ Services │►│  AI/ML Models │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│         │                                        │          │
│         ▼                                        ▼          │
│  ┌──────────┐                            ┌───────────────┐  │
│  │ MongoDB  │                            │ Bandit/Semgrep│  │
│  └──────────┘                            └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Prerequisites

Before running the application, ensure you have the following installed:

- **Python 3.10+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **MongoDB** — Either:
  - A local MongoDB instance, **or**
  - A MongoDB Atlas cloud connection string (already configured in `.env`)
- **Git** — [git-scm.com](https://git-scm.com/) (required for Git repo scanning)
- **Bandit** — Installed globally: `pip install bandit`
- **Semgrep** — Installed globally: `pip install semgrep`

---

## 🚀 Installation

### 1. Clone the Repository

```bash
cd SecureScanner
```

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install Python dependencies
pip install -r requirements.txt

# Install scanning tools globally
pip install bandit semgrep
```

### 3. Frontend Setup

```bash
cd ../securescan

# Install Node.js dependencies
npm install
```

### 4. Environment Configuration

The backend `.env` file is already configured. Key variables:

```env
MONGODB_URL=mongodb+srv://...
DB_NAME=securescan
SECRET_KEY=s3cur3sc4n_2026_@pfe_s3cr3t_k3y_!x9z
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
MAIL_EMAIL=rouagharib631@gmail.com
MAIL_PASSWORD=xdca fzox jxys dokl
```

> ⚠️ **Security Warning:** The `.env` file contains real credentials. For production use, rotate all secrets and use environment-specific values.

---

## ▶️ Running the Application

You need to run both the backend and frontend servers simultaneously.

### Terminal 1 — Start the Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

Interactive API docs (Swagger UI): `http://localhost:8000/docs`

### Terminal 2 — Start the Frontend

```bash
cd securescan
npm run dev
```

The app will be available at: `http://localhost:5173`

---

## 📁 Project Structure

```
SecureScanner/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── database.py              # MongoDB connection (Motor)
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Environment variables
│   ├── routes/
│   │   ├── auth.py              # Authentication routes
│   │   ├── scan.py              # SAST/DAST/Git scan routes
│   │   ├── history.py           # Scan history & stats
│   │   └── admin.py             # Admin management routes
│   ├── controllers/
│   │   ├── auth_controller.py   # Auth request handling
│   │   └── scan_controller.py   # Scan orchestration
│   ├── services/
│   │   ├── ai_service.py        # ML model pipeline
│   │   ├── auth_service.py      # User CRUD & password hashing
│   │   ├── dast_service.py      # Dynamic web app scanner
│   │   ├── sast_service.py      # Static code scanner (Bandit + Semgrep)
│   │   ├── git_service.py       # Git clone & scan
│   │   ├── report_service.py    # PDF report generation
│   │   ├── email_service.py     # SMTP email sending
│   │   └── token_service.py     # JWT creation & verification
│   └── models/
│       ├── vulnerability_model.pkl   # ML: vulnerability confidence
│       ├── vectorizer.pkl            # ML: text vectorizer
│       ├── msr_vulnerability_model.pkl # ML: vuln type classifier
│       ├── risk_model.pkl            # ML: risk assessment
│       ├── risk_vectorizer.pkl       # ML: risk vectorizer
│       └── severity_model.pkl        # ML: severity prediction
│
├── securescan/
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite configuration
│   ├── index.html               # HTML entry point
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Router & auth state
│       ├── index.css            # Global styles
│       ├── pages/
│       │   ├── Login.jsx        # Login page
│       │   ├── Register.jsx     # Registration page
│       │   ├── Dashboard.jsx    # User dashboard & stats
│       │   ├── SASTScanner.jsx  # Static code scanner UI
│       │   ├── DASTScanner.jsx  # Dynamic scanner UI
│       │   ├── ReportViewer.jsx # PDF report viewer
│       │   ├── Admin.jsx        # Admin dashboard
│       │   ├── VerifyEmail.jsx  # Email verification
│       │   └── ResetPassword.jsx# Password reset
│       └── components/
│           └── Layout.jsx       # App shell layout
```

---

## 🔌 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login & get JWT token |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

### Scanning (`/api/scan`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/scan/sast` | ✅ | Upload files for static analysis |
| POST | `/api/scan/dast` | ✅ | Scan a web app by URL |
| POST | `/api/scan/git` | ✅ | Scan a Git repository |
| POST | `/api/scan/report` | ❌ | Generate PDF report from scan data |

### History (`/api/history`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/history/` | ✅ | Get current user's scan history |
| GET | `/api/history/stats` | ✅ | Get user scan statistics |
| GET | `/api/history/{scan_id}/full` | ✅ | Get full details of a specific scan |

### Admin (`/api/admin`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | 🔒 Admin | Platform-wide statistics |
| GET | `/api/admin/users` | 🔒 Admin | List all users |
| PATCH | `/api/admin/users/{id}` | 🔒 Admin | Update user role/status |
| DELETE | `/api/admin/users/{id}` | 🔒 Admin | Delete user & their scans |
| GET | `/api/admin/scans` | 🔒 Admin | List last 50 scans (all users) |

---

## 🔍 Scanning Capabilities

### SAST — Static Application Security Testing

**Supported Languages:** Python, JavaScript, JSX, TypeScript, TSX, Java, PHP, Go, Ruby, C, C++

**Tools Used:**
- **Bandit** — For Python files only. Detects hardcoded secrets, insecure cryptography, eval/exec usage, SQL injection patterns, and more.
- **Semgrep** — For all other languages. Uses community rules to detect OWASP Top 10 vulnerabilities, insecure patterns, and best practice violations.

**How it works:**
1. Files are uploaded and saved to a temporary directory.
2. The scanner detects the language and runs the appropriate tool.
3. Results are collected and passed through the AI pipeline.
4. Findings are saved to MongoDB with severity breakdowns.

### DAST — Dynamic Application Security Testing

**Tests Performed:**
- **XSS (Cross-Site Scripting)** — Injects `<script>` payloads into form inputs and checks for reflection.
- **SQL Injection** — Tests form inputs with `' OR '1'='1` and checks for SQL error messages.
- **Missing Security Headers** — Checks for Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and HSTS.

**How it works:**
1. The crawler discovers all pages on the target website.
2. Each page is checked for security headers.
3. Forms are extracted and tested with XSS and SQLi payloads.
4. Results are deduplicated and passed through the AI pipeline.

### Git Repository Scanning

**How it works:**
1. The repository is cloned with `--depth=1` (shallow clone for speed).
2. Unnecessary folders (`node_modules`, `.git`, `vendor`, etc.) are cleaned.
3. Large files (>500KB) are removed to speed up scanning.
4. The SAST scanner runs on the cleaned codebase.

---

## 🤖 AI/ML Pipeline

SecureScan includes **4 trained machine learning models** that enhance scan results:

| Model | Purpose | Input | Output |
|---|---|---|---|
| **Vulnerability Model** | Confidence score | Code + description text | Probability (%) that the finding is truly vulnerable |
| **MSR Model** | Vulnerability type classification | Code + description text | Specific CWE/OWASP category |
| **Risk Model** | Risk level assessment | Code + description text | Risk level (Low/Medium/High/Critical) |
| **Severity Model** | Severity prediction | Code + description text | Predicted severity string |

Each vulnerability found is enriched with:
- `confidence` — 0-100 score
- `ai_verdict` — "Confirmed" (≥75%), "Likely" (≥50%), or "Review" (<50%)
- `ai_vuln_type` — ML-predicted vulnerability classification
- `risk_level` — Assessed risk
- `ai_severity` — ML-predicted severity

Fallback rule-based logic is used if any model fails to load.

---

## 🔐 Authentication & Email

- **JWT Tokens** — Issued on login, required for all authenticated routes. Tokens expire after 30 minutes.
- **Password Hashing** — Uses `bcrypt` for secure one-way password hashing.
- **Email Verification** — New accounts receive a verification email with a unique token.
- **Password Reset** — Users can request a password reset link via email.
- **Login Notifications** — Users receive an email notification on each login.

Emails are sent via Gmail SMTP. Templates use inline HTML styling for compatibility.

---

## 👑 Admin Dashboard

Accessible to users with `role: "admin"`. Features include:

- **Platform Statistics** — Total users, scans, vulnerabilities, and top vulnerability types.
- **User Management** — View all users, their scan counts, roles, and status. Promote/demote users, ban/unban accounts, or delete users and all their data.
- **Scan Overview** — Browse the most recent 50 scans across all users.

---

## 🔧 Environment Variables

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string | `mongodb+srv://user:pass@cluster/...` |
| `DB_NAME` | Database name | `securescan` |
| `SECRET_KEY` | JWT signing secret | (any strong string) |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `30` |
| `MAIL_EMAIL` | SMTP sender email | `you@gmail.com` |
| `MAIL_PASSWORD` | SMTP app password | (Gmail app password) |

---

## 🐳 Docker Deployment

The application can be deployed with Docker Compose in a single command. This includes MongoDB, the backend API, and the frontend served via nginx.

### Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url> SecureScanner
cd SecureScanner

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# 3. Build and start all services
docker compose up -d --build

# 4. Access the application
# Frontend: http://localhost
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Create Admin User

```bash
# Create admin user inside the backend container
docker compose exec backend python create_admin.py
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
```

### Stop the Application

```bash
docker compose down

# With volumes (removes MongoDB data — use with caution!)
docker compose down -v
```

### Production Deployment

For production, update the `.env` file with:
- **Real MongoDB credentials** (not the default local one)
- **Strong `SECRET_KEY`** (generate with `openssl rand -hex 32`)
- **Valid Gmail app password** for email notifications

If using MongoDB Atlas (cloud), update `MONGODB_URL` in `.env`:
```env
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/securescan
```

### Docker Architecture

```
┌──────────────────────────────────────────────────────┐
│                   docker-compose.yml                  │
│                                                       │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │ MongoDB  │  │  Backend  │  │    Frontend       │  │
│  │  (mongo) │◄─│ (FastAPI) │◄─│  (nginx + React)  │  │
│  │  :27017  │  │  :8000    │  │       :80         │  │
│  └──────────┘  └───────────┘  └───────────────────┘  │
│       ▲              ▲                                │
│       └── securescan-network ─────────────────────────┘
└──────────────────────────────────────────────────────┘
```

### Docker Best Practices Applied

| Practice | Implementation |
|---|---|
| **Multi-stage builds** | Separate build and production stages to minimize image size |
| **Non-root user** | Backend runs as `securescan` user (not root) |
| **Health checks** | All services have health checks for reliability |
| **Layer caching** | Dependencies copied before source code for faster rebuilds |
| **.dockerignore** | Excludes `node_modules`, `venv`, `.env`, caches |
| **Slim base images** | `python:3.10-slim` and `node:20-alpine` |
| **No cache installs** | `--no-cache-dir` for pip and npm |
| **Nginx for frontend** | Production-grade static file serving with gzip + security headers |
| **Volume persistence** | MongoDB data and scan temp files persisted via Docker volumes |

---

## 📝 Notes

### Important
- **External Tool Dependencies:** The backend relies on `bandit` and `semgrep` being installed and available in the system PATH. Install them with `pip install bandit semgrep`.
- **Git Executable (Windows):** The `git_service.py` hardcodes the Git path for Windows: `C:\\Program Files\\Git\\bin\\git.exe`. If Git is installed elsewhere, update this path.
- **Database:** The project uses MongoDB (not SQL). The `SQLAlchemy` dependency in `requirements.txt` is unused and can be removed.
- **Security:** The `.env` file contains real credentials. **Rotate all secrets before deploying to production.**

### Supported File Extensions for SAST
`.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.java`, `.php`, `.go`, `.rb`, `.c`, `.cpp`, `.zip`

### DAST Limitations
- Only scans pages accessible from the base URL via link crawling.
- Form-based XSS/SQLi testing is limited to detected `<form>` elements.
- SSL verification is disabled for testing purposes (not recommended for production).

---

## 📄 License

This project was developed as part of a PFE (Projet de Fin d'Études / Graduation Project).

---

## 🙏 Credits

**Developed by:** Rouag Harib & Team  
**Project:** SecureScan — AI-Powered Security Vulnerability Scanner  
**Year:** 2026
