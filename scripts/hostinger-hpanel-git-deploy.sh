#!/usr/bin/env bash
# hPanel Git → Post-deployment script (paste in hPanel):
#   bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/hostinger-hpanel-git-deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
export SKIP_GIT_PULL=1
export SKIP_SERVER_FRONTEND_BUILD=1

exec bash "$SCRIPT_DIR/deployment.sh"
