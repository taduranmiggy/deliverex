#!/usr/bin/env bash
# Fix 500 errors + seed demo users. Run on server via SSH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Fix permissions..."
chmod -R u+rwX "$REPO/backend/storage" "$REPO/backend/bootstrap/cache" 2>/dev/null || true
chmod 644 "$REPO/.htaccess" 2>/dev/null || true
bash "$SCRIPT_DIR/fix-public-html.sh" 2>/dev/null || true

cd "$REPO/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "WARN: Created .env — run: bash scripts/fix-mysql-env.sh"
  exit 1
fi

echo "==> Clear caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  php artisan key:generate --force
fi

echo "==> Migrate + seed..."
php artisan migrate --force
php artisan db:seed --force

echo "==> Deploy..."
cd "$REPO"
export SKIP_GIT_PULL=1
bash "$SCRIPT_DIR/deploy-hostinger.sh"

echo ""
echo "DONE — test https://deliverexapp.com/up and login admin@deliverex.com / admin123"
