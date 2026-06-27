#!/usr/bin/env python3
"""Simple OCR smoke checks for clean/skewed/low-contrast samples."""

import os
import sys

import cv2
import numpy as np
from fastapi.testclient import TestClient

os.environ.setdefault("OCR_SERVICE_TOKEN", "smoke-token")

from app import app  # noqa: E402


def make_clean() -> np.ndarray:
    img = np.full((420, 1100, 3), 255, dtype=np.uint8)
    cv2.putText(img, "DELIVERY RECEIPT DR-77421", (40, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 3)
    cv2.putText(img, "LENGTH: 2.40  WIDTH: 1.30  HEIGHT: 0.50", (40, 220), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
    cv2.putText(img, "VOLUME: 1.56 CBM", (40, 290), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
    return img


def make_skewed(base: np.ndarray) -> np.ndarray:
    h, w = base.shape[:2]
    m = cv2.getRotationMatrix2D((w // 2, h // 2), 7.0, 1.0)
    return cv2.warpAffine(base, m, (w, h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))


def make_low_contrast(base: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
    # Compress dynamic range to simulate washed-out capture.
    low = cv2.convertScaleAbs(gray, alpha=0.45, beta=120)
    return cv2.cvtColor(low, cv2.COLOR_GRAY2BGR)


def encode_png(image: np.ndarray) -> bytes:
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise RuntimeError("Failed to encode synthetic image")
    return encoded.tobytes()


def run_case(client: TestClient, name: str, image: np.ndarray) -> tuple[bool, str]:
    payload = encode_png(image)
    response = client.post(
        "/ocr",
        headers={"Authorization": "Bearer smoke-token"},
        files={"file": (f"{name}.png", payload, "image/png")},
    )
    if response.status_code != 200:
        return False, f"{name}: HTTP {response.status_code} {response.text}"

    data = response.json()
    text = str(data.get("text", "")).strip()
    diagnostics = data.get("diagnostics", {})
    chosen = f"{diagnostics.get('chosen_variant', '?')}/psm{diagnostics.get('chosen_psm', '?')}"

    if len(text) < 12:
        return False, f"{name}: OCR text too short (len={len(text)}) via {chosen}"

    return True, f"{name}: ok len={len(text)} variant={chosen}"


def main() -> int:
    client = TestClient(app)
    clean = make_clean()
    cases = [
        ("clean", clean),
        ("skewed", make_skewed(clean)),
        ("low_contrast", make_low_contrast(clean)),
    ]

    failures = 0
    for name, image in cases:
        ok, message = run_case(client, name, image)
        print(message)
        if not ok:
            failures += 1

    if failures:
        print(f"smoke test failed: {failures} case(s) failed")
        return 1

    print("smoke test passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
