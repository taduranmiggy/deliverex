#!/usr/bin/env bash
# Entry point for GitHub Actions SSH deploy — no server git required.
# CI uploads deliverex-deploy.tar.gz (backend + scripts + frontend-dist), then runs deployment.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DEPLOY_BUNDLE="${DEPLOY_BUNDLE:-/tmp/deliverex-deploy/deliverex-deploy.tar.gz}"
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

cd "$DEPLOY_PATH"

if [ -f "$DEPLOY_BUNDLE" ]; then
  echo "Extracting application code from CI bundle..."
  tar -xzf "$DEPLOY_BUNDLE" -C "$DEPLOY_PATH" backend scripts deployment.sh
  chmod +x scripts/*.sh deployment.sh 2>/dev/null || true

  echo "Extracting frontend build to backend/public ..."
  mkdir -p backend/public/assets
  tar -xzf "$DEPLOY_BUNDLE" -C backend/public frontend-dist --strip-components=1
  rm -f "$DEPLOY_BUNDLE"
  if [ ! -f backend/public/index.html ]; then
    echo "ERROR: frontend index.html missing after extract" >&2
    exit 1
  fi
elif [ -f "$APP_CODE" ]; then
  echo "Extracting application code from CI..."
  tar -xzf "$APP_CODE" -C "$DEPLOY_PATH"
  chmod +x scripts/*.sh deployment.sh 2>/dev/null || true
  rm -f "$APP_CODE"

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
else
  echo "ERROR: No deploy bundle at $DEPLOY_BUNDLE (or legacy $APP_CODE)" >&2
  exit 1
fi

export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_SERVER_FRONTEND_BUILD=1
export SKIP_ROLLBACK=1
export DEPLOY_PREVIOUS_SHA=none

exec bash "$SCRIPT_DIR/deployment.sh"
