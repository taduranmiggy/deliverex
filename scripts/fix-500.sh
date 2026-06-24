#!/usr/bin/env bash
# Clear bad caches causing HTTP 500 on Hostinger. Run via SSH.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO/backend"

echo "==> Clear all Laravel caches..."
php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan view:clear
rm -f bootstrap/cache/*.php 2>/dev/null || true

echo "==> Storage permissions..."
chmod -R u+rwX storage bootstrap/cache 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

echo "==> Verify DB from .env..."
grep "^DB_" .env | grep -v PASSWORD

echo "==> Test artisan..."
php artisan --version
php artisan migrate:status 2>&1 | head -5

echo ""
echo "Test in browser: https://deliverexapp.com/up"
echo "If still 500, run: tail -30 storage/logs/laravel.log"
