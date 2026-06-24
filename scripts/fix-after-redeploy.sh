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
  chmod 600 "$REPO/backend/.env" 2>/dev/null || true
else
  echo "    No backup — creating .env (enter DB password)"
  bash "$SCRIPT_DIR/write-production-env.sh"
fi

cd "$REPO/backend"
[ -f vendor/autoload.php ] || composer install --no-dev --optimize-autoloader --no-interaction

chmod -R 775 storage bootstrap/cache 2>/dev/null || true
mkdir -p storage/logs storage/framework/{cache,sessions,views} 2>/dev/null || true
touch storage/logs/laravel.log 2>/dev/null || true

cd "$REPO"
export SKIP_GIT_PULL=1
bash "$SCRIPT_DIR/deploy-hostinger.sh"

echo ""
echo "DONE — login: admin@deliverex.com / admin123"
