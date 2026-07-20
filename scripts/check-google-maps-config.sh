#!/usr/bin/env bash
# Verify GOOGLE_MAPS_API_KEY is present in shared secrets and backend/.env.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

read_key() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

echo "==> Google Maps configuration"
echo "shared/.env:     $SHARED_ENV"
echo "shared secrets:  $SHARED_SECRETS"
echo "backend/.env:    $BACKEND_ENV"

SECRETS_KEY=""
ENV_KEY=""
if [ -f "$SHARED_SECRETS" ]; then
  SECRETS_KEY="$(read_key "$SHARED_SECRETS" GOOGLE_MAPS_API_KEY || true)"
fi
if [ -f "$SHARED_ENV" ]; then
  ENV_KEY="$(read_key "$SHARED_ENV" GOOGLE_MAPS_API_KEY || true)"
fi

if [ -n "$SECRETS_KEY" ]; then
  echo "GOOGLE_MAPS_API_KEY in .deploy.secrets: yes (${#SECRETS_KEY} chars)"
else
  echo "GOOGLE_MAPS_API_KEY in .deploy.secrets: MISSING"
fi

if [ -n "$ENV_KEY" ]; then
  echo "GOOGLE_MAPS_API_KEY in shared/.env: yes (${#ENV_KEY} chars)"
else
  echo "GOOGLE_MAPS_API_KEY in shared/.env: MISSING"
fi

if [ -n "$SECRETS_KEY" ] && [ -z "$ENV_KEY" ]; then
  echo ""
  echo "Run: bash scripts/sync-google-maps-key.sh"
  exit 1
fi

if [ -z "$ENV_KEY" ]; then
  echo ""
  echo "Add to shared/.deploy.secrets:"
  echo "  GOOGLE_MAPS_API_KEY=your_key_here"
  echo "Then run: bash scripts/sync-google-maps-key.sh"
  exit 1
fi

echo "OK"
