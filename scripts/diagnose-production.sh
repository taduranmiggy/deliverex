#!/usr/bin/env bash
# Print production health checklist. Run via SSH after redeploy issues.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP="$(dirname "$REPO")/.deliverex.env"
cd "$REPO/backend"

echo "========== Deliverex diagnose =========="
echo "1. .env backup: $([ -f "$BACKUP" ] && echo OK || echo MISSING)"
echo "2. backend/.env: $([ -f .env ] && echo OK || echo MISSING)"
echo "3. vendor/:     $([ -f vendor/autoload.php ] && echo OK || echo MISSING — run composer install)"
echo ""
if [ -f .env ]; then
  echo "--- .env (no password) ---"
  grep -E '^(APP_|DB_CONNECTION|DB_HOST|DB_DATABASE|DB_USERNAME|CACHE|SESSION)' .env | grep -v PASSWORD
fi
echo ""
if [ -f vendor/autoload.php ]; then
  php artisan --version || true
  echo ""
  php artisan migrate:status 2>&1 | head -8 || true
  echo ""
  php artisan tinker --execute='try { echo "users=".App\Models\User::count(); } catch (Throwable $e) { echo "DB error: ".$e->getMessage(); }' 2>&1 || true
fi
echo ""
echo "--- storage/logs (last 15 lines) ---"
tail -15 storage/logs/laravel.log 2>/dev/null || echo "(no log file — run: mkdir -p storage/logs && chmod -R 775 storage)"
echo "--- storage ---"
ls -la public/storage 2>/dev/null || echo "public/storage MISSING — run: bash scripts/fix-storage.sh"
DOC_COUNT=$(find storage/app/public/delivery_documents -type f 2>/dev/null | wc -l | tr -d ' ')
echo "delivery_documents files on disk: ${DOC_COUNT:-0}"
echo ""
ls -ld storage storage/logs bootstrap/cache 2>/dev/null || true
echo "======================================="
