#!/usr/bin/env bash
# Force-sync server repo to origin/main (discards local edits to tracked files).
# Safe on production: shared/.env and shared/storage are outside git and preserved.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"

cd "$DEPLOY_PATH"

if [ ! -d .git ]; then
  echo "ERROR: Not a git repo: $DEPLOY_PATH" >&2
  exit 1
fi

echo "==> Fetching origin/main..."
git fetch origin main

echo "==> Resetting to origin/main (local tracked-file edits will be discarded)..."
git reset --hard origin/main

echo "==> Synced to $(git rev-parse --short HEAD)"
echo "    shared/.env and shared/storage are NOT affected."
