#!/usr/bin/env bash
# Server-side deploy (GitHub Actions, hPanel Git post-deploy, or manual SSH).
#
# Env vars:
#   DEPLOY_PATH     — repo root (auto-detected from script location if unset)
#   SKIP_GIT_PULL=1 — set when hPanel Git already pulled (default: pull)
#   VITE_API_URL    — optional; read from scripts/.deploy.env if present

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
fi

DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
VITE_API_URL="${VITE_API_URL:-https://deliverexapp.com/api}"

if [ ! -d "$DEPLOY_PATH" ]; then
  echo "ERROR: DEPLOY_PATH does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

if [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  echo "==> Pulling latest code..."
  git pull origin main
else
  echo "==> Skipping git pull (hPanel Git / CI already updated files)."
fi

cd backend

echo "==> Installing PHP dependencies..."
if command -v composer >/dev/null 2>&1; then
  composer install --no-dev --optimize-autoloader --no-interaction
elif [ -f "$DEPLOY_PATH/backend/composer.phar" ]; then
  php composer.phar install --no-dev --optimize-autoloader --no-interaction
elif [ -f "$DEPLOY_PATH/composer.phar" ]; then
  php "$DEPLOY_PATH/composer.phar" install --no-dev --optimize-autoloader --no-interaction
else
  echo "ERROR: composer not found. Install via hPanel or place composer.phar in backend/." >&2
  exit 1
fi

ENV_BACKUP="$(dirname "$DEPLOY_PATH")/.deliverex.env"
if [ ! -f .env ] && [ -f "$ENV_BACKUP" ]; then
  echo "==> Restoring .env from backup (wiped by git deploy)..."
  cp "$ENV_BACKUP" .env
  chmod 600 .env 2>/dev/null || true
fi

if [ ! -f .env ]; then
  echo "ERROR: backend/.env missing. Run: bash scripts/write-production-env.sh" >&2
  exit 1
fi

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Seeding (ensures admin exists after redeploy)..."
php artisan db:seed --force 2>/dev/null || true

echo "==> Clearing caches (avoid stale config on shared hosting)..."
php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan view:clear
rm -f bootstrap/cache/config.php bootstrap/cache/routes-v7.php bootstrap/cache/routes.php 2>/dev/null || true

echo "==> Fixing storage permissions..."
chmod -R u+rwX storage bootstrap/cache 2>/dev/null || true

echo "==> Ensuring storage link (shell symlink — exec() disabled on shared hosting)..."
if [ ! -e public/storage ]; then
  ln -sfn ../storage/app/public public/storage 2>/dev/null || true
fi

DIST_DIR="/tmp/deliverex-dist"
PUBLISHED=0

if [ -d "$DIST_DIR" ] && [ -n "$(ls -A "$DIST_DIR" 2>/dev/null)" ]; then
  echo "==> Publishing frontend from $DIST_DIR ..."
  rsync -a --delete "$DIST_DIR/" public/ \
    --exclude index.php \
    --exclude .htaccess
  PUBLISHED=1
fi

if [ "$PUBLISHED" -eq 0 ] && command -v npm >/dev/null 2>&1 && [ -n "${VITE_API_URL:-}" ]; then
  echo "==> Building frontend on server (npm)..."
  cd "$DEPLOY_PATH/frontend"
  npm ci
  VITE_API_URL="$VITE_API_URL" npm run build
  rsync -a --delete dist/ "$DEPLOY_PATH/backend/public/" \
    --exclude index.php \
    --exclude .htaccess
  PUBLISHED=1
  cd "$DEPLOY_PATH/backend"
fi

if [ "$PUBLISHED" -eq 0 ]; then
  echo "WARN: No frontend build published."
  echo "      Use GitHub Actions deploy, or set VITE_API_URL in scripts/.deploy.env and install Node on server,"
  echo "      or upload frontend/dist to /tmp/deliverex-dist before deploy."
fi

echo "==> Deploy complete."
