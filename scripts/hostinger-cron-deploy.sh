#!/usr/bin/env bash
# Legacy hPanel cron entry — forwards to CI artifact queue processor.
# Add in hPanel (every minute):
#   * * * * * bash /home/USER/domains/deliverexapp.com/public_html/scripts/process-deploy-queue.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/process-deploy-queue.sh"
