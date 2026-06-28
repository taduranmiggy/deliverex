import os
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

try:
    import cv2
    import numpy as np

    CV2_AVAILABLE = True
    CV2_IMPORT_ERROR: str | None = None
except ImportError as exc:
    cv2 = None  # type: ignore[assignment]
    np = None  # type: ignore[assignment]
    CV2_AVAILABLE = False
    CV2_IMPORT_ERROR = str(exc)

from fastapi import FastAPI, File, Header, HTTPException, UploadFile


app = FastAPI(title="Deliverex OCR Service")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp"}
MAX_UPLOAD_BYTES = int(os.getenv("OCR_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
TESSERACT_TIMEOUT = int(os.getenv("TESSERACT_TIMEOUT", "120"))
OCR_LANG = os.getenv("OCR_LANG", "eng").strip() or "eng"
OCR_ENABLE_DESKEW = os.getenv("OCR_ENABLE_DESKEW", "true").lower() == "true"
OCR_ENABLE_MORPH = os.getenv("OCR_ENABLE_MORPH", "true").lower() == "true"
OCR_PSM_CANDIDATES = [x.strip() for x in os.getenv("OCR_PSM_CANDIDATES", "3,4,6,11,12").split(",") if x.strip()]
OCR_OEM_CANDIDATES = [x.strip() for x in os.getenv("OCR_OEM_CANDIDATES", "3").split(",") if x.strip()]
OCR_MAX_VARIANTS = max(1, int(os.getenv("OCR_MAX_VARIANTS", "4")))
OCR_MAX_PASSES = max(1, int(os.getenv("OCR_MAX_PASSES", "12")))
OCR_EARLY_EXIT_SCORE = float(os.getenv("OCR_EARLY_EXIT_SCORE", "0.55"))
OCR_DEBUG_MODE = os.getenv("OCR_DEBUG_MODE", "true").lower() == "true"
OCR_DEBUG_ROOT = os.getenv("OCR_DEBUG_ROOT", "/tmp/deliverex-ocr-debug")


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


def require_opencv() -> None:
    if CV2_AVAILABLE:
        return
    detail = "OpenCV is not available in this container"
    if CV2_IMPORT_ERROR:
        detail = f"{detail}: {CV2_IMPORT_ERROR}"
    raise HTTPException(status_code=500, detail=detail)


def decode_image(contents: bytes) -> "np.ndarray":
    require_opencv()
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
) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    gray = remove_alpha(raw)
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    denoise = cv2.GaussianBlur(gray, (3, 3), 0)

    variants: dict[str, np.ndarray] = {"gray": with_border(denoise)}

    _, otsu = cv2.threshold(denoise, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants["otsu"] = with_border(otsu)

    adaptive = cv2.adaptiveThreshold(
        denoise,
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
    steps = {
        "gray": gray,
        "threshold": adaptive,
        "denoise": denoise,
        "final": next(iter(limited.values())) if limited else adaptive,
    }
    return limited, steps


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


def parse_oem(raw: str | None, fallback: list[str]) -> list[str]:
    if raw is None:
        return fallback
    values = [x.strip() for x in raw.split(",") if x.strip().isdigit()]
    return values or fallback


def crop_footer_band(image: np.ndarray, start_ratio: float = 0.68) -> np.ndarray:
    height = image.shape[0]
    start = max(0, int(height * start_ratio))
    return with_border(image[start:, :])


def extract_red_ink_mask(image: np.ndarray) -> np.ndarray | None:
    if image.ndim < 3 or image.shape[2] < 3:
        return None

    bgr = image[:, :, :3]
    red = bgr[:, :, 2].astype(np.int16)
    green = bgr[:, :, 1].astype(np.int16)
    blue = bgr[:, :, 0].astype(np.int16)
    mask = ((red - green) > 35) & ((red - blue) > 35) & (red > 90)
    if not np.any(mask):
        return None

    channel = np.full(bgr.shape[:2], 255, dtype=np.uint8)
    channel[mask] = 0
    return with_border(channel)


def supplement_serial_text(raw: np.ndarray, base_text: str) -> tuple[str, list[str]]:
    extras: list[str] = []
    gray = remove_alpha(raw)
    regions: dict[str, np.ndarray] = {
        "footer": crop_footer_band(gray),
    }
    red_mask = extract_red_ink_mask(raw)
    if red_mask is not None:
        regions["red_footer"] = crop_footer_band(red_mask)

    for region_name, region in regions.items():
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            temp_path = tmp.name
        try:
            if not cv2.imwrite(temp_path, region):
                continue
            for psm in ("7", "8", "6"):
                try:
                    result = run_tesseract(temp_path, "3", psm, include_tsv=False)
                except (subprocess.TimeoutExpired, RuntimeError):
                    continue
                snippet = str(result.get("text", "")).strip()
                if snippet and snippet not in base_text and snippet not in extras:
                    extras.append(snippet)
        finally:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass

    if not extras:
        return base_text, []

    merged = base_text
    for snippet in extras:
        if snippet not in merged:
            merged = f"{merged}\n{snippet}".strip()
    return merged, extras


def score_text(text: str) -> float:
    if not text:
        return 0.0
    lower = text.lower()
    length_score = min(len(text), 500) / 500.0
    digit_ratio = (sum(ch.isdigit() for ch in text) / max(1, len(text)))
    keyword_hits = sum(1 for kw in ("receipt", "delivery", "length", "width", "height", "volume", "dr", "no") if kw in lower)
    serial_bonus = 0.0
    if re.search(r"\bno\s*[:#.\-]?\s*\d{5,8}\b", lower) or re.search(r"\b\d{7}\b", text):
        serial_bonus = 0.15
    alpha_num = sum(ch.isalnum() for ch in text) / max(1, len(text))
    return (0.45 * length_score) + (0.2 * min(digit_ratio * 4.0, 1.0)) + (0.2 * min(keyword_hits / 5.0, 1.0)) + (0.15 * alpha_num) + serial_bonus


def parse_tsv(tsv_text: str) -> dict[str, Any]:
    lines = [line for line in tsv_text.splitlines() if line.strip()]
    if len(lines) <= 1:
        return {"avg_conf": None, "boxes": []}

    header = lines[0].split("\t")
    boxes: list[dict[str, Any]] = []
    confidences: list[float] = []
    for raw in lines[1:]:
        cols = raw.split("\t")
        if len(cols) != len(header):
            continue
        row = dict(zip(header, cols))
        text = str(row.get("text", "")).strip()
        if not text:
            continue
        try:
            conf = float(row.get("conf", "-1"))
        except ValueError:
            conf = -1.0
        if conf >= 0:
            confidences.append(conf)
        boxes.append(
            {
                "text": text,
                "left": int(float(row.get("left", "0") or 0)),
                "top": int(float(row.get("top", "0") or 0)),
                "width": int(float(row.get("width", "0") or 0)),
                "height": int(float(row.get("height", "0") or 0)),
                "confidence": conf if conf >= 0 else None,
            }
        )
    avg_conf = (sum(confidences) / len(confidences)) if confidences else None
    return {"avg_conf": avg_conf, "boxes": boxes[:25]}


def run_tesseract(image_path: str, oem: str, psm: str, *, include_tsv: bool = True) -> dict[str, Any]:
    base_cmd = ["tesseract", image_path]
    completed = subprocess.run(
        [*base_cmd, "stdout", "--oem", oem, "-l", OCR_LANG, "--psm", psm],
        capture_output=True,
        text=True,
        timeout=TESSERACT_TIMEOUT,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "Tesseract failed").strip()
        raise RuntimeError(message)

    tsv_data: dict[str, Any] = {"avg_conf": None, "boxes": []}
    if include_tsv:
        tsv_completed = subprocess.run(
            [*base_cmd, "stdout", "--oem", oem, "-l", OCR_LANG, "--psm", psm, "tsv"],
            capture_output=True,
            text=True,
            timeout=TESSERACT_TIMEOUT,
        )
        tsv_text = tsv_completed.stdout if tsv_completed.returncode == 0 else ""
        tsv_data = parse_tsv(tsv_text)

    return {
        "text": completed.stdout.strip(),
        "stderr": (completed.stderr or "").strip(),
        "avg_conf": tsv_data["avg_conf"],
        "boxes": tsv_data["boxes"],
        "command": f"tesseract {image_path} stdout --oem {oem} -l {OCR_LANG} --psm {psm}",
    }


@app.get("/health")
def health() -> dict:
    tesseract_version = None
    tesseract_error = None
    try:
        completed = subprocess.run(
            ["tesseract", "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        tesseract_version = completed.stdout.splitlines()[0] if completed.stdout else "tesseract"
    except Exception as exc:
        tesseract_error = str(exc)

    status = "ok" if CV2_AVAILABLE and tesseract_error is None else "degraded"
    payload = {
        "status": status,
        "engine": "render-tesseract",
        "opencv": CV2_AVAILABLE,
        "version": tesseract_version or "unknown",
    }
    if CV2_IMPORT_ERROR:
        payload["opencv_error"] = CV2_IMPORT_ERROR
    if tesseract_error:
        payload["tesseract_error"] = tesseract_error
        raise HTTPException(status_code=500, detail=payload)

    return payload


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    x_ocr_psm_candidates: str | None = Header(default=None),
    x_ocr_oem_candidates: str | None = Header(default=None),
    x_ocr_max_variants: str | None = Header(default=None),
    x_ocr_enable_deskew: str | None = Header(default=None),
    x_ocr_enable_morph: str | None = Header(default=None),
) -> dict:
    require_bearer(authorization)
    require_opencv()

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {suffix or 'unknown'}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large for OCR")

    psm_candidates = parse_psm(x_ocr_psm_candidates, OCR_PSM_CANDIDATES)
    oem_candidates = parse_oem(x_ocr_oem_candidates, OCR_OEM_CANDIDATES)
    max_variants = parse_int(x_ocr_max_variants, OCR_MAX_VARIANTS, minimum=1, maximum=8)
    enable_deskew = parse_bool(x_ocr_enable_deskew, OCR_ENABLE_DESKEW)
    enable_morph = parse_bool(x_ocr_enable_morph, OCR_ENABLE_MORPH)
    debug_id = str(uuid.uuid4())[:8]
    debug_dir = os.path.join(OCR_DEBUG_ROOT, debug_id)
    preprocessed_image_path = ""
    debug_steps: dict[str, str] = {}
    if OCR_DEBUG_MODE:
        os.makedirs(debug_dir, exist_ok=True)

    try:
        raw = decode_image(contents)
        variants, steps = build_variants(raw, enable_deskew=enable_deskew, enable_morph=enable_morph, max_variants=max_variants)
        if OCR_DEBUG_MODE:
            original_path = os.path.join(debug_dir, "original.jpg")
            cv2.imwrite(original_path, raw)
            for name, image in steps.items():
                step_path = os.path.join(debug_dir, f"{name}.jpg")
                cv2.imwrite(step_path, image)
                debug_steps[name] = step_path
            preprocessed_image_path = debug_steps.get("final", "")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Image preprocessing failed: {exc}") from exc

    artifacts: list[str] = []
    variant_paths: dict[str, str] = {}
    candidates: list[dict[str, Any]] = []
    passes_run = 0
    stop_early = False

    try:
        for variant_name, variant_img in variants.items():
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                temp_path = tmp.name
            artifacts.append(temp_path)
            ok = cv2.imwrite(temp_path, variant_img)
            if not ok:
                continue
            variant_paths[variant_name] = temp_path

            for oem in oem_candidates:
                for psm in psm_candidates:
                    if passes_run >= OCR_MAX_PASSES:
                        stop_early = True
                        break
                    passes_run += 1
                    try:
                        result = run_tesseract(temp_path, oem, psm, include_tsv=False)
                        text = str(result["text"])
                        score = score_text(text)
                        candidates.append(
                            {
                                "variant": variant_name,
                                "oem": oem,
                                "psm": psm,
                                "score": round(score, 4),
                                "text_len": len(text),
                                "text": text,
                                "stderr": str(result["stderr"])[:180],
                                "avg_conf": None,
                                "boxes": [],
                                "command": result["command"],
                            }
                        )
                        if score >= OCR_EARLY_EXIT_SCORE and len(text) >= 40:
                            stop_early = True
                            break
                    except subprocess.TimeoutExpired as exc:
                        raise HTTPException(status_code=504, detail="Tesseract timed out") from exc
                    except RuntimeError as exc:
                        candidates.append(
                            {
                                "variant": variant_name,
                                "oem": oem,
                                "psm": psm,
                                "score": 0.0,
                                "text_len": 0,
                                "text": "",
                                "stderr": str(exc)[:180],
                                "avg_conf": None,
                                "boxes": [],
                                "command": f"tesseract {temp_path} stdout --oem {oem} -l {OCR_LANG} --psm {psm}",
                            }
                        )
                if stop_early:
                    break
            if stop_early:
                break

        if not candidates:
            raise HTTPException(status_code=500, detail="OCR could not produce any candidate output")

        ranked = sorted(candidates, key=lambda item: (item["score"], item["text_len"]), reverse=True)
        best = ranked[0]
        best_path = variant_paths.get(best["variant"])
        if best_path:
            try:
                enriched = run_tesseract(best_path, str(best.get("oem", "3")), str(best["psm"]), include_tsv=True)
                best["avg_conf"] = enriched["avg_conf"]
                best["boxes"] = enriched["boxes"]
                best["text"] = enriched["text"] or best["text"]
                best["command"] = enriched["command"]
            except (subprocess.TimeoutExpired, RuntimeError):
                pass
        text = best["text"].strip()
        text, footer_snippets = supplement_serial_text(raw, text)
        if footer_snippets:
            best["score"] = round(score_text(text), 4)

        return {
            "text": text,
            "confidence": best.get("avg_conf") / 100.0 if isinstance(best.get("avg_conf"), float) else estimate_confidence(text),
            "engine": "render-tesseract",
            "command": best.get("command"),
            "preprocessed_image_path": preprocessed_image_path,
            "diagnostics": {
                "chosen_variant": best["variant"],
                "chosen_oem": best.get("oem"),
                "chosen_psm": best["psm"],
                "footer_snippets": footer_snippets,
                "candidate_scores": [
                    {
                        "variant": item["variant"],
                        "oem": item.get("oem"),
                        "psm": item["psm"],
                        "score": item["score"],
                        "text_len": item["text_len"],
                        "avg_conf": item.get("avg_conf"),
                    }
                    for item in ranked[:8]
                ],
                "bounding_boxes": best.get("boxes", []),
                "variants_tested": len(variants),
                "passes_tested": len(candidates),
                "passes_run": passes_run,
                "stopped_early": stop_early,
                "preprocess_steps": debug_steps,
                "config": {
                    "psm_candidates": psm_candidates,
                    "oem_candidates": oem_candidates,
                    "max_variants": max_variants,
                    "max_passes": OCR_MAX_PASSES,
                    "early_exit_score": OCR_EARLY_EXIT_SCORE,
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
        if not OCR_DEBUG_MODE:
            try:
                shutil.rmtree(debug_dir, ignore_errors=True)
            except Exception:
                pass
