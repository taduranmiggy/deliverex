#!/usr/bin/env bash
# Verify production health via ping.php — exits non-zero on failure.
set -euo pipefail

BASE_URL="${1:-https://deliverexapp.com}"
PING_URL="${BASE_URL%/}/ping.php"
MAX_ATTEMPTS="${HEALTH_CHECK_ATTEMPTS:-12}"
SLEEP_SECS="${HEALTH_CHECK_INTERVAL:-10}"
EXPECTED_DEPLOY_SHA="${EXPECTED_DEPLOY_SHA:-}"

log() { echo "[health-check] $*"; }

check_body() {
  local body="$1"
  local failed=0

  echo "$body"

  for key in env vendor db storage; do
    if ! echo "$body" | grep -qE "^${key}=yes\$"; then
      log "FAIL: ${key} is not yes"
      failed=1
    fi
  done

  if [ -n "$EXPECTED_DEPLOY_SHA" ] && [ "${SKIP_DEPLOY_SHA_CHECK:-0}" != "1" ]; then
    local expected_short="${EXPECTED_DEPLOY_SHA:0:7}"
    local live_deploy
    live_deploy="$(echo "$body" | grep -E '^deploy=' | head -1 | cut -d= -f2 || true)"
    if [ -z "$live_deploy" ]; then
      log "FAIL: deploy= missing in ping.php (server may need deploy-hook.php update)"
      failed=1
    elif [ "$live_deploy" != "$expected_short" ]; then
      log "FAIL: deploy=${live_deploy} expected ${expected_short}"
      failed=1
    else
      log "PASS: deploy=${live_deploy} matches expected commit"
    fi
  elif [ -n "$EXPECTED_DEPLOY_SHA" ] && [ "${SKIP_DEPLOY_SHA_CHECK:-0}" = "1" ]; then
    local live_deploy
    live_deploy="$(echo "$body" | grep -E '^deploy=' | head -1 | cut -d= -f2 || true)"
    if [ -n "$live_deploy" ]; then
      log "INFO: deploy=${live_deploy} (sha gate skipped — cron may still be applying)"
    fi
  fi

  if [ "$failed" -ne 0 ]; then
    return 1
  fi

  log "PASS: env=yes vendor=yes db=yes storage=yes"
  return 0
}

attempt=1
unreachable_streak=0
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  log "Attempt $attempt/$MAX_ATTEMPTS — $PING_URL"

  body=""
  if body="$(curl -fsS --connect-timeout 15 --max-time 30 "$PING_URL" 2>/dev/null)"; then
    unreachable_streak=0
    if check_body "$body"; then
      exit 0
    fi
  else
    unreachable_streak=$((unreachable_streak + 1))
    log "FAIL: Could not reach $PING_URL"
    # Hostinger often blocks GitHub runner IPs — do not fail CI for 30+ minutes.
    if [ "${ALLOW_UNREACHABLE_HEALTH_CHECK:-0}" = "1" ] && [ "$unreachable_streak" -ge 5 ]; then
      log "WARN: Site unreachable from GitHub runner — skipping health gate (cron deploy may still apply)."
      exit 0
    fi
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    sleep "$SLEEP_SECS"
  fi
  attempt=$((attempt + 1))
done

log "FAIL: Health check did not pass after $MAX_ATTEMPTS attempts"
exit 1
