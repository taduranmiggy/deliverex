#!/usr/bin/env bash
# Hostinger-safe public/storage link (artisan often fails when storage is symlinked).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/shared-paths.sh"

log() { echo "[link-storage] $*"; }

PUBLIC_LINK="$BACKEND/public/storage"
STORAGE_PUBLIC="$SHARED_STORAGE/app/public"

mkdir -p "$STORAGE_PUBLIC" "$SHARED_POD" 2>/dev/null || true

if [ ! -e "$STORAGE_PUBLIC/delivery_documents" ]; then
  ln -sfn "$SHARED_POD" "$STORAGE_PUBLIC/delivery_documents" 2>/dev/null || true
fi

if [ -L "$PUBLIC_LINK" ]; then
  rm -f "$PUBLIC_LINK"
elif [ -e "$PUBLIC_LINK" ]; then
  rm -rf "$PUBLIC_LINK"
fi

log "Creating $PUBLIC_LINK → ../storage/app/public"
ln -sfn ../storage/app/public "$PUBLIC_LINK"

if [ -L "$PUBLIC_LINK" ]; then
  log "Symlink OK: $(ls -la "$PUBLIC_LINK")"
  exit 0
fi

log "Manual symlink failed — trying php artisan storage:link ..."
php "$BACKEND/artisan" storage:link || true

if [ -L "$PUBLIC_LINK" ] || [ -d "$PUBLIC_LINK" ]; then
  log "Storage link OK"
  exit 0
fi

log "ERROR: Could not create public/storage link" >&2
exit 1
