import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile


app = FastAPI(title="Deliverex OCR Service")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp"}
MAX_UPLOAD_BYTES = int(os.getenv("OCR_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
TESSERACT_TIMEOUT = int(os.getenv("TESSERACT_TIMEOUT", "120"))
OCR_LANG = os.getenv("OCR_LANG", "eng").strip() or "eng"
OCR_ENABLE_DESKEW = os.getenv("OCR_ENABLE_DESKEW", "true").lower() == "true"
OCR_ENABLE_MORPH = os.getenv("OCR_ENABLE_MORPH", "true").lower() == "true"
OCR_PSM_CANDIDATES = [x.strip() for x in os.getenv("OCR_PSM_CANDIDATES", "6,11,7").split(",") if x.strip()]
OCR_MAX_VARIANTS = max(1, int(os.getenv("OCR_MAX_VARIANTS", "4")))


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


def decode_image(contents: bytes) -> np.ndarray:
    np_bytes = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(np_bytes, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image for OCR")
    return image


def remove_alpha(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image
    if image.shape[2] == 4:
        alpha = image[:, :, 3].astype(np.float32) / 255.0
        rgb = image[:, :, :3].astype(np.float32)
        white = np.ones_like(rgb, dtype=np.float32) * 255.0
        blended = (alpha[..., None] * rgb + (1.0 - alpha[..., None]) * white).astype(np.uint8)
        return cv2.cvtColor(blended, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def deskew(gray: np.ndarray) -> np.ndarray:
    inv = cv2.bitwise_not(gray)
    coords = np.column_stack(np.where(inv > 0))
    if coords.size == 0:
        return gray

    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.2:
        return gray

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def with_border(image: np.ndarray, border: int = 12) -> np.ndarray:
    return cv2.copyMakeBorder(image, border, border, border, border, cv2.BORDER_CONSTANT, value=255)


def build_variants(
    raw: np.ndarray,
    enable_deskew: bool,
    enable_morph: bool,
    max_variants: int,
) -> dict[str, np.ndarray]:
    gray = remove_alpha(raw)
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    variants: dict[str, np.ndarray] = {"gray": with_border(gray)}

    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants["otsu"] = with_border(otsu)

    adaptive = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    variants["adaptive"] = with_border(adaptive)

    if enable_morph:
        kernel = np.ones((2, 2), np.uint8)
        eroded = cv2.erode(adaptive, kernel, iterations=1)
        variants["adaptive_eroded"] = with_border(eroded)

    if enable_deskew:
        variants = {name: deskew(img) for name, img in variants.items()}

    limited: dict[str, np.ndarray] = {}
    for name, image in variants.items():
        limited[name] = image
        if len(limited) >= max(1, max_variants):
            break
    return limited


def parse_bool(raw: str | None, fallback: bool) -> bool:
    if raw is None:
        return fallback
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return fallback


def parse_int(raw: str | None, fallback: int, minimum: int = 1, maximum: int = 10) -> int:
    if raw is None:
        return fallback
    try:
        value = int(raw.strip())
    except ValueError:
        return fallback
    return max(minimum, min(maximum, value))


def parse_psm(raw: str | None, fallback: list[str]) -> list[str]:
    if raw is None:
        return fallback
    values = [x.strip() for x in raw.split(",") if x.strip().isdigit()]
    return values or fallback


def score_text(text: str) -> float:
    if not text:
        return 0.0
    lower = text.lower()
    length_score = min(len(text), 500) / 500.0
    digit_ratio = (sum(ch.isdigit() for ch in text) / max(1, len(text)))
    keyword_hits = sum(1 for kw in ("receipt", "delivery", "length", "width", "height", "volume", "dr", "no") if kw in lower)
    alpha_num = sum(ch.isalnum() for ch in text) / max(1, len(text))
    return (0.45 * length_score) + (0.2 * min(digit_ratio * 4.0, 1.0)) + (0.2 * min(keyword_hits / 5.0, 1.0)) + (0.15 * alpha_num)


def run_tesseract(image_path: str, psm: str) -> tuple[str, str]:
    completed = subprocess.run(
        ["tesseract", image_path, "stdout", "-l", OCR_LANG, "--psm", psm],
        capture_output=True,
        text=True,
        timeout=TESSERACT_TIMEOUT,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "Tesseract failed").strip()
        raise RuntimeError(message)
    return completed.stdout.strip(), (completed.stderr or "").strip()


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
async def ocr(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    x_ocr_psm_candidates: str | None = Header(default=None),
    x_ocr_max_variants: str | None = Header(default=None),
    x_ocr_enable_deskew: str | None = Header(default=None),
    x_ocr_enable_morph: str | None = Header(default=None),
) -> dict:
    require_bearer(authorization)

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {suffix or 'unknown'}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large for OCR")

    psm_candidates = parse_psm(x_ocr_psm_candidates, OCR_PSM_CANDIDATES)
    max_variants = parse_int(x_ocr_max_variants, OCR_MAX_VARIANTS, minimum=1, maximum=8)
    enable_deskew = parse_bool(x_ocr_enable_deskew, OCR_ENABLE_DESKEW)
    enable_morph = parse_bool(x_ocr_enable_morph, OCR_ENABLE_MORPH)

    try:
        raw = decode_image(contents)
        variants = build_variants(raw, enable_deskew=enable_deskew, enable_morph=enable_morph, max_variants=max_variants)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Image preprocessing failed: {exc}") from exc

    artifacts: list[str] = []
    candidates: list[dict[str, Any]] = []

    try:
        for variant_name, variant_img in variants.items():
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                temp_path = tmp.name
            artifacts.append(temp_path)
            ok = cv2.imwrite(temp_path, variant_img)
            if not ok:
                continue

            for psm in psm_candidates:
                try:
                    text, stderr = run_tesseract(temp_path, psm)
                    score = score_text(text)
                    candidates.append(
                        {
                            "variant": variant_name,
                            "psm": psm,
                            "score": round(score, 4),
                            "text_len": len(text),
                            "text": text,
                            "stderr": stderr[:180],
                        }
                    )
                except subprocess.TimeoutExpired as exc:
                    raise HTTPException(status_code=504, detail="Tesseract timed out") from exc
                except RuntimeError as exc:
                    candidates.append(
                        {
                            "variant": variant_name,
                            "psm": psm,
                            "score": 0.0,
                            "text_len": 0,
                            "text": "",
                            "stderr": str(exc)[:180],
                        }
                    )

        if not candidates:
            raise HTTPException(status_code=500, detail="OCR could not produce any candidate output")

        ranked = sorted(candidates, key=lambda item: (item["score"], item["text_len"]), reverse=True)
        best = ranked[0]
        text = best["text"].strip()

        return {
            "text": text,
            "confidence": estimate_confidence(text),
            "engine": "render-tesseract",
            "diagnostics": {
                "chosen_variant": best["variant"],
                "chosen_psm": best["psm"],
                "candidate_scores": [
                    {
                        "variant": item["variant"],
                        "psm": item["psm"],
                        "score": item["score"],
                        "text_len": item["text_len"],
                    }
                    for item in ranked[:8]
                ],
                "variants_tested": len(variants),
                "passes_tested": len(candidates),
                "config": {
                    "psm_candidates": psm_candidates,
                    "max_variants": max_variants,
                    "enable_deskew": enable_deskew,
                    "enable_morph": enable_morph,
                },
            },
        }
    finally:
        for path in artifacts:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
