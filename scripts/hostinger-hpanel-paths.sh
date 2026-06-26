#!/usr/bin/env bash
# Run once via SSH to print exact hPanel copy-paste values for deliverexapp.com
set -euo pipefail

HOME_DIR="${HOME:-/home/$(whoami)}"
REPO="$HOME_DIR/domains/deliverexapp.com/public_html"

echo "=== hPanel settings for deliverexapp.com ==="
echo ""
echo "Git install path:"
echo "  $REPO"
echo ""
echo "Document root:"
echo "  $REPO/backend/public"
echo ""
echo "Post-deployment script:"
echo "  bash $REPO/scripts/hostinger-hpanel-git-deploy.sh"
echo ""
echo "scripts/.deploy.env (auto-created on first setup if missing):"
echo "  DEPLOY_PATH=$REPO"
echo "  VITE_API_URL=https://deliverexapp.com/api"
