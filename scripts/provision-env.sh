#!/usr/bin/env bash
# Create or restore backend/.env for production (survives hPanel Git redeploy).
# Sources (in order): .deliverex.env backup → .deploy.secrets → existing mysql .env
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BACKEND="$DEPLOY_PATH/backend"
ENV_FILE="$BACKEND/.env"
ENV_BACKUP="$(dirname "$DEPLOY_PATH")/.deliverex.env"
SECRETS_FILE="$(dirname "$DEPLOY_PATH")/.deploy.secrets"

log() { echo "[provision-env] $*"; }

write_env_from_secrets() {
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"

  : "${DB_DATABASE:?DB_DATABASE missing in $SECRETS_FILE}"
  : "${DB_USERNAME:?DB_USERNAME missing in $SECRETS_FILE}"
  : "${DB_PASSWORD:?DB_PASSWORD missing in $SECRETS_FILE}"

  RESEND_API_KEY="${RESEND_API_KEY:-}"

  local app_url="${APP_URL:-https://deliverexapp.com}"
  local domain="${APP_DOMAIN:-deliverexapp.com}"
  local db_pass_env="${DB_PASSWORD//\"/\\\"}"

  cat > "$ENV_FILE" <<EOF
APP_NAME=Deliverex
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=${app_url}

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD="${db_pass_env}"

SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_DOMAIN=${domain}
SESSION_SECURE_COOKIE=true

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=file

MAIL_MAILER=resend
MAIL_FROM_ADDRESS=noreply@deliverexapp.com
MAIL_FROM_NAME=Deliverex
MAIL_ACCOUNTS_ADDRESS=accounts@deliverexapp.com
MAIL_SUPPORT_ADDRESS=deliverexapp@gmail.com
MAIL_QUEUE=false
RESEND_API_KEY=${RESEND_API_KEY:-}
FRONTEND_URL=${app_url}

CORS_ALLOWED_ORIGINS=${app_url}
SANCTUM_STATEFUL_DOMAINS=${domain}
OCR_ENGINE=${OCR_ENGINE:-local}
OCR_SYNC_MODE=true
EOF
}

save_backup() {
  cp "$ENV_FILE" "$ENV_BACKUP"
  chmod 600 "$ENV_BACKUP" 2>/dev/null || true
  log "Backed up to $ENV_BACKUP"
}

is_production_env() {
  [ -f "$ENV_FILE" ] && grep -q '^DB_CONNECTION=mysql' "$ENV_FILE"
}

read_env_var() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

bootstrap_secrets_from_env() {
  [ -f "$SECRETS_FILE" ] && return 0
  is_production_env || return 1
  local db_pass db_name db_user
  db_pass="$(read_env_var DB_PASSWORD)"
  db_name="$(read_env_var DB_DATABASE)"
  db_user="$(read_env_var DB_USERNAME)"
  [ -n "$db_pass" ] && [ -n "$db_name" ] && [ -n "$db_user" ] || return 1
  cat > "$SECRETS_FILE" <<EOF
DB_DATABASE=${db_name}
DB_USERNAME=${db_user}
DB_PASSWORD=${db_pass}
DB_HOST=$(read_env_var DB_HOST)
APP_URL=$(read_env_var APP_URL)
APP_DOMAIN=deliverexapp.com
EOF
  chmod 600 "$SECRETS_FILE" 2>/dev/null || true
  log "Created $SECRETS_FILE from existing .env"
}

mkdir -p "$BACKEND"

bootstrap_secrets_from_env || true

if [ -f "$ENV_BACKUP" ]; then
  log "Restoring from $ENV_BACKUP"
  cp "$ENV_BACKUP" "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
elif [ -f "$SECRETS_FILE" ]; then
  log "Building .env from $SECRETS_FILE"
  write_env_from_secrets
  save_backup
elif is_production_env; then
  log "Keeping existing mysql .env and creating backup"
  save_backup
  bootstrap_secrets_from_env || true
elif [ -f "$ENV_FILE" ] && grep -q '^DB_CONNECTION=sqlite' "$ENV_FILE"; then
  log "ERROR: .env uses sqlite (dev template). Create $SECRETS_FILE first."
  log "  Run once: bash scripts/setup-hostinger-autodeploy.sh"
  exit 1
else
  log "ERROR: No .env backup or secrets file."
  log "  Run once: bash scripts/setup-hostinger-autodeploy.sh"
  log "  Expected: $ENV_BACKUP or $SECRETS_FILE"
  exit 1
fi

if ! grep -q '^DB_CONNECTION=mysql' "$ENV_FILE"; then
  log "ERROR: .env must use DB_CONNECTION=mysql for production"
  exit 1
fi

# Merge Resend/mail settings from .deploy.secrets into restored .env (backup may predate email setup).
if [ -f "$SECRETS_FILE" ]; then
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  merge_env_var() {
    local key="$1"
    local val="$2"
    [ -n "$val" ] || return 0
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" 2>/dev/null || true
      rm -f "$ENV_FILE.bak" 2>/dev/null || true
    else
      echo "${key}=${val}" >>"$ENV_FILE"
    fi
  }
  merge_env_var "MAIL_MAILER" "resend"
  merge_env_var "MAIL_FROM_ADDRESS" "noreply@deliverexapp.com"
  merge_env_var "MAIL_FROM_NAME" "Deliverex"
  merge_env_var "MAIL_ACCOUNTS_ADDRESS" "${MAIL_ACCOUNTS_ADDRESS:-accounts@deliverexapp.com}"
  merge_env_var "MAIL_SUPPORT_ADDRESS" "${MAIL_SUPPORT_ADDRESS:-deliverexapp@gmail.com}"
  merge_env_var "MAIL_QUEUE" "false"
  merge_env_var "FRONTEND_URL" "${APP_URL:-https://deliverexapp.com}"
  if [ -n "${RESEND_API_KEY:-}" ]; then
    merge_env_var "RESEND_API_KEY" "$RESEND_API_KEY"
    log "Merged RESEND_API_KEY from .deploy.secrets into backend/.env"
  else
    log "WARN: RESEND_API_KEY not set in .deploy.secrets — emails will fail until added"
  fi
  save_backup
fi
