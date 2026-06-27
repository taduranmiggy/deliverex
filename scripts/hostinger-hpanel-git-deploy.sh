#!/usr/bin/env bash
# DEPRECATED — deploys are handled by GitHub Actions SSH (see docs/DEPLOYMENT_ARCHITECTURE.md).
# Disable hPanel Auto Deployment and post-deploy/cron hooks to avoid race conditions.
# Kept for emergency manual recovery only.
set -euo pipefail

echo "WARN: hostinger-hpanel-git-deploy.sh is deprecated. Use GitHub Actions SSH deploy." >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_SERVER_FRONTEND_BUILD=1

chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true

exec bash "$SCRIPT_DIR/deployment.sh"
