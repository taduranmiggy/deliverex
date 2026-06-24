#!/usr/bin/env bash
# Fail early if Laravel cannot connect to MySQL (wrong/missing .env after redeploy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/../backend" && pwd)}"

cd "$BACKEND"

if [ ! -f .env ]; then
  echo "ERROR: backend/.env missing. Run: bash scripts/write-production-env.sh" >&2
  exit 1
fi

if [ ! -f vendor/autoload.php ]; then
  echo "ERROR: vendor/ missing — run composer install before verifying DB." >&2
  exit 1
fi

echo "==> Verifying database connection..."
RESULT="$(php artisan tinker --execute="try { DB::connection()->getPdo(); echo 'ok'; } catch (Throwable \$e) { echo 'fail:'.\$e->getMessage(); }" 2>&1 | tail -1)"

if [[ "$RESULT" == "ok" ]]; then
  echo "    Database connection OK"
  exit 0
fi

echo "ERROR: Cannot connect to database." >&2
echo "       Restore .env: bash scripts/write-production-env.sh" >&2
echo "       Backup path: $(dirname "$(dirname "$BACKEND")")/.deliverex.env" >&2
if [[ "$RESULT" == fail:* ]]; then
  echo "       Details: ${RESULT#fail:}" >&2
fi
exit 1
