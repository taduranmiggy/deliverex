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

```env
OCR_SERVICE_TOKEN=<long-random-secret>
```

After deploy, set Hostinger Laravel:

```env
OCR_ENGINE=remote
OCR_REMOTE_URL=https://your-render-service.onrender.com/ocr
OCR_REMOTE_TOKEN=<same-long-random-secret>
OCR_REMOTE_TIMEOUT=180
```
