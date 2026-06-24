#!/usr/bin/env bash
# Run after hPanel Git Redeploy — delegates to deployment.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP="$(dirname "$REPO")/.deliverex.env"

echo "==> Fix after redeploy"

if [ -f "$BACKUP" ]; then
  echo "    Restoring .env from $BACKUP"
  cp "$BACKUP" "$REPO/backend/.env"
  chmod 600 "$REPO/backend/.env" 2>/dev/null || true
else
  echo "    No backup — creating .env (enter DB password)"
  bash "$SCRIPT_DIR/write-production-env.sh"
fi

export DEPLOY_PATH="$REPO"
export SKIP_GIT_PULL=1
export SKIP_SERVER_FRONTEND_BUILD=1
bash "$SCRIPT_DIR/deployment.sh"

echo ""
echo "DONE — login: admin@deliverex.com / admin123"
