# Deliverex — Production Deployment

Zero-maintenance deploy for Laravel on Hostinger. After one-time setup, every `git push` to `main` runs migrate + seed + cache automatically via GitHub Actions or hPanel post-deploy hook.

---

## What runs on every deploy

[`scripts/deployment.sh`](scripts/deployment.sh) (or [`deployment.sh`](deployment.sh) at repo root):

| Step | Command |
|------|---------|
| Restore `.env` | Copy from `../.deliverex.env` (survives git redeploy) |
| Dependencies | `composer install --no-dev --optimize-autoloader` |
| Migrations | `php artisan migrate --force` |
| Seed | `php artisan db:seed --force` (idempotent) |
| Clear caches | `php artisan optimize:clear` |
| Cache config/routes | `php artisan config:cache` + `php artisan route:cache` |
| Frontend | Publish git-committed `backend/public/` or `/tmp/deliverex-dist` |

**Logs:** `backend/storage/logs/deploy.log`

---

## GitHub Actions (recommended)

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

Builds the React app in CI, commits assets to `backend/public/`, and pushes to `main`.  
**Hostinger pulls via hPanel Git** — SSH from GitHub Actions is not used (shared hosting often blocks GitHub IPs).

Triggers on every push to `main` (except commits that only change `backend/public/`).

### Optional GitHub Secret

| Secret | Example | Description |
|--------|---------|-------------|
| `VITE_API_URL` | `https://deliverexapp.com/api` | Frontend API URL at build time |

### After CI push

1. hPanel → **Git** → **Deploy** (install path: `domains/deliverexapp.com/public_html`)
2. Post-deploy script runs on the server automatically

### Manual workflow run

GitHub → **Actions** → **Deploy to Hostinger** → **Run workflow**

### SSH (manual server tasks only)

Use SSH from your PC for first-time setup, storage fix, and diagnostics — not for GitHub Actions deploy.

```powershell
ssh -p 65002 u826622735@147.93.101.66
cd ~/domains/deliverexapp.com/public_html
bash scripts/hostinger-first-setup.sh
bash scripts/fix-storage.sh
```

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
