#!/usr/bin/env bash
# Paste sa Hostinger hPanel → SSH Access → Browser terminal (o SSH sa PC):
#   curl -fsSL https://raw.githubusercontent.com/taduranmiggy/deliverex/main/scripts/hostinger-one-shot-setup.sh | bash
#
# O kung naka-clone na ang repo:
#   bash ~/domains/deliverexapp.com/deliverex/scripts/hostinger-one-shot-setup.sh

set -euo pipefail

DOMAIN="deliverexapp.com"
USER_NAME="$(whoami)"
HOME_DIR="${HOME:-/home/$USER_NAME}"
DEFAULT_REPO="$HOME_DIR/domains/$DOMAIN/deliverex"

echo "============================================"
echo " Deliverex one-shot setup — $DOMAIN"
echo " User: $USER_NAME"
echo "============================================"

find_repo() {
  if [ -d "$DEFAULT_REPO/backend" ]; then
    echo "$DEFAULT_REPO"
    return 0
  fi
  local public_html="$HOME_DIR/domains/$DOMAIN/public_html"
  if [ -d "$public_html/backend" ]; then
    echo "$public_html"
    return 0
  fi
  local found
  found="$(find "$HOME_DIR/domains" -maxdepth 4 -type f -path '*/deliverex/backend/artisan' 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    dirname "$(dirname "$found")"
    return 0
  fi
  found="$(find "$HOME_DIR" -maxdepth 5 -type f -path '*/backend/artisan' 2>/dev/null | grep -i deliverex | head -1 || true)"
  if [ -n "$found" ]; then
    dirname "$(dirname "$found")"
    return 0
  fi
  return 1
}

REPO_PATH=""
if REPO_PATH="$(find_repo)"; then
  echo "==> Found repo: $REPO_PATH"
else
  echo "ERROR: Hindi mahanap ang deliverex folder."
  echo "       hPanel → Git → Deploy muna, install path:"
  echo "       $DEFAULT_REPO"
  exit 1
fi

# Hostinger shared hosting: Git root is often public_html (no document-root change).
if [ -f "$REPO_PATH/backend/public/index.php" ]; then
  bash "$REPO_PATH/scripts/fix-public-html.sh"
fi

SCRIPT_DIR="$REPO_PATH/scripts"
PUBLIC_DIR="$REPO_PATH/backend/public"

echo ""
echo "=== hPanel — kopyahin at i-save ==="
echo "Document root:"
echo "  $PUBLIC_DIR"
echo ""
echo "Post-deployment script:"
echo "  bash $SCRIPT_DIR/hostinger-hpanel-git-deploy.sh"
echo ""

echo "==> Fixing permissions (fixes 403 Forbidden)..."
chmod -R u+rwX "$REPO_PATH/backend/storage" "$REPO_PATH/backend/bootstrap/cache" 2>/dev/null || true
chmod 755 "$PUBLIC_DIR" 2>/dev/null || true
chmod 644 "$PUBLIC_DIR/index.php" 2>/dev/null || true
chmod 644 "$PUBLIC_DIR/.htaccess" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/"*.sh 2>/dev/null || true

if [ ! -f "$PUBLIC_DIR/index.php" ]; then
  echo "ERROR: Walang index.php sa $PUBLIC_DIR"
  echo "       i-Deploy ang Git repo sa hPanel, tapos ulitin ang script."
  exit 1
fi

echo "==> Creating scripts/.deploy.env..."
cat > "$SCRIPT_DIR/.deploy.env" <<EOF
DEPLOY_PATH=$REPO_PATH
VITE_API_URL=https://$DOMAIN/api
EOF

cd "$REPO_PATH/backend"

if [ ! -f .env ]; then
  echo "==> Creating backend/.env from .env.example..."
  cp .env.example .env
fi

# Production URLs (idempotent)
sed -i.bak "s|^APP_ENV=.*|APP_ENV=production|" .env
sed -i.bak "s|^APP_DEBUG=.*|APP_DEBUG=false|" .env
sed -i.bak "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" .env
rm -f .env.bak

if grep -q '^DB_CONNECTION=sqlite' .env || grep -q '^DB_DATABASE=laravel' .env; then
  echo ""
  echo "=== MySQL credentials (hPanel → Databases) ==="
  read -r -p "DB_DATABASE: " DB_NAME
  read -r -p "DB_USERNAME: " DB_USER
  read -r -s -p "DB_PASSWORD: " DB_PASS
  echo ""
  sed -i.bak "s|^DB_CONNECTION=.*|DB_CONNECTION=mysql|" .env
  sed -i.bak "s|^# DB_HOST=.*|DB_HOST=localhost|" .env
  sed -i.bak "s|^DB_HOST=.*|DB_HOST=localhost|" .env
  sed -i.bak "s|^# DB_PORT=.*|DB_PORT=3306|" .env
  sed -i.bak "s|^DB_PORT=.*|DB_PORT=3306|" .env
  sed -i.bak "s|^# DB_DATABASE=.*|DB_DATABASE=$DB_NAME|" .env
  sed -i.bak "s|^DB_DATABASE=.*|DB_DATABASE=$DB_NAME|" .env
  sed -i.bak "s|^# DB_USERNAME=.*|DB_USERNAME=$DB_USER|" .env
  sed -i.bak "s|^DB_USERNAME=.*|DB_USERNAME=$DB_USER|" .env
  sed -i.bak "s|^# DB_PASSWORD=.*|DB_PASSWORD=$DB_PASS|" .env
  sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASS|" .env
  rm -f .env.bak
fi

grep -q '^CORS_ALLOWED_ORIGINS=' .env || echo "CORS_ALLOWED_ORIGINS=https://$DOMAIN" >> .env
grep -q '^SESSION_DOMAIN=' .env || echo "SESSION_DOMAIN=$DOMAIN" >> .env
grep -q '^SANCTUM_STATEFUL_DOMAINS=' .env || echo "SANCTUM_STATEFUL_DOMAINS=$DOMAIN" >> .env

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  echo "==> Generating APP_KEY..."
  php artisan key:generate --force
fi

echo "==> Composer install..."
if command -v composer >/dev/null 2>&1; then
  composer install --no-dev --optimize-autoloader --no-interaction
elif [ -f "$REPO_PATH/backend/composer.phar" ]; then
  php composer.phar install --no-dev --optimize-autoloader --no-interaction
else
  echo "WARN: Walang composer. hPanel → Advanced → PHP → Composer → install sa backend/"
fi

echo "==> Migrations..."
php artisan migrate --force

echo "==> Deploy (build frontend + cache)..."
export SKIP_GIT_PULL=1
bash "$SCRIPT_DIR/deploy-hostinger.sh"

echo ""
echo "==> Verifying Laravel..."
if [ ! -f "$REPO_PATH/backend/vendor/autoload.php" ]; then
  echo "ERROR: backend/vendor wala pa. hPanel → Composer → install sa backend/"
  exit 1
fi
if [ ! -f "$PUBLIC_DIR/index.php" ]; then
  echo "ERROR: Walang $PUBLIC_DIR/index.php — mali ang document root o incomplete ang deploy."
  exit 1
fi
cd "$REPO_PATH/backend"
php artisan route:list --path=auth/login 2>/dev/null | head -3 || true
echo ""
echo "TEST sa browser pagkatapos i-set ang document root:"
echo "  https://$DOMAIN/up          (dapat: laravel health, hindi Hostinger 404)"
echo "  https://$DOMAIN/api/auth/login (POST lang; GET ay 405 ok)"

echo ""
echo "============================================"
echo " DONE!"
echo " 1. Siguraduhing document root = $PUBLIC_DIR"
echo " 2. Buksan https://$DOMAIN"
echo "============================================"
