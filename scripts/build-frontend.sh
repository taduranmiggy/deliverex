#!/usr/bin/env bash
# Publish React build to backend/public (for Hostinger hPanel Git deploy).
#
# Hostinger shared hosting cannot run Vite/Rolldown builds (thread limits).
# Default: use index.html + assets committed in git, or /tmp/deliverex-dist from CI.
# Set FORCE_SERVER_FRONTEND_BUILD=1 only if your server can run npm run build.
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
  mkdir -p "$PUBLIC/assets"
  rsync -a --delete "$src/" "$PUBLIC/" \
    --exclude index.php \
    --exclude .htaccess \
    --exclude ping.php \
    --exclude storage
}

# 1. GitHub Actions / manual rsync upload
if [ -d /tmp/deliverex-dist ] && [ -n "$(ls -A /tmp/deliverex-dist 2>/dev/null)" ]; then
  publish_dist /tmp/deliverex-dist
  exit 0
fi

# 2. Git-committed build (recommended for Hostinger — no npm on server)
if [ -f "$PUBLIC/index.html" ] && [ "${FORCE_SERVER_FRONTEND_BUILD:-0}" != "1" ]; then
  echo "==> Using git-committed frontend (backend/public/index.html)"
  exit 0
fi

# 3. Off-repo cache from a previous successful build
if [ -d "$CACHE" ] && [ -f "$CACHE/index.html" ]; then
  echo "==> Restoring frontend from cache $CACHE ..."
  publish_dist "$CACHE"
  exit 0
fi

# 4. Server npm build — often fails on shared hosting (Rolldown thread pool limits)
if [ "${SKIP_SERVER_FRONTEND_BUILD:-0}" = "1" ]; then
  echo "WARN: SKIP_SERVER_FRONTEND_BUILD=1 and no frontend build found." >&2
elif command -v npm >/dev/null 2>&1; then
  load_node
  echo "==> Building frontend on server (npm) — may fail on shared hosting..."
  if (
    set -e
    cd "$FRONTEND"
    npm ci
    VITE_API_URL="$VITE_API_URL" npm run build
  ); then
    mkdir -p "$CACHE"
    rsync -a --delete dist/ "$CACHE/"
    publish_dist dist
    exit 0
  fi
  echo "WARN: Server npm build failed (common on Hostinger). Using fallbacks..." >&2
fi

if [ -f "$PUBLIC/index.html" ]; then
  echo "==> Using existing $PUBLIC/index.html"
  exit 0
fi

echo "ERROR: No frontend build found." >&2
echo "       Push latest main (includes backend/public assets) or use GitHub Actions deploy." >&2
exit 1
