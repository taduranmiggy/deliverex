#!/usr/bin/env bash
# Write a complete production .env (not .env.example patches).
# Usage: bash scripts/write-production-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO/backend/.env"

read -r -p "DB_DATABASE [u826622735_deliverex]: " DB_NAME
DB_NAME="${DB_NAME:-u826622735_deliverex}"
read -r -p "DB_USERNAME [u826622735_dbuser]: " DB_USER
DB_USER="${DB_USER:-u826622735_dbuser}"
read -r -s -p "DB_PASSWORD: " DB_PASS
echo ""
if [ -z "$DB_PASS" ]; then echo "ERROR: password required"; exit 1; fi

# Escape double quotes in password for .env
DB_PASS_ENV="${DB_PASS//\"/\\\"}"

existing_env_value() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
  fi
}

OCR_ENGINE="$(existing_env_value OCR_ENGINE)"
OCR_PROVIDER="$(existing_env_value OCR_PROVIDER)"
OCR_ENGINE="${OCR_ENGINE:-local}"
OCR_PROVIDER="${OCR_PROVIDER:-document_ai}"
OCR_REMOTE_URL="$(existing_env_value OCR_REMOTE_URL)"
OCR_REMOTE_TOKEN="$(existing_env_value OCR_REMOTE_TOKEN)"
OCR_REMOTE_TIMEOUT="$(existing_env_value OCR_REMOTE_TIMEOUT)"
OCR_REMOTE_TIMEOUT="${OCR_REMOTE_TIMEOUT:-180}"
GOOGLE_APPLICATION_CREDENTIALS="$(existing_env_value GOOGLE_APPLICATION_CREDENTIALS)"
GOOGLE_CLOUD_PROJECT="$(existing_env_value GOOGLE_CLOUD_PROJECT)"
DOCUMENT_AI_LOCATION="$(existing_env_value DOCUMENT_AI_LOCATION)"
DOCUMENT_AI_PROCESSOR_ID="$(existing_env_value DOCUMENT_AI_PROCESSOR_ID)"
DOCUMENT_AI_TIMEOUT="$(existing_env_value DOCUMENT_AI_TIMEOUT)"
DOCUMENT_AI_RETRIES="${DOCUMENT_AI_RETRIES:-1}"
GOOGLE_MAPS_API_KEY="$(existing_env_value GOOGLE_MAPS_API_KEY)"
OPENROUTESERVICE_API_KEY="$(existing_env_value OPENROUTESERVICE_API_KEY)"
GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-storage/app/google/document-ai.json}"
DOCUMENT_AI_LOCATION="${DOCUMENT_AI_LOCATION:-us}"
DOCUMENT_AI_TIMEOUT="${DOCUMENT_AI_TIMEOUT:-30}"
DOCUMENT_AI_RETRIES="${DOCUMENT_AI_RETRIES:-1}"

cat > "$ENV_FILE" <<EOF
APP_NAME=Deliverex
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://deliverexapp.com

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD="${DB_PASS_ENV}"

SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_DOMAIN=deliverexapp.com

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=file

MAIL_MAILER=log

CORS_ALLOWED_ORIGINS=https://deliverexapp.com
SANCTUM_STATEFUL_DOMAINS=deliverexapp.com
OCR_ENGINE=${OCR_ENGINE}
OCR_PROVIDER=${OCR_PROVIDER}
OCR_REMOTE_URL=${OCR_REMOTE_URL}
OCR_REMOTE_TOKEN=${OCR_REMOTE_TOKEN}
OCR_REMOTE_TIMEOUT=${OCR_REMOTE_TIMEOUT}
OCR_SYNC_MODE=true
GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}
DOCUMENT_AI_LOCATION=${DOCUMENT_AI_LOCATION}
DOCUMENT_AI_PROCESSOR_ID=${DOCUMENT_AI_PROCESSOR_ID}
DOCUMENT_AI_TIMEOUT=${DOCUMENT_AI_TIMEOUT}
DOCUMENT_AI_RETRIES=${DOCUMENT_AI_RETRIES}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
OPENROUTESERVICE_API_KEY=${OPENROUTESERVICE_API_KEY}
EOF

echo "==> Wrote $ENV_FILE (complete production config)"
grep "^DB_\|^APP_\|^CORS\|^SANCTUM\|^CACHE\|^SESSION_DRIVER\|^OCR_" "$ENV_FILE" | grep -v PASSWORD | grep -v TOKEN

# Backup outside git root — survives hPanel Git redeploy (which wipes untracked .env)
BACKUP="$(dirname "$REPO")/.deliverex.env"
cp "$ENV_FILE" "$BACKUP"
chmod 600 "$BACKUP" 2>/dev/null || true
echo "==> Backed up to $BACKUP"
