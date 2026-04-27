#!/bin/bash
# ── SecureScan Docker Setup ──────────────────────────────────
# Usage: ./docker-start.sh

set -e

echo "🛡️  SecureScan — Docker Deployment"
echo "===================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration before continuing."
    echo "   Then run: docker compose up -d --build"
    exit 0
fi

# Start services
echo "🚀 Building and starting services..."
docker compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check health
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ SecureScan is running!"
echo ""
echo "  🌐 Frontend:  http://localhost"
echo "  🔌 Backend:   http://localhost:8000"
echo "  📖 API Docs:  http://localhost:8000/docs"
echo ""
echo "  To create an admin user:"
echo "    docker compose exec backend python create_admin.py"
echo ""
echo "  To view logs:"
echo "    docker compose logs -f"
echo ""
echo "  To stop:"
echo "    docker compose down"
