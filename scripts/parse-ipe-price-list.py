#!/usr/bin/env python3
"""
Parse an iPE PDF price list into structured JSON/CSV.

Default retail formula:
  retail_usd = msrp_usd + import_fee_usd

Where:
  - items below threshold use low fee
  - items at/above threshold use high fee

Usage:
  python scripts/parse-ipe-price-list.py "C:\\path\\to\\2025 Price List_USD.pdf"
  python scripts/parse-ipe-price-list.py "C:\\path\\to\\2025 Price List_USD.pdf" --threshold 5000 --low-fee 1500 --high-fee 1600
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


BRAND_ALIASES = {
    "AUDI": "Audi",
    "Aston Martin": "Aston Martin",
    "Audi": "Audi",
    "BMW": "BMW",
    "Benz": "Mercedes-Benz",
    "Bentley": "Bentley",
    "Chevrolet": "Chevrolet",
    "Ferrari": "Ferrari",
    "Jaguar": "Jaguar",
    "Lamborghini": "Lamborghini",
    "Land Rover": "Land Rover",
    "Lexus": "Lexus",
    "MINI": "MINI",
    "Maserati": "Maserati",
    "Mclaren": "McLaren",
    "McLaren": "McLaren",
    "Mercedes-Benz": "Mercedes-Benz",
    "Nissan": "Nissan",
    "Porsche": "Porsche",
    "Rolls Royce": "Rolls-Royce",
    "Ford": "Ford",
    "Subaru": "Subaru",
    "Toyota": "Toyota",
    "Volkswagen": "Volkswagen",
}
NORMALIZED_BRAND_ALIASES: dict[str, str] = {}

SKU_RE = re.compile(r"\b(?:[0-9A-Z]{1,}[A-Z0-9]*)(?:-[A-Z0-9]+){2,}\b")
ABS_PRICE_RE = re.compile(r"\$([\d,]+)\s*$")
REL_PRICE_RE = re.compile(r"\+\s*(?:\$([\d,]+)|(FREE))\s*$", re.IGNORECASE)
TBD_RE = re.compile(r"\bTBD\b", re.IGNORECASE)
YEAR_RE = re.compile(r"(?:19|20)\d{2}\s*[-–]\s*(?:Current|(?:19|20)\d{2})", re.IGNORECASE)
ENGINE_RE = re.compile(r"\bengine\b", re.IGNORECASE)
TOKEN_RE = re.compile(r"[a-z0-9]+")

PRIMARY_SECTION_HINTS = (
    "downpipe",
    "cat back",
    "catback",
    "cat pipe",
    "header",
    "front pipe",
    "rear valvetronic",
    "mid pipe",
    "muffler",
    "full system",
    "header back",
    "front section",
    "rear section",
)

SECTION_HINTS = PRIMARY_SECTION_HINTS + (
    "tips",
    "upgrade options",
    "no discount",
    "remote control",
    "obdii",
    "control",
    "version",
    "cat/catless straight",
    "catless straight",
    "equal-length full system",
    "equal length full system",
    "factory version",
    "non-opf version",
    "opf version",
    "dual side dual out version",
    "dual side single out version",
    "header back system",
)
ACCESSORY_HINTS = (
    "tips",
    "remote control",
    "obdii",
    "lighting sensor",
    "bmr control",
    "cel sync",
    "extend pipe",
    "polished silver",
    "chrome silver",
    "satin silver",
    "chrome black",
    "satin gold",
    "titanium blue",
    "gold",
)
MODEL_NOISE = {
    "remark",
    "upgrade options",
    "no discount",
    "bmr control",
    "remote control",
    "obdii with lighting sensor",
    "obdii control system",
    "control",
    "mat.",
}


@dataclass
class RawItem:
    page: int
    tier: str | None
    brand: str
    line_index: int
    raw_line: str
    section: str | None
    sku: str
    material: str | None
    description: str
    price_kind: str | None
    msrp_usd: float | None
    model_fragments: list[str] = field(default_factory=list)
    matched_summary_label: str | None = None


@dataclass
class ParsedItem:
    page: int
    tier: str | None
    brand: str
    model: str | None
    year_range: str | None
    engine: str | None
    section: str | None
    sku: str
    material: str | None
    description: str
    price_kind: str
    msrp_usd: float | None
    import_fee_usd: float | None
    retail_usd: float | None
    remarks: str | None
    matched_summary_label: str | None
    raw_line: str


@dataclass
class Block:
    page: int
    brand: str
    tier: str | None
    lines: list[str] = field(default_factory=list)
    remarks: list[str] = field(default_factory=list)


def collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("：", ":")).strip()


def normalize_for_match(value: str) -> str:
    value = collapse_spaces(value).lower()
    value = value.replace("catback", "cat back")
    value = value.replace("rear valvetronic system", "rear valvetronic system")
    return value


def split_layout_segments(value: str) -> list[str]:
    return [collapse_spaces(part) for part in re.split(r"\s{2,}", value) if collapse_spaces(part)]


def normalize_brand_key(value: str) -> str:
    return collapse_spaces(value).lower()


for alias, brand in BRAND_ALIASES.items():
    NORMALIZED_BRAND_ALIASES[normalize_brand_key(alias)] = brand
    NORMALIZED_BRAND_ALIASES[normalize_brand_key(brand)] = brand


def resolve_brand_heading(value: str) -> str | None:
    return NORMALIZED_BRAND_ALIASES.get(normalize_brand_key(value))


def infer_brand_from_line(value: str) -> str | None:
    for segment in split_layout_segments(value):
        brand = resolve_brand_heading(segment)
        if brand:
            return brand
    return None


def extract_tokens(value: str) -> set[str]:
    return {token for token in TOKEN_RE.findall(normalize_for_match(value)) if len(token) > 1}


def money_to_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value.replace(",", ""))
    except ValueError:
        return None


def looks_like_brand_heading(value: str) -> bool:
    return resolve_brand_heading(value) is not None


def looks_like_table_header(value: str) -> bool:
    normalized = collapse_spaces(value).upper()
    return "MODEL" in normalized and "SKU NO." in normalized and "MSRP" in normalized


def looks_like_footer(value: str) -> bool:
    normalized = collapse_spaces(value)
    return normalized.startswith("iPE Price List ")


def looks_like_section(value: str) -> bool:
    normalized = normalize_for_match(value)
    return any(hint in normalized for hint in SECTION_HINTS)


def is_accessory_item(item: RawItem) -> bool:
    haystack = normalize_for_match(f"{item.section or ''} {item.description}")
    return any(hint in haystack for hint in ACCESSORY_HINTS)


def needs_summary_price(item: RawItem) -> bool:
    if item.msrp_usd is not None or item.price_kind in {"relative", "free", "tbd"}:
        return False
    if is_accessory_item(item):
        return False
    haystack = normalize_for_match(f"{item.section or ''} {item.description}")
    return any(hint in haystack for hint in PRIMARY_SECTION_HINTS)


def is_included_accessory(item: RawItem) -> bool:
    return is_accessory_item(item)


def looks_like_price_line(value: str) -> bool:
    normalized = collapse_spaces(value)
    return bool(ABS_PRICE_RE.search(normalized) or REL_PRICE_RE.search(normalized) or TBD_RE.search(normalized))


def parse_item_line(page: int, tier: str | None, brand: str, line_index: int, line: str) -> RawItem | None:
    sku_match = SKU_RE.search(line)
    if not sku_match:
        return None

    left = line[: sku_match.start()].rstrip()
    sku = sku_match.group(0)
    right = line[sku_match.end() :].rstrip()

    price_kind: str | None = None
    price_value: float | None = None

    rel_match = REL_PRICE_RE.search(right)
    abs_match = ABS_PRICE_RE.search(right)

    if rel_match:
        if rel_match.group(2):
            price_kind = "free"
            price_value = 0.0
        else:
            price_kind = "relative"
            price_value = money_to_float(rel_match.group(1))
        right_core = right[: rel_match.start()].rstrip()
    elif abs_match:
        price_kind = "absolute"
        price_value = money_to_float(abs_match.group(1))
        right_core = right[: abs_match.start()].rstrip()
    elif TBD_RE.search(right):
        price_kind = "tbd"
        price_value = None
        right_core = TBD_RE.sub("", right).rstrip()
    else:
        right_core = right

    parts = split_layout_segments(left.strip())
    section = None
    model_fragments = parts
    if parts and looks_like_section(parts[-1]):
        section = collapse_spaces(parts[-1])
        model_fragments = parts[:-1]

    material = None
    description = collapse_spaces(right_core)
    material_match = re.match(r"^\s*([A-Za-z+]{1,10})\s{2,}(.*)$", right_core)
    if material_match:
        material = collapse_spaces(material_match.group(1))
        description = collapse_spaces(material_match.group(2))
    elif description in {"SS", "Ti"}:
        material = description
        description = ""

    return RawItem(
        page=page,
        tier=tier,
        brand=brand,
        line_index=line_index,
        raw_line=line.rstrip(),
        section=section,
        sku=sku,
        material=material,
        description=description,
        price_kind=price_kind,
        msrp_usd=price_value,
        model_fragments=model_fragments,
    )


def collect_blocks(
    page_no: int,
    text: str,
    default_brand: str | None = None,
    default_tier: str | None = None,
) -> tuple[list[Block], str | None, str | None]:
    blocks: list[Block] = []
    current_brand: str | None = default_brand
    current_tier: str | None = default_tier
    current_block: Block | None = None
    in_remarks = False

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        trimmed = collapse_spaces(line)
        if not trimmed or looks_like_footer(trimmed):
            continue

        if trimmed in {"Premium Products", "Standard Products"}:
            current_tier = trimmed
            continue

        brand_heading = resolve_brand_heading(trimmed)
        if brand_heading:
            current_brand = brand_heading
            continue

        if looks_like_table_header(trimmed):
            if current_block and (current_block.lines or current_block.remarks):
                blocks.append(current_block)
            current_block = Block(page=page_no, brand=current_brand or "Unknown", tier=current_tier)
            in_remarks = False
            continue

        if current_block is None:
            continue

        if current_block.brand == "Unknown":
            embedded_brand = infer_brand_from_line(line)
            if embedded_brand:
                current_block.brand = embedded_brand

        if trimmed == "Remark":
            in_remarks = True
            continue

        if in_remarks:
            current_block.remarks.append(trimmed)
        else:
            current_block.lines.append(line)

    if current_block and (current_block.lines or current_block.remarks):
        blocks.append(current_block)

    return blocks, current_brand, current_tier


def extract_summary_context(lines: list[str], index: int) -> str | None:
    if index <= 0:
        return None

    previous = collapse_spaces(lines[index - 1])
    if not previous or looks_like_table_header(previous) or previous == "Remark":
        return None

    if SKU_RE.search(previous):
        parsed = parse_item_line(0, None, "Unknown", index - 1, lines[index - 1])
        if parsed:
            context = collapse_spaces(f"{parsed.section or ''} {parsed.description or ''}")
            return context or parsed.material

    return previous


def parse_summary_lines(lines: list[str]) -> list[dict]:
    summaries = []
    for index, line in enumerate(lines):
        if SKU_RE.search(line):
            continue
        match = ABS_PRICE_RE.search(line)
        if not match:
            continue
        label = collapse_spaces(line[: match.start()])
        context = extract_summary_context(lines, index)
        if context and (not label or len(extract_tokens(label)) <= 2):
            label = collapse_spaces(f"{context} {label}")
        if not label or looks_like_table_header(label):
            continue
        summaries.append(
            {
                "line_index": index,
                "label": label,
                "normalized": normalize_for_match(label),
                "price": money_to_float(match.group(1)),
                "used": False,
            }
        )
    return summaries


def attach_item_continuations(items: list[RawItem], lines: list[str]) -> None:
    for item in items:
        next_index = item.line_index + 1
        if next_index >= len(lines):
            continue

        next_line = collapse_spaces(lines[next_index])
        if (
            not next_line
            or SKU_RE.search(next_line)
            or looks_like_price_line(next_line)
            or looks_like_table_header(next_line)
            or next_line == "Remark"
            or next_line.startswith("※")
            or YEAR_RE.search(next_line)
            or resolve_brand_heading(next_line) is not None
        ):
            continue

        normalized = normalize_for_match(next_line)
        if not any(hint in normalized for hint in PRIMARY_SECTION_HINTS + ACCESSORY_HINTS):
            continue

        if not item.description:
            item.description = next_line
        elif next_line not in item.description:
            item.description = collapse_spaces(f"{item.description} {next_line}")


def build_price_candidates(items: list[RawItem], summary_lines: list[dict]) -> list[dict]:
    candidates = [
        {
            "type": "summary",
            "line_index": summary["line_index"],
            "label": summary["label"],
            "normalized": summary["normalized"],
            "price": summary["price"],
            "used": summary["used"],
            "section": None,
        }
        for summary in summary_lines
    ]

    for item in items:
        if item.price_kind != "absolute" or item.msrp_usd is None or not is_accessory_item(item):
            continue
        label = collapse_spaces(f"{item.section or ''} {item.description}")
        candidates.append(
            {
                "type": "item",
                "line_index": item.line_index,
                "label": label,
                "normalized": normalize_for_match(label),
                "price": item.msrp_usd,
                "used": False,
                "section": normalize_for_match(item.section or ""),
            }
        )

    return candidates


def attach_summary_prices(items: list[RawItem], summary_lines: list[dict]) -> None:
    candidates = build_price_candidates(items, summary_lines)

    for item in items:
        if not needs_summary_price(item):
            if item.msrp_usd is None and is_included_accessory(item):
                item.price_kind = "included"
                item.msrp_usd = 0.0
            continue

        wanted = normalize_for_match(f"{item.section or ''} {item.description}")
        wanted_tokens = extract_tokens(wanted)
        wanted_section = normalize_for_match(item.section or "")

        best = None
        best_score = 0
        for candidate in candidates:
            candidate_tokens = extract_tokens(candidate["normalized"])
            overlap = len(wanted_tokens & candidate_tokens)
            score = overlap

            distance = candidate["line_index"] - item.line_index
            if 0 <= distance <= 3:
                score += 4 - distance
            elif distance > 3:
                score += 1

            if wanted_section and candidate["section"] and wanted_section == candidate["section"]:
                score += 4
            elif wanted_section and wanted_section in candidate["normalized"]:
                score += 3

            description_key = normalize_for_match(item.description)
            if description_key and description_key in candidate["normalized"]:
                score += 2
            if candidate["normalized"] in wanted:
                score += 1

            if candidate["type"] == "item" and "tips" in candidate["normalized"]:
                score += 3
            if candidate["used"]:
                score -= 1
            if score > best_score:
                best = candidate
                best_score = score

        if best and best_score >= 4:
            item.price_kind = "absolute"
            item.msrp_usd = best["price"]
            item.matched_summary_label = best["label"]
            best["used"] = True
        elif is_included_accessory(item):
            item.price_kind = "included"
            item.msrp_usd = 0.0


def unique_preserve_order(values: Iterable[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        normalized = collapse_spaces(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def is_brand_value(value: str, block_brand: str) -> bool:
    resolved = resolve_brand_heading(value)
    return bool(resolved and resolved == block_brand)


def is_model_noise(value: str, block_brand: str) -> bool:
    normalized = normalize_for_match(value)
    if not normalized:
        return True
    if "$" in value:
        return True
    if normalized in MODEL_NOISE:
        return True
    if normalized.startswith("※"):
        return True
    if is_brand_value(value, block_brand):
        return True
    if resolve_brand_heading(value) is not None:
        return True
    if looks_like_section(value):
        return True
    if value in {"SS", "Ti"}:
        return True
    if len(normalized) <= 2:
        return True
    return False


def infer_block_brand(block: Block, items: list[RawItem]) -> str:
    if block.brand != "Unknown":
        return block.brand

    for line in block.lines:
        brand = infer_brand_from_line(line)
        if brand:
            return brand

    for item in items:
        for fragment in item.model_fragments:
            brand = resolve_brand_heading(fragment)
            if brand:
                return brand

    return block.brand


def build_model_context(block: Block, items: list[RawItem]) -> tuple[str | None, str | None, str | None]:
    candidates: list[str] = []
    block_brand = infer_block_brand(block, items)

    for line in block.lines:
        if SKU_RE.search(line):
            continue
        candidates.extend(split_layout_segments(line))

    for item in items:
        candidates.extend(item.model_fragments)

    candidates = unique_preserve_order(candidates)

    year_range = next((value for value in candidates if YEAR_RE.search(value)), None)
    engine = next((value for value in candidates if ENGINE_RE.search(value)), None)

    model_parts = []
    for value in candidates:
        if year_range and value == year_range:
            continue
        if engine and value == engine:
            continue
        if is_model_noise(value, block_brand):
            continue
        model_parts.append(value)

    model = " | ".join(model_parts) if model_parts else None
    return model, year_range, engine


def compute_import_fee(msrp_usd: float | None, low_fee: float, high_fee: float, threshold: float) -> float | None:
    if msrp_usd is None:
        return None
    return high_fee if msrp_usd >= threshold else low_fee


def finalize_items(block: Block) -> list[ParsedItem]:
    raw_items = [
        parse_item_line(block.page, block.tier, block.brand, index, line)
        for index, line in enumerate(block.lines)
    ]
    raw_items = [item for item in raw_items if item is not None]
    block.brand = infer_block_brand(block, raw_items)
    for item in raw_items:
        item.brand = block.brand

    attach_item_continuations(raw_items, block.lines)
    summary_lines = parse_summary_lines(block.lines)
    attach_summary_prices(raw_items, summary_lines)

    model, year_range, engine = build_model_context(block, raw_items)
    remarks = " | ".join(unique_preserve_order(block.remarks)) or None

    return raw_items, model, year_range, engine, remarks


def parse_price_list(pdf_path: Path, low_fee: float, high_fee: float, threshold: float) -> list[ParsedItem]:
    reader = PdfReader(str(pdf_path))
    parsed_items: list[ParsedItem] = []
    current_brand: str | None = None
    current_tier: str | None = None

    for page_no, page in enumerate(reader.pages, start=1):
        text = page.extract_text(extraction_mode="layout", layout_mode_space_vertically=False) or ""
        blocks, current_brand, current_tier = collect_blocks(page_no, text, current_brand, current_tier)
        for block in blocks:
            raw_items, model, year_range, engine, remarks = finalize_items(block)
            for item in raw_items:
                import_fee = None
                retail = None
                price_kind = item.price_kind or "unpriced"

                if price_kind == "absolute":
                    import_fee = compute_import_fee(item.msrp_usd, low_fee, high_fee, threshold)
                    if item.msrp_usd is not None and import_fee is not None:
                        retail = item.msrp_usd + import_fee
                elif price_kind in {"relative", "free", "included"}:
                    retail = item.msrp_usd

                parsed_items.append(
                    ParsedItem(
                        page=item.page,
                        tier=item.tier,
                        brand=item.brand,
                        model=model,
                        year_range=year_range,
                        engine=engine,
                        section=item.section,
                        sku=item.sku,
                        material=item.material,
                        description=item.description,
                        price_kind=price_kind,
                        msrp_usd=item.msrp_usd,
                        import_fee_usd=import_fee,
                        retail_usd=retail,
                        remarks=remarks,
                        matched_summary_label=item.matched_summary_label,
                        raw_line=item.raw_line,
                    )
                )

    return parsed_items


def default_output_paths(pdf_path: Path) -> tuple[Path, Path]:
    base = pdf_path.with_suffix("")
    return base.with_suffix(".parsed.json"), base.with_suffix(".parsed.csv")


def write_json(
    path: Path,
    source_pdf: Path,
    items: list[ParsedItem],
    low_fee: float,
    high_fee: float,
    threshold: float,
) -> None:
    payload = {
        "source_pdf": str(source_pdf),
        "pricing_formula": {
            "type": "flat_import_fee_by_threshold",
            "threshold_usd": threshold,
            "low_fee_usd": low_fee,
            "high_fee_usd": high_fee,
            "rule": f"retail = msrp + ({high_fee} if msrp >= {threshold} else {low_fee})",
        },
        "items": [asdict(item) for item in items],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(path: Path, items: list[ParsedItem]) -> None:
    fieldnames = [
        "page",
        "tier",
        "brand",
        "model",
        "year_range",
        "engine",
        "section",
        "sku",
        "material",
        "description",
        "price_kind",
        "msrp_usd",
        "import_fee_usd",
        "retail_usd",
        "matched_summary_label",
        "remarks",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            row = {key: getattr(item, key) for key in fieldnames}
            writer.writerow(row)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Parse iPE PDF price list into JSON/CSV.")
    parser.add_argument("pdf_path", type=Path, help="Path to the source PDF.")
    parser.add_argument("--json-out", type=Path, help="Optional JSON output path.")
    parser.add_argument("--csv-out", type=Path, help="Optional CSV output path.")
    parser.add_argument("--low-fee", type=float, default=1500, help="Flat import fee for items below threshold.")
    parser.add_argument("--high-fee", type=float, default=1600, help="Flat import fee for items at/above threshold.")
    parser.add_argument("--threshold", type=float, default=5000, help="MSRP threshold for switching to the high fee.")
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    pdf_path: Path = args.pdf_path
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    json_out, csv_out = default_output_paths(pdf_path)
    if args.json_out:
        json_out = args.json_out
    if args.csv_out:
        csv_out = args.csv_out

    items = parse_price_list(pdf_path, args.low_fee, args.high_fee, args.threshold)

    json_out.parent.mkdir(parents=True, exist_ok=True)
    csv_out.parent.mkdir(parents=True, exist_ok=True)
    write_json(json_out, pdf_path, items, args.low_fee, args.high_fee, args.threshold)
    write_csv(csv_out, items)

    priced = sum(1 for item in items if item.msrp_usd is not None)
    retail_ready = sum(1 for item in items if item.retail_usd is not None)
    unresolved = sum(1 for item in items if item.msrp_usd is None)

    print(f"Parsed items: {len(items)}")
    print(f"Priced items: {priced}")
    print(f"Retail-ready items: {retail_ready}")
    print(f"Unresolved price rows: {unresolved}")
    print(f"JSON: {json_out}")
    print(f"CSV: {csv_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
