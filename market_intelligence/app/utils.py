from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


TRACKING_QUERY_KEYS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
}


def setup_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
        force=True,
    )


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def atomic_write_text(path: Path, content: str) -> None:
    ensure_directory(path.parent)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(content, encoding="utf-8", newline="\n")
    os.replace(tmp_path, path)


def safe_append_text(path: Path, content: str) -> None:
    ensure_directory(path.parent)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    separator = ""
    if existing and not existing.endswith("\n"):
        separator = "\n"
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(separator + content)


def split_csv_like(value: str) -> list[str]:
    if not value.strip():
        return []
    items = re.split(r"[,\n;]+", value)
    clean: list[str] = []
    for item in items:
        stripped = item.strip()
        if stripped and stripped not in clean:
            clean.append(stripped)
    return clean


def normalize_whitespace(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def normalize_url(url: str) -> str:
    stripped = url.strip()
    if not stripped:
        return ""
    parsed = urlparse(stripped)
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_QUERY_KEYS
    ]
    normalized = parsed._replace(
        scheme=(parsed.scheme or "https").lower(),
        netloc=parsed.netloc.lower(),
        path=parsed.path.rstrip("/") or parsed.path or "",
        query=urlencode(query),
        fragment="",
    )
    return urlunparse(normalized)


def normalize_title(value: str) -> str:
    lowered = value.lower().strip()
    lowered = re.sub(r"\[[^\]]+\]", "", lowered)
    lowered = re.sub(r"[^a-z0-9а-яіїєґ\s]", " ", lowered, flags=re.IGNORECASE)
    lowered = re.sub(r"\s+", " ", lowered)
    return lowered.strip()


def first_non_empty(*values: str | None) -> str:
    for value in values:
        if value and value.strip():
            return value.strip()
    return ""


def prompt_multiline(prompt: str, sentinel: str = "END") -> str:
    print(f"{prompt} Finish with a single '{sentinel}' line.")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == sentinel:
            break
        lines.append(line)
    return normalize_whitespace("\n".join(lines))


def compact_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def truncate(value: str, limit: int = 320) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def top_counts(values: Iterable[str], limit: int = 5) -> list[tuple[str, int]]:
    counts: dict[str, int] = {}
    for value in values:
        key = value.strip()
        if not key:
            continue
        counts[key] = counts.get(key, 0) + 1
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]

