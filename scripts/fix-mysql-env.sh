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

if [ ! -f vendor/autoload.php ]; then
  echo "==> Installing composer dependencies (vendor/ missing)..."
  composer install --no-dev --optimize-autoloader --no-interaction
fi

echo "==> Clearing config cache..."
php artisan config:clear || { echo "ERROR: php artisan failed — run: composer install"; exit 1; }

if ! grep -q '^APP_KEY=base64:' "$ENV_FILE" 2>/dev/null; then
  echo "==> Generating APP_KEY..."
  php artisan key:generate --force
fi

echo "==> Running migrations..."
php artisan migrate --force -v

echo "==> Seeding demo users if needed (use FORCE_SEED=1 to reset demo records intentionally)..."
bash "$SCRIPT_DIR/seed-if-needed.sh"
php artisan tinker --execute="echo 'users=' . App\Models\User::count();"

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
