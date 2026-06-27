#!/usr/bin/env bash
# Decrypt Document AI credentials into backend/storage/app/google/document-ai.json.
# Safe no-op when no encrypted payload is configured.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

log() { echo "[document-ai-decrypt] $*"; }

TARGET_JSON="$BACKEND/storage/app/google/document-ai.json"
TARGET_DIR="$(dirname "$TARGET_JSON")"
mkdir -p "$TARGET_DIR"
chmod 775 "$TARGET_DIR" 2>/dev/null || true

ENC_FILE="$DEPLOY_PATH/.deploy.secrets/document-ai.json.enc"
TMP_ENC="/tmp/document-ai.json.enc.$$"
TMP_OUT="/tmp/document-ai.json.$$"

cleanup() {
  rm -f "$TMP_ENC" "$TMP_OUT"
}
trap cleanup EXIT

read_secret() {
  local key="$1"
  local value=""
  if [ -f "$SHARED_SECRETS" ]; then
    value="$(grep -E "^${key}=" "$SHARED_SECRETS" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  fi
  printf '%s' "$value"
}

decrypt_with_openssl() {
  local enc_file="$1"
  local out_file="$2"
  local passphrase="$3"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -salt \
    -in "$enc_file" \
    -out "$out_file" \
    -pass pass:"$passphrase"
}

ENCRYPTED_B64="$(read_secret DOCUMENT_AI_JSON_ENC_B64)"
DECRYPT_KEY="$(read_secret DOCUMENT_AI_DECRYPT_KEY)"

if [ -z "$DECRYPT_KEY" ]; then
  log "No DOCUMENT_AI_DECRYPT_KEY in shared secrets. Skipping Document AI credential decrypt."
  exit 0
fi

if [ -n "$ENCRYPTED_B64" ]; then
  printf '%s' "$ENCRYPTED_B64" | base64 -d > "$TMP_ENC"
  decrypt_with_openssl "$TMP_ENC" "$TMP_OUT" "$DECRYPT_KEY"
elif [ -f "$ENC_FILE" ]; then
  decrypt_with_openssl "$ENC_FILE" "$TMP_OUT" "$DECRYPT_KEY"
else
  log "No encrypted Document AI payload found (env or $ENC_FILE). Skipping."
  exit 0
fi

if ! php -r '$j=json_decode(file_get_contents($argv[1]),true); if(!is_array($j)||($j["type"]??"")!=="service_account") exit(1);' "$TMP_OUT"; then
  log "Decrypted Document AI credentials are invalid JSON or not a service account."
  exit 1
fi

cp "$TMP_OUT" "$TARGET_JSON"
chmod 600 "$TARGET_JSON" 2>/dev/null || true
log "Wrote Document AI credentials to $TARGET_JSON"

