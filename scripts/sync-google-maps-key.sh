#!/usr/bin/env bash
# Sync GOOGLE_MAPS_API_KEY from shared/.deploy.secrets → shared/.env and refresh Laravel config cache.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BACKEND="$DEPLOY_PATH/backend"

echo "==> Syncing Google Maps API key and refreshing config..."
export DEPLOY_PATH
bash "$SCRIPT_DIR/provision-env.sh"
cd "$BACKEND"
php artisan config:clear
php artisan config:cache
echo "==> Done. Verify: curl -s https://deliverexapp.com/ping.php | grep google_maps"
