#!/usr/bin/env bash
# Canonical paths for Hostinger shared-hosting deploy layout.
# Domain layout:
#   domains/deliverexapp.com/
#     shared/          — persistent .env, secrets, storage (never wiped by git)
#     public_html/     — git checkout (DEPLOY_PATH)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DOMAIN_ROOT="${DOMAIN_ROOT:-$(dirname "$DEPLOY_PATH")}"
SHARED_ROOT="${SHARED_ROOT:-$DOMAIN_ROOT/shared}"

SHARED_ENV="$SHARED_ROOT/.env"
SHARED_SECRETS="$SHARED_ROOT/.deploy.secrets"
SHARED_STORAGE="$SHARED_ROOT/storage"
SHARED_UPLOADS="$SHARED_ROOT/uploads"
SHARED_POD="$SHARED_ROOT/pod"
SHARED_OCR="$SHARED_ROOT/ocr"
SHARED_STATE="$SHARED_ROOT/deploy-state"

BACKEND="$DEPLOY_PATH/backend"
BACKEND_ENV="$BACKEND/.env"
BACKEND_STORAGE="$BACKEND/storage"

# Legacy paths (migrated once into shared/)
LEGACY_ENV_BACKUP="$DOMAIN_ROOT/.deliverex.env"
LEGACY_SECRETS="$DOMAIN_ROOT/.deploy.secrets"

export DEPLOY_PATH DOMAIN_ROOT SHARED_ROOT SHARED_ENV SHARED_SECRETS
export SHARED_STORAGE SHARED_UPLOADS SHARED_POD SHARED_OCR SHARED_STATE
export BACKEND BACKEND_ENV BACKEND_STORAGE
export LEGACY_ENV_BACKUP LEGACY_SECRETS
