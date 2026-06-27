#!/usr/bin/env bash
# Verify production health via ping.php — exits non-zero on failure.
set -euo pipefail

BASE_URL="${1:-https://deliverexapp.com}"
PING_URL="${BASE_URL%/}/ping.php"
MAX_ATTEMPTS="${HEALTH_CHECK_ATTEMPTS:-12}"
SLEEP_SECS="${HEALTH_CHECK_INTERVAL:-10}"

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

  if [ "$failed" -ne 0 ]; then
    return 1
  fi

  log "PASS: env=yes vendor=yes db=yes storage=yes"
  return 0
}

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  log "Attempt $attempt/$MAX_ATTEMPTS — $PING_URL"

  body=""
  if body="$(curl -fsS --connect-timeout 15 --max-time 30 "$PING_URL" 2>/dev/null)"; then
    if check_body "$body"; then
      exit 0
    fi
  else
    log "FAIL: Could not reach $PING_URL"
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    sleep "$SLEEP_SECS"
  fi
  attempt=$((attempt + 1))
done

log "FAIL: Health check did not pass after $MAX_ATTEMPTS attempts"
exit 1
