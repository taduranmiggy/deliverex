# Deliverex — Defense Demo Setup

Run these steps before your capstone defense.

## Backend (`backend/`)

```powershell
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

### OCR (recommended for live demo)

Set in `backend/.env`:

```env
TESSERACT_PATH="C:/Program Files/Tesseract-OCR/tesseract.exe"
OCR_SYNC_MODE=true
```

With `OCR_SYNC_MODE=true`, OCR runs **immediately after upload** — no queue worker required.

If `OCR_SYNC_MODE=false`, run a queue worker in a second terminal:

```powershell
php artisan queue:work
```

#### Install Tesseract (Windows)

1. Download from [UB-Mannheim tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
2. Install to `C:\Program Files\Tesseract-OCR`
3. Add to `backend/.env` (use forward slashes):
   ```
   TESSERACT_PATH="C:/Program Files/Tesseract-OCR/tesseract.exe"
   ```
4. **Restart** `php artisan serve` after editing `.env`

#### Verify OCR

```powershell
& "C:\Program Files\Tesseract-OCR\tesseract.exe" --version
cd backend
php artisan ocr:check
php scripts/test_ocr.php
```

If Tesseract is missing, OCR status becomes **failed** with a clear error (not silent fake text).  
Optional local-only stub: `OCR_STUB_FALLBACK=true` (never use in production).

#### Storage (required for Admin image preview)

```powershell
php artisan storage:link
```

Uploaded files live in `storage/app/public/delivery_documents/` and are served via authenticated API: `GET /api/documents/{id}/file`.

## Frontend (`frontend/`)

```powershell
cd frontend
npm install
```

Set `VITE_API_URL=http://localhost:8000/api` in `frontend/.env`.

```powershell
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
4. **Admin** → OCR Validation → preview image → edit text → **Validate**.
5. **Manager** → Reports → Export CSV; Fleet Tracking → map.
6. **Customer** → Track → enter tracking code from step 1.

Avoid public tracking codes prefixed `DEMO-` (blocked on tracking API).

## OCR testing checklist

1. Driver PWA → Upload → Take Photo or Upload JPG/PNG → Submit Document
2. Admin → OCR Validation → document appears in queue
3. Status moves: `pending` → `processing` → `processed` or `needs_review`
4. Image preview loads (no 404)
5. Extracted text visible
6. Edit text → Validate → status `validated`
7. If failed: error message shown → fix Tesseract → Reprocess OCR

## PWA / offline

- Status and GPS queue in localStorage and sync on reconnect.
- Document uploads queue offline (max 2 MB per image) and sync when online.
