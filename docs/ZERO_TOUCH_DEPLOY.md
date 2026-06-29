# Zero-Touch Deploy — Push Lang, Gumana Na

Pag na-setup na **isang beses** ang server, ang flow ay:

```
git push origin main  →  GitHub Actions (build + artifact)  →  server cron auto-deploy  →  live
```

**Hindi mo na kailangan** mag-SSH pagkatapos mag-push.

---

## Isang beses lang (required)

### 1. Server secrets (SSH, isang beses)

```bash
cd ~/domains/deliverexapp.com/public_html
bash scripts/setup-hostinger-autodeploy.sh
```

Sa `~/domains/deliverexapp.com/shared/.deploy.secrets`, lagyan ng:

```
GITHUB_DEPLOY_TOKEN=<GitHub PAT with repo + actions:read>
```

### 2. GitHub Actions secret

GitHub repo → **Settings** → **Secrets** → **Actions**:

| Name | Value |
|------|-------|
| `DEPLOY_HOOK_TOKEN` | Same token as in `shared/.deploy.secrets` |

### 3. hPanel cron (isang beses — ito ang auto-deploy, walang SSH after)

hPanel → **Advanced** → **Cron Jobs** → add **every minute**:

```bash
* * * * * bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/process-deploy-queue.sh
```

Palitan ang path kung iba ang install path mo.

**Tapos na.** Bawat `git push` sa `main`:

1. GitHub Actions nagbu-build ng frontend at nag-upload ng artifact
2. Sa loob ng ~1–2 minuto, ang cron sa server kumukuha ng artifact mula GitHub at nagde-deploy
3. Walang SSH na kailangan

> **Note:** Ang deploy webhook (`deploy-hook.php`) ay bonus lang — madalas blocked ang GitHub IPs sa Hostinger. Ang cron ang primary path.

---

## Optional — hPanel Git (huwag gamitin kasabay ng CI)

**I-disable** ang hPanel Git Auto Deployment kung gumagamit ka ng GitHub Actions + cron — magdudulot ng race condition.

---

## Paano malalaman na gumagana

Buksan: `https://deliverexapp.com/ping.php`

Dapat makita:

```
pong
env=yes
vendor=yes
version=d9ef9e5   ← live deployed commit (tumugma sa latest push)
deploy=d9ef9e5
```

Kung `version=` ay luma pa habang may bagong push sa GitHub `main`, check ang cron log:

```bash
tail -40 ~/domains/deliverexapp.com/shared/deploy-state/deploy-logs/cron-deploy.log
```

Kung `GITHUB_DEPLOY_TOKEN missing` → lagyan sa `shared/.deploy.secrets`.

---

## Ano ang ginagawa ng auto-deploy

- Download CI artifact (`deliverex-deploy.tar.gz`) mula GitHub
- Restore `backend/.env` mula sa `shared/.env`
- `composer install --no-dev`
- `php artisan migrate --force` (safe — hindi dine-delete ang data)
- Cache clear + config cache
- Frontend mula sa CI build

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Push pero luma pa ang site | Check hPanel cron (every minute) + `GITHUB_DEPLOY_TOKEN` |
| `env=no` sa ping | Run `setup-hostinger-autodeploy.sh` once |
| Cron log: `No deploy artifact ready` | Wait 1–2 min after push (CI still building) |
| Cron log: `deploy-from-ci.sh failed` | `tail -80 ~/domains/deliverexapp.com/shared/deploy-state/deploy-logs/cron-deploy.log` |
| GitHub Actions red | Check **Actions** tab — build must succeed first |

---

## Document root (importante)

Dapat naka-point sa:

```
/home/u826622735/domains/deliverexapp.com/public_html/backend/public
```

(hPanel → Advanced → Change document root)
