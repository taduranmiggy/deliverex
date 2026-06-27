#!/usr/bin/env bash
# Entry point for GitHub Actions SSH deploy — no server git required.
# CI uploads app-code.tar.gz + frontend-dist.tar.gz, then runs deployment.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
APP_CODE="${APP_CODE:-/tmp/deliverex-deploy/app-code.tar.gz}"
FRONTEND_DIST="${FRONTEND_DIST:-/tmp/deliverex-deploy/frontend-dist.tar.gz}"
DEPLOY_SHA="${DEPLOY_SHA:-unknown}"

mkdir -p /tmp/deliverex-deploy "$DEPLOY_PATH" 2>/dev/null || true
export DEPLOY_PATH
export APP_URL="${APP_URL:-https://deliverexapp.com}"

echo "========== deploy-from-ci started =========="
echo "DEPLOY_PATH=$DEPLOY_PATH"
echo "DEPLOY_SHA=$DEPLOY_SHA"

if [ ! -d "$DEPLOY_PATH" ]; then
  echo "ERROR: DEPLOY_PATH does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

if [ ! -f "$APP_CODE" ]; then
  echo "ERROR: Application tarball missing: $APP_CODE" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

echo "Extracting application code from CI..."
tar -xzf "$APP_CODE" -C "$DEPLOY_PATH"
chmod +x scripts/*.sh deployment.sh 2>/dev/null || true

if [ -f "$FRONTEND_DIST" ]; then
  echo "Extracting frontend build to backend/public ..."
  mkdir -p backend/public/assets
  tar -xzf "$FRONTEND_DIST" -C backend/public/
  rm -f "$FRONTEND_DIST"
  if [ ! -f backend/public/index.html ]; then
    echo "ERROR: frontend index.html missing after extract" >&2
    exit 1
  fi
else
  echo "WARN: No frontend artifact at $FRONTEND_DIST"
fi

rm -f "$APP_CODE"

export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_SERVER_FRONTEND_BUILD=1
export SKIP_ROLLBACK=1
export DEPLOY_PREVIOUS_SHA=none

exec bash "$SCRIPT_DIR/deployment.sh"
