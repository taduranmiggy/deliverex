#!/usr/bin/env bash
# Ensure shared/.env exists and is symlinked — NEVER overwrite an existing shared/.env.
# Creates shared/.env once from secrets or legacy backup only when missing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

log() { echo "[provision-env] $*"; }

write_env_from_secrets() {
  local secrets_file="$1"
  local target="$2"
  # shellcheck disable=SC1090
  source "$secrets_file"

  : "${DB_DATABASE:?DB_DATABASE missing in $secrets_file}"
  : "${DB_USERNAME:?DB_USERNAME missing in $secrets_file}"
  : "${DB_PASSWORD:?DB_PASSWORD missing in $secrets_file}"

  RESEND_API_KEY="${RESEND_API_KEY:-}"
  RESEND_API_KEY="$(printf '%s' "$RESEND_API_KEY" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"

  local app_url="${APP_URL:-https://deliverexapp.com}"
  local domain="${APP_DOMAIN:-deliverexapp.com}"
  local db_pass_env="${DB_PASSWORD//\"/\\\"}"

  cat > "$target" <<EOF
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
MAIL_SUPPORT_FROM=noreply@deliverexapp.com
MAIL_QUEUE=false
RESEND_API_KEY=${RESEND_API_KEY:-}
FRONTEND_URL=${app_url}

CORS_ALLOWED_ORIGINS=${app_url}
SANCTUM_STATEFUL_DOMAINS=${domain}
OCR_ENGINE=${OCR_ENGINE:-local}
OCR_PROVIDER=${OCR_PROVIDER:-document_ai}
OCR_SYNC_MODE=true
GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-storage/app/google/document-ai.json}
GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT:-}
DOCUMENT_AI_LOCATION=${DOCUMENT_AI_LOCATION:-us}
DOCUMENT_AI_PROCESSOR_ID=${DOCUMENT_AI_PROCESSOR_ID:-}
DOCUMENT_AI_TIMEOUT=${DOCUMENT_AI_TIMEOUT:-30}
DOCUMENT_AI_RETRIES=${DOCUMENT_AI_RETRIES:-1}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY:-}
OPENROUTESERVICE_API_KEY=${OPENROUTESERVICE_API_KEY:-}
EOF
  chmod 600 "$target" 2>/dev/null || true
}

read_env_var() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

merge_secret_keys_into_env() {
  local secrets_file="$1"
  local env_file="$2"
  [ -f "$secrets_file" ] || return 0
  # shellcheck disable=SC1090
  source "$secrets_file"

  merge_env_var() {
    local key="$1"
    local val="$2"
    val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    [ -n "$val" ] || return 0
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${key}=${val}|" "$env_file" 2>/dev/null || true
      rm -f "$env_file.bak" 2>/dev/null || true
    else
      echo "${key}=${val}" >>"$env_file"
    fi
  }

  merge_env_var "MAIL_MAILER" "resend"
  merge_env_var "MAIL_FROM_ADDRESS" "noreply@deliverexapp.com"
  merge_env_var "MAIL_FROM_NAME" "Deliverex"
  merge_env_var "MAIL_ACCOUNTS_ADDRESS" "${MAIL_ACCOUNTS_ADDRESS:-accounts@deliverexapp.com}"
  merge_env_var "MAIL_SUPPORT_ADDRESS" "${MAIL_SUPPORT_ADDRESS:-deliverexapp@gmail.com}"
  merge_env_var "MAIL_SUPPORT_FROM" "${MAIL_SUPPORT_FROM:-noreply@deliverexapp.com}"
  merge_env_var "MAIL_QUEUE" "false"
  merge_env_var "FRONTEND_URL" "${APP_URL:-https://deliverexapp.com}"
  merge_env_var "OCR_PROVIDER" "${OCR_PROVIDER:-document_ai}"
  merge_env_var "GOOGLE_APPLICATION_CREDENTIALS" "${GOOGLE_APPLICATION_CREDENTIALS:-storage/app/google/document-ai.json}"
  merge_env_var "GOOGLE_CLOUD_PROJECT" "${GOOGLE_CLOUD_PROJECT:-}"
  merge_env_var "DOCUMENT_AI_LOCATION" "${DOCUMENT_AI_LOCATION:-us}"
  merge_env_var "DOCUMENT_AI_PROCESSOR_ID" "${DOCUMENT_AI_PROCESSOR_ID:-}"
  merge_env_var "DOCUMENT_AI_TIMEOUT" "${DOCUMENT_AI_TIMEOUT:-30}"
  merge_env_var "DOCUMENT_AI_RETRIES" "${DOCUMENT_AI_RETRIES:-1}"
  if [ -n "${GOOGLE_MAPS_API_KEY:-}" ]; then
    merge_env_var "GOOGLE_MAPS_API_KEY" "$GOOGLE_MAPS_API_KEY"
    log "Merged GOOGLE_MAPS_API_KEY from secrets"
  fi
  if [ -n "${OPENROUTESERVICE_API_KEY:-}" ]; then
    merge_env_var "OPENROUTESERVICE_API_KEY" "$OPENROUTESERVICE_API_KEY"
    log "Merged OPENROUTESERVICE_API_KEY from secrets"
  fi
  if [ -n "${RESEND_API_KEY:-}" ]; then
    merge_env_var "RESEND_API_KEY" "$RESEND_API_KEY"
    log "Merged RESEND_API_KEY from secrets"
  fi
  if [ -n "${PUSHER_APP_KEY:-}" ] && [ -n "${PUSHER_APP_SECRET:-}" ] && [ -n "${PUSHER_APP_ID:-}" ]; then
    merge_env_var "BROADCAST_CONNECTION" "pusher"
    merge_env_var "PUSHER_APP_ID" "$PUSHER_APP_ID"
    merge_env_var "PUSHER_APP_KEY" "$PUSHER_APP_KEY"
    merge_env_var "PUSHER_APP_SECRET" "$PUSHER_APP_SECRET"
    merge_env_var "PUSHER_APP_CLUSTER" "${PUSHER_APP_CLUSTER:-ap1}"
    log "Merged Pusher credentials — BROADCAST_CONNECTION=pusher"
  fi
}

mkdir -p "$SHARED_ROOT" "$BACKEND"

# Resolve secrets file (shared first, legacy fallback)
SECRETS_FILE="$SHARED_SECRETS"
if [ ! -f "$SECRETS_FILE" ] && [ -f "$LEGACY_SECRETS" ]; then
  SECRETS_FILE="$LEGACY_SECRETS"
fi

# Bootstrap secrets from existing env if missing
if [ ! -f "$SHARED_SECRETS" ] && [ -f "$SHARED_ENV" ] && grep -q '^DB_CONNECTION=mysql' "$SHARED_ENV"; then
  db_pass="$(read_env_var "$SHARED_ENV" DB_PASSWORD)"
  db_name="$(read_env_var "$SHARED_ENV" DB_DATABASE)"
  db_user="$(read_env_var "$SHARED_ENV" DB_USERNAME)"
  if [ -n "$db_pass" ] && [ -n "$db_name" ] && [ -n "$db_user" ]; then
    cat > "$SHARED_SECRETS" <<EOF
DB_DATABASE=${db_name}
DB_USERNAME=${db_user}
DB_PASSWORD=${db_pass}
DB_HOST=$(read_env_var "$SHARED_ENV" DB_HOST)
APP_URL=$(read_env_var "$SHARED_ENV" APP_URL)
APP_DOMAIN=deliverexapp.com
EOF
    chmod 600 "$SHARED_SECRETS" 2>/dev/null || true
    log "Created $SHARED_SECRETS from existing shared/.env"
  fi
fi

if [ -f "$SHARED_ENV" ]; then
  log "Using existing $SHARED_ENV (never overwritten)"
  merge_secret_keys_into_env "$SHARED_SECRETS" "$SHARED_ENV"
elif [ -f "$LEGACY_ENV_BACKUP" ]; then
  log "Creating $SHARED_ENV from legacy backup (one-time)"
  cp "$LEGACY_ENV_BACKUP" "$SHARED_ENV"
  chmod 600 "$SHARED_ENV" 2>/dev/null || true
  merge_secret_keys_into_env "$SHARED_SECRETS" "$SHARED_ENV"
elif [ -f "$SECRETS_FILE" ]; then
  log "Creating $SHARED_ENV from secrets (one-time)"
  write_env_from_secrets "$SECRETS_FILE" "$SHARED_ENV"
elif [ -f "$BACKEND_ENV" ] && [ ! -L "$BACKEND_ENV" ] && grep -q '^DB_CONNECTION=mysql' "$BACKEND_ENV"; then
  log "Creating $SHARED_ENV from existing backend/.env (one-time)"
  cp "$BACKEND_ENV" "$SHARED_ENV"
  chmod 600 "$SHARED_ENV" 2>/dev/null || true
else
  log "ERROR: No shared/.env and no secrets to bootstrap from."
  log "  Run once via SSH: bash scripts/setup-hostinger-autodeploy.sh"
  log "  Expected: $SHARED_ENV or $SHARED_SECRETS"
  exit 1
fi

if ! grep -q '^DB_CONNECTION=mysql' "$SHARED_ENV"; then
  log "ERROR: shared/.env must use DB_CONNECTION=mysql for production"
  exit 1
fi

# Ensure backend/.env symlinks to shared/.env
if [ -f "$BACKEND_ENV" ] && [ ! -L "$BACKEND_ENV" ]; then
  rm -f "$BACKEND_ENV"
fi
ln -sfn "$SHARED_ENV" "$BACKEND_ENV"
log "backend/.env → shared/.env"

# Keep legacy backup in sync (non-destructive copy for compatibility)
cp "$SHARED_ENV" "$LEGACY_ENV_BACKUP" 2>/dev/null || true
chmod 600 "$LEGACY_ENV_BACKUP" 2>/dev/null || true
