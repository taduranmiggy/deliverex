#!/usr/bin/env bash
# Build React app and publish to backend/public (for Hostinger hPanel Git deploy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$REPO/frontend"
PUBLIC="$REPO/backend/public"
CACHE="$(dirname "$REPO")/.deliverex-frontend-dist"
VITE_API_URL="${VITE_API_URL:-https://deliverexapp.com/api}"

load_node() {
  export PATH="/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs18/root/usr/bin:$PATH"
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
  fi
}

publish_dist() {
  local src="$1"
  echo "==> Publishing frontend to $PUBLIC ..."
  rsync -a --delete "$src/" "$PUBLIC/" \
    --exclude index.php \
    --exclude .htaccess \
    --exclude ping.php \
    --exclude storage
}

if [ -d /tmp/deliverex-dist ] && [ -n "$(ls -A /tmp/deliverex-dist 2>/dev/null)" ]; then
  publish_dist /tmp/deliverex-dist
  exit 0
fi

load_node
if command -v npm >/dev/null 2>&1; then
  echo "==> Building frontend (npm)..."
  cd "$FRONTEND"
  npm ci
  VITE_API_URL="$VITE_API_URL" npm run build
  mkdir -p "$CACHE"
  rsync -a --delete dist/ "$CACHE/"
  publish_dist dist
  exit 0
fi

if [ -d "$CACHE" ] && [ -f "$CACHE/index.html" ]; then
  echo "==> Restoring frontend from cache $CACHE ..."
  publish_dist "$CACHE"
  exit 0
fi

if [ -f "$PUBLIC/index.html" ]; then
  echo "==> Using existing $PUBLIC/index.html"
  exit 0
fi

echo "ERROR: No frontend build. Enable Node on Hostinger or push built assets from GitHub Actions." >&2
exit 1
