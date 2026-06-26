#!/usr/bin/env bash
# Quick check: is Resend configured in production backend/.env?
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="$DEPLOY_PATH/backend/.env"
SECRETS_FILE="$(dirname "$DEPLOY_PATH")/.deploy.secrets"

echo "========== Resend email config check =========="
echo "backend/.env: $([ -f "$ENV_FILE" ] && echo OK || echo MISSING)"
echo "secrets file: $([ -f "$SECRETS_FILE" ] && echo OK || echo MISSING)"

if [ -f "$ENV_FILE" ]; then
  echo ""
  echo "--- Mail settings in backend/.env (key hidden) ---"
  grep -E '^(MAIL_MAILER|MAIL_FROM|MAIL_SUPPORT|RESEND_API_KEY|FRONTEND_URL)=' "$ENV_FILE" 2>/dev/null | sed 's/RESEND_API_KEY=.*/RESEND_API_KEY=***set***/' | sed 's/RESEND_API_KEY=$/RESEND_API_KEY=***EMPTY***/'
  if grep -q '^RESEND_API_KEY=$' "$ENV_FILE" 2>/dev/null || ! grep -q '^RESEND_API_KEY=' "$ENV_FILE" 2>/dev/null; then
    echo ""
    echo "FIX: Add RESEND_API_KEY to $SECRETS_FILE then run:"
    echo "  bash scripts/hostinger-hpanel-git-deploy.sh"
  fi
fi

if [ -f "$SECRETS_FILE" ]; then
  echo ""
  if grep -q '^RESEND_API_KEY=' "$SECRETS_FILE" 2>/dev/null; then
    echo "RESEND_API_KEY present in .deploy.secrets"
  else
    echo "RESEND_API_KEY MISSING in .deploy.secrets"
    echo "Add line: RESEND_API_KEY=re_your_key"
  fi
fi

echo "==============================================="
