#!/usr/bin/env bash
# Pull latest code and run deployment (called by deploy-hook.php or manual).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$DEPLOY_PATH"
if [ -d .git ]; then
  git pull origin main
fi

export DEPLOY_PATH
export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_SERVER_FRONTEND_BUILD=1
exec bash "$SCRIPT_DIR/hostinger-hpanel-git-deploy.sh"
