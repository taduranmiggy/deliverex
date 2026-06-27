#!/usr/bin/env bash
# Roll back to the previous known-good git commit and rebuild caches.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

PREVIOUS_SHA="${1:-}"
STATE_FILE="$SHARED_STATE/previous-sha"

if [ -z "$PREVIOUS_SHA" ] && [ -f "$STATE_FILE" ]; then
  PREVIOUS_SHA="$(cat "$STATE_FILE")"
fi

if [ -z "$PREVIOUS_SHA" ] || [ "$PREVIOUS_SHA" = "none" ]; then
  echo "[rollback] ERROR: No previous SHA to roll back to." >&2
  exit 1
fi

log() { echo "[rollback] $*"; }

cd "$DEPLOY_PATH"

if [ ! -d .git ]; then
  log "ERROR: Not a git repository: $DEPLOY_PATH"
  exit 1
fi

log "Rolling back: $(git rev-parse --short HEAD) → ${PREVIOUS_SHA:0:7}"

git reset --hard "$PREVIOUS_SHA"

export SKIP_GIT_PULL=1
export SKIP_FRONTEND=1
export SKIP_HEALTH_CHECK=1
export SKIP_ROLLBACK=1

bash "$SCRIPT_DIR/deployment.sh"

log "Rollback complete at ${PREVIOUS_SHA:0:7}"
