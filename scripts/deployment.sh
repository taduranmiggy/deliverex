#!/usr/bin/env bash
# Production deployment for Deliverex on Hostinger shared hosting.
# Invoked exclusively by GitHub Actions SSH (scripts/deploy-from-ci.sh).
#
# Env:
#   DEPLOY_PATH            — repo root (auto-detected)
#   SKIP_GIT_PULL=1        — skip git pull (CI already updated code)
#   SKIP_FRONTEND=1        — skip frontend build (CI uploads assets)
#   SKIP_HEALTH_CHECK=1    — skip post-deploy health gate
#   SKIP_ROLLBACK=1        — skip automatic rollback on failure
#   DEPLOY_PREVIOUS_SHA    — commit to restore on failure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
fi

LOG_FILE="${LOG_FILE:-$SHARED_STORAGE/logs/deploy.log}"
DEPLOY_PREVIOUS_SHA="${DEPLOY_PREVIOUS_SHA:-none}"

mkdir -p "$SHARED_STORAGE/logs" 2>/dev/null || true
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
    if [ -f "$SHARED_STORAGE/logs/laravel.log" ]; then
      tail -10 "$SHARED_STORAGE/logs/laravel.log" >>"$LOG_FILE" 2>/dev/null || true
    fi
  else
    log "Deployment finished successfully."
  fi
  exit "$code"
}
trap on_exit EXIT

run_deploy_steps() {
  log "========== Deliverex deployment started =========="
  log "DEPLOY_PATH=$DEPLOY_PATH"
  log "SHARED_ROOT=$SHARED_ROOT"

  if [ ! -d "$DEPLOY_PATH" ]; then
    log_error "DEPLOY_PATH does not exist: $DEPLOY_PATH"
    return 1
  fi

  cd "$DEPLOY_PATH"
  chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true

  if [ "${SKIP_GIT_PULL:-0}" != "1" ] && [ -d .git ]; then
    log "Pulling latest code from origin/main..."
    git fetch origin main
    git reset --hard origin/main
  elif [ "${SKIP_GIT_PULL:-0}" != "1" ] && [ ! -d .git ]; then
    log "No .git on server — expecting code from CI tarball (OK)."
  else
    log "Skipping git pull (already updated by CI)."
  fi

  if [ ! -f "$BACKEND/composer.json" ] || [ ! -f "$BACKEND/artisan" ]; then
    log_error "Backend missing: $BACKEND"
    return 1
  fi

  log "Setting up shared persistent layout..."
  bash "$SCRIPT_DIR/setup-shared-layout.sh"

  log "Provisioning environment..."
  export DEPLOY_PATH
  bash "$SCRIPT_DIR/provision-env.sh"

  bash "$SCRIPT_DIR/setup-shared-layout.sh"

  if [ ! -f "$BACKEND/.env" ]; then
    log_error "backend/.env missing after provision"
    return 1
  fi

  ARTISAN=(php "$BACKEND/artisan")
  chmod +x "$SCRIPT_DIR/run-composer.sh" 2>/dev/null || true

  sync_composer_lock_if_needed() {
    if grep -q '"resend/resend-php"' "$BACKEND/composer.json" \
      && ! grep -q '"name": "resend/resend-php"' "$BACKEND/composer.lock"; then
      log "composer.lock missing resend/resend-php — updating lock file..."
      bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" update resend/resend-php \
        --no-dev --no-interaction --with-all-dependencies \
        || bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" require resend/resend-php \
          --no-dev --no-interaction --update-with-all-dependencies
    fi
  }

  sync_composer_lock_if_needed

  log "Installing PHP dependencies (composer install --no-dev --optimize-autoloader)..."
  if ! bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --optimize-autoloader --no-interaction; then
    log "composer install failed (optimize) — retrying without optimize-autoloader..."
    if ! bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --no-interaction; then
      sync_composer_lock_if_needed
      if ! bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --no-interaction; then
        log_error "composer install failed"
        return 1
      fi
    fi
    bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" dump-autoload --no-interaction || true
  fi

  if [ ! -f "$BACKEND/vendor/autoload.php" ]; then
    log_error "vendor/autoload.php missing after composer install"
    return 1
  fi

  if ! grep -q '^APP_KEY=base64:' "$BACKEND/.env"; then
    log "Generating APP_KEY..."
    "${ARTISAN[@]}" key:generate --force
    cp "$SHARED_ENV" "$LEGACY_ENV_BACKUP" 2>/dev/null || true
  fi

  log "Clearing config cache before DB verify..."
  "${ARTISAN[@]}" config:clear

  export BACKEND_DIR="$BACKEND"
  bash "$SCRIPT_DIR/verify-db.sh"

  log "Running migrations (php artisan migrate --force)..."
  "${ARTISAN[@]}" migrate --force

  log "Checking whether database seed is needed..."
  bash "$SCRIPT_DIR/seed-if-needed.sh"

  log "Clearing caches (php artisan optimize:clear)..."
  "${ARTISAN[@]}" optimize:clear

  log "Caching config, routes, and views..."
  "${ARTISAN[@]}" config:cache
  "${ARTISAN[@]}" route:cache
  "${ARTISAN[@]}" view:cache

  log "Fixing storage permissions..."
  chmod -R u+rwX "$SHARED_STORAGE" "$BACKEND/bootstrap/cache" 2>/dev/null || true
  chmod -R 775 "$SHARED_STORAGE" "$BACKEND/bootstrap/cache" 2>/dev/null || true
  mkdir -p "$SHARED_STORAGE/framework/"{cache/data,sessions,views} "$SHARED_STORAGE/logs" 2>/dev/null || true
  mkdir -p "$SHARED_POD" 2>/dev/null || true
  touch "$SHARED_STORAGE/logs/laravel.log" 2>/dev/null || true

  log "Linking public storage..."
  bash "$SCRIPT_DIR/link-storage.sh"

  if [ ! -L "$BACKEND/public/storage" ] && [ ! -d "$BACKEND/public/storage" ]; then
    log_error "public/storage link missing after link-storage.sh"
    return 1
  fi

  log "Restarting queue workers (php artisan queue:restart)..."
  "${ARTISAN[@]}" queue:restart || true

  if [ "${SKIP_FRONTEND:-0}" != "1" ]; then
    export VITE_API_URL="${VITE_API_URL:-https://deliverexapp.com/api}"
    bash "$SCRIPT_DIR/build-frontend.sh"
    if [ ! -f "$BACKEND/public/index.html" ]; then
      log_error "backend/public/index.html missing after frontend publish."
      return 1
    fi
  elif [ ! -f "$BACKEND/public/index.html" ]; then
    log_error "backend/public/index.html missing — CI should upload frontend assets."
    return 1
  fi

  CURRENT_SHA="$(git rev-parse HEAD 2>/dev/null || echo "${DEPLOY_SHA:-unknown}")"
  echo "$DEPLOY_PREVIOUS_SHA" >"$SHARED_STATE/previous-sha" 2>/dev/null || true
  echo "$CURRENT_SHA" >"$SHARED_STATE/current-sha" 2>/dev/null || true

  log "Deployed commit: ${CURRENT_SHA:0:7}"
  log "========== Deliverex deployment complete =========="
  return 0
}

if run_deploy_steps; then
  if [ "${SKIP_HEALTH_CHECK:-0}" != "1" ]; then
    APP_URL="${APP_URL:-https://deliverexapp.com}"
    log "Running post-deploy health check..."
    if ! bash "$SCRIPT_DIR/health-check.sh" "$APP_URL"; then
      log_error "Health check failed after deploy"
      if [ "${SKIP_ROLLBACK:-0}" != "1" ] && [ "$DEPLOY_PREVIOUS_SHA" != "none" ]; then
        log "Attempting rollback to ${DEPLOY_PREVIOUS_SHA:0:7}..."
        bash "$SCRIPT_DIR/rollback.sh" "$DEPLOY_PREVIOUS_SHA" || true
      fi
      exit 1
    fi
  fi
else
  if [ "${SKIP_ROLLBACK:-0}" != "1" ] && [ "$DEPLOY_PREVIOUS_SHA" != "none" ]; then
    log "Deploy steps failed — rolling back to ${DEPLOY_PREVIOUS_SHA:0:7}..."
    bash "$SCRIPT_DIR/rollback.sh" "$DEPLOY_PREVIOUS_SHA" || true
  fi
  exit 1
fi
