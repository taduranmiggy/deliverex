# Deliverex — Defense Demo Setup

Run these steps before your capstone defense.

## Backend (`backend/`)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan queue:work
```

In another terminal:

```bash
php artisan serve
```

### OCR (recommended for live demo)

Uploads are processed **immediately** (no queue worker required for basic OCR).

For real text extraction, install [Tesseract OCR](https://github.com/tesseract-ocr/tesseract):

**Windows**
1. Download installer from [UB-Mannheim tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
2. Install to `C:\Program Files\Tesseract-OCR`
3. Optional: add that folder to system PATH
4. Restart `php artisan serve` after install

**Verify**
```powershell
& "C:\Program Files\Tesseract-OCR\tesseract.exe" --version

If `tesseract` works in PowerShell but OCR still shows "stub", PHP may not see your PATH. Either:

1. **Restart** the terminal running `php artisan serve` (required after editing PATH), or  
2. Set in `backend/.env`:
   ```
   TESSERACT_PATH="C:\full\path\to\tesseract.exe"
   ```
3. Verify from backend folder:
   ```
   php artisan ocr:check
   ```
```

Without Tesseract, OCR completes in **stub mode** (`engine: stub`) — use **Reprocess OCR** in Admin after installing.

**Storage (required for image preview)**
```bash
php artisan storage:link
```

## Frontend (`frontend/`)

```bash
cd frontend
npm install
```

Set `VITE_API_URL=http://localhost:8000/api` in `frontend/.env`.

```bash
npm run dev
```

## Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@deliverex.com | admin123 |
| Dispatcher | dispatcher@deliverex.com | dispatcher123 |
| Manager | manager@deliverex.com | manager123 |
| Driver | driver@deliverex.ph | driver123 |

## Defense script (create data live)

1. **Dispatcher** → Job Orders → create job (note **tracking code**).
2. **Dispatcher** → Fleet Dispatch → Best-Fit → **Assign This Driver** → confirm.
3. **Driver** (mobile view) → job → En Route (GPS on) → upload POD → Completed.
4. **Admin** → OCR Validation → preview image → Approve.
5. **Manager** → Reports → Export CSV; Fleet Tracking → map.
6. **Customer** → Track → enter tracking code from step 1.

Avoid public tracking codes prefixed `DEMO-` (blocked on tracking API).

## PWA / offline

- Status and GPS queue in localStorage and sync on reconnect.
- Document uploads queue offline (max 2 MB per image) and sync when online.
