#!/usr/bin/env bash
# Seed production only when explicitly requested or when the users table is empty.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/../backend" && pwd)}"

cd "$BACKEND"

if [ "${FORCE_SEED:-0}" = "1" ]; then
  echo "==> FORCE_SEED=1 — running php artisan db:seed --force"
  php artisan db:seed --force
  exit 0
fi

if [ ! -f .env ]; then
  echo "==> Skipping seed: backend/.env missing"
  exit 0
fi

if [ ! -f vendor/autoload.php ]; then
  echo "==> Skipping seed: vendor/autoload.php missing"
  exit 0
fi

RESULT="$(php artisan tinker --execute='try { if (! Schema::hasTable("users")) { echo "missing"; } else { echo App\Models\User::count(); } } catch (Throwable $e) { echo "error:".$e->getMessage(); }' 2>&1 | tail -1)"

case "$RESULT" in
  0)
    echo "==> users table is empty — running php artisan db:seed --force"
    php artisan db:seed --force
    ;;
  missing)
    echo "==> Skipping seed: users table does not exist yet"
    ;;
  error:*)
    echo "ERROR: Cannot determine seed state: ${RESULT#error:}" >&2
    exit 1
    ;;
  ''|*[!0-9]*)
    echo "ERROR: Unexpected seed check result: $RESULT" >&2
    exit 1
    ;;
  *)
    echo "==> Skipping seed: users table already has $RESULT user(s)"
    ;;
esac

seed_chatbot_intents_if_needed() {
  if [ ! -f vendor/autoload.php ]; then
    return 0
  fi

  local intent_result
  intent_result="$(php artisan tinker --execute='try {
    if (! Schema::hasTable("chatbot_intents")) { echo "missing"; }
    else { echo App\Models\ChatbotIntent::count(); }
  } catch (Throwable $e) { echo "error:".$e->getMessage(); }' 2>&1 | tail -1)"

  case "$intent_result" in
    0|missing)
      echo "==> Seeding chatbot intents (php artisan db:seed --class=ChatbotIntentSeeder --force)"
      php artisan db:seed --class=ChatbotIntentSeeder --force
      ;;
    error:*)
      echo "WARN: Could not check chatbot_intents: ${intent_result#error:}" >&2
      ;;
    ''|*[!0-9]*)
      echo "WARN: Unexpected chatbot intent check: $intent_result" >&2
      ;;
    *)
      echo "==> chatbot_intents already has $intent_result row(s) — skipping ChatbotIntentSeeder"
      ;;
  esac
}

seed_chatbot_intents_if_needed
