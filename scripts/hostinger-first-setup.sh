#!/usr/bin/env bash
# One-time server setup after hPanel Git clone or manual git clone.
# Run from your PC via SSH, or paste into Hostinger SSH terminal.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  DEPLOY_PATH="${DEPLOY_PATH:-$DEPLOY_PATH}"
fi

echo "==> Deliverex first-time setup"
echo "    DEPLOY_PATH=$DEPLOY_PATH"

cd "$DEPLOY_PATH/backend"

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example..."
  cp .env.example .env
  echo ""
  echo "IMPORTANT: Edit backend/.env now (nano .env) with MySQL + APP_URL, then run this script again."
  echo "  nano $DEPLOY_PATH/backend/.env"
  exit 0
fi

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  echo "==> Generating APP_KEY..."
  php artisan key:generate --force
fi

echo "==> Installing Composer dependencies..."
COMPOSER_CMD="$("$SCRIPT_DIR/ensure-composer.sh" "$DEPLOY_PATH/backend" "$DEPLOY_PATH")"
echo "    Using: $COMPOSER_CMD"
$COMPOSER_CMD install --no-dev --optimize-autoloader --no-interaction

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Storage link..."
if [ ! -e public/storage ]; then
  ln -sfn ../storage/app/public public/storage 2>/dev/null || true
fi

chmod +x "$DEPLOY_PATH/scripts/"*.sh 2>/dev/null || true

if [ ! -f "$SCRIPT_DIR/.deploy.env" ]; then
  echo "==> Creating scripts/.deploy.env for deliverexapp.com..."
  cat > "$SCRIPT_DIR/.deploy.env" <<EOF
DEPLOY_PATH=$DEPLOY_PATH
VITE_API_URL=https://deliverexapp.com/api
EOF
  echo "    Created $SCRIPT_DIR/.deploy.env"
fi

echo ""
echo "==> First-time setup done."
echo "    Set document root in hPanel to: $DEPLOY_PATH/backend/public"
echo "    Then run deploy: bash $SCRIPT_DIR/hostinger-hpanel-git-deploy.sh"
