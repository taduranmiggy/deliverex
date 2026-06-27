#!/usr/bin/env bash
# Idempotent: create shared/ persistent dirs and migrate legacy backups.
# Safe on Hostinger shared hosting — no root/sudo required.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

log() { echo "[setup-shared] $*"; }

ensure_dir() {
  mkdir -p "$1"
  chmod 775 "$1" 2>/dev/null || true
}

log "SHARED_ROOT=$SHARED_ROOT"

ensure_dir "$SHARED_ROOT"
ensure_dir "$SHARED_STORAGE/app/private"
ensure_dir "$SHARED_STORAGE/app/public"
ensure_dir "$SHARED_STORAGE/framework/cache/data"
ensure_dir "$SHARED_STORAGE/framework/sessions"
ensure_dir "$SHARED_STORAGE/framework/views"
ensure_dir "$SHARED_STORAGE/framework/testing"
ensure_dir "$SHARED_STORAGE/logs"
ensure_dir "$SHARED_UPLOADS"
ensure_dir "$SHARED_POD"
ensure_dir "$SHARED_OCR"
ensure_dir "$SHARED_STATE"

# Migrate legacy .deliverex.env → shared/.env (once, never overwrite existing shared/.env)
if [ ! -f "$SHARED_ENV" ] && [ -f "$LEGACY_ENV_BACKUP" ]; then
  log "Migrating $LEGACY_ENV_BACKUP → $SHARED_ENV"
  cp "$LEGACY_ENV_BACKUP" "$SHARED_ENV"
  chmod 600 "$SHARED_ENV" 2>/dev/null || true
fi

if [ ! -f "$SHARED_ENV" ] && [ -f "$DEPLOY_PATH/.deliverex.env" ]; then
  log "Migrating $DEPLOY_PATH/.deliverex.env → $SHARED_ENV"
  cp "$DEPLOY_PATH/.deliverex.env" "$SHARED_ENV"
  chmod 600 "$SHARED_ENV" 2>/dev/null || true
fi

# Migrate legacy .deploy.secrets → shared/.deploy.secrets
if [ ! -f "$SHARED_SECRETS" ] && [ -f "$LEGACY_SECRETS" ]; then
  log "Migrating $LEGACY_SECRETS → $SHARED_SECRETS"
  cp "$LEGACY_SECRETS" "$SHARED_SECRETS"
  chmod 600 "$SHARED_SECRETS" 2>/dev/null || true
fi

# Migrate backend/storage → shared/storage (only if storage is a real directory, not symlink)
if [ -d "$BACKEND_STORAGE" ] && [ ! -L "$BACKEND_STORAGE" ]; then
  log "Migrating backend/storage contents → $SHARED_STORAGE"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$BACKEND_STORAGE/" "$SHARED_STORAGE/"
  else
    cp -a "$BACKEND_STORAGE/." "$SHARED_STORAGE/" 2>/dev/null || true
  fi
fi

# POD / uploads / OCR: wire shared dirs into Laravel storage tree
ensure_dir "$SHARED_STORAGE/app/public"

if [ ! -e "$SHARED_STORAGE/app/public/delivery_documents" ]; then
  ln -sfn "$SHARED_POD" "$SHARED_STORAGE/app/public/delivery_documents"
  log "Linked delivery_documents → shared/pod"
fi

if [ ! -e "$SHARED_UPLOADS/.gitkeep" ]; then
  touch "$SHARED_UPLOADS/.gitkeep"
fi

if [ ! -e "$SHARED_OCR/.gitkeep" ]; then
  touch "$SHARED_OCR/.gitkeep"
fi

# Symlink backend/storage → shared/storage
if [ -L "$BACKEND_STORAGE" ]; then
  :
elif [ -d "$BACKEND_STORAGE" ]; then
  rm -rf "$BACKEND_STORAGE"
  ln -sfn "$SHARED_STORAGE" "$BACKEND_STORAGE"
  log "Symlinked backend/storage → shared/storage"
else
  ln -sfn "$SHARED_STORAGE" "$BACKEND_STORAGE"
  log "Created backend/storage → shared/storage"
fi

# Symlink backend/.env → shared/.env (created after provision-env ensures shared/.env exists)
if [ -f "$SHARED_ENV" ]; then
  if [ -f "$BACKEND_ENV" ] && [ ! -L "$BACKEND_ENV" ]; then
    if ! grep -q '^DB_CONNECTION=mysql' "$BACKEND_ENV" 2>/dev/null; then
      rm -f "$BACKEND_ENV"
    else
      log "Preserving existing backend/.env content in shared/.env"
      cp "$BACKEND_ENV" "$SHARED_ENV"
      chmod 600 "$SHARED_ENV" 2>/dev/null || true
      rm -f "$BACKEND_ENV"
    fi
  fi
  ln -sfn "$SHARED_ENV" "$BACKEND_ENV"
  log "Symlinked backend/.env → shared/.env"
fi

touch "$SHARED_STORAGE/logs/laravel.log" 2>/dev/null || true
touch "$SHARED_STORAGE/logs/deploy.log" 2>/dev/null || true
chmod -R u+rwX "$SHARED_STORAGE" "$SHARED_POD" "$SHARED_OCR" "$SHARED_UPLOADS" 2>/dev/null || true

log "Shared layout ready."
