# Deliverex — Hostinger Deploy Guide

Dalawang paraan para auto-deploy. **Kung naka-connect na ang GitHub sa hPanel Git**, sundin ang **Path A** muna.

| URL | Serves |
|-----|--------|
| `https://yourdomain.com/` | React app |
| `https://yourdomain.com/api/...` | Laravel API |

---

## Path A — hPanel Git (ginawa mo na: connect GitHub + Deploy)

Ito ang tamang setup pagkatapos i-connect ang repo sa Hostinger.

### Step 1 — Repository path sa hPanel Git

hPanel → **Websites** → **Manage** → **Git** (o **Advanced** → **Git**)

| Setting | Dapat ganito |
|---------|----------------|
| Repository | `https://github.com/taduranmiggy/deliverex.git` |
| Branch | `main` |
| **Install path** | `domains/YOURDOMAIN.com/deliverex` |

**Huwag** i-install directly sa `public_html` root lang — kailangan buong repo (`backend/` + `frontend/` + `scripts/`).

Halimbawa ng install path:
```
/home/u123456789/domains/yourdomain.com/deliverex
```

### Step 2 — Document root (IMPORTANTE)

hPanel → **Websites** → **Manage** → **Advanced** → **Change document root**

Ituro sa Laravel `public` folder:
```
/home/u123456789/domains/yourdomain.com/deliverex/backend/public
```

### Step 3 — MySQL + PHP

1. **Databases** → gumawa ng MySQL database + user
2. **PHP Configuration** → **PHP 8.2+**
3. **SSH Access** → i-enable (kailangan para sa first setup)

### Step 4 — First-time setup (SSH, isang beses lang)

SSH (port usually **65002**):
```bash
ssh -p 65002 u123456789@YOUR_SERVER_IP
```

Pagkatapos ng hPanel Git deploy (may files na sa server):
```bash
cd ~/domains/yourdomain.com/deliverex
bash scripts/hostinger-first-setup.sh
```

I-edit ang `.env`:
```bash
nano backend/.env
```

Ilagay ang MySQL credentials at domain:
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=your_db
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

CORS_ALLOWED_ORIGINS=https://yourdomain.com
SESSION_DOMAIN=yourdomain.com
SANCTUM_STATEFUL_DOMAINS=yourdomain.com
OCR_SYNC_MODE=true
```

Run ulit ang setup:
```bash
bash scripts/hostinger-first-setup.sh
```

### Step 5 — Post-deployment script sa hPanel Git

hPanel → **Git** → hanapin ang **Deployment script** / **Post-deployment command**

I-paste (palitan ang path kung iba ang username/domain):
```bash
bash /home/u123456789/domains/yourdomain.com/deliverex/scripts/hostinger-hpanel-git-deploy.sh
```

Ginagawa nito pagkatapos ng bawat **Deploy** o auto-pull:
- `composer install`
- `php artisan migrate`
- cache config/routes/views
- i-publish ang frontend (kung may build)

### Step 6 — Frontend build config (server)

Copy sa server:
```bash
cp scripts/.deploy.env.example scripts/.deploy.env
nano scripts/.deploy.env
```

```env
DEPLOY_PATH=/home/u123456789/domains/yourdomain.com/deliverex
VITE_API_URL=https://yourdomain.com/api
```

Pag may `VITE_API_URL` at `npm` sa server, auto-build ang React sa deploy.  
Kung **walang npm** sa Hostinger (common sa shared hosting), gamitin ang **Path B (GitHub Actions)** para sa frontend build — mas reliable.

### Step 7 — Manual deploy pagkatapos mag-push sa GitHub

1. Push code sa `main`
2. hPanel → **Git** → **Pull** o **Deploy**
3. Post-deploy script tumatakbo automatically

### Checklist — gumagana na ba?

- [ ] `https://yourdomain.com` — login page lumalabas
- [ ] Login gumagana
- [ ] `/admin` refresh — hindi 404

---

## Path B — GitHub Actions (recommended para sa frontend build)

Mas kumpleto: build ng React sa cloud, upload sa server, run deploy script.

### GitHub Secrets

Repo → **Settings** → **Secrets and variables** → **Actions**

| Secret | Halimbawa |
|--------|-----------|
| `SSH_HOST` | IP mula sa hPanel |
| `SSH_PORT` | `65002` |
| `SSH_USER` | `u123456789` |
| `SSH_PRIVATE_KEY` | buong private key |
| `DEPLOY_PATH` | `/home/u123456789/domains/yourdomain.com/deliverex` |
| `VITE_API_URL` | `https://yourdomain.com/api` |

### SSH key (PowerShell sa PC)
```powershell
ssh-keygen -t ed25519 -C "deliverex-deploy" -f "$env:USERPROFILE\.ssh\deliverex_hostinger"
```

- **Public key** → idagdag sa hPanel SSH Access
- **Private key** → ilagay sa GitHub secret `SSH_PRIVATE_KEY`

### Auto-deploy

Tuwing **push sa `main`**, tumatakbo ang [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Manual: GitHub → **Actions** → **Deploy to Hostinger** → **Run workflow**

Pwede mong gamitin **Path A + Path B** sabay: hPanel Git para sa pull, GitHub Actions para sa full build — o **Path B lang** at i-disable ang hPanel auto-pull para iwas double deploy.

---

## Scripts reference

| Script | Kailan |
|--------|--------|
| [`scripts/hostinger-first-setup.sh`](scripts/hostinger-first-setup.sh) | Isang beses: `.env`, composer, migrate |
| [`scripts/hostinger-hpanel-git-deploy.sh`](scripts/hostinger-hpanel-git-deploy.sh) | I-paste sa hPanel Git post-deploy |
| [`scripts/deploy-hostinger.sh`](scripts/deploy-hostinger.sh) | GitHub Actions / manual SSH |
| [`scripts/.deploy.env.example`](scripts/.deploy.env.example) | Copy to `scripts/.deploy.env` sa server |

---

## Troubleshooting

| Problema | Solusyon |
|---------|----------|
| 500 error | `tail backend/storage/logs/laravel.log`; `php artisan config:clear` |
| Blank / white page | Walang frontend build — gamitin GitHub Actions o set `VITE_API_URL` sa `.deploy.env` |
| Laravel welcome page | Mali ang document root — dapat `backend/public` |
| CORS error | `CORS_ALLOWED_ORIGINS=https://yourdomain.com` sa `.env` |
| composer not found | hPanel → Composer → install sa `backend/` folder |
| Git pull fail | Check repo access sa hPanel Git settings |

---

## Domain (hindi mawawala)

Ang **domain** na binili niyo ay hiwalay sa website files. Kahit i-delete o i-reset ang website, nandoon pa rin ang domain sa **Domains** section — pwede ninyong i-connect ulit sa bagong setup.
