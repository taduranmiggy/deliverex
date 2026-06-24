#!/usr/bin/env bash
# Fix MySQL credentials on Hostinger and re-run migrate + deploy.
# Usage: bash scripts/fix-mysql-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Will create fresh $ENV_FILE"
fi

echo "============================================"
echo " Fix MySQL — deliverexapp.com"
echo "============================================"
echo ""

bash "$SCRIPT_DIR/write-production-env.sh"

DB_NAME="$(grep '^DB_DATABASE=' "$ENV_FILE" | cut -d= -f2-)"
DB_USER="$(grep '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2-)"
DB_PASS="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"

echo ""
echo "==> Testing MySQL connection..."
if command -v mysql >/dev/null 2>&1; then
  if ! mysql -h localhost -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1" >/dev/null 2>&1; then
    echo "ERROR: MySQL rejected credentials."
    echo "       hPanel → Databases → check user is assigned to database + reset password."
    exit 1
  fi
  echo "    MySQL OK"
else
  echo "    (mysql CLI not found — skipping direct test)"
fi

cd "$REPO/backend"
php artisan config:clear

if ! grep -q '^APP_KEY=base64:' "$ENV_FILE" 2>/dev/null; then
  echo "==> Generating APP_KEY..."
  php artisan key:generate --force
fi

echo "==> Running migrations..."
if ! php artisan migrate --force; then
  echo ""
  echo "ERROR: migrate failed. Check hPanel database user permissions."
  exit 1
fi

echo "==> Seeding demo users (admin@deliverex.com / admin123)..."
php artisan db:seed --force

echo "==> Deploy..."
cd "$REPO"
export SKIP_GIT_PULL=1
bash "$SCRIPT_DIR/deploy-hostinger.sh"

# Do NOT config:cache after deploy — shared hosting reads .env directly

echo ""
echo "============================================"
echo " DONE! Test: https://deliverexapp.com/up"
echo " Login: admin@deliverex.com / admin123"
echo "============================================"
