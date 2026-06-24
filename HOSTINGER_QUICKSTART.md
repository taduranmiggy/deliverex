# Hostinger — deliverexapp.com (copy-paste)

Domain: **https://deliverexapp.com**  
Repo: `https://github.com/taduranmiggy/deliverex.git` (branch `main`)

---

## A. Sa hPanel (gawin mo sa browser)

### 1. Git → Repository
| Setting | Value |
|---------|--------|
| Repository | `https://github.com/taduranmiggy/deliverex.git` |
| Branch | `main` |
| Install path | tingnan sa Step B — SSH command `hostinger-hpanel-paths.sh` |

### 2. Document root
hPanel → **Websites** → **deliverexapp.com** → **Advanced** → **Change document root**

Path: `.../deliverex/backend/public` (buong path sa Step B)

### 3. Post-deployment script
hPanel → **Git** → **Deployment script**

```bash
bash /home/uXXXXXXX/domains/deliverexapp.com/deliverex/scripts/hostinger-hpanel-git-deploy.sh
```

Palitan `uXXXXXXX` ng username mo, o kopyahin ang exact line mula sa Step B.

### 4. I-click **Deploy** sa Git

---

## B. Sa SSH (isang beses lang)

hPanel → **SSH Access** → i-on → kopyahin ang command (hal. `ssh -p 65002 u123@ip`).

```bash
cd ~/domains/deliverexapp.com/deliverex
bash scripts/hostinger-hpanel-paths.sh
```

Kopyahin ang output → ilagay sa hPanel (document root + post-deploy script).

```bash
bash scripts/hostinger-first-setup.sh
```

Kung wala pang `.env`, gagawa ito mula sa `.env.example`. I-edit:

```bash
nano backend/.env
```

Minimum na palitan:
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://deliverexapp.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=...   # mula sa hPanel → Databases
DB_USERNAME=...
DB_PASSWORD=...

CORS_ALLOWED_ORIGINS=https://deliverexapp.com
SESSION_DOMAIN=deliverexapp.com
SANCTUM_STATEFUL_DOMAINS=deliverexapp.com
```

Tapos:
```bash
bash scripts/hostinger-first-setup.sh
bash scripts/hostinger-hpanel-git-deploy.sh
```

Buksan: **https://deliverexapp.com**

---

## C. Tuwing may bagong code

1. Push sa `main` sa GitHub
2. hPanel → Git → **Deploy**
3. Post-deploy script ang mag-aasikaso ng composer, migrate, at frontend build

---

Buong guide: [DEPLOY_HOSTINGER.md](DEPLOY_HOSTINGER.md)
