#!/usr/bin/env bash
# Entry point for GitHub Actions SSH deploy — single deployment path.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
FRONTEND_DIST="${FRONTEND_DIST:-/tmp/deliverex-deploy/frontend-dist.tar.gz}"

mkdir -p /tmp/deliverex-deploy 2>/dev/null || true
export DEPLOY_PATH
export APP_URL="${APP_URL:-https://deliverexapp.com}"

echo "========== deploy-from-ci started =========="
echo "DEPLOY_PATH=$DEPLOY_PATH"
echo "FRONTEND_DIST=$FRONTEND_DIST"

cd "$DEPLOY_PATH"
chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true

# Pull latest code (GitHub Actions is the sole deploy trigger)
if [ -d .git ]; then
  PREVIOUS_SHA="$(git rev-parse HEAD 2>/dev/null || echo none)"
  echo "Previous SHA: ${PREVIOUS_SHA:0:7}"

  git fetch origin main
  git reset --hard origin/main

  NEW_SHA="$(git rev-parse HEAD)"
  echo "Deployed SHA: ${NEW_SHA:0:7}"
else
  echo "ERROR: $DEPLOY_PATH is not a git repository." >&2
  exit 1
fi

# Publish frontend build from CI artifact (never committed to main)
if [ -f "$FRONTEND_DIST" ]; then
  echo "Extracting frontend build to backend/public ..."
  mkdir -p backend/public/assets
  tar -xzf "$FRONTEND_DIST" -C backend/public/
  rm -f "$FRONTEND_DIST"
  if [ ! -f backend/public/index.html ]; then
    echo "ERROR: frontend index.html missing after extract" >&2
    exit 1
  fi
  echo "Frontend assets published."
else
  echo "WARN: No frontend artifact at $FRONTEND_DIST — using existing backend/public"
fi

export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_SERVER_FRONTEND_BUILD=1
export DEPLOY_PREVIOUS_SHA="$PREVIOUS_SHA"

exec bash "$SCRIPT_DIR/deployment.sh"
