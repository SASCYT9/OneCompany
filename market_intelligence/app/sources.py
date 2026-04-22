from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import httpx

from app.models import SourceCandidate
from app.utils import split_csv_like


def fetch_url_metadata(url: str, timeout_seconds: int = 15) -> dict[str, str]:
    if not url.strip():
        return {"meta_title": "", "meta_description": ""}

    try:
        response = httpx.get(
            url,
            headers={"User-Agent": "OneCompanyMarketIntel/1.0"},
            follow_redirects=True,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
    except Exception:  # noqa: BLE001
        return {"meta_title": "", "meta_description": ""}

    html = response.text
    title = _find_first(html, [r"<title>(.*?)</title>", r'<meta property="og:title" content="(.*?)"'])
    description = _find_first(
        html,
        [
            r'<meta name="description" content="(.*?)"',
            r'<meta property="og:description" content="(.*?)"',
        ],
    )
    return {"meta_title": _html_unescape(title), "meta_description": _html_unescape(description)}


def load_candidates_from_file(path: Path) -> list[SourceCandidate]:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError("JSON import must be a list of objects.")
        return [_candidate_from_mapping(item) for item in payload]

    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = csv.DictReader(handle)
            return [_candidate_from_mapping(row) for row in rows]

    raise ValueError("Only CSV and JSON imports are supported in V1.")


def _candidate_from_mapping(row: dict[str, object]) -> SourceCandidate:
    def get_value(*keys: str) -> str:
        for key in keys:
            value = row.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    return SourceCandidate(
        title=get_value("title", "resource_name", "name"),
        platform=get_value("platform", "source_platform") or "Other",
        url=get_value("url", "link"),
        raw_notes=get_value("raw_notes", "notes", "description"),
        copied_comments=get_value("copied_comments", "comments"),
        brand_names=split_csv_like(get_value("brand_names", "brands")),
        vehicle_platforms=split_csv_like(get_value("vehicle_platforms", "vehicles", "platforms")),
        meta_title=get_value("meta_title"),
        meta_description=get_value("meta_description"),
    )


def _find_first(html: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return ""


def _html_unescape(value: str) -> str:
    return (
        value.replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )

