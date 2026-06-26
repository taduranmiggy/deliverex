# ═══════════════════════════════════════════════════════════════
# DELIVEREX — ZERO-TOUCH HOSTINGER SETUP (hPanel browser lang, 3 min)
# Pagkatapos nito: git push lang, wala nang SSH / manual deploy.
# ═══════════════════════════════════════════════════════════════

# ── 1. Git → Repository ───────────────────────────────────────
#    Repo:   https://github.com/taduranmiggy/deliverex.git
#    Branch: main
#    Install path: domains/deliverexapp.com/public_html
#    ✅ I-ON ang "Auto Deployment" (auto-pull kapag may bagong commit sa GitHub)

# ── 2. Document root ──────────────────────────────────────────
#    Websites → deliverexapp.com → Advanced → Change document root:
/home/u826622735/domains/deliverexapp.com/public_html/backend/public

# ── 3. Post-deployment script (Git → Deployment script) ───────
bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/hostinger-hpanel-git-deploy.sh

# ── 4. Cron Job (Advanced → Cron Jobs → every 5 minutes) ──────
#    Backup kung hindi agad mag-auto-deploy ang Git hook:
*/5 * * * * bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/hostinger-cron-deploy.sh >> /home/u826622735/domains/deliverexapp.com/public_html/backend/storage/logs/cron-deploy.log 2>&1

# ── 5. GitHub Secret (optional — instant deploy, isang beses) ─
#    GitHub → taduranmiggy/deliverex → Settings → Secrets → Actions
#    Name:  DEPLOY_HOOK_TOKEN
#    Value: (see ../.deploy.secrets on server, line DEPLOY_HOOK_TOKEN=...)

# ═══════════════════════════════════════════════════════════════
# TAPOS NA. Flow mula ngayon:
#   git push origin main
#     → GitHub Actions: build frontend
#     → Hostinger: auto-pull + post-deploy script
#     → composer + .env + migrate + storage (automatic)
# ═══════════════════════════════════════════════════════════════
