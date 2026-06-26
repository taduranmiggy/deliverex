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
LOG_DIR="$DEPLOY_PATH/backend/storage/logs"
LOG_FILE="${LOG_FILE:-$DEPLOY_PATH/deploy.log}"
DEPLOY_STATUS=0

mkdir -p "$LOG_DIR" "$DEPLOY_PATH" 2>/dev/null || true
if [ -d "$LOG_DIR" ]; then
  LOG_FILE="$LOG_DIR/deploy.log"
fi
touch "$LOG_FILE" 2>/dev/null || true

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line"
  echo "$line" >>"$LOG_FILE" 2>/dev/null || true
}

log_error() {
  log "ERROR: $*"
}

wait_for_backend_ready() {
  local max_wait="${DEPLOY_WAIT_SECS:-90}"
  local elapsed=0
  log "Waiting for backend files (composer.json) — hPanel Git may still be syncing..."
  while [ "$elapsed" -lt "$max_wait" ]; do
    if [ -f "$BACKEND/composer.json" ] && [ -f "$BACKEND/artisan" ]; then
      log "Backend ready after ${elapsed}s."
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    log "  still waiting... (${elapsed}s / ${max_wait}s)"
  done
  log_error "Backend not ready after ${max_wait}s — expected $BACKEND/composer.json"
  log "DEPLOY_PATH listing:"
  ls -la "$DEPLOY_PATH" >>"$LOG_FILE" 2>&1 || true
  return 1
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

wait_for_backend_ready

log "Provisioning backend/.env..."
export DEPLOY_PATH
bash "$SCRIPT_DIR/provision-env.sh"

if [ ! -f "$BACKEND/composer.json" ]; then
  log_error "Backend directory missing or incomplete: $BACKEND"
  exit 1
fi

ARTISAN=(php "$BACKEND/artisan")

chmod +x "$SCRIPT_DIR/run-composer.sh" 2>/dev/null || true

sync_composer_lock_if_needed() {
  if grep -q '"resend/resend-php"' "$BACKEND/composer.json" \
    && ! grep -q '"name": "resend/resend-php"' "$BACKEND/composer.lock"; then
    log "composer.lock missing resend/resend-php — updating lock file on server..."
    bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" update resend/resend-php \
      --no-dev --no-interaction --with-all-dependencies \
      || bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" require resend/resend-php \
        --no-dev --no-interaction --update-with-all-dependencies
  fi
}

sync_composer_lock_if_needed

log "Installing PHP dependencies (composer install --no-dev)..."
if ! bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --optimize-autoloader --no-interaction; then
  log "composer install failed (optimize) — retrying without optimize-autoloader..."
  if ! bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --no-interaction; then
    log "composer install failed — attempting lock sync for resend/resend-php..."
    sync_composer_lock_if_needed
    if ! bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --no-interaction; then
      log_error "composer install failed"
      exit 1
    fi
  fi
  bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" dump-autoload --no-interaction || log "dump-autoload skipped (non-fatal)"
fi
if [ ! -f "$BACKEND/vendor/autoload.php" ]; then
  log_error "vendor/autoload.php missing after composer install"
  exit 1
fi

if [ ! -d "$BACKEND/vendor/resend/resend-php" ]; then
  log "Installing resend/resend-php for email transport..."
  bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" require resend/resend-php --no-dev --no-interaction --update-with-all-dependencies \
    || log "WARN: resend/resend-php install failed — check RESEND_API_KEY and composer network"
fi

if ! grep -q '^APP_KEY=base64:' "$BACKEND/.env"; then
  log "Generating APP_KEY..."
  "${ARTISAN[@]}" key:generate --force
  cp "$BACKEND/.env" "$ENV_BACKUP" 2>/dev/null || true
  chmod 600 "$ENV_BACKUP" 2>/dev/null || true
fi

"${ARTISAN[@]}" config:clear
export BACKEND_DIR="$BACKEND"
bash "$SCRIPT_DIR/verify-db.sh"

log "Running migrations (php artisan migrate --force)..."
"${ARTISAN[@]}" migrate --force

log "Checking whether database seed is needed..."
export BACKEND_DIR="$BACKEND"
bash "$SCRIPT_DIR/seed-if-needed.sh"

log "Clearing caches (php artisan optimize:clear)..."
"${ARTISAN[@]}" optimize:clear

log "Caching config and routes..."
"${ARTISAN[@]}" config:cache
"${ARTISAN[@]}" route:cache

log "Fixing storage permissions..."
chmod -R u+rwX "$BACKEND/storage" "$BACKEND/bootstrap/cache" 2>/dev/null || true
chmod -R 775 "$BACKEND/storage" "$BACKEND/bootstrap/cache" 2>/dev/null || true
mkdir -p "$BACKEND/storage/framework/"{cache,sessions,views} "$BACKEND/storage/logs" 2>/dev/null || true
mkdir -p "$BACKEND/storage/app/public/delivery_documents" 2>/dev/null || true
touch "$BACKEND/storage/logs/laravel.log" 2>/dev/null || true

log "Linking public/storage -> storage/app/public (Hostinger-safe)..."
rm -f "$BACKEND/public/storage" 2>/dev/null || true
ln -sfn ../storage/app/public "$BACKEND/public/storage" 2>/dev/null || true
if [ -L "$BACKEND/public/storage" ] && [ -d "$BACKEND/storage/app/public" ]; then
  log "storage link OK: public/storage"
else
  log_error "Could not create public/storage symlink — check permissions on backend/public"
fi

if [ "${SKIP_FRONTEND:-0}" != "1" ]; then
  export VITE_API_URL="${VITE_API_URL:-https://deliverexapp.com/api}"
  bash "$SCRIPT_DIR/build-frontend.sh"
  if [ ! -f "$BACKEND/public/index.html" ]; then
    log_error "backend/public/index.html missing after frontend publish."
    exit 1
  fi
fi

log "Verifying admin account exists..."
"${ARTISAN[@]}" tinker --execute="echo App\Models\User::where('email','admin@deliverex.com')->exists() ? 'admin_ok' : 'admin_missing';" 2>&1 | tail -1 >>"$LOG_FILE" || true

log "========== Deliverex deployment complete =========="
