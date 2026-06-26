#!/usr/bin/env bash
# Ensure composer is available; print the command to run (composer or php composer.phar).
set -euo pipefail

BACKEND="${1:?backend directory required}"
DEPLOY_ROOT="${2:-$(dirname "$BACKEND")}"

if command -v composer >/dev/null 2>&1; then
  echo "composer"
  exit 0
fi

if [ -f "$BACKEND/composer.phar" ]; then
  echo "php $BACKEND/composer.phar"
  exit 0
fi

if [ -f "$DEPLOY_ROOT/composer.phar" ]; then
  echo "php $DEPLOY_ROOT/composer.phar"
  exit 0
fi

echo "==> Downloading composer.phar to $BACKEND ..." >&2
curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
php /tmp/composer-setup.php --install-dir="$BACKEND" --filename=composer.phar --quiet
rm -f /tmp/composer-setup.php
echo "php $BACKEND/composer.phar"
