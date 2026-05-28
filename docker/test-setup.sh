#!/bin/bash
# Test script to validate Docker setup configuration

set -e

echo "🔍 Validating Docker Setup Configuration..."
echo ""

# Check if docker-compose.yml exists
echo "✓ Checking docker-compose.yml..."
if [ -f "docker-compose.yml" ]; then
    echo "  ✓ docker-compose.yml found"
else
    echo "  ✗ docker-compose.yml not found"
    exit 1
fi

# Check if Dockerfile exists
echo "✓ Checking Dockerfile..."
if [ -f "apps/api/Dockerfile" ]; then
    echo "  ✓ apps/api/Dockerfile found"
else
    echo "  ✗ apps/api/Dockerfile not found"
    exit 1
fi

# Check if init-db scripts exist
echo "✓ Checking database init scripts..."
for script in "01-init-extensions.sql" "02-create-tables.sql" "03-seed-data.sql"; do
    if [ -f "docker/init-db/$script" ]; then
        echo "  ✓ docker/init-db/$script found"
    else
        echo "  ✗ docker/init-db/$script not found"
        exit 1
    fi
done

# Check if .dockerignore exists
echo "✓ Checking .dockerignore..."
if [ -f ".dockerignore" ]; then
    echo "  ✓ .dockerignore found"
else
    echo "  ✗ .dockerignore not found"
    exit 1
fi

echo ""
echo "✅ All configuration files are in place!"
echo ""
echo "📝 Next steps:"
echo "  1. Make sure Docker and Docker Compose are installed"
echo "  2. Run: docker compose up"
echo "  3. Wait for all services to be healthy"
echo "  4. Access API at: http://localhost:3001"
echo ""
echo "🧪 To test manually:"
echo "  • PostgreSQL: docker compose exec postgres psql -U asset_user -d asset_platform"
echo "  • Redis: docker compose exec redis redis-cli"
echo "  • Logs: docker compose logs -f api"
echo ""
echo "🗄️  Demo data:"
echo "  • User: demo@dxaiot.com / demo123"
echo "  • 3 sample assets: ASSET-LAPTOP-001, ASSET-PRINTER-002, ASSET-CHAIR-003"
