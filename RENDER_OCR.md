# Deliverex Render OCR Setup

Use this when Hostinger cannot run native Tesseract. The Laravel app stays on Hostinger, and Render runs a small Docker OCR API.

## 1. Push these files

Commit and push the repo changes that add `ocr-service/` and remote OCR support.

## 2. Create Render web service

In Render:

1. New -> Web Service.
2. Connect the Deliverex GitHub repo.
3. Runtime/Language: Docker.
4. Root directory: leave blank.
5. Dockerfile path: `ocr-service/Dockerfile`.
6. Plan: Free.
7. Add environment variable:

```env
OCR_SERVICE_TOKEN=<long-random-secret>
```

Generate a token locally with:

```bash
openssl rand -hex 32
```

After deploy, test:

```text
https://your-render-service.onrender.com/health
```

## 3. Configure Hostinger Laravel

Edit `backend/.env` on Hostinger:

```env
OCR_ENGINE=remote
OCR_REMOTE_URL=https://your-render-service.onrender.com/ocr
OCR_REMOTE_TOKEN=<same-long-random-secret>
OCR_REMOTE_TIMEOUT=180
OCR_SYNC_MODE=true
```

Then clear Laravel config:

```bash
cd /path/to/deliverex/backend
php artisan config:clear
php artisan optimize:clear
php artisan ocr:check
```

## 4. Verify

1. Open Admin -> OCR Review.
2. Click Reprocess OCR on a failed document.
3. Confirm the missing local Tesseract warning disappears.
4. Confirm the OCR result engine is `render-tesseract`.

Render Free can sleep after idle time. If the first OCR request is slow or times out, wait for the service to wake up and click Reprocess OCR again.

## 5. Troubleshooting 502 Bad Gateway

If Hostinger shows:

```text
HEALTH_HTTP=502
ERROR=Remote OCR failed: Application failed to respond
```

the Laravel app is fine — the Render OCR container is not responding. Fix it on Render, not Hostinger.

1. Open the Render service dashboard -> **Logs**.
2. Look for deploy/build errors or startup crashes (common after adding OpenCV):
   - `ImportError: libGL.so.1`
   - `ImportError: libgomp.so.1`
3. Confirm settings:
   - Root directory: blank
   - Dockerfile path: `ocr-service/Dockerfile`
   - Env: `OCR_SERVICE_TOKEN=<secret>`
4. Click **Manual Deploy -> Deploy latest commit** after pushing repo changes.
5. Wait until Render shows **Live**, then test in browser:

```text
https://your-render-service.onrender.com/health
```

Expected JSON:

```json
{"status":"ok","engine":"render-tesseract","opencv":true,"version":"tesseract 5.x"}
```

6. On Hostinger:

```bash
php scripts/ocr-diagnose.php --ping
php scripts/ocr-diagnose.php 19
```

Recommended Render env for Free tier (keeps responses under Hostinger timeout):

```env
OCR_PSM_CANDIDATES=6,11,4
OCR_MAX_VARIANTS=2
OCR_MAX_PASSES=8
TESSERACT_TIMEOUT=60
OCR_DEBUG_MODE=false
```
