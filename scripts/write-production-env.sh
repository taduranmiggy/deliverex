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
OCR_SYNC_MODE=true
EOF

echo "==> Wrote $ENV_FILE (complete production config)"
grep "^DB_\|^APP_\|^CORS\|^SANCTUM\|^CACHE\|^SESSION_DRIVER" "$ENV_FILE" | grep -v PASSWORD
