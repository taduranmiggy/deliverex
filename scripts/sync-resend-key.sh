#!/usr/bin/env bash
# Sync RESEND_API_KEY from .deploy.secrets → backend/.env and refresh Laravel config cache.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BACKEND="$DEPLOY_PATH/backend"

echo "==> Syncing secrets and refreshing config..."
export DEPLOY_PATH
bash "$SCRIPT_DIR/provision-env.sh"
cd "$BACKEND"
php artisan config:clear
php artisan config:cache
echo "==> Done. Run: bash scripts/check-resend-config.sh"