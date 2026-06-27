# Deliverex OCR Service

Small Render-hosted OCR API for Deliverex. It installs Tesseract in Docker and exposes:

- `GET /health`
- `POST /ocr` with multipart field `file`

The `/ocr` endpoint requires:

```http
Authorization: Bearer <OCR_SERVICE_TOKEN>
```

## Render settings

- Service type: Web Service
- Runtime: Docker
- Root directory: leave blank
- Dockerfile path: `ocr-service/Dockerfile`
- Plan: Free
- Environment variable:
  - Required:

```env
OCR_SERVICE_TOKEN=<long-random-secret>
```

  - Optional tuning:

```env
OCR_LANG=eng
OCR_PSM_CANDIDATES=3,4,6,11,12
OCR_OEM_CANDIDATES=3
OCR_MAX_VARIANTS=4
OCR_MAX_PASSES=12
OCR_EARLY_EXIT_SCORE=0.55
OCR_ENABLE_DESKEW=true
OCR_ENABLE_MORPH=true
TESSERACT_TIMEOUT=120
OCR_MAX_UPLOAD_BYTES=10485760
OCR_DEBUG_MODE=true
OCR_DEBUG_ROOT=/tmp/deliverex-ocr-debug
```

After deploy, set Hostinger Laravel:

```env
OCR_ENGINE=remote
OCR_REMOTE_URL=https://your-render-service.onrender.com/ocr
OCR_REMOTE_TOKEN=<same-long-random-secret>
OCR_REMOTE_TIMEOUT=180
OCR_REMOTE_PSM_CANDIDATES=3,4,6,11,12
OCR_REMOTE_MAX_VARIANTS=4
OCR_REMOTE_ENABLE_DESKEW=true
OCR_REMOTE_ENABLE_MORPH=true
OCR_DIAGNOSTICS_ENABLED=true
OCR_DEBUG_MODE=true
```

The API now returns `diagnostics` metadata (`chosen_variant`, `chosen_psm`, candidate scores, and active config) to help debug poor OCR results.
When debug mode is enabled, preprocessing artifacts are saved under `/tmp/deliverex-ocr-debug/<id>/`.

## Smoke test

Run synthetic OCR checks (clean, skewed, low-contrast) before deploying:

```bash
cd ocr-service
python smoke_test.py
```
