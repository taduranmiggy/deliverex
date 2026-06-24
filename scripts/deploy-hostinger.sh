#!/usr/bin/env bash
# Backward-compatible wrapper — use scripts/deployment.sh or ./deployment.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
exec bash "$SCRIPT_DIR/deployment.sh"
