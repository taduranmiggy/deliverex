#!/usr/bin/env bash
# Install git post-merge hook on server — auto-runs deploy after every git pull.
# Run once via SSH (or let CI run it if SSH key is configured).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$REPO/.git/hooks/post-merge"

if [ ! -d "$REPO/.git" ]; then
  echo "ERROR: $REPO/.git not found — deploy Git repo via hPanel first."
  exit 1
fi

cat > "$HOOK" <<EOF
#!/bin/bash
# Auto-deploy after git pull (installed by install-server-autodeploy.sh)
export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_SERVER_FRONTEND_BUILD=1
bash "$REPO/scripts/hostinger-hpanel-git-deploy.sh" >> "$REPO/backend/storage/logs/deploy.log" 2>&1
EOF

chmod +x "$HOOK"
echo "Installed: $HOOK"
echo "hPanel Git Auto Deployment ON lang ang kailangan — no post-deploy script field needed."
