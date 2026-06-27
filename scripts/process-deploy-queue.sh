#!/usr/bin/env bash
# Process CI deploy queue — run via hPanel cron every minute (CLI has shell access).
# Web hook (deploy-hook.php) downloads artifact and writes shared/deploy-state/pending-deploy.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

PENDING="$SHARED_STATE/pending-deploy.json"
LOCK="$SHARED_STATE/deploy.lock"
LOG_DIR="$SHARED_STATE/deploy-logs"
LOG_FILE="$LOG_DIR/cron-deploy.log"

mkdir -p "$LOG_DIR" "$SHARED_STATE" 2>/dev/null || true

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line"
  echo "$line" >>"$LOG_FILE" 2>/dev/null || true
}

if [ ! -f "$PENDING" ]; then
  exit 0
fi

exec 9>"$LOCK"
if ! flock -n 9; then
  log "Another deploy is running — skip"
  exit 0
fi

log "========== process-deploy-queue started =========="

export PENDING_FILE="$PENDING"
mapfile -t _DEPLOY_VARS < <(php -r '
  $path = getenv("PENDING_FILE");
  $j = json_decode(@file_get_contents($path), true);
  if (!is_array($j)) { fwrite(STDERR, "invalid pending json\n"); exit(1); }
  echo ($j["bundle"] ?? "") . "\n";
  echo ($j["sha"] ?? "unknown") . "\n";
  echo ($j["app_url"] ?? "https://deliverexapp.com") . "\n";
' 2>>"$LOG_FILE") || {
  log "ERROR: could not read $PENDING"
  exit 1
}

DEPLOY_BUNDLE="${_DEPLOY_VARS[0]:-}"
DEPLOY_SHA="${_DEPLOY_VARS[1]:-unknown}"
APP_URL_QUEUED="${_DEPLOY_VARS[2]:-https://deliverexapp.com}"

if [ -z "$DEPLOY_BUNDLE" ] || [ ! -f "$DEPLOY_BUNDLE" ]; then
  log "ERROR: pending deploy bundle missing: $DEPLOY_BUNDLE"
  exit 1
fi

export DEPLOY_PATH
export DEPLOY_BUNDLE
export DEPLOY_SHA
export APP_URL="${APP_URL_QUEUED}"
export SKIP_HEALTH_CHECK=1
export SKIP_GIT_PULL=1
export SKIP_ROLLBACK=1
export DEPLOY_PREVIOUS_SHA=none

log "Applying deploy sha=${DEPLOY_SHA:0:7} bundle=$DEPLOY_BUNDLE"

if bash "$SCRIPT_DIR/deploy-from-ci.sh" >>"$LOG_FILE" 2>&1; then
  rm -f "$PENDING"
  log "Deploy complete sha=${DEPLOY_SHA:0:7}"
else
  log "ERROR: deploy-from-ci.sh failed — pending file kept for retry"
  exit 1
fi
