import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile


app = FastAPI(title="Deliverex OCR Service")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp"}
MAX_UPLOAD_BYTES = int(os.getenv("OCR_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
TESSERACT_TIMEOUT = int(os.getenv("TESSERACT_TIMEOUT", "120"))


def configured_token() -> str:
    return os.getenv("OCR_SERVICE_TOKEN", "").strip()


def require_bearer(authorization: str | None) -> None:
    token = configured_token()
    if not token:
        raise HTTPException(status_code=500, detail="OCR_SERVICE_TOKEN is not configured")

    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def estimate_confidence(text: str) -> float | None:
    if not text:
        return None

    length = len(text)
    if length > 200:
        return 0.88
    if length > 50:
        return 0.75
    return 0.55


@app.get("/health")
def health() -> dict:
    try:
        completed = subprocess.run(
            ["tesseract", "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Tesseract unavailable: {exc}") from exc

    first_line = completed.stdout.splitlines()[0] if completed.stdout else "tesseract"
    return {"status": "ok", "engine": "render-tesseract", "version": first_line}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...), authorization: str | None = Header(default=None)) -> dict:
    require_bearer(authorization)

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {suffix or 'unknown'}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large for OCR")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(contents)
            temp_path = temp_file.name

        completed = subprocess.run(
            ["tesseract", temp_path, "stdout", "-l", "eng", "--psm", "6"],
            capture_output=True,
            text=True,
            timeout=TESSERACT_TIMEOUT,
        )

        if completed.returncode != 0:
            message = (completed.stderr or completed.stdout or "Tesseract failed").strip()
            raise HTTPException(status_code=500, detail=message)

        text = completed.stdout.strip()
        return {
            "text": text,
            "confidence": estimate_confidence(text),
            "engine": "render-tesseract",
        }
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Tesseract timed out") from exc
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass
