#!/usr/bin/env bash
# Fix MySQL credentials on Hostinger and re-run migrate + deploy.
# Usage: bash scripts/fix-mysql-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creating $ENV_FILE from .env.example..."
  cp "$REPO/backend/.env.example" "$ENV_FILE"
fi

echo "============================================"
echo " Fix MySQL — deliverexapp.com"
echo "============================================"
echo ""
echo "Kunin sa hPanel → Databases → MySQL Databases"
echo "(user dapat naka-assign sa database)"
echo ""

read -r -p "DB_DATABASE [u826622735_deliverex]: " DB_NAME
DB_NAME="${DB_NAME:-u826622735_deliverex}"

read -r -p "DB_USERNAME [u826622735_dbuser]: " DB_USER
DB_USER="${DB_USER:-u826622735_dbuser}"

read -r -s -p "DB_PASSWORD: " DB_PASS
echo ""

if [ -z "$DB_PASS" ]; then
  echo "ERROR: Password cannot be empty."
  exit 1
fi

# Remove duplicate/stale DB and sqlite-related lines before appending
grep -v -E '^(#\s*)?DB_(CONNECTION|HOST|PORT|DATABASE|USERNAME|PASSWORD)=' "$ENV_FILE" | \
  grep -v -E '^DB_CONNECTION=sqlite' > "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
{
  echo "DB_CONNECTION=mysql"
  echo "DB_HOST=localhost"
  echo "DB_PORT=3306"
  echo "DB_DATABASE=$DB_NAME"
  echo "DB_USERNAME=$DB_USER"
  echo "DB_PASSWORD=$DB_PASS"
} >> "$ENV_FILE"

# Use file cache/sessions on shared hosting (avoids sqlite default from .env.example)
sed -i.bak 's|^CACHE_STORE=.*|CACHE_STORE=file|' "$ENV_FILE"
sed -i.bak 's|^SESSION_DRIVER=.*|SESSION_DRIVER=file|' "$ENV_FILE"
sed -i.bak 's|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=database|' "$ENV_FILE"
rm -f "$ENV_FILE.bak"
grep -q '^CACHE_STORE=' "$ENV_FILE" || echo 'CACHE_STORE=file' >> "$ENV_FILE"
grep -q '^SESSION_DRIVER=' "$ENV_FILE" || echo 'SESSION_DRIVER=file' >> "$ENV_FILE"

# Production app settings (no manual nano needed)
sed -i.bak "s|^APP_NAME=.*|APP_NAME=Deliverex|" "$ENV_FILE"
sed -i.bak "s|^APP_ENV=.*|APP_ENV=production|" "$ENV_FILE"
sed -i.bak "s|^APP_DEBUG=.*|APP_DEBUG=false|" "$ENV_FILE"
sed -i.bak "s|^APP_URL=.*|APP_URL=https://deliverexapp.com|" "$ENV_FILE"
rm -f "$ENV_FILE.bak"

grep -q '^CORS_ALLOWED_ORIGINS=' "$ENV_FILE" || echo 'CORS_ALLOWED_ORIGINS=https://deliverexapp.com' >> "$ENV_FILE"
grep -q '^SESSION_DOMAIN=' "$ENV_FILE" || echo 'SESSION_DOMAIN=deliverexapp.com' >> "$ENV_FILE"
grep -q '^SANCTUM_STATEFUL_DOMAINS=' "$ENV_FILE" || echo 'SANCTUM_STATEFUL_DOMAINS=deliverexapp.com' >> "$ENV_FILE"
grep -q '^OCR_SYNC_MODE=' "$ENV_FILE" || echo 'OCR_SYNC_MODE=true' >> "$ENV_FILE"

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
