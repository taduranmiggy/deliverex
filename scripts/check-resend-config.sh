#!/usr/bin/env bash
# Quick check: is Resend configured in production backend/.env?
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="$DEPLOY_PATH/backend/.env"
SECRETS_FILE="$(dirname "$DEPLOY_PATH")/.deploy.secrets"

normalize_key() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

validate_key() {
  local key="$1"
  local label="$2"
  if [ -z "$key" ]; then
    echo "  $label: MISSING"
    return 1
  fi
  if [[ "$key" != re_* ]]; then
    echo "  $label: INVALID format (must start with re_ — get key from https://resend.com/api-keys)"
    return 1
  fi
  if [ "${#key}" -lt 20 ]; then
    echo "  $label: INVALID (too short — copy the full key from Resend)"
    return 1
  fi
  echo "  $label: OK (starts with re_, length ${#key})"
  return 0
}

echo "========== Resend email config check =========="
echo "backend/.env: $([ -f "$ENV_FILE" ] && echo OK || echo MISSING)"
echo "secrets file: $([ -f "$SECRETS_FILE" ] && echo OK || echo MISSING)"

ENV_KEY=""
SECRETS_KEY=""

if [ -f "$ENV_FILE" ]; then
  echo ""
  echo "--- Mail settings in backend/.env (key hidden) ---"
  grep -E '^(MAIL_MAILER|MAIL_FROM|MAIL_SUPPORT|RESEND_API_KEY|FRONTEND_URL)=' "$ENV_FILE" 2>/dev/null \
    | sed 's/RESEND_API_KEY=.*/RESEND_API_KEY=***hidden***/' \
    | sed 's/RESEND_API_KEY=$/RESEND_API_KEY=***EMPTY***/'
  ENV_KEY="$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  ENV_KEY="$(normalize_key "$ENV_KEY")"
fi

if [ -f "$SECRETS_FILE" ]; then
  SECRETS_KEY="$(grep -E '^RESEND_API_KEY=' "$SECRETS_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  SECRETS_KEY="$(normalize_key "$SECRETS_KEY")"
fi

echo ""
echo "--- API key validation ---"
validate_key "$SECRETS_KEY" ".deploy.secrets" || true
validate_key "$ENV_KEY" "backend/.env" || true

if [ -n "$SECRETS_KEY" ] && [ -n "$ENV_KEY" ] && [ "$SECRETS_KEY" != "$ENV_KEY" ]; then
  echo ""
  echo "WARN: Keys in .deploy.secrets and backend/.env differ — run deploy to sync:"
  echo "  bash scripts/hostinger-hpanel-git-deploy.sh"
fi

if [ -z "$SECRETS_KEY" ]; then
  echo ""
  echo "FIX: Add to $SECRETS_FILE (no quotes):"
  echo "  RESEND_API_KEY=re_your_full_key_from_resend_dashboard"
  echo "Then run: bash scripts/hostinger-hpanel-git-deploy.sh"
fi

echo ""
echo "Note: Gmail password or GitHub secret is NOT a Resend key."
echo "Create one at: https://resend.com/api-keys"
echo "==============================================="
