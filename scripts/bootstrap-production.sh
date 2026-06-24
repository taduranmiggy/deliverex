#!/usr/bin/env bash
# Full production bootstrap: .env + composer + migrate + seed + deploy
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================"
echo " Deliverex production bootstrap"
echo "============================================"

bash "$SCRIPT_DIR/fix-public-html.sh" 2>/dev/null || true
bash "$SCRIPT_DIR/write-production-env.sh"

cd "$REPO/backend"

if [ ! -f vendor/autoload.php ]; then
  echo "==> composer install..."
  composer install --no-dev --optimize-autoloader --no-interaction
fi

php artisan config:clear
php artisan cache:clear
rm -f bootstrap/cache/*.php 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  php artisan key:generate --force
fi

echo "==> migrate..."
php artisan migrate --force

echo "==> seed..."
php artisan db:seed --force

echo "==> verify users table..."
php artisan tinker --execute="echo 'users=' . App\Models\User::count();"

cd "$REPO"
export SKIP_GIT_PULL=1
bash "$SCRIPT_DIR/deploy-hostinger.sh"

echo ""
echo "============================================"
echo " DONE!"
echo " phpMyAdmin: database u826622735_deliverex → tables users, roles, ..."
echo " Login: admin@deliverex.com / admin123"
echo " Test: https://deliverexapp.com/up"
echo "============================================"
