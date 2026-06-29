#!/usr/bin/env bash
# ONE-TIME Hostinger setup — shared/.env + shared/.deploy.secrets + GitHub SSH deploy checklist.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"
USER_NAME="$(whoami)"
DOMAIN="deliverexapp.com"

echo "============================================"
echo " Deliverex — one-time Hostinger setup"
echo " DEPLOY_PATH=$DEPLOY_PATH"
echo " SHARED_ROOT=$SHARED_ROOT"
echo "============================================"

chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true
mkdir -p "$SHARED_ROOT"

if [ -f "$SHARED_SECRETS" ]; then
  echo "==> $SHARED_SECRETS already exists — skipping prompts"
else
  read -r -p "DB_DATABASE [${USER_NAME}_deliverex]: " DB_DATABASE
  DB_DATABASE="${DB_DATABASE:-${USER_NAME}_deliverex}"
  read -r -p "DB_USERNAME [${USER_NAME}_dbuser]: " DB_USERNAME
  DB_USERNAME="${DB_USERNAME:-${USER_NAME}_dbuser}"
  read -r -s -p "DB_PASSWORD (from hPanel → Databases): " DB_PASSWORD
  echo ""
  if [ -z "$DB_PASSWORD" ]; then echo "ERROR: password required"; exit 1; fi

  read -r -p "RESEND_API_KEY (optional, press Enter to skip): " RESEND_API_KEY

  DEPLOY_HOOK_TOKEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  cat > "$SHARED_SECRETS" <<EOF
# Deliverex production secrets (outside git — survives redeploy)
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=localhost
APP_URL=https://${DOMAIN}
APP_DOMAIN=${DOMAIN}
RESEND_API_KEY=${RESEND_API_KEY}
DEPLOY_HOOK_TOKEN=${DEPLOY_HOOK_TOKEN}
# GitHub PAT with repo + actions:read — server downloads CI artifacts
GITHUB_DEPLOY_TOKEN=
EOF
  chmod 600 "$SHARED_SECRETS"
  echo "==> Wrote $SHARED_SECRETS"
fi

export DEPLOY_PATH
bash "$SCRIPT_DIR/provision-env.sh"
bash "$SCRIPT_DIR/setup-shared-layout.sh"

cd "$DEPLOY_PATH/backend"
if [ ! -f vendor/autoload.php ]; then
  bash "$SCRIPT_DIR/run-composer.sh" "$BACKEND" install --no-dev --optimize-autoloader --no-interaction
fi

if ! grep -q '^APP_KEY=base64:' "$SHARED_ENV" 2>/dev/null; then
  php artisan key:generate --force
  cp "$SHARED_ENV" "$LEGACY_ENV_BACKUP" 2>/dev/null || true
fi

if [ ! -f "$SCRIPT_DIR/.deploy.env" ]; then
  cat > "$SCRIPT_DIR/.deploy.env" <<EOF
DEPLOY_PATH=${DEPLOY_PATH}
VITE_API_URL=https://${DOMAIN}/api
EOF
fi

echo ""
echo "============================================"
echo " GitHub Actions secrets (add once)"
echo "============================================"
echo ""
echo "DEPLOY_HOOK_TOKEN=${DEPLOY_HOOK_TOKEN:-<from shared/.deploy.secrets>}"
echo "APP_URL=https://${DOMAIN}"
echo "VITE_API_URL=https://${DOMAIN}/api"
echo ""
echo "Server shared/.deploy.secrets must also include:"
echo "  GITHUB_DEPLOY_TOKEN=<GitHub PAT with repo + actions:read>"
echo ""
echo "============================================"
echo " hPanel checklist"
echo "============================================"
echo ""
echo "1. Document root: ${DEPLOY_PATH}/backend/public"
echo "2. DISCONNECT hPanel Git repository (stops auto-deploy race)"
echo "3. REMOVE post-deploy script and cron deploy jobs"
echo "4. Upload backend/public/deploy-hook.php if not yet updated"
echo ""
echo "5. hPanel cron (every minute — enables zero-touch deploy without SSH):"
echo "   * * * * * bash ${DEPLOY_PATH}/scripts/process-deploy-queue.sh"
echo ""
echo "6. Verify: bash ${DEPLOY_PATH}/scripts/deployment.sh"
echo "7. Push to main — GitHub Actions builds; cron deploys within ~1–2 minutes"
echo ""
echo "See docs/DEPLOYMENT_ARCHITECTURE.md"
echo "============================================"
