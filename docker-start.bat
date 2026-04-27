@echo off
REM ── SecureScan Docker Setup (Windows) ──────────────────────
REM Usage: docker-start.bat

echo.
echo ==============================
echo   SecureScan - Docker Deployment
echo ==============================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if .env exists
if not exist .env (
    echo [WARNING] .env file not found. Creating from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env with your configuration before continuing.
    echo Then run: docker compose up -d --build
    pause
    exit /b 0
)

REM Start services
echo [INFO] Building and starting services...
docker compose up -d --build

REM Wait for services to be ready
echo.
echo [INFO] Waiting for services to start...
timeout /t 8 /nobreak >nul

REM Check health
echo.
echo [INFO] Service Status:
docker compose ps

echo.
echo [OK] SecureScan is running!
echo.
echo   Frontend:  http://localhost
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   To create an admin user:
echo     docker compose exec backend python create_admin.py
echo.
echo   To view logs:
echo     docker compose logs -f
echo.
echo   To stop:
echo     docker compose down
echo.
pause
