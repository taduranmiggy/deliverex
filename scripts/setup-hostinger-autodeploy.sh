#!/usr/bin/env bash
# ONE-TIME Hostinger setup — creates .deploy.secrets + .deliverex.env, prints hPanel checklist.
# After this, every git push → GitHub build → auto deploy (webhook or cron) with zero SSH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_FILE="$(dirname "$DEPLOY_PATH")/.deploy.secrets"
USER_NAME="$(whoami)"
DOMAIN="deliverexapp.com"

echo "============================================"
echo " Deliverex — one-time Hostinger autodeploy"
echo " DEPLOY_PATH=$DEPLOY_PATH"
echo "============================================"

if [ -f "$SECRETS_FILE" ]; then
  echo "==> $SECRETS_FILE already exists — skipping prompts"
else
  read -r -p "DB_DATABASE [${USER_NAME}_deliverex]: " DB_DATABASE
  DB_DATABASE="${DB_DATABASE:-${USER_NAME}_deliverex}"
  read -r -p "DB_USERNAME [${USER_NAME}_dbuser]: " DB_USERNAME
  DB_USERNAME="${DB_USERNAME:-${USER_NAME}_dbuser}"
  read -r -s -p "DB_PASSWORD (from hPanel → Databases): " DB_PASSWORD
  echo ""
  if [ -z "$DB_PASSWORD" ]; then echo "ERROR: password required"; exit 1; fi

  HOOK_TOKEN="$(openssl rand -hex 24 2>/dev/null || php -r 'echo bin2hex(random_bytes(24));')"
  cat > "$SECRETS_FILE" <<EOF
# Deliverex production secrets (outside git — survives redeploy)
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=localhost
APP_URL=https://${DOMAIN}
APP_DOMAIN=${DOMAIN}
DEPLOY_HOOK_TOKEN=${HOOK_TOKEN}
EOF
  chmod 600 "$SECRETS_FILE"
  echo "==> Wrote $SECRETS_FILE"
  echo ""
  echo "IMPORTANT — add to GitHub → Settings → Secrets → Actions:"
  echo "  DEPLOY_HOOK_TOKEN=${HOOK_TOKEN}"
fi

export DEPLOY_PATH
bash "$SCRIPT_DIR/provision-env.sh"

cd "$DEPLOY_PATH/backend"
if [ ! -f vendor/autoload.php ]; then
  COMPOSER_CMD="$("$SCRIPT_DIR/ensure-composer.sh" "$DEPLOY_PATH/backend" "$DEPLOY_PATH")"
  $COMPOSER_CMD install --no-dev --optimize-autoloader --no-interaction
fi

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  php artisan key:generate --force
  cp .env "$(dirname "$DEPLOY_PATH")/.deliverex.env"
fi

if [ ! -f "$SCRIPT_DIR/.deploy.env" ]; then
  cat > "$SCRIPT_DIR/.deploy.env" <<EOF
DEPLOY_PATH=${DEPLOY_PATH}
VITE_API_URL=https://${DOMAIN}/api
EOF
fi

chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true

echo ""
echo "============================================"
echo " hPanel checklist (copy-paste)"
echo "============================================"
echo ""
echo "1. Git → Repository: github.com/taduranmiggy/deliverex (branch main)"
echo "   Install path: domains/${DOMAIN}/public_html"
echo ""
echo "2. Document root:"
echo "   ${DEPLOY_PATH}/backend/public"
echo ""
echo "3. Post-deployment script:"
echo "   bash ${DEPLOY_PATH}/scripts/hostinger-hpanel-git-deploy.sh"
echo ""
echo "4. Cron job (every 5 min — auto-deploy when GitHub pushes):"
echo "   */5 * * * * bash ${DEPLOY_PATH}/scripts/hostinger-cron-deploy.sh >> ${DEPLOY_PATH}/backend/storage/logs/cron-deploy.log 2>&1"
echo ""
echo "5. GitHub secret DEPLOY_HOOK_TOKEN (if not added yet):"
grep '^DEPLOY_HOOK_TOKEN=' "$SECRETS_FILE" || true
echo ""
echo "6. Run full deploy now:"
echo "   bash ${DEPLOY_PATH}/scripts/hostinger-hpanel-git-deploy.sh"
echo "============================================"
