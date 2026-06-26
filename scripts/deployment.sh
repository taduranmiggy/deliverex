#!/usr/bin/env bash
# Production deployment for Deliverex on Hostinger (shared hosting or VPS).
#
# Runs automatically via GitHub Actions SSH or hPanel post-deploy hook.
#
# Env:
#   DEPLOY_PATH          — repo root (auto-detected)
#   SKIP_GIT_PULL=1      — skip git pull (hPanel already deployed)
#   SKIP_FRONTEND=1      — skip frontend publish step
#   VITE_API_URL         — optional frontend API URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
fi

DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BACKEND="$DEPLOY_PATH/backend"
ENV_BACKUP="$(dirname "$DEPLOY_PATH")/.deliverex.env"
ENV_BACKUP_ALT="$DEPLOY_PATH/.deliverex.env"
LOG_DIR="$BACKEND/storage/logs"
LOG_FILE="$LOG_DIR/deploy.log"
DEPLOY_STATUS=0

mkdir -p "$LOG_DIR" 2>/dev/null || true
touch "$LOG_FILE" 2>/dev/null || true

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line"
  echo "$line" >>"$LOG_FILE" 2>/dev/null || true
}

log_error() {
  log "ERROR: $*"
}

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    log_error "Deployment failed (exit $code). See $LOG_FILE"
    if [ -f "$BACKEND/storage/logs/laravel.log" ]; then
      log "Last 10 lines of laravel.log:"
      tail -10 "$BACKEND/storage/logs/laravel.log" >>"$LOG_FILE" 2>/dev/null || true
    fi
  else
    log "Deployment finished successfully."
  fi
  exit "$code"
}
trap on_exit EXIT

log "========== Deliverex deployment started =========="
log "DEPLOY_PATH=$DEPLOY_PATH"

if [ ! -d "$DEPLOY_PATH" ]; then
  log_error "DEPLOY_PATH does not exist: $DEPLOY_PATH"
  exit 1
fi

cd "$DEPLOY_PATH"

chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true

if [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  log "Pulling latest code from origin/main..."
  git pull origin main
else
  log "Skipping git pull (already updated by hPanel Git / CI)."
fi

log "Provisioning backend/.env..."
export DEPLOY_PATH
bash "$SCRIPT_DIR/provision-env.sh"

cd "$BACKEND"

log "Installing PHP dependencies (composer install --no-dev)..."
COMPOSER_CMD="$(bash "$SCRIPT_DIR/ensure-composer.sh" "$BACKEND" "$DEPLOY_PATH")"
log "Using: $COMPOSER_CMD"
if ! $COMPOSER_CMD install --no-dev --optimize-autoloader --no-interaction; then
  log_error "composer install failed"
  exit 1
fi
if [ ! -f vendor/autoload.php ]; then
  log_error "vendor/autoload.php missing after composer install"
  exit 1
fi

if ! grep -q '^APP_KEY=base64:' .env; then
  log "Generating APP_KEY..."
  php artisan key:generate --force
  cp .env "$ENV_BACKUP" 2>/dev/null || true
  chmod 600 "$ENV_BACKUP" 2>/dev/null || true
fi

php artisan config:clear
bash "$SCRIPT_DIR/verify-db.sh"

log "Running migrations (php artisan migrate --force)..."
php artisan migrate --force

log "Checking whether database seed is needed..."
bash "$SCRIPT_DIR/seed-if-needed.sh"

log "Clearing caches (php artisan optimize:clear)..."
php artisan optimize:clear

log "Caching config and routes..."
php artisan config:cache
php artisan route:cache

log "Fixing storage permissions..."
chmod -R u+rwX storage bootstrap/cache 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true
mkdir -p storage/framework/{cache,sessions,views} storage/logs 2>/dev/null || true
mkdir -p storage/app/public/delivery_documents 2>/dev/null || true
touch storage/logs/laravel.log 2>/dev/null || true

log "Linking public/storage -> storage/app/public (Hostinger-safe)..."
# Always recreate — broken symlinks break uploads and OCR previews.
rm -f public/storage 2>/dev/null || true
ln -sfn ../storage/app/public public/storage 2>/dev/null || true
if [ -L public/storage ] && [ -d storage/app/public ]; then
  log "storage link OK: public/storage"
else
  log_error "Could not create public/storage symlink — check permissions on backend/public"
fi

if [ "${SKIP_FRONTEND:-0}" != "1" ]; then
  export VITE_API_URL="${VITE_API_URL:-https://deliverexapp.com/api}"
  bash "$SCRIPT_DIR/build-frontend.sh"
  if [ ! -f public/index.html ]; then
    log_error "backend/public/index.html missing after frontend publish."
    exit 1
  fi
fi

log "Verifying admin account exists..."
php artisan tinker --execute="echo App\Models\User::where('email','admin@deliverex.com')->exists() ? 'admin_ok' : 'admin_missing';" 2>&1 | tail -1 >>"$LOG_FILE" || true

log "========== Deliverex deployment complete =========="
