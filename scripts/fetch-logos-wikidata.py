"""Fetch missing brand logos via Wikidata -> Wikimedia Commons.

This avoids random logo sites and pulls assets from a source that usually
includes licensing/attribution metadata.

Run:
  python scripts/fetch-logos-wikidata.py

Output:
  - Downloads to public/logos/<slug>.<ext>
  - Writes scripts/wikidata-logo-report.json
"""

from __future__ import annotations

import json
import re
import time
from urllib.parse import urlparse
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote
from urllib.request import Request, urlopen

PROJECT_DIR = Path(__file__).resolve().parent.parent
BRANDS_TS = PROJECT_DIR / "src" / "lib" / "brands.ts"
LOGOS_DIR = PROJECT_DIR / "public" / "logos"
REPORT_PATH = Path(__file__).resolve().parent / "wikidata-logo-report.json"

MIN_BYTES = 500

NAME_TO_SLUG_OVERRIDES: Dict[str, str] = {
    "ABT": "abt",
    "AC Schnitzer": "ac-schnitzer",
    "AMS / Alpha Performance": "ams-alpha-performance",
    "H&R": "handr",
    "KW": "kw",
    "Öhlins": "ohlins",
    "3D Design": "3d-design",
    "FI Exhaust": "fi-exhaust",
    "IPe exhaust": "ipe-exhaust",
    "Akrapovič": "akrapovic",
}


def slugify(name: str) -> str:
    if name in NAME_TO_SLUG_OVERRIDES:
        return NAME_TO_SLUG_OVERRIDES[name]
    slug = name.lower()
    slug = slug.replace("ö", "o").replace("č", "c")
    slug = slug.replace("&", "and")
    slug = slug.replace("'", "")
    slug = slug.replace("/", "-")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"^-|-$", "", slug)
    return slug


def has_valid_logo(name: str) -> bool:
    slug = slugify(name)
    for ext in [".svg", ".webp", ".png", ".jpg", ".jpeg", ".gif"]:
        p = LOGOS_DIR / f"{slug}{ext}"
        if p.exists() and p.stat().st_size >= MIN_BYTES:
            return True
    return False


@dataclass
class Brand:
    name: str
    website: str


def _unescape_ts_string(s: str) -> str:
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def load_brands_from_ts() -> List[Brand]:
    content = BRANDS_TS.read_text(encoding="utf-8")

    brands: List[Brand] = []

    # name: '...' or name: "..." and website: similarly; allow escaped quotes.
    pat = re.compile(
        r"name:\s*(?:'((?:\\\\.|[^'])*)'|\"((?:\\\\.|[^\"])*)\").*?website:\s*(?:'((?:\\\\.|[^'])*)'|\"((?:\\\\.|[^\"])*)\")",
        re.DOTALL,
    )

    seen = set()
    for m in pat.finditer(content):
        raw_name = (m.group(1) or m.group(2) or "").strip()
        raw_site = (m.group(3) or m.group(4) or "").strip()
        if not raw_name or not raw_site:
            continue
        name = _unescape_ts_string(raw_name)
        website = _unescape_ts_string(raw_site)
        if name in seen:
            continue
        seen.add(name)
        brands.append(Brand(name=name, website=website))

    return brands


def http_get_json(url: str) -> dict:
    req = Request(
        url,
        headers={
            "User-Agent": "OneCompanyLogoBot/1.0 (logo fetch; contact: admin@onecompany)"
        },
    )
    with urlopen(req, timeout=25) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8"))


def wikidata_search_entity(query: str) -> Optional[str]:
    # Deprecated by the domain-matching selector below; keep for fallback.
    url = (
        "https://www.wikidata.org/w/api.php?"
        "action=wbsearchentities&format=json&language=en&limit=1&search="
        + quote(query)
    )
    data = http_get_json(url)
    hits = data.get("search") or []
    if not hits:
        return None
    return hits[0].get("id")


def _host(url: str) -> str:
    try:
        h = (urlparse(url).hostname or "").lower().strip()
        if h.startswith("www."):
            h = h[4:]
        return h
    except Exception:
        return ""


def wikidata_search_entity_by_domain(query: str, website: str, limit: int = 6) -> Optional[str]:
    """Search Wikidata and pick the entity whose official website matches our domain.

    This avoids ambiguous short brand names (e.g. 'YPG') matching unrelated entities.
    """
    target_host = _host(website)
    if not target_host:
        return None

    url = (
        "https://www.wikidata.org/w/api.php?"
        "action=wbsearchentities&format=json&language=en&limit="
        + str(limit)
        + "&search="
        + quote(query)
    )
    data = http_get_json(url)
    hits = data.get("search") or []
    if not hits:
        return None

    # Fetch official website (P856) for each candidate and compare hosts.
    for hit in hits:
        entity_id = hit.get("id")
        if not entity_id:
            continue
        try:
            ent_data = http_get_json(
                "https://www.wikidata.org/w/api.php?"
                "action=wbgetentities&format=json&props=claims&ids="
                + quote(entity_id)
            )
            ent = (ent_data.get("entities") or {}).get(entity_id) or {}
            claims = ent.get("claims") or {}
            p856 = claims.get("P856") or []
            if not p856:
                continue
            mainsnak = (p856[0].get("mainsnak") or {})
            dv = (mainsnak.get("datavalue") or {})
            val = dv.get("value")
            if isinstance(val, str) and _host(val) == target_host:
                return entity_id
        except Exception:
            continue

    return None


def wikidata_get_logo_filename(entity_id: str) -> Optional[Tuple[str, str]]:
    # returns (property, filename)
    url = (
        "https://www.wikidata.org/w/api.php?"
        "action=wbgetentities&format=json&props=claims&ids="
        + quote(entity_id)
    )
    data = http_get_json(url)
    ent = (data.get("entities") or {}).get(entity_id) or {}
    claims = ent.get("claims") or {}

    def pick_file(prop: str) -> Optional[str]:
        arr = claims.get(prop) or []
        if not arr:
            return None
        mainsnak = (arr[0].get("mainsnak") or {})
        dv = (mainsnak.get("datavalue") or {})
        val = dv.get("value")
        if isinstance(val, str) and val.strip():
            return val.strip()
        return None

    # Prefer explicit logo, then image.
    for prop in ("P154", "P18"):
        fn = pick_file(prop)
        if fn:
            return prop, fn
    return None


def commons_fileinfo(filename: str) -> dict:
    # filename is like "Foo.svg" (no File: prefix)
    title = "File:" + filename
    url = (
        "https://commons.wikimedia.org/w/api.php?"
        "action=query&format=json&prop=imageinfo&iiprop=url|mime|size|extmetadata&titles="
        + quote(title)
    )
    return http_get_json(url)


def commons_download_url(filename: str) -> Optional[Tuple[str, str, int]]:
    data = commons_fileinfo(filename)
    pages = ((data.get("query") or {}).get("pages") or {})
    for _, page in pages.items():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        url = info.get("url")
        mime = info.get("mime") or ""
        size = int(info.get("size") or 0)
        if isinstance(url, str) and url.startswith("http"):
            return url, mime, size
    return None


def pick_ext(filename: str, mime: str) -> str:
    low = filename.lower()
    if low.endswith(".svg") or "svg" in (mime or "").lower():
        return ".svg"
    if low.endswith(".png"):
        return ".png"
    if low.endswith(".webp"):
        return ".webp"
    if low.endswith(".jpg") or low.endswith(".jpeg"):
        return ".jpg"
    if low.endswith(".gif"):
        return ".gif"
    # fallback
    if "png" in (mime or "").lower():
        return ".png"
    if "jpeg" in (mime or "").lower() or "jpg" in (mime or "").lower():
        return ".jpg"
    return ".png"


def download_binary(url: str) -> bytes:
    req = Request(
        url,
        headers={
            "User-Agent": "OneCompanyLogoBot/1.0 (logo fetch; contact: admin@onecompany)",
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=35) as resp:
        return resp.read()


def main() -> None:
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)

    brands = load_brands_from_ts()
    missing = [b for b in brands if not has_valid_logo(b.name)]

    report: List[dict] = []
    downloaded = 0

    print(f"Missing brands (>= {MIN_BYTES}b rule): {len(missing)}")

    for idx, b in enumerate(missing, 1):
        slug = slugify(b.name)
        entry = {
            "name": b.name,
            "slug": slug,
            "website": b.website,
            "status": "skipped",
        }

        print(f"[{idx}/{len(missing)}] {b.name}")

        try:
            entity = wikidata_search_entity_by_domain(b.name, b.website)
            if not entity:
                # Fallback: sometimes Wikidata doesn't store P856; avoid matching very short/ambiguous names.
                if len(b.name.strip()) >= 5:
                    entity = wikidata_search_entity(b.name)
            entry["wikidataEntity"] = entity
            if not entity:
                entry["status"] = "no-wikidata"
                report.append(entry)
                continue

            logo = wikidata_get_logo_filename(entity)
            entry["wikidataProperty"] = logo[0] if logo else None
            entry["commonsFilename"] = logo[1] if logo else None
            if not logo:
                entry["status"] = "no-image-claims"
                report.append(entry)
                continue

            url_meta = commons_download_url(logo[1])
            if not url_meta:
                entry["status"] = "no-commons-url"
                report.append(entry)
                continue

            url, mime, declared_size = url_meta
            entry["commonsUrl"] = url
            entry["commonsMime"] = mime
            entry["commonsDeclaredSize"] = declared_size

            data = download_binary(url)
            entry["downloadedBytes"] = len(data)

            if len(data) < MIN_BYTES:
                entry["status"] = "too-small"
                report.append(entry)
                continue

            ext = pick_ext(logo[1], mime)
            out_path = LOGOS_DIR / f"{slug}{ext}"
            out_path.write_bytes(data)
            entry["status"] = "downloaded"
            entry["output"] = str(out_path.relative_to(PROJECT_DIR)).replace("\\", "/")
            downloaded += 1
            report.append(entry)

        except Exception as e:
            entry["status"] = "error"
            entry["error"] = str(e)[:300]
            report.append(entry)

        # gentle rate-limit
        time.sleep(0.35)

    REPORT_PATH.write_text(json.dumps({"downloaded": downloaded, "items": report}, indent=2), encoding="utf-8")

    print("=" * 60)
    print(f"Downloaded: {downloaded}")
    print(f"Report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
