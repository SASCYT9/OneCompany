"""Build a reviewable Revozport catalog payload from the two supplied workbooks.

This is intentionally a preview/draft builder. It never writes to Prisma or a
public API. The output is a set of AdminShopProductPayload-compatible records
under .tmp/, ready for a separately authorized draft import.

Usage:
  python scripts/build-revozport-catalog-preview.py
  python scripts/build-revozport-catalog-preview.py --no-images
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import html
import json
import re
import subprocess
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit, urlunsplit

import openpyxl


DEFAULT_SOURCE_DIR = Path(r"C:\Users\Admin\Downloads\Telegram Desktop")
DEFAULT_PRICING = DEFAULT_SOURCE_DIR / "AIN_SKU_EXPORT_MX_9.14.xlsx"
DEFAULT_INVENTORY = DEFAULT_SOURCE_DIR / "revozport_inventory_pricing_9.14.xlsx"
OUTPUT_DIR = Path(".tmp")
OUTPUT_FILE = OUTPUT_DIR / "revozport-catalog-preview.json"
IMAGE_CACHE_FILE = OUTPUT_DIR / "revozport-image-cache.json"

SKU_RE = re.compile(r"^RZ-[A-Z0-9-]+$")
IN_TO_CM = 2.54
LB_TO_KG = 0.45359237
REVOZPORT_SHIPPING_RATE_USD_PER_KG = 25
REVOZPORT_SHIPPING_SAFETY_MULTIPLIER = 1.10

# The supplier workbook has a package/shipping weight for most products, but
# some rows contain only the part weight (or no weight at all). Those rows are
# still useful catalog candidates, so we estimate a conservative packed weight
# from comparable Revozport parts. The estimate is always marked in the
# payload and must not be confused with a supplier-confirmed measurement.
ESTIMATED_SHIPPING_WEIGHT_BY_TYPE_KG = {
    "hood": 39.92,
    "rear trunk": 19.96,
    "side skirts": 9.98,
    "side fender": 9.98,
    "fender arches": 9.98,
    "rear wing": 9.98,
    "rear diffuser": 7.98,
    "undertray": 7.98,
    "front lip": 4.99,
    "splitters": 4.99,
    "splitter": 4.99,
    "front splitter": 4.99,
    "spoiler": 4.99,
    "bumper": 7.98,
    "grill": 3.18,
    "air intake vents": 1.50,
    "air intake": 3.18,
    "vents": 1.50,
    "vent": 1.50,
    "canard": 1.50,
    "mirror": 1.50,
    "tailpipe": 3.18,
}
DEFAULT_ESTIMATED_SHIPPING_WEIGHT_KG = 4.99


def find_weight_baseline(value: str) -> tuple[float, str] | None:
    normalized = text(value).lower()
    for part_type, candidate in ESTIMATED_SHIPPING_WEIGHT_BY_TYPE_KG.items():
        if part_type in normalized:
            return candidate, part_type
    return None

SHEET_MAKES = {
    "AUDI": "Audi",
    "BMW": "BMW",
    "CHEVROLET": "Chevrolet",
    "PORSCHE": "Porsche",
    "TESLA": "Tesla",
    "XIAOMI": "Xiaomi",
}

UA_REPLACEMENTS = [
    (r"\bCarbon Fiber\b|\bCarbon Fibre\b", "Карбоновий"),
    (r"\bRear Spoiler\b", "задній спойлер"),
    (r"\bFront Spoiler\b", "передній спойлер"),
    (r"\bSide Skirts?\b", "бічні пороги"),
    (r"\bSide Fenders?\b", "бічні крила"),
    (r"\bFront Splitter\b", "передній спліттер"),
    (r"\bFront Lip\b", "передня губа"),
    (r"\bRear Diffuser\b", "задній дифузор"),
    (r"\bFront Diffuser\b", "передній дифузор"),
    (r"\bFront Bumper Canards?\b", "канарди переднього бампера"),
    (r"\bCanards?\b", "канарди"),
    (r"\bHood\b", "капот"),
    (r"\bTrunk\b", "кришка багажника"),
    (r"\bBumper\b", "бампер"),
    (r"\bGrille\b|\bGrill\b", "решітка"),
    (r"\bRoof\b", "дах"),
    (r"\bMirror Caps?\b", "накладки на дзеркала"),
    (r"\bWing\b", "антикрило"),
    (r"\bExtension\b", "накладка"),
    (r"\bCover\b", "накладка"),
    (r"\bfor\b", "для"),
]


def text(value: Any) -> str:
    return str(value or "").strip()


def number(value: Any) -> float | None:
    if value is None or text(value) == "":
        return None
    if isinstance(value, (int, float)):
        value = float(value)
    cleaned = text(value).replace(",", "")
    try:
        parsed = float(cleaned)
    except ValueError:
        return None
    return parsed if parsed >= 0 else None


def positive_number(value: Any) -> float | None:
    parsed = number(value)
    return parsed if parsed is not None and parsed > 0 else None


def metric(value: Any, factor: float) -> float | None:
    parsed = positive_number(value)
    return round(parsed * factor, 3) if parsed is not None else None


def round_currency(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def estimate_shipping_weight_kg(
    name: str,
    product_type: str,
    product_weight_kg: float | None,
    length_cm: float | None,
    width_cm: float | None,
    height_cm: float | None,
) -> tuple[float, str]:
    """Estimate packed shipping weight when the workbook is incomplete.

    The baseline is based on the median shipping weights of comparable rows in
    the same workbook. Product weight can only increase the estimate; it never
    replaces the package-weight baseline. Large known package dimensions can
    also lift a generic estimate to the next safe packaging band.
    """
    baseline = DEFAULT_ESTIMATED_SHIPPING_WEIGHT_KG
    matched_type = "generic carbon aero"
    # Prefer the structured product type. Searching the full title first can
    # misclassify "hood fins" as a full hood or a canard as a bumper part.
    match = find_weight_baseline(product_type) or find_weight_baseline(name)
    if match is not None:
        baseline, matched_type = match

    estimate = baseline
    if product_weight_kg is not None and product_weight_kg > 0:
        estimate = max(estimate, product_weight_kg * 1.8)

    if all(value is not None and value > 0 for value in (length_cm, width_cm, height_cm)):
        volume_m3 = (length_cm * width_cm * height_cm) / 1_000_000
        max_dimension_cm = max(length_cm, width_cm, height_cm)
        if volume_m3 >= 0.28 or max_dimension_cm >= 180:
            estimate = max(estimate, 9.98)

    source = "estimated_from_product_weight" if product_weight_kg is not None else "estimated_by_part_type"
    return round(estimate * REVOZPORT_SHIPPING_SAFETY_MULTIPLIER, 3), f"{source}:{matched_type}"


def year_value(value: Any) -> int | None:
    parsed = number(value)
    return int(parsed) if parsed is not None and parsed.is_integer() else None


def year_bounds(*values: Any) -> tuple[int | None, int | None]:
    years: list[int] = []
    for value in values:
        years.extend(int(match) for match in re.findall(r"\b(?:18|19|20|21)\d{2}\b", text(value)))
    return (min(years), max(years)) if years else (None, None)


def year_ranges_from_row(value: Any, product_name: str) -> list[tuple[int | None, int | None]]:
    years = sorted({int(item) for item in re.findall(r"\b(?:18|19|20|21)\d{2}\b", text(value))})
    if not years:
        bounds = year_bounds(product_name)
        return [bounds] if bounds != (None, None) else [(None, None)]
    ranges: list[tuple[int | None, int | None]] = []
    start = previous = years[0]
    for current in years[1:]:
        if current != previous + 1:
            ranges.append((start, previous))
            start = current
        previous = current
    ranges.append((start, previous))
    return ranges


OTHER_SHEET_MAKES = {
    "Audi": (r"\bAudi\b",),
    "BMW": (r"\bBMW\b",),
    "Chevrolet": (r"\bChevrolet\b|\bCorvette\b",),
    "Mercedes-Benz": (r"\bMercedes(?:-Benz)?\b|\bAMG\b",),
    "Porsche": (r"\bPorsche\b",),
    "Tesla": (r"\bTesla\b",),
    "Xiaomi": (r"\bXiaomi\b|\bSU7\b",),
}


def resolve_make(sheet: str, product_name: str, official_url: str) -> str:
    make = SHEET_MAKES.get(text(sheet).upper())
    if make:
        return make
    evidence = f"{product_name} {official_url}"
    matches = [candidate for candidate, patterns in OTHER_SHEET_MAKES.items()
               if any(re.search(pattern, evidence, flags=re.IGNORECASE) for pattern in patterns)]
    return matches[0] if len(matches) == 1 else ""


MODEL_PATTERNS: dict[str, list[tuple[str, str]]] = {
    "Audi": [
        ("RSQ8", r"\bRS\s*Q\s*8\b"),
        ("RS3", r"\bRS\s*3\b"), ("RS4", r"\bRS\s*4\b"),
        ("RS5", r"\bRS\s*5\b"), ("RS6", r"\bRS\s*6\b"),
        ("RS7", r"\bRS\s*7\b"), ("RSQ3", r"\bRS\s*Q\s*3\b"),
        ("SQ8", r"\bSQ\s*8\b"), ("SQ7", r"\bSQ\s*7\b"),
        ("Q8", r"\bQ\s*8\b"), ("Q7", r"\bQ\s*7\b"),
        ("Q5", r"\bQ\s*5\b"), ("Q3", r"\bQ\s*3\b"),
        ("A7", r"\bA\s*7\b"), ("A6", r"\bA\s*6\b"),
        ("A5", r"\bA\s*5\b"), ("A4", r"\bA\s*4\b"),
        ("RS3", r"\bRS\s*3\b"),
    ],
    "BMW": [
        ("X3 M", r"\bX\s*3\s*M\b"), ("X4 M", r"\bX\s*4\s*M\b"),
        ("X5 M", r"\bX\s*5\s*M\b"), ("X6 M", r"\bX\s*6\s*M\b"),
        ("M2", r"\bM\s*2\b"), ("M3", r"\bM\s*3\b"),
        ("M4", r"\bM\s*4\b"), ("M5", r"\bM\s*5\b"),
        ("M8", r"\bM\s*8\b"), ("X3", r"\bX\s*3\b"),
        ("X4", r"\bX\s*4\b"), ("X5", r"\bX\s*5\b"),
        ("X6", r"\bX\s*6\b"), ("8 Series", r"\b8\s*Series\b"),
    ],
    "Chevrolet": [("Corvette", r"\bCorvette\b")],
    "Porsche": [("911", r"\b911(?:\s+(?:GT\s*3|Turbo|Carrera))?\b"), ("718", r"\b718\b")],
    "Tesla": [("Model X", r"\bModel\s+X\b"), ("Model Y", r"\bModel\s+Y\b"),
              ("Model S", r"\bModel\s+S\b"), ("Model 3", r"\bModel\s+3\b")],
    "Xiaomi": [("SU7 Ultra", r"\bSU\s*7\s+Ultra\b"), ("SU7", r"\bSU\s*7\b")],
    "Mercedes-Benz": [("G-Class", r"\bG\s*[- ]?Class\b"), ("AMG G 63", r"\bG\s*63\b")],
}


CHASSIS_PATTERNS: dict[str, str] = {
    "Audi": r"\b(?:B\s*\d(?:\.\d)?|C\s*[5-9]|8\s*Y|4\s*M|F\s*Y|F\s*3)\b",
    "BMW": r"\b(?:[EFG]\s*\d{2,3}[A-Z]?)\b",
    "Chevrolet": r"\bC\s*[6-8]\b",
    "Porsche": r"\b(?:991(?:\.\d)?|992(?:\.\d)?|718)\b",
    "Mercedes-Benz": r"\b(?:W\s*\d{3}[A-Z]?|V\s*\d{2,3})\b",
}


def _fitment_text(value: str, is_url: bool = False) -> str:
    normalized = text(value).replace("\u00a0", " ")
    normalized = re.sub(r"\bB(\d+)-(\d+)\b", r"B\1.\2", normalized, flags=re.IGNORECASE)
    if is_url:
        normalized = urlsplit(normalized).path
    normalized = re.sub(r"\b([EFG]\d{2,3})(?=[A-Z])", r"\1 ", normalized, flags=re.IGNORECASE)
    return re.sub(r"[-_/]+", " ", normalized).upper()


def extract_revozport_chassis_codes(make: str, value: str, is_url: bool = False) -> list[str]:
    normalized = _fitment_text(value, is_url)
    pattern = CHASSIS_PATTERNS.get(make)
    if not pattern:
        return []
    return list(dict.fromkeys(
        re.sub(r"\s+", "", match.group(0)).upper()
        for match in re.finditer(pattern, normalized, flags=re.IGNORECASE)
    ))


def extract_revozport_signatures(make: str, value: str, is_url: bool = False) -> list[tuple[str, str | None, str | None]]:
    normalized = _fitment_text(value, is_url)
    phase = "PRE-LCI" if re.search(r"\bPRE\s*LCI\b", normalized) else "LCI" if re.search(r"\bLCI\b", normalized) else None
    model_matches: list[tuple[int, int, str]] = []
    for model, pattern in MODEL_PATTERNS.get(make, []):
        for match in re.finditer(pattern, normalized, flags=re.IGNORECASE):
            model_matches.append((match.start(), match.end(), model))
    model_matches.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    filtered_models: list[tuple[int, int, str]] = []
    for item in model_matches:
        if any(item[0] < existing[1] and existing[0] < item[1] for existing in filtered_models):
            continue
        filtered_models.append(item)
    models = filtered_models
    if not models:
        return []

    chassis_pattern = CHASSIS_PATTERNS.get(make)
    chassis_matches: list[tuple[int, int, str]] = []
    if chassis_pattern:
        for match in re.finditer(chassis_pattern, normalized, flags=re.IGNORECASE):
            code = re.sub(r"\s+", "", match.group(0)).upper()
            if code not in {"718"}:
                chassis_matches.append((match.start(), match.end(), code))
    chassis_matches = list(dict.fromkeys(chassis_matches))

    if not chassis_matches:
        return list(dict.fromkeys((model, None, phase) for _, _, model in models))
    if len(models) == 1 or len(chassis_matches) == 1:
        return list(dict.fromkeys((model, code, phase) for _, _, model in models for _, _, code in chassis_matches))
    if len(models) == len(chassis_matches):
        return list(dict.fromkeys((models[index][2], chassis_matches[index][2], phase) for index in range(len(models))))

    # Supplier strings such as "G80 G81 M3 G82 G83 M4" group chassis codes
    # immediately before each model. Accept only when every code is assigned.
    assigned: list[tuple[str, str, str | None]] = []
    consumed: set[int] = set()
    for model_index, (_, model_end, model) in enumerate(models):
        previous_end = models[model_index - 1][1] if model_index else 0
        preceding = [(index, code) for index, (start, end, code) in enumerate(chassis_matches)
                     if previous_end <= start < model_end and index not in consumed]
        following_end = models[model_index + 1][0] if model_index + 1 < len(models) else len(normalized)
        following = [(index, code) for index, (start, end, code) in enumerate(chassis_matches)
                     if model_end <= start < following_end and index not in consumed]
        chosen = preceding or following
        for index, code in chosen:
            consumed.add(index)
            assigned.append((model, code, phase))
    if len(consumed) != len(chassis_matches):
        return []
    return list(dict.fromkeys(assigned))


def _intersect_signatures(left: list[tuple[str, str | None, str | None]], right: list[tuple[str, str | None, str | None]]):
    result: list[tuple[str, str | None, str | None]] = []
    for left_model, left_chassis, left_phase in left:
        for right_model, right_chassis, right_phase in right:
            if left_model != right_model:
                continue
            if left_chassis and right_chassis and left_chassis != right_chassis:
                continue
            if left_phase and right_phase and left_phase != right_phase:
                continue
            result.append((left_model, left_chassis or right_chassis, left_phase or right_phase))
    return list(dict.fromkeys(result))


def normalize_revozport_sku(value: Any) -> str:
    normalized = text(value).upper()
    normalized = re.sub(r"-KB(?:-\d+)?$", "", normalized)
    return re.sub(r"-1$", "", normalized)


def revozport_official_match(sku: str, official_url: str, official_products: list[dict[str, Any]]):
    normalized_sku = normalize_revozport_sku(sku)
    candidates: dict[str, dict[str, Any]] = {}
    for product in official_products:
        if any(normalize_revozport_sku(variant.get("sku")) == normalized_sku for variant in product.get("variants", [])):
            candidates[str(product.get("handle") or "")] = product
    try:
        source_handle = urlsplit(official_url).path.rstrip("/").split("/")[-1]
    except (TypeError, ValueError):
        source_handle = ""
    linked = candidates.get(source_handle)
    if linked:
        return {"status": "sku_and_url_match", "sourceHandle": source_handle, "product": linked}
    if len(candidates) == 1:
        return {"status": "unique_sku_url_mismatch", "sourceHandle": source_handle, "product": next(iter(candidates.values()))}
    return {"status": "ambiguous_or_missing_sku", "sourceHandle": source_handle, "product": None}


def slugify(value: str) -> str:
    normalized = value.lower().replace("&", " and ")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return re.sub(r"^-+|-+$", "", normalized)


def localized_title(title: str) -> str:
    translated = title
    for pattern, replacement in UA_REPLACEMENTS:
        translated = re.sub(pattern, replacement, translated, flags=re.IGNORECASE)
    translated = re.sub(r"\bКарбоновий\s+передня\b", "Карбонова передня", translated, flags=re.IGNORECASE)
    translated = re.sub(r"\bКарбоновий\s+бічні\b", "Карбонові бічні", translated, flags=re.IGNORECASE)
    translated = re.sub(r"\bКарбоновий\s+накладки\b", "Карбонові накладки", translated, flags=re.IGNORECASE)
    translated = re.sub(r"\bКарбоновий\s+канарди\b", "Карбонові канарди", translated, flags=re.IGNORECASE)
    return translated


def parse_header_row(sheet, row_number: int) -> list[str]:
    return [text(value) for value in next(sheet.iter_rows(min_row=row_number, values_only=True))]


def read_sheet_rows(path: Path, header_row: int) -> list[tuple[str, dict[str, Any]]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows: list[tuple[str, dict[str, Any]]] = []
    try:
        for sheet in workbook.worksheets:
            iterator = sheet.iter_rows(min_row=header_row, values_only=True)
            headers = [text(value) for value in next(iterator)]
            for source_row_number, raw_row in enumerate(iterator, start=header_row + 1):
                record = {header: raw_row[index] if index < len(raw_row) else None for index, header in enumerate(headers)}
                record["__sourceRowNumber"] = source_row_number
                sku = text(record.get("Product Code") or record.get("PRODUCT NO."))
                if SKU_RE.fullmatch(sku):
                    rows.append((sheet.title, record))
    finally:
        workbook.close()
    return rows


def choose_first(rows: list[dict[str, Any]], *columns: str) -> str:
    for row in rows:
        for column in columns:
            value = text(row.get(column))
            if value:
                return value
    return ""


def choose_number(rows: list[dict[str, Any]], *columns: str) -> float | None:
    for row in rows:
        for column in columns:
            value = number(row.get(column))
            if value is not None:
                return value
    return None


def unique_strings(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = text(value)
        if normalized and normalized.lower() not in seen:
            result.append(normalized)
            seen.add(normalized.lower())
    return result


def make_fitment(
    sheet: str,
    detail_rows: list[dict[str, Any]],
    ain_rows: list[dict[str, Any]],
    url: str,
    sku: str,
    official_products: list[dict[str, Any]],
    official_fetched_at: str | None,
    source_revision: str,
):
    audit_rows: list[dict[str, Any]] = []
    applications: list[dict[str, Any]] = []
    clauses_by_identity: dict[tuple[str, str, str | None, str | None], dict[str, Any]] = {}
    corrected_rows = unresolved_rows = 0
    source_rows = detail_rows or ain_rows

    for ordinal, row in enumerate(source_rows, 1):
        product_name = choose_first([row], "PRODUCT NAME", "Product Name")
        row_url = choose_first([row], "WEB LINK", "Website Link") or url
        make = resolve_make(sheet, product_name, row_url)
        raw_model = choose_first([row], "GENERATION / MODEL")
        source_signatures = extract_revozport_signatures(make, raw_model)
        official_match = revozport_official_match(sku, row_url, official_products)
        official_product = official_match["product"]
        official_title = text(official_product.get("title")) if official_product else ""
        official_handle = text(official_product.get("handle")) if official_product else ""
        official_title_signatures = extract_revozport_signatures(make, official_title)
        official_handle_signatures = extract_revozport_signatures(make, official_handle, is_url=True)
        official_handle_codes = extract_revozport_chassis_codes(make, official_handle, is_url=True)
        official_title_codes = extract_revozport_chassis_codes(make, official_title)
        if official_handle_signatures:
            resolved_signatures = _intersect_signatures(official_title_signatures, official_handle_signatures)
        elif not official_handle_codes or set(official_handle_codes).intersection(official_title_codes):
            # Some official handles are generic (for example /products/c7-hood).
            # Exact SKU + URL match still anchors the official page, while its
            # title supplies the vehicle identity.
            resolved_signatures = official_title_signatures
        else:
            resolved_signatures = []
        title_signatures = extract_revozport_signatures(make, product_name)
        url_signatures = extract_revozport_signatures(make, row_url, is_url=True)

        raw_identity_agrees = bool(
            source_signatures and resolved_signatures and
            _intersect_signatures(source_signatures, resolved_signatures)
        )
        source_title_agrees = bool(
            title_signatures and resolved_signatures and
            _intersect_signatures(title_signatures, resolved_signatures)
        )
        source_url_agrees = bool(
            url_signatures and resolved_signatures and
            _intersect_signatures(url_signatures, resolved_signatures)
        )
        has_source_conflict = (
            (bool(source_signatures) and not raw_identity_agrees) or
            (bool(title_signatures) and not source_title_agrees) or
            (bool(url_signatures) and not source_url_agrees)
        )
        if official_product and resolved_signatures:
            if official_match["status"] == "unique_sku_url_mismatch":
                resolution = "official_sku_match_source_url_conflict"
                corrected_rows += 1
            elif has_source_conflict:
                resolution = "corrected_from_official_sku_and_page"
                corrected_rows += 1
            else:
                resolution = "official_sku_url_confirmed"
        else:
            resolution = official_match["status"] if not official_product else "official_page_identity_conflict"
            resolved_signatures = []
            unresolved_rows += 1

        row_applications: list[dict[str, Any]] = []
        for model, chassis_code, _phase in resolved_signatures:
            generation_name = f"{chassis_code} {_phase}".strip() if chassis_code else (f"{model} {_phase}".strip() if _phase else None)
            application = {
                "make": make,
                "model": model,
                "chassisCode": chassis_code,
                "generation": generation_name,
            }
            row_applications.append(application)
            applications.append(application)

            identity = (make, model, generation_name, chassis_code)
            verification = "VERIFIED" if official_match["status"] == "sku_and_url_match" else "NEEDS_REVIEW"
            clause = clauses_by_identity.get(identity)
            raw_path = f"inventory.{sheet}.row.{row.get('__sourceRowNumber', ordinal)}"
            source_ref = f"https://revozport.com/products/{official_handle}" if official_handle else row_url
            evidence_refs = [value for value in (row_url, source_ref, f"sku:{sku}") if value]
            if clause is None:
                clause = {
                    "id": f"revozport-{len(clauses_by_identity) + 1}",
                    "verification": verification,
                    "provenance": {
                        "sourceRef": source_ref or "https://revozport.com/",
                        "sourceRecordKey": sku,
                        "rawPaths": [],
                        "evidenceRefs": [],
                    },
                    "constraints": [
                        {"dimension": "scope", "state": "EXACT", "values": ["auto"]},
                        {"dimension": "make", "state": "EXACT", "values": [make]},
                        {"dimension": "model", "state": "EXACT", "values": [model]},
                        {"dimension": "generation", "state": "EXACT", "values": [generation_name]}
                        if generation_name else {"dimension": "generation", "state": "UNKNOWN"},
                        {"dimension": "chassis", "state": "EXACT", "values": [chassis_code]}
                        if chassis_code else {"dimension": "chassis", "state": "UNKNOWN"},
                        # Workbook year values are not correlated reliably to
                        # model variants (the same SKU row can span pre-LCI and LCI).
                        {"dimension": "year", "state": "UNKNOWN"},
                        {"dimension": "engine", "state": "UNKNOWN"},
                        {"dimension": "fuel", "state": "UNKNOWN"},
                        {"dimension": "bodyStyle", "state": "UNKNOWN"},
                        {"dimension": "drivetrain", "state": "UNKNOWN"},
                        {"dimension": "transmission", "state": "UNKNOWN"},
                        {"dimension": "market", "state": "UNKNOWN"},
                        {"dimension": "opfGpf", "state": "UNKNOWN"},
                    ],
                }
                clauses_by_identity[identity] = clause
            elif verification == "VERIFIED":
                clause["verification"] = "VERIFIED"
            clause["provenance"]["rawPaths"].append(f"{raw_path}.GENERATION / MODEL")
            clause["provenance"]["rawPaths"].append(f"{raw_path}.PRODUCT NAME")
            clause["provenance"]["rawPaths"].append(f"{raw_path}.YEAR")
            clause["provenance"]["evidenceRefs"].extend(evidence_refs)

        audit_rows.append({
            "row": ordinal,
            "make": make or None,
            "rawGenerationModel": raw_model or None,
            "productName": product_name or None,
            "officialUrl": row_url or None,
            "officialMatchStatus": official_match["status"],
            "officialHandle": official_handle or None,
            "officialTitle": official_title or None,
            "sourceYear": text(row.get("YEAR")) or None,
            "resolution": resolution,
            "applications": row_applications,
        })

    clauses = list(clauses_by_identity.values())
    mode = "vehicle_specific" if clauses else "needs_review"
    note = "Fitment uses an exact Revozport SKU and official-page identity. Year, engine and configuration remain UNKNOWN until separately verified."
    if corrected_rows:
        note += f" Corrected or quarantined {corrected_rows} conflicting source row(s); raw claims and official page evidence are preserved in revozport_source.fitment_audit."
    if unresolved_rows:
        note += f" {unresolved_rows} row(s) remain unresolved and are excluded from vehicle-specific clauses."
    if not clauses:
        note = "No exact-SKU official product match with a supported vehicle identity; review before filtering."
    payload_hash = hashlib.sha256(
        json.dumps({"sku": sku, "audit": audit_rows, "clauses": clauses}, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    contract = {
        "version": 2,
        "mode": mode,
        "scope": "auto",
        "policy": {"requiredDimensions": ["make", "model"], "clauses": clauses},
        "parentSku": None,
        "source": {
            "supplier": "Revozport",
            "sourceRef": url or "https://revozport.com/",
            "sourceUpdatedAt": official_fetched_at,
            "sourceKey": "revozport-inventory-pricing",
            "sourceRecordKey": sku,
            "sourceRevision": source_revision,
            "payloadHash": payload_hash,
            "mapperVersion": "revozport-fitment-v2.1",
        },
        "note": note,
    }
    deduped_applications = list({
        (item["make"], item["model"], item["chassisCode"], item["generation"]): item
        for item in applications
    }.values())
    return contract, audit_rows, corrected_rows, unresolved_rows, deduped_applications


def meta(namespace: str, key: str, value: Any, value_type: str = "single_line_text_field") -> dict[str, str]:
    return {
        "namespace": namespace,
        "key": key,
        "value": text(value),
        "valueType": value_type,
    }


def extract_og_image(url: str) -> str | None:
    if not url:
        return None
    parts = urlsplit(url)
    product_json_url = urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") + ".js", "", ""))
    try:
        result = subprocess.run(
            [
                "curl.exe",
                "-L",
                "--max-time",
                "20",
                "-A",
                "Mozilla/5.0",
                "-H",
                "Accept: application/json",
                "-sS",
                product_json_url,
            ],
            capture_output=True,
            text=True,
            timeout=25,
            check=False,
        )
        if result.returncode == 0:
            product = json.loads(result.stdout)
            candidates = product.get("images", []) if isinstance(product, dict) else []
            if isinstance(candidates, list):
                for candidate in candidates:
                    if isinstance(candidate, str) and candidate.strip():
                        return candidate.strip().replace("http://", "https://", 1)
            if isinstance(product, dict) and isinstance(product.get("featured_image"), str):
                return product["featured_image"].strip().replace("http://", "https://", 1)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        pass

    request = Request(url, headers={"User-Agent": "OneCompany catalog preview/1.0"})
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(1_500_000).decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, ValueError):
        return None

    for tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.IGNORECASE):
        attrs = {
            key.lower(): html.unescape(value)
            for key, value in re.findall(
                r"([\w:-]+)\s*=\s*['\"]([^'\"]*)['\"]", tag, flags=re.IGNORECASE
            )
        }
        if attrs.get("property", "").lower() == "og:image" or attrs.get("name", "").lower() == "twitter:image":
            image = attrs.get("content", "").strip()
            if image:
                return image.replace("http://", "https://", 1)
    return None


def load_image_cache() -> dict[str, str | None]:
    if not IMAGE_CACHE_FILE.exists():
        return {}
    try:
        value = json.loads(IMAGE_CACHE_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def build_preview(
    pricing_path: Path,
    inventory_path: Path,
    include_images: bool,
    official_catalog_path: Path | None = None,
) -> dict[str, Any]:
    ain_rows = read_sheet_rows(pricing_path, 6)
    inventory_rows = read_sheet_rows(inventory_path, 3)
    official_products: list[dict[str, Any]] = []
    official_fetched_at: str | None = None
    if official_catalog_path and official_catalog_path.exists():
        official_catalog = json.loads(official_catalog_path.read_text(encoding="utf-8"))
        official_products = official_catalog.get("products", [])
        official_fetched_at = text(official_catalog.get("fetchedAt")) or None
    revision_parts = [
        hashlib.sha256(pricing_path.read_bytes()).hexdigest(),
        hashlib.sha256(inventory_path.read_bytes()).hexdigest(),
    ]
    if official_catalog_path and official_catalog_path.exists():
        revision_parts.append(hashlib.sha256(official_catalog_path.read_bytes()).hexdigest())
    source_revision = hashlib.sha256("\n".join(revision_parts).encode("utf-8")).hexdigest()
    ain_by_sku: dict[str, list[dict[str, Any]]] = defaultdict(list)
    detail_by_sku: dict[str, list[dict[str, Any]]] = defaultdict(list)
    detail_sheet_by_sku: dict[str, str] = {}
    for sheet, row in ain_rows:
        ain_by_sku[text(row.get("Product Code"))].append(row)
    for sheet, row in inventory_rows:
        sku = text(row.get("PRODUCT NO."))
        detail_by_sku[sku].append(row)
        detail_sheet_by_sku.setdefault(sku, sheet)

    all_skus = sorted(set(ain_by_sku) | set(detail_by_sku))
    cache = load_image_cache()
    if include_images:
        urls_to_fetch = sorted(
            {
                choose_first(detail_by_sku.get(sku, []), "WEB LINK")
                or choose_first(ain_by_sku.get(sku, []), "Website Link")
                for sku in set(ain_by_sku) | set(detail_by_sku)
            }
            - {""}
            - {url for url, image in cache.items() if image}
        )
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(extract_og_image, url): url for url in urls_to_fetch}
            for future in as_completed(futures):
                url = futures[future]
                try:
                    cache[url] = future.result()
                except Exception:
                    cache[url] = None
    products: list[dict[str, Any]] = []
    counts = Counter()
    image_failures: list[dict[str, str]] = []

    for sku in all_skus:
        ain = ain_by_sku.get(sku, [])
        detail = detail_by_sku.get(sku, [])
        rows = detail or ain
        sheet = detail_sheet_by_sku.get(sku, "")
        name = choose_first(detail, "PRODUCT NAME") or choose_first(ain, "Product Name") or sku
        url = choose_first(detail, "WEB LINK") or choose_first(ain, "Website Link")
        material = choose_first(detail, "MATERIAL") or choose_first(ain, "Material")
        product_type = choose_first(detail, "PRODUCT TYPE") or "Carbon aero"
        make = resolve_make(sheet, name, url)
        fitment, fitment_audit, corrected_fitment_rows, unresolved_fitment_rows, fitment_applications = make_fitment(
            sheet, detail, ain, url, sku, official_products, official_fetched_at, source_revision
        )
        counts["fitment_rows_corrected_from_title_and_url"] += corrected_fitment_rows
        counts["fitment_rows_unresolved"] += unresolved_fitment_rows
        counts["fitment_applications"] += len(fitment_applications)
        counts["fitment_verified_clauses"] += sum(
            1 for clause in fitment["policy"]["clauses"] if clause["verification"] == "VERIFIED"
        )
        counts["fitment_review_clauses"] += sum(
            1 for clause in fitment["policy"]["clauses"] if clause["verification"] == "NEEDS_REVIEW"
        )
        if not fitment["policy"]["clauses"]:
            counts["products_without_machine_readable_fitment"] += 1
        model_labels = unique_strings(
            [
                " ".join(
                    value
                    for value in (application["model"], application["generation"])
                    if value
                )
                for application in fitment_applications
            ]
        )
        make_labels = unique_strings([application["make"] for application in fitment_applications])
        if not make_labels and make:
            make_labels = [make]

        msrp = choose_number(detail, "MSRP")
        if msrp is None:
            msrp = choose_number(ain, "New MSRP (USD)")
        sea = choose_number(detail, "SEA SHIPPING")
        if sea is None:
            sea = choose_number(ain, "New Sea Shipping (USD)")
        air = choose_number(detail, "AIR SHIPPING")
        if air is None:
            air = choose_number(ain, "New Air shipping (USD)")

        length_cm = metric(choose_number(detail, "PACKAGE LENGTH (IN)"), IN_TO_CM)
        width_cm = metric(choose_number(detail, "PACKAGE WIDTH (IN)"), IN_TO_CM)
        height_cm = metric(choose_number(detail, "PACKAGE HEIGHT (IN)"), IN_TO_CM)
        shipping_weight_kg = metric(choose_number(detail, "SHIPPING WEIGHT(LBS)"), LB_TO_KG)
        product_weight_kg = metric(choose_number(detail, "PRODUCT WEIGHT (LBS)"), LB_TO_KG)
        if shipping_weight_kg is not None:
            weight_kg = shipping_weight_kg
            weight_source = "workbook_shipping_weight"
            weight_is_estimated = False
        else:
            weight_kg, weight_source = estimate_shipping_weight_kg(
                name,
                product_type,
                product_weight_kg,
                length_cm,
                width_cm,
                height_cm,
            )
            weight_is_estimated = True
        dimensions_complete = all(value is not None for value in (length_cm, width_cm, height_cm))
        weight_complete = weight_kg is not None
        calculated_shipping_usd = (
            round_currency(weight_kg * REVOZPORT_SHIPPING_RATE_USD_PER_KG)
            if weight_kg is not None
            else None
        )

        if include_images and url:
            image = cache.get(url)
            if image is None:
                image_failures.append({"sku": sku, "url": url})
        else:
            image = cache.get(url) if url else None

        title_ua = localized_title(name)
        inventory_values = [
            number(row.get(column)) or 0
            for row in rows
            for column in (
                "Available for sale inventory(CN)",
                "Available for sale inventory(US)",
                "Available for sale inventory(EU)",
                "AVAILABLE FOR SALE INVENTORY(CN)",
                "AVAILABLE FOR SALE INVENTORY(US)",
                "AVAILABLE FOR SALE INVENTORY(EU)",
            )
        ]
        inventory_qty = int(max(inventory_values, default=0))
        stock = "inStock" if inventory_qty > 0 else "preOrder"
        display_fitment = ", ".join(model_labels[:4]) or "vehicle-specific Revozport application"
        status = "ACTIVE" if msrp is not None and dimensions_complete and weight_complete and image else "DRAFT"
        if status == "ACTIVE":
            counts["publish_candidates"] += 1
        else:
            counts["draft_products"] += 1
        if msrp is None:
            counts["missing_price"] += 1
        if not dimensions_complete:
            counts["missing_dimensions"] += 1
        if shipping_weight_kg is None:
            counts["missing_source_shipping_weight"] += 1
        if weight_is_estimated:
            counts["estimated_weight"] += 1
        if not image:
            counts["missing_image"] += 1
        if len(rows) > 1:
            counts["merged_duplicate_rows"] += len(rows) - 1

        short_en = f"{name}. Revozport carbon aero component for {display_fitment}."
        short_ua = f"{title_ua}. Карбоновий компонент Revozport для {display_fitment}."
        weight_label_en = "shipping weight"
        weight_label_ua = "вага для доставки"
        dims_text_en = (
            f"Package: {length_cm:.1f} × {width_cm:.1f} × {height_cm:.1f} cm; "
            f"{weight_label_en}: {weight_kg:.3f} kg."
            if dimensions_complete and weight_kg is not None
            else "Package dimensions and shipping weight require review."
        )
        dims_text_ua = (
            f"Упаковка: {length_cm:.1f} × {width_cm:.1f} × {height_cm:.1f} см; "
            f"{weight_label_ua}: {weight_kg:.3f} кг."
            if dimensions_complete and weight_kg is not None
            else "Габарити упаковки та вага для доставки потребують перевірки."
        )
        body_en = (
            f"<p>{html.escape(short_en)}</p>"
            f"<ul><li>SKU: {html.escape(sku)}</li>"
            f"<li>Material: {html.escape(material or 'See official specification')}</li>"
            f"<li>{html.escape(dims_text_en)}</li>"
            f"<li>Worldwide delivery: {('$' + format(calculated_shipping_usd, '.2f') + ' at $25/kg') if calculated_shipping_usd is not None else 'weight required'}</li></ul>"
        )
        body_ua = (
            f"<p>{html.escape(short_ua)}</p>"
            f"<ul><li>Артикул: {html.escape(sku)}</li>"
            f"<li>Матеріал: {html.escape(material or 'див. офіційну специфікацію')}</li>"
            f"<li>{html.escape(dims_text_ua)}</li>"
            f"<li>Доставка по світу: {('$' + format(calculated_shipping_usd, '.2f') + ' за правилом $25/кг') if calculated_shipping_usd is not None else 'потрібна вага'}</li></ul>"
        )
        media = (
            [{"src": image, "altText": name, "position": 1, "mediaType": "IMAGE"}]
            if image
            else []
        )
        metafields = [
            meta("onecompany", "supplier_fitment", json.dumps(fitment, ensure_ascii=False), "json"),
            meta("revozport_source", "fitment_audit", json.dumps(fitment_audit, ensure_ascii=False), "json"),
            meta("revozport_source", "official_url", url or "https://revozport.com/", "url"),
            meta("revozport_source", "source_workbooks", "AIN_SKU_EXPORT_MX_9.14.xlsx; revozport_inventory_pricing_9.14.xlsx"),
            meta("revozport_source", "source_row_count", len(rows), "number_integer"),
        ]
        if sea is not None:
            metafields.append(meta("revozport_logistics", "sea_shipping_usd", f"{sea:.2f}", "number_decimal"))
        if air is not None:
            metafields.append(meta("revozport_logistics", "air_shipping_usd", f"{air:.2f}", "number_decimal"))
        if product_weight_kg is not None:
            metafields.append(meta("revozport_logistics", "product_weight_kg", f"{product_weight_kg:.3f}", "number_decimal"))
        if shipping_weight_kg is not None:
            metafields.append(meta("revozport_logistics", "shipping_weight_kg", f"{shipping_weight_kg:.3f}", "number_decimal"))
        else:
            metafields.append(meta("revozport_logistics", "shipping_weight_kg", f"{weight_kg:.3f}", "number_decimal"))
            metafields.append(meta("revozport_logistics", "estimated_shipping_weight_kg", f"{weight_kg:.3f}", "number_decimal"))
        metafields.append(meta("revozport_logistics", "shipping_weight_source", weight_source))
        metafields.append(meta("revozport_logistics", "shipping_rate_usd_per_kg", f"{REVOZPORT_SHIPPING_RATE_USD_PER_KG:.2f}", "number_decimal"))
        if weight_is_estimated:
            metafields.append(meta("revozport_logistics", "estimated_weight_safety_margin_pct", "10.00", "number_decimal"))
        if calculated_shipping_usd is not None:
            metafields.append(meta("revozport_logistics", "calculated_shipping_usd", f"{calculated_shipping_usd:.2f}", "number_decimal"))

        product = {
            "slug": f"revozport-{slugify(sku)}",
            "sku": sku,
            "scope": "auto",
            "storefront": "main",
            "brand": "Revozport",
            "vendor": "Revozport",
            "productType": product_type,
            "productCategory": product_type,
            "tags": unique_strings(["Revozport", *make_labels, product_type, *model_labels]),
            "collectionIds": [],
            "status": status,
            "titleUa": title_ua,
            "titleEn": name,
            "categoryUa": "Карбонова аеродинаміка",
            "categoryEn": "Carbon aero",
            "shortDescUa": short_ua,
            "shortDescEn": short_en,
            "longDescUa": body_ua,
            "longDescEn": body_en,
            "bodyHtmlUa": body_ua,
            "bodyHtmlEn": body_en,
            "leadTimeUa": "Під замовлення від Revozport" if stock == "preOrder" else None,
            "leadTimeEn": "Made to order from Revozport" if stock == "preOrder" else None,
            "stock": stock,
            "collectionUa": "Revozport",
            "collectionEn": "Revozport",
            "priceEur": None,
            "priceEurEurope": None,
            "priceUsd": round(msrp, 2) if msrp is not None else None,
            "priceUah": None,
            "priceEurB2b": None,
            "priceUsdB2b": None,
            "priceUahB2b": None,
            "compareAtEur": None,
            "compareAtUsd": None,
            "compareAtUah": None,
            "compareAtEurB2b": None,
            "compareAtUsdB2b": None,
            "compareAtUahB2b": None,
            "weight": weight_kg,
            "length": length_cm,
            "width": width_cm,
            "height": height_cm,
            "isDimensionsEstimated": weight_is_estimated,
            "image": image,
            "seoTitleUa": f"{title_ua} | Revozport — One Company",
            "seoTitleEn": f"{name} | Revozport — One Company",
            "seoDescriptionUa": short_ua,
            "seoDescriptionEn": short_en,
            "isPublished": False,
            "publishedAt": None,
            "gallery": [image] if image else [],
            "highlights": {
                "ua": [
                    "Офіційна ціна Revozport у USD" if msrp is not None else "Ціна уточнюється за офіційним прайсом",
                    "Доставка: $25/кг; вага для доставки вказана",
                    "Сумісність і дані упаковки збережені з прайсу виробника",
                ],
                "en": [
                    "Official Revozport USD price" if msrp is not None else "Price requires official quote",
                    "Delivery: $25/kg; shipping weight included",
                    "Fitment and package data retained from the manufacturer workbook",
                ],
            },
            "media": media,
            "options": [],
            "variants": [
                {
                    "title": "Default",
                    "sku": sku,
                    "position": 1,
                    "inventoryQty": inventory_qty,
                    "inventoryPolicy": "CONTINUE",
                    "inventoryTracker": "manual",
                    "fulfillmentService": "manual",
                    "priceEur": None,
                    "priceEurEurope": None,
                    "priceUsd": round(msrp, 2) if msrp is not None else None,
                    "priceUah": None,
                    "priceEurB2b": None,
                    "priceUsdB2b": None,
                    "priceUahB2b": None,
                    "compareAtEur": None,
                    "compareAtUsd": None,
                    "compareAtUah": None,
                    "compareAtEurB2b": None,
                    "compareAtUsdB2b": None,
                    "compareAtUahB2b": None,
                    "requiresShipping": True,
                    "taxable": True,
                    "image": image,
                    "weightUnit": "kg",
                    "weight": weight_kg,
                    "grams": round(weight_kg * 1000) if weight_kg is not None else None,
                    "length": length_cm,
                    "width": width_cm,
                    "height": height_cm,
                    "isDefault": True,
                    "isDimensionsEstimated": weight_is_estimated,
                }
            ],
            "metafields": metafields,
            "source": {
                "sheet": sheet,
                "sourceRows": len(rows),
                "officialUrl": url,
                "imageUrl": image,
                "msrpUsd": msrp,
                "seaShippingUsd": sea,
                "airShippingUsd": air,
                "packageInches": {
                    "length": choose_number(detail, "PACKAGE LENGTH (IN)"),
                    "width": choose_number(detail, "PACKAGE WIDTH (IN)"),
                    "height": choose_number(detail, "PACKAGE HEIGHT (IN)"),
                },
                "shippingWeightLbs": choose_number(detail, "SHIPPING WEIGHT(LBS)"),
                "estimatedShippingWeightKg": weight_kg if weight_is_estimated else None,
                "shippingWeightSource": weight_source,
                "productWeightLbs": choose_number(detail, "PRODUCT WEIGHT (LBS)"),
                "statusReason": "complete source data" if status == "ACTIVE" else "normalized logistics data; review remaining source gaps",
            },
        }
        products.append(product)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    counts["products"] = len(products)
    counts["source_ain_rows"] = len(ain_rows)
    counts["source_inventory_rows"] = len(inventory_rows)
    counts["products_with_official_url"] = sum(1 for product in products if product["source"]["officialUrl"])
    counts["products_with_sea_quote"] = sum(1 for product in products if product["source"]["seaShippingUsd"] is not None)
    counts["products_with_air_quote"] = sum(1 for product in products if product["source"]["airShippingUsd"] is not None)

    result = {
        "schemaVersion": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sourceFiles": [str(pricing_path), str(inventory_path)],
        "sourceRevision": source_revision,
        "counts": dict(counts),
        "imageFailures": image_failures,
        "products": products,
    }
    OUTPUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pricing", type=Path, default=DEFAULT_PRICING)
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument(
        "--official-catalog",
        type=Path,
        default=OUTPUT_DIR / "revozport-official-audit" / "products.json",
        help="Fresh read-only products.json snapshot from audit-revozport-official.mjs; exact SKU fitment is review-only without it.",
    )
    parser.add_argument("--no-images", action="store_true")
    args = parser.parse_args()
    if not args.pricing.exists():
        raise SystemExit(f"Pricing workbook not found: {args.pricing}")
    if not args.inventory.exists():
        raise SystemExit(f"Inventory workbook not found: {args.inventory}")
    result = build_preview(
        args.pricing,
        args.inventory,
        include_images=not args.no_images,
        official_catalog_path=args.official_catalog,
    )
    print(json.dumps({"output": str(OUTPUT_FILE), "counts": result["counts"], "imageFailures": len(result["imageFailures"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
