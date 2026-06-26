#!/usr/bin/env bash
# Run composer with a stable working directory (Hostinger-safe).
# Usage: run-composer.sh <backend_dir> [composer args...]
set -euo pipefail

BACKEND="${1:?backend directory required}"
shift

if [ ! -d "$BACKEND" ]; then
  echo "ERROR: backend directory missing: $BACKEND" >&2
  exit 1
fi

BACKEND="$(cd "$BACKEND" && pwd -P 2>/dev/null || cd "$BACKEND" && pwd)"

export COMPOSER_HOME="${COMPOSER_HOME:-$HOME/.composer}"
export COMPOSER_CACHE_DIR="${COMPOSER_CACHE_DIR:-$HOME/.cache/composer}"
mkdir -p "$COMPOSER_HOME" "$COMPOSER_CACHE_DIR" 2>/dev/null || true

if command -v composer >/dev/null 2>&1; then
  exec composer --working-dir="$BACKEND" "$@"
fi

DEPLOY_ROOT="$(dirname "$BACKEND")"
PHAR="$BACKEND/composer.phar"
if [ ! -f "$PHAR" ] && [ -f "$DEPLOY_ROOT/composer.phar" ]; then
  PHAR="$DEPLOY_ROOT/composer.phar"
fi

if [ ! -f "$PHAR" ]; then
  echo "==> Downloading composer.phar to $BACKEND ..." >&2
  curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
  php /tmp/composer-setup.php --install-dir="$BACKEND" --filename=composer.phar --quiet
  rm -f /tmp/composer-setup.php
  PHAR="$BACKEND/composer.phar"
fi

exec php "$PHAR" --working-dir="$BACKEND" "$@"
