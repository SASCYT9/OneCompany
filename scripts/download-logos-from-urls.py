"""Download logo files from a manually curated URL list.

Why: Avoid scraping Google Images (unstable + licensing issues). You can still copy
image URLs you trust (official media kits, Wikipedia/Commons, etc.) into the JSON.

Run:
  python scripts/download-logos-from-urls.py

Then:
  node scripts/generate-brand-logos-map.js

Rules:
- Only saves if content is an image (or SVG) and size >= minBytes.
- Writes to public/logos/<slug>.<ext>.
"""

from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.request import Request, urlopen

PROJECT_DIR = Path(__file__).resolve().parent.parent
SOURCES_PATH = Path(__file__).resolve().parent / "manual-logo-sources.json"
LOGOS_DIR = PROJECT_DIR / "public" / "logos"


def _pick_ext(url: str, content_type: str) -> str:
    ct = (content_type or "").lower()
    u = url.lower()
    if "svg" in ct or u.endswith(".svg"):
        return ".svg"
    if "webp" in ct or u.endswith(".webp"):
        return ".webp"
    if "png" in ct or u.endswith(".png"):
        return ".png"
    if "jpeg" in ct or "jpg" in ct or u.endswith(".jpg") or u.endswith(".jpeg"):
        return ".jpg"
    if "gif" in ct or u.endswith(".gif"):
        return ".gif"

    guessed = mimetypes.guess_extension(ct.split(";")[0].strip()) if ct else None
    if guessed in {".svg", ".webp", ".png", ".jpg", ".jpeg", ".gif"}:
        return ".jpg" if guessed == ".jpeg" else guessed
    return ".png"


def _download(url: str) -> tuple[bytes, str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        # Some hosts block hotlinking without referer.
        "Referer": url,
    }

    last_err: Exception | None = None
    for _ in range(2):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=35) as resp:
                data = resp.read()
                ct = resp.headers.get("Content-Type", "")
            return data, ct
        except Exception as e:
            last_err = e
            # Small downgrade for some CDNs: try without referer
            headers.pop("Referer", None)
            continue

    raise last_err if last_err else RuntimeError("download failed")


def main() -> None:
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)

    cfg: Dict[str, Any] = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    min_bytes = int(cfg.get("minBytes") or 500)
    items = cfg.get("items") or []

    downloaded = 0
    skipped = 0
    failed = 0

    for it in items:
        name = (it.get("name") or "").strip()
        slug = (it.get("slug") or "").strip()
        url = (it.get("url") or "").strip()

        if not name or not slug:
            continue
        if not url:
            print(f"- SKIP (no url): {name}")
            skipped += 1
            continue

        try:
            data, ct = _download(url)
            if not data or len(data) < min_bytes:
                print(f"- FAIL (too small {len(data)}b): {name} :: {url}")
                failed += 1
                continue

            ct_low = (ct or "").lower()
            if not ("image/" in ct_low or "svg" in ct_low or url.lower().endswith(".svg")):
                print(f"- FAIL (not image, ct={ct!r}): {name} :: {url}")
                failed += 1
                continue

            ext = _pick_ext(url, ct)
            out = LOGOS_DIR / f"{slug}{ext}"
            out.write_bytes(data)
            print(f"- OK {name} -> {out.as_posix()} ({len(data)}b)")
            downloaded += 1

        except Exception as e:
            print(f"- FAIL {name}: {str(e)[:200]}")
            failed += 1

    print("=" * 60)
    print(f"Downloaded: {downloaded}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
