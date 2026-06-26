#!/usr/bin/env bash
# Fix Laravel storage symlink + upload folders on Hostinger (run once via SSH if POD images fail).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$(cd "$SCRIPT_DIR/../backend" && pwd)"
cd "$BACKEND"

echo "==> Deliverex storage fix"
mkdir -p storage/app/public/delivery_documents
mkdir -p storage/framework/{cache,sessions,views} storage/logs
chmod -R 775 storage bootstrap/cache 2>/dev/null || chmod -R u+rwX storage bootstrap/cache

rm -f public/storage 2>/dev/null || true
ln -sfn ../storage/app/public public/storage

echo ""
echo "Symlink:"
ls -la public/storage 2>/dev/null || echo "FAILED to create public/storage"
echo ""
echo "Upload folder:"
ls -ld storage/app/public/delivery_documents
echo ""
echo "Files in delivery_documents: $(find storage/app/public/delivery_documents -type f 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "Done. Re-upload POD if a specific file was lost during an old deploy."
