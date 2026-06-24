#!/usr/bin/env bash
# Seed database only on first install or when FORCE_SEED=1.
# Routine redeploys run migrate only — existing MySQL data is preserved.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/../backend" && pwd)}"

cd "$BACKEND"

if [ ! -f vendor/autoload.php ]; then
  echo "ERROR: vendor/ missing — run composer install before seeding." >&2
  exit 1
fi

if [ "${FORCE_SEED:-0}" = "1" ]; then
  echo "==> FORCE_SEED=1 — running full database seed..."
  php artisan db:seed --force
  php artisan db:seed --class=DispatchDemoSeeder --force 2>/dev/null || true
  exit 0
fi

USER_COUNT="$(php artisan tinker --execute="try { echo (int) App\Models\User::count(); } catch (Throwable \$e) { echo -1; }" 2>&1 | tail -1 | tr -d '[:space:]')"

if [[ "$USER_COUNT" =~ ^[0-9]+$ ]] && [ "$USER_COUNT" -gt 0 ]; then
  echo "==> Database already seeded (users=$USER_COUNT) — skipping seed."
  exit 0
fi

echo "==> Empty database — running first-time seed..."
php artisan db:seed --force
php artisan db:seed --class=DispatchDemoSeeder --force 2>/dev/null || true
