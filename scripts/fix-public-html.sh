#!/usr/bin/env bash
# Fix Hostinger shared hosting when Git root = public_html (no "change document root" option).
# Run via SSH: bash scripts/fix-public-html.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
HTACCESS="$REPO/.htaccess"

if [ ! -f "$REPO/backend/public/index.php" ]; then
  echo "ERROR: $REPO/backend/public/index.php not found."
  exit 1
fi

if [ ! -f "$HTACCESS" ] || ! grep -q 'backend/public' "$HTACCESS" 2>/dev/null; then
  cat > "$HTACCESS" <<'EOF'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^backend/public/ - [L]
    RewriteRule ^(.*)$ backend/public/$1 [L]
</IfModule>
EOF
  echo "==> Wrote $HTACCESS"
else
  echo "==> $HTACCESS already configured"
fi

chmod 644 "$HTACCESS"
chmod 755 "$REPO/backend/public"
chmod 644 "$REPO/backend/public/index.php" 2>/dev/null || true

echo ""
echo "Done. Test: https://deliverexapp.com/up"
echo "Then run: bash $SCRIPT_DIR/hostinger-one-shot-setup.sh"
