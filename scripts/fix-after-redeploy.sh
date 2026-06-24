#!/usr/bin/env bash
# Run after hPanel Git Redeploy wipes .env
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP="$(dirname "$REPO")/.deliverex.env"

echo "==> Fix after redeploy"

if [ -f "$BACKUP" ]; then
  echo "    Restoring .env from $BACKUP"
  cp "$BACKUP" "$REPO/backend/.env"
else
  echo "    No backup — creating .env (enter DB password)"
  bash "$SCRIPT_DIR/write-production-env.sh"
fi

cd "$REPO/backend"
[ -f vendor/autoload.php ] || composer install --no-dev --optimize-autoloader --no-interaction

php artisan config:clear
grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

cd "$REPO"
export SKIP_GIT_PULL=1
bash "$SCRIPT_DIR/deploy-hostinger.sh" || true

echo ""
echo "DONE — login: admin@deliverex.com / admin123"
