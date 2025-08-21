#!/bin/bash

# Test Database Setup Script
echo "🗄️ Setting up test database..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo -e "${RED}❌ PostgreSQL is not running. Please start PostgreSQL first.${NC}"
    echo "On macOS with Homebrew: brew services start postgresql"
    echo "On Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-user}
DB_PASSWORD=${DB_PASSWORD:-postgres}
TEST_DB_NAME="test_ws_event_server"

echo -e "${YELLOW}📋 Database Configuration:${NC}"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo "Test Database: $TEST_DB_NAME"

# Function to run SQL command
run_sql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "$1" 2>/dev/null
}

# Check if database exists
if run_sql "SELECT 1 FROM pg_database WHERE datname='$TEST_DB_NAME';" | grep -q "1 row"; then
    echo -e "${YELLOW}⚠️ Test database already exists. Dropping and recreating...${NC}"
    run_sql "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
fi

# Create test database
echo -e "${YELLOW}🔨 Creating test database...${NC}"
if run_sql "CREATE DATABASE $TEST_DB_NAME;"; then
    echo -e "${GREEN}✅ Test database created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create test database${NC}"
    exit 1
fi

# Run migrations on test database
echo -e "${YELLOW}🔄 Running migrations on test database...${NC}"
export DB_NAME=$TEST_DB_NAME

if npm run migration:run; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Failed to run migrations${NC}"
    echo -e "${YELLOW}💡 You may need to generate migrations first:${NC}"
    echo "npm run migration:generate -- src/migrations/TestSetup"
    exit 1
fi

echo -e "${GREEN}🎉 Test database setup complete!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Run tests: npm test"
echo "2. Open test UI: npm run test:ui"
echo "3. Run with coverage: npm run test:coverage"
