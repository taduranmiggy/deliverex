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
VARS_TMP="/tmp/deliverex-deploy-vars.$$"
LAST_QUEUED_RUN_FILE="$SHARED_STATE/last-queued-run-id"
LAST_DEPLOYED_SHA_FILE="$SHARED_STATE/last-deployed-sha"

mkdir -p "$LOG_DIR" "$SHARED_STATE" 2>/dev/null || true

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line"
  echo "$line" >>"$LOG_FILE" 2>/dev/null || true
}

cleanup() {
  rm -f "$VARS_TMP"
}
trap cleanup EXIT

read_secret() {
  local key="$1"
  local default_value="${2:-}"
  local value=""
  if [ -f "$SHARED_SECRETS" ]; then
    value="$(grep -E "^${key}=" "$SHARED_SECRETS" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  fi
  if [ -z "$value" ]; then
    value="$default_value"
  fi
  printf '%s' "$value"
}

queue_latest_from_github_if_needed() {
  [ -f "$PENDING" ] && return 0

  local github_token repo app_url last_deployed last_queued
  github_token="$(read_secret GITHUB_DEPLOY_TOKEN)"
  repo="$(read_secret GITHUB_REPO taduranmiggy/deliverex)"
  app_url="$(read_secret APP_URL https://deliverexapp.com)"
  last_deployed="$(cat "$LAST_DEPLOYED_SHA_FILE" 2>/dev/null || true)"
  last_queued="$(cat "$LAST_QUEUED_RUN_FILE" 2>/dev/null || true)"

  if [ -z "$github_token" ]; then
    log "WARN: GITHUB_DEPLOY_TOKEN missing; cannot poll GitHub artifacts."
    return 0
  fi

  # Include in-progress runs — artifact upload finishes long before the workflow ends.
  local runs_json run_id sha
  runs_json="$(curl -fsS \
    -H "Authorization: Bearer $github_token" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "User-Agent: Deliverex-Deploy-Cron" \
    "https://api.github.com/repos/$repo/actions/workflows/deploy.yml/runs?branch=main&per_page=10" \
    2>>"$LOG_FILE" || true)"

  if [ -z "$runs_json" ]; then
    log "WARN: Could not fetch workflow runs from GitHub."
    return 0
  fi

  run_id=""
  sha=""
  while IFS=$'\t' read -r candidate_run candidate_sha; do
    [ -z "$candidate_run" ] && continue
    local candidate_short="${candidate_sha:0:7}"
    if [ -n "$last_deployed" ] && [ "$candidate_short" = "$last_deployed" ]; then
      continue
    fi
    if [ "$candidate_run" = "$last_queued" ]; then
      continue
    fi

    local artifacts_json artifact_id
    artifacts_json="$(curl -fsS \
      -H "Authorization: Bearer $github_token" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      -H "User-Agent: Deliverex-Deploy-Cron" \
      "https://api.github.com/repos/$repo/actions/runs/$candidate_run/artifacts?per_page=100" \
      2>>"$LOG_FILE" || true)"

    artifact_id="$(printf '%s' "$artifacts_json" | php -r '
      $j=json_decode(stream_get_contents(STDIN),true);
      if (!is_array($j) || !isset($j["artifacts"])) exit(0);
      foreach ($j["artifacts"] as $a) {
        $name = (string)($a["name"] ?? "");
        if ($name === "deliverex-deploy" || str_starts_with($name, "deliverex-deploy-")) {
          echo (string)($a["id"] ?? "");
          exit(0);
        }
      }
    ' 2>>"$LOG_FILE" || true)"

    if [ -n "$artifact_id" ]; then
      run_id="$candidate_run"
      sha="$candidate_sha"
      break
    fi
  done < <(printf '%s' "$runs_json" | php -r '
    $j = json_decode(stream_get_contents(STDIN), true);
    if (!is_array($j) || empty($j["workflow_runs"])) { exit(0); }
    foreach ($j["workflow_runs"] as $run) {
      $id = (string)($run["id"] ?? "");
      $head = (string)($run["head_sha"] ?? "");
      if ($id !== "" && $head !== "") {
        echo $id . "\t" . $head . "\n";
      }
    }
  ' 2>>"$LOG_FILE" || true)

  if [ -z "$run_id" ]; then
    log "WARN: No deploy artifact ready on GitHub yet."
    return 0
  fi

  local zip_path bundle_path
  zip_path="/tmp/deliverex-deploy/artifact-${run_id}.zip"
  bundle_path="/tmp/deliverex-deploy/deliverex-deploy.tar.gz"
  mkdir -p /tmp/deliverex-deploy

  if ! curl -fsS -L \
    -H "Authorization: Bearer $github_token" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "User-Agent: Deliverex-Deploy-Cron" \
    "https://api.github.com/repos/$repo/actions/artifacts/$artifact_id/zip" \
    -o "$zip_path" 2>>"$LOG_FILE"; then
    log "WARN: Failed to download artifact zip for run $run_id."
    return 0
  fi

  if ! ZIP_PATH="$zip_path" BUNDLE_PATH="$bundle_path" php -r '
    $zipPath = getenv("ZIP_PATH");
    $bundlePath = getenv("BUNDLE_PATH");
    if (!class_exists("ZipArchive")) { fwrite(STDERR, "ZipArchive missing\n"); exit(1); }
    $z = new ZipArchive();
    if ($z->open($zipPath) !== true) { fwrite(STDERR, "cannot open zip\n"); exit(1); }
    $ok = false;
    for ($i = 0; $i < $z->numFiles; $i++) {
      $name = $z->getNameIndex($i);
      if ($name !== false && basename($name) === "deliverex-deploy.tar.gz") {
        $content = $z->getFromIndex($i);
        if ($content !== false) {
          file_put_contents($bundlePath, $content);
          $ok = true;
        }
        break;
      }
    }
    $z->close();
    if (!$ok) { fwrite(STDERR, "bundle not found in zip\n"); exit(1); }
  ' 2>>"$LOG_FILE"; then
    log "WARN: Failed extracting deliverex-deploy.tar.gz from artifact zip."
    return 0
  fi

  if [ ! -f "$bundle_path" ]; then
    log "WARN: Bundle file missing after extraction."
    return 0
  fi

  cat >"$PENDING" <<EOF
{
  "bundle": "$bundle_path",
  "sha": "${sha:-unknown}",
  "run_id": "$run_id",
  "repo": "$repo",
  "app_url": "$app_url",
  "queued_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
  echo "$run_id" >"$LAST_QUEUED_RUN_FILE"
  log "Queued deploy from GitHub artifact run_id=$run_id sha=${sha:0:7}"
}

if [ ! -f "$PENDING" ]; then
  queue_latest_from_github_if_needed
fi

if [ ! -f "$PENDING" ]; then
  exit 0
fi

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "Another deploy is running — skip"
    exit 0
  fi
fi

log "========== process-deploy-queue started =========="

if ! PENDING_FILE="$PENDING" php -r '
  $path = getenv("PENDING_FILE");
  $j = json_decode(@file_get_contents($path), true);
  if (!is_array($j)) { fwrite(STDERR, "invalid pending json\n"); exit(1); }
  echo ($j["bundle"] ?? "") . "\n";
  echo ($j["sha"] ?? "unknown") . "\n";
  echo ($j["app_url"] ?? "https://deliverexapp.com") . "\n";
' >"$VARS_TMP" 2>>"$LOG_FILE"; then
  log "ERROR: could not read $PENDING"
  exit 1
fi

DEPLOY_BUNDLE="$(sed -n '1p' "$VARS_TMP")"
DEPLOY_SHA="$(sed -n '2p' "$VARS_TMP")"
APP_URL_QUEUED="$(sed -n '3p' "$VARS_TMP")"

if [ -z "$DEPLOY_BUNDLE" ] || [ ! -f "$DEPLOY_BUNDLE" ]; then
  log "ERROR: pending deploy bundle missing: $DEPLOY_BUNDLE"
  exit 1
fi

export DEPLOY_PATH
export DEPLOY_BUNDLE
export DEPLOY_SHA
export APP_URL="${APP_URL_QUEUED:-https://deliverexapp.com}"
export SKIP_HEALTH_CHECK=1
export SKIP_GIT_PULL=1
export SKIP_ROLLBACK=1
export DEPLOY_PREVIOUS_SHA=none

log "Applying deploy sha=${DEPLOY_SHA:0:7} bundle=$DEPLOY_BUNDLE"

if bash "$SCRIPT_DIR/deploy-from-ci.sh" >>"$LOG_FILE" 2>&1; then
  rm -f "$PENDING"
  if [ -n "$DEPLOY_SHA" ] && [ "$DEPLOY_SHA" != "unknown" ]; then
    echo "${DEPLOY_SHA:0:7}" >"$LAST_DEPLOYED_SHA_FILE"
  fi
  log "Deploy complete sha=${DEPLOY_SHA:0:7}"
else
  rm -f "$LAST_QUEUED_RUN_FILE"
  log "ERROR: deploy-from-ci.sh failed — pending file kept for retry"
  exit 1
fi
