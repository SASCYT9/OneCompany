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
            for raw_row in iterator:
                record = {header: raw_row[index] if index < len(raw_row) else None for index, header in enumerate(headers)}
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


def make_fitment(sheet: str, detail_rows: list[dict[str, Any]], ain_rows: list[dict[str, Any]], url: str) -> dict[str, Any]:
    applications: list[dict[str, Any]] = []
    for row in detail_rows:
        make = SHEET_MAKES.get(sheet, "")
        product_name = choose_first([row], "PRODUCT NAME")
        model = choose_first([row], "GENERATION / MODEL")
        if not model and product_name:
            match = re.search(rf"\bfor\s+{re.escape(make)}\s+(.+?)(?=\s+(?:18|19|20|21)\d{{2}}(?:[-–]\d{{2,4}})?\b|$)", product_name, flags=re.IGNORECASE)
            model = match.group(1).strip() if match else product_name
        if not make or not model:
            continue
        year_from, year_to = year_bounds(row.get("YEAR"), product_name)
        applications.append(
            {
                "vehicleType": "car",
                "make": make,
                "model": model,
                "chassisCode": None,
                "yearFrom": year_from,
                "yearTo": year_to,
                "engine": None,
                "fuel": None,
                "bodyStyle": None,
                "drivetrain": None,
                "transmission": None,
                "market": None,
                "opfGpf": "unknown",
            }
        )

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for application in applications:
        key = json.dumps(application, sort_keys=True)
        if key not in seen:
            deduped.append(application)
            seen.add(key)

    mode = "vehicle_specific" if deduped else "needs_review"
    note = (
        "Compatibility merged from the Revozport inventory/pricing workbook. "
        "Review model/year clauses before publication."
    )
    if not deduped:
        note = "The source row has no machine-readable make/model/year clause; review before publication."
    return {
        "version": 1,
        "mode": mode,
        "scope": "auto",
        "applications": deduped,
        "parentSku": None,
        "source": {"supplier": "Revozport", "sourceRef": url or "https://revozport.com/", "sourceUpdatedAt": None},
        "note": note,
    }


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


def build_preview(pricing_path: Path, inventory_path: Path, include_images: bool) -> dict[str, Any]:
    ain_rows = read_sheet_rows(pricing_path, 6)
    inventory_rows = read_sheet_rows(inventory_path, 3)
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
        model_labels = unique_strings(
            [choose_first([row], "GENERATION / MODEL") for row in detail]
        )
        if not model_labels:
            for source_row in detail or ain:
                source_name = choose_first([source_row], "PRODUCT NAME", "Product Name")
                make_name = SHEET_MAKES.get(sheet, "")
                match = re.search(
                    rf"\bfor\s+{re.escape(make_name)}\s+(.+?)(?=\s+(?:18|19|20|21)\d{{2}}(?:[-–]\d{{2,4}})?\b|$)",
                    source_name,
                    flags=re.IGNORECASE,
                ) if make_name else None
                if match:
                    model_labels.append(match.group(1).strip())
            model_labels = unique_strings(model_labels)

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
        make = SHEET_MAKES.get(sheet, "")
        fitment = make_fitment(sheet, detail, ain, url)
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
            "tags": unique_strings(["Revozport", make, product_type, *model_labels]),
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
    parser.add_argument("--no-images", action="store_true")
    args = parser.parse_args()
    if not args.pricing.exists():
        raise SystemExit(f"Pricing workbook not found: {args.pricing}")
    if not args.inventory.exists():
        raise SystemExit(f"Inventory workbook not found: {args.inventory}")
    result = build_preview(args.pricing, args.inventory, include_images=not args.no_images)
    print(json.dumps({"output": str(OUTPUT_FILE), "counts": result["counts"], "imageFailures": len(result["imageFailures"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
