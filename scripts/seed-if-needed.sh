#!/usr/bin/env bash
# Deprecated — use scripts/deployment.sh (runs db:seed --force on every deploy).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/../backend" && pwd)}"
cd "$BACKEND"
echo "==> seed-if-needed.sh: running idempotent db:seed --force"
php artisan db:seed --force
