#!/bin/bash

# WorkOS 26 - Data Migration Script
# Usage: ./run-migration.sh <clerk-user-id>

set -e

CLERK_USER_ID=$1

if [ -z "$CLERK_USER_ID" ]; then
  echo "❌ Missing Clerk User ID"
  echo ""
  echo "Usage: ./run-migration.sh <clerk-user-id>"
  echo ""
  echo "To get your Clerk User ID:"
  echo "1. Go to https://workos.moiseskalebbe.cloud and sign in"
  echo "2. Open browser console (F12)"
  echo "3. Run: window.location.href"
  echo "4. The user ID is in the URL like: /user/[clerk-user-id]/..."
  echo ""
  exit 1
fi

echo "🔄 WorkOS 26 - Data Migration"
echo "=============================="
echo "📋 Clerk User ID: $CLERK_USER_ID"
echo ""

# Check if data-export folder exists
if [ ! -d "data-export" ]; then
  echo "❌ data-export folder not found. Please ensure it exists in the same directory."
  exit 1
fi

# Set environment variables for the migration script
export DATABASE_URL="postgresql://workos-user:workos_secure_password_2026@workos-postgres:5432/workos-db"
export MIGRATION_USER_ID="$CLERK_USER_ID"
export NODE_ENV="production"

echo "📦 Starting migration..."

# Run the migration script from inside the workos container
docker exec -it -w /app workos node migrate-data.mjs

echo ""
echo "✅ Migration complete!"
