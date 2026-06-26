# Zero-Touch Deploy — Push Lang, Gumana Na

Pag na-setup na **isang beses** ang server, ang flow ay:

```
git push origin main  →  GitHub Actions  →  server auto-deploy  →  live
```

**Hindi mo na kailangan** mag-SSH o mag-run ng commands pagkatapos mag-push.

---

## Isang beses lang (pili ng isa)

### Option A — hPanel Post-Deploy Script (pinakasimple)

1. hPanel → **Websites** → **Git** → i-connect ang repo (`taduranmiggy/deliverex`, branch `main`)
2. I-enable **Auto Deployment** (kung may toggle)
3. Sa **Post-deployment script**, i-paste:

```bash
bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/hostinger-hpanel-git-deploy.sh
```

Palitan ang path kung iba ang install path mo (check sa hPanel Git → Install path).

4. Click **Deploy** isang beses para ma-run ang unang deploy.

**Tapos na.** Bawat `git push` sa `main` → hPanel auto-pull → script tumatakbo → composer + migrate + live.

---

### Option B — GitHub Deploy Hook (instant, ~30 segundo)

1. Sa server (SSH, isang beses):

```bash
cd ~/domains/deliverexapp.com/public_html
bash scripts/setup-hostinger-autodeploy.sh
```

2. Kopyahin ang `DEPLOY_HOOK_TOKEN` na ipapakita
3. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New secret**
   - Name: `DEPLOY_HOOK_TOKEN`
   - Value: (yung token)

**Tapos na.** Bawat push → GitHub Actions tumatawag sa deploy hook → server nagde-deploy agad.

---

### Option C — Cron (walang GitHub secret, ~5 min delay)

hPanel → **Advanced** → **Cron Jobs** → add:

```bash
*/5 * * * * bash /home/u826622735/domains/deliverexapp.com/public_html/scripts/hostinger-cron-deploy.sh
```

**Tapos na.** Bawat push → within 5 minutes auto-pull + deploy.

---

## Paano malalaman na gumagana

Buksan: `https://deliverexapp.com/ping.php`

Dapat makita:

```
pong
env=yes
vendor=yes
git=6d3f6c6   ← dapat tumugma sa latest commit
```

Kung `env=no` o `vendor=no` → hindi pa tumatakbo ang deploy script. Ulitin ang one-time setup sa itaas.

---

## Ano ang ginagawa ng auto-deploy

- Restore `backend/.env` mula sa `.deliverex.env` backup
- `composer install --no-dev`
- `php artisan migrate --force` (safe — hindi dine-delete ang data)
- Cache clear + config cache
- Frontend mula sa `backend/public/` (naka-commit na sa git)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Push pero luma pa ang site | Check hPanel Auto Deploy ON; o i-run Option B/C |
| `env=no` sa ping | Walang post-deploy script — i-paste Option A |
| Login "Request failed" | `bash scripts/fix-after-redeploy.sh` sa SSH (isang beses) |
| GitHub Actions hindi tumatakbo | Check **Actions** tab sa GitHub — dapat may green check |

---

## Document root (importante)

Dapat naka-point sa:

```
/home/u826622735/domains/deliverexapp.com/public_html/backend/public
```

(hPanel → Advanced → Change document root)
