#!/usr/bin/env bash
# Sync PUSHER_* from shared/.deploy.secrets → shared/.env and refresh config cache.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

bash "$SCRIPT_DIR/provision-env.sh"

cd "$BACKEND"
php artisan config:clear
php artisan config:cache

echo "Pusher sync done. BROADCAST_CONNECTION=$(grep -E '^BROADCAST_CONNECTION=' "$SHARED_ENV" | cut -d= -f2-)"
grep -E '^PUSHER_APP_(ID|KEY|CLUSTER)=' "$SHARED_ENV" | sed 's/=.*/=***/' || true
