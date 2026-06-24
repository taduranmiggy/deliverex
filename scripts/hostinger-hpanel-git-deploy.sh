#!/usr/bin/env bash
# Paste this path into Hostinger hPanel → Git → Deployment / Post-deployment script:
#   bash /home/u123456789/domains/yourdomain.com/deliverex/scripts/hostinger-hpanel-git-deploy.sh
#
# hPanel Git already pulled the code — we skip git pull.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
export SKIP_GIT_PULL=1

exec bash "$SCRIPT_DIR/deploy-hostinger.sh"
