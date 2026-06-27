# Deliverex — Deployment Architecture

Production deploy target: **Hostinger shared hosting** (hPanel, no root/sudo).

## Flow (single path)

```
git push origin main
        ↓
GitHub Actions (.github/workflows/deploy.yml)
        ↓
Build React frontend (CI only — not committed to main)
        ↓
SCP frontend tarball to server
        ↓
SSH → scripts/deploy-from-ci.sh
        ↓
scripts/deployment.sh
        ↓
Health check (ping.php)
        ↓
Success (green) or Fail + rollback (red)
```

**Disable** hPanel Auto Deployment, post-deploy scripts, cron deploy, and deploy-hook usage to prevent race conditions.

---

## Server directory layout

```
/home/USER/domains/deliverexapp.com/
├── shared/                          ← persistent (never wiped by git)
│   ├── .env                         ← canonical environment file
│   ├── .deploy.secrets              ← DB + API secrets (bootstrap only)
│   ├── storage/                     ← Laravel storage (logs, cache, sessions)
│   ├── uploads/                     ← general uploads
│   ├── pod/                         ← POD / delivery_documents files
│   ├── ocr/                         ← OCR working files
│   └── deploy-state/
│       ├── previous-sha             ← rollback target
│       └── current-sha
└── public_html/                     ← git checkout (DEPLOY_PATH)
    ├── backend/
    │   ├── .env  → ../../shared/.env
    │   ├── storage → ../../shared/storage
    │   └── public/                  ← document root
    └── scripts/
```

Document root (hPanel): `public_html/backend/public`

---

## GitHub Secrets (required)

| Secret | Example | Description |
|--------|---------|-------------|
| `SSH_HOST` | `153.92.9.220` | Hostinger server IP |
| `SSH_PORT` | `65002` | Hostinger SSH port |
| `SSH_USER` | `u826622735` | SSH username |
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | Deploy private key (full PEM) |
| `DEPLOY_PATH` | `/home/u826622735/domains/deliverexapp.com/public_html` | Git repo root on server |
| `VITE_API_URL` | `https://deliverexapp.com/api` | Optional — frontend build API URL |
| `APP_URL` | `https://deliverexapp.com` | Optional — health check base URL |

Generate SSH key locally:

```powershell
ssh-keygen -t ed25519 -C "deliverex-deploy" -f $env:USERPROFILE\.ssh\deliverex_hostinger
```

Add the `.pub` key in hPanel → **SSH Access** → **Add SSH key**.

Add the private key contents to GitHub → **Settings** → **Secrets** → **Actions** → `SSH_PRIVATE_KEY`.

---

## One-time server setup (SSH once)

```bash
cd ~/domains/deliverexapp.com/public_html
bash scripts/setup-hostinger-autodeploy.sh   # creates shared/.deploy.secrets + shared/.env
bash scripts/setup-shared-layout.sh          # migrates storage + symlinks
bash scripts/deployment.sh                   # verify first deploy works
```

Then add GitHub Secrets and push to `main`.

### hPanel checklist

1. **Git** — repo connected (for initial clone only); **disable Auto Deployment**
2. **Post-deploy script** — remove or leave empty
3. **Cron** — remove `hostinger-cron-deploy.sh` if present
4. **Document root** — `.../public_html/backend/public`
5. **PHP** — 8.2+

---

## What `deployment.sh` runs

| Step | Command |
|------|---------|
| Shared layout | `setup-shared-layout.sh` |
| Environment | `provision-env.sh` (never overwrites existing `shared/.env`) |
| Dependencies | `composer install --no-dev --optimize-autoloader` |
| Database | `php artisan migrate --force` |
| Clear | `php artisan optimize:clear` |
| Cache | `config:cache`, `route:cache`, `view:cache` |
| Storage | `php artisan storage:link` |
| Queues | `php artisan queue:restart \|\| true` |
| Health | `health-check.sh` → `ping.php` |

On failure: automatic rollback to previous git commit via `rollback.sh`.

---

## Health check

```bash
curl -s https://deliverexapp.com/ping.php
```

Expected:

```
pong
env=yes
vendor=yes
db=yes
storage=yes
```

GitHub Actions fails if any check is not `yes` after retries.

---

## Rollback

Automatic: if deploy or health check fails, `rollback.sh` resets git to `shared/deploy-state/previous-sha` and re-runs `deployment.sh`.

Manual (emergency):

```bash
cd ~/domains/deliverexapp.com/public_html
bash scripts/rollback.sh
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| GitHub Actions red at "Validate SSH secrets" | Missing GitHub Secrets | Add all required secrets |
| `env=no` on ping.php | `shared/.env` missing | Run `setup-hostinger-autodeploy.sh` once |
| `vendor=no` | composer failed | Check `shared/storage/logs/deploy.log` |
| `db=no` | Wrong DB credentials | Edit `shared/.env` (never deleted by deploy) |
| `storage=no` | Symlink broken | Re-run `deployment.sh` |
| Site breaks after push | hPanel auto-deploy still ON | Disable hPanel Git auto-deploy |
| Double deploy / race | cron + webhook + CI | Remove cron/webhook; CI only |
| Frontend stale | Old flow committed assets | New flow uploads via SCP — hard refresh |

### Logs

```bash
tail -80 ~/domains/deliverexapp.com/shared/storage/logs/deploy.log
tail -80 ~/domains/deliverexapp.com/shared/storage/logs/laravel.log
```

---

## What is NOT used

- Docker / Kubernetes
- Supervisor / systemd / service restarts (no root on shared hosting)
- Webhook → hPanel → cron chain
- Committing `backend/public/` build artifacts to `main`
- `continue-on-error` on deploy steps

---

## Environment protection rules

1. `shared/.env` is created **once** from secrets or legacy backup
2. Existing `shared/.env` is **never overwritten** on deploy
3. `backend/.env` is always a symlink to `shared/.env`
4. Secret keys (e.g. `RESEND_API_KEY`) are merged into existing `.env` without wiping other values

---

## Storage protection rules

1. `backend/storage` → symlink to `shared/storage`
2. POD files live in `shared/pod/` (linked as `delivery_documents`)
3. OCR files in `shared/ocr/`
4. Git deploy never deletes `shared/` contents
