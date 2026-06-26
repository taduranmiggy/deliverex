#!/usr/bin/env bash
# Install backend/vendor/ on Hostinger when ping.php shows vendor=no.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$DEPLOY_PATH/backend"

echo "==> Fix vendor (Deliverex)"
echo "    DEPLOY_PATH=$DEPLOY_PATH"

cd "$BACKEND"

COMPOSER_CMD="$("$SCRIPT_DIR/ensure-composer.sh" "$BACKEND" "$DEPLOY_PATH")"
echo "==> Using: $COMPOSER_CMD"
$COMPOSER_CMD install --no-dev --optimize-autoloader --no-interaction

if [ -f vendor/autoload.php ]; then
  echo "==> vendor OK"
  php artisan config:clear 2>/dev/null || true
  php artisan config:cache 2>/dev/null || true
else
  echo "ERROR: vendor/autoload.php still missing after composer install" >&2
  exit 1
fi

echo ""
echo "Check: https://deliverexapp.com/ping.php (vendor=yes)"
