#!/usr/bin/env bash
# DEPRECATED — GitHub Actions SSH is the sole deploy trigger.
# Remove this cron job from hPanel to prevent race conditions with CI deploys.
set -euo pipefail

echo "WARN: hostinger-cron-deploy.sh is deprecated. Remove cron; use GitHub Actions." >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG="$DEPLOY_PATH/backend/storage/logs/cron-deploy.log"

mkdir -p "$(dirname "$LOG")"
touch "$LOG" 2>/dev/null || true

{
  echo "========== $(date '+%Y-%m-%d %H:%M:%S') cron deploy check =========="
  cd "$DEPLOY_PATH"

  if [ -d .git ]; then
    git fetch origin main 2>/dev/null || true
    LOCAL="$(git rev-parse HEAD 2>/dev/null || echo none)"
    REMOTE="$(git rev-parse origin/main 2>/dev/null || echo none)"
    if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "none" ]; then
      echo "Pulling $LOCAL → $REMOTE"
      git pull origin main
    else
      echo "Already up to date ($LOCAL)"
    fi
  fi

  export DEPLOY_PATH
  export SKIP_GIT_PULL=1
  export SKIP_FRONTEND=1
  export SKIP_SERVER_FRONTEND_BUILD=1
  bash "$SCRIPT_DIR/hostinger-hpanel-git-deploy.sh"
} >>"$LOG" 2>&1
