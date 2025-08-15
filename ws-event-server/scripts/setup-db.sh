#!/bin/bash

# Database setup script for Session Replay Server

echo "🗄️  Setting up PostgreSQL database for Session Replay Server..."

# Default values
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-session_replay}
DB_USER=${DB_USER:-postgres}

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

# Create database if it doesn't exist
echo "📊 Creating database '$DB_NAME' if it doesn't exist..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database '$DB_NAME' already exists or couldn't be created."

echo "✅ Database setup complete!"
echo ""
echo "💡 Next steps:"
echo "1. Copy .env.example to .env and configure your database settings"
echo "2. Run 'npm run dev' to start the development server"
echo "3. The server will automatically create the required tables on first run"
