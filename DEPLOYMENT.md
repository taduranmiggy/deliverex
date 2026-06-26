# Deliverex — Production Deployment

Zero-maintenance deploy for Hostinger. **One-time setup** (5 min), then every `git push` → build → auto-deploy with no manual SSH.

---

## Automated flow (after one-time setup)

```
git push main
  → GitHub Actions: build React, commit backend/public/, push
  → POST deploy-hook.php (or hPanel cron within 5 min)
  → deployment.sh: .env + composer + migrate + cache + storage link
```

---

## One-time setup (isang beses lang)

SSH once, then never again for routine deploys:

```bash
cd ~/domains/deliverexapp.com/public_html
bash scripts/setup-hostinger-autodeploy.sh
```

This creates:
- `../.deploy.secrets` — MySQL + deploy hook token (outside git, survives redeploy)
- `../.deliverex.env` — `.env` backup
- Prints hPanel checklist (post-deploy script + cron)

Add to **GitHub → Secrets → Actions**:
- `DEPLOY_HOOK_TOKEN` — shown by setup script

Configure **hPanel** (copy from script output):
- Git install path: `domains/deliverexapp.com/public_html`
- Document root: `.../public_html/backend/public`
- Post-deploy: `bash .../scripts/hostinger-hpanel-git-deploy.sh`
- Cron (every 5 min): `bash .../scripts/hostinger-cron-deploy.sh`

Then run once: `bash scripts/hostinger-hpanel-git-deploy.sh`

---

## What runs on every deploy

[`scripts/deployment.sh`](scripts/deployment.sh):

| Step | Action |
|------|--------|
| `.env` | `provision-env.sh` — restore backup or build from `.deploy.secrets` |
| `vendor/` | `ensure-composer.sh` — auto-download composer.phar if needed |
| Migrations | `php artisan migrate --force` |
| Seed | Only if users table empty |
| Storage | symlink, permissions, `delivery_documents/` |
| Frontend | Uses git-committed `backend/public/` (built in CI) |

**Logs:** `backend/storage/logs/deploy.log`, `backend/storage/logs/cron-deploy.log`

---

## GitHub Actions

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

| Secret | Required | Description |
|--------|----------|-------------|
| `DEPLOY_HOOK_TOKEN` | Yes (for instant deploy) | From `setup-hostinger-autodeploy.sh` |
| `VITE_API_URL` | No | Default `https://deliverexapp.com/api` |

If webhook fails, **hPanel cron** deploys within 5 minutes automatically.

---

## Hostinger setup (shared hosting — deliverexapp.com)

### One-time

1. **hPanel** → **Websites** → **deliverexapp.com** → **Manage**
2. **Git** → Connect `https://github.com/taduranmiggy/deliverex.git`, branch `main`
3. **Install path:** `domains/deliverexapp.com/public_html` (or your path)
4. **PHP 8.2+** via PHP Configuration
5. **MySQL** — create database + user; note credentials
6. **SSH Access** — enable; add deploy public key

### First SSH setup (once only)

```bash
ssh -p 65002 u826622735@YOUR_SERVER_IP
cd /home/u826622735/domains/deliverexapp.com/public_html
bash scripts/write-production-env.sh   # creates backend/.env + ../.deliverex.env backup
bash scripts/deployment.sh
```

### hPanel post-deploy script (zero SSH after this)

hPanel → **Git** → **Post-deployment script**:

```bash
bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/hostinger-hpanel-git-deploy.sh
```

Every **Deploy** / **Pull** in hPanel Git runs the full deployment automatically.

---

## Hostinger VPS setup

Same flow; paths differ:

```bash
# Example VPS path
export DEPLOY_PATH=/var/www/deliverex
git clone https://github.com/taduranmiggy/deliverex.git "$DEPLOY_PATH"
cd "$DEPLOY_PATH"
bash scripts/write-production-env.sh
bash scripts/deployment.sh
```

**Nginx document root:** `$DEPLOY_PATH/backend/public`

**Cron (optional queue worker):**
```cron
* * * * * cd /var/www/deliverex/backend && php artisan schedule:run >> /dev/null 2>&1
```

Point domain A record to VPS IP. Add deploy SSH key to `/root/.ssh/authorized_keys` or deploy user.

---

## Idempotent seeders

All production seeders use `firstOrCreate` / `updateOrCreate` — safe to run on every deploy:

- Demo users (`admin@deliverex.com` / `admin123`, etc.) are ensured via `updateOrCreate`
- Master drivers/vehicles use `firstOrCreate` — **no delete/cleanup** on re-seed
- Job orders use `firstOrCreate` by `tracking_code`

Login uses standard Laravel `Auth::attempt()` — **no seed/migrate logic in auth requests**.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 500 after redeploy | `bash scripts/fix-after-redeploy.sh` |
| `env=no` on ping.php | Run `write-production-env.sh` once |
| Login "Request failed" | `.env` missing — post-deploy script not set |
| Deploy failed in GitHub Actions | Check Actions log; SSH: `tail -80 backend/storage/logs/deploy.log` |
| Rolldown/npm build fails on server | Normal on shared hosting — frontend is built in GitHub Actions |

```bash
bash scripts/diagnose-production.sh
tail -50 backend/storage/logs/deploy.log
```

---

## Scripts reference

| Script | Purpose |
|--------|---------|
| [`deployment.sh`](deployment.sh) | Main entry — run on server |
| [`scripts/deployment.sh`](scripts/deployment.sh) | Implementation |
| [`scripts/hostinger-hpanel-git-deploy.sh`](scripts/hostinger-hpanel-git-deploy.sh) | hPanel post-deploy hook |
| [`scripts/write-production-env.sh`](scripts/write-production-env.sh) | One-time `.env` + backup |
| [`scripts/diagnose-production.sh`](scripts/diagnose-production.sh) | Health check |
| [`scripts/verify-db.sh`](scripts/verify-db.sh) | DB connection test |

See also: [`DEPLOY_HOSTINGER.md`](DEPLOY_HOSTINGER.md)
