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
