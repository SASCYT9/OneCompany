from __future__ import annotations

from app.models import PriorityLevel, SignalEntry, SuggestedAction, TargetFile


MULTILINE_FIELDS = {
    "What it does": "what_it_does",
    "Demand Signals": "demand_signals",
    "Why it matters for One Company": "why_it_matters_for_one_company",
}

INLINE_FIELDS = {
    "Type": "source_type",
    "Platform": "platform",
    "Link": "link",
    "Category": "category",
    "Relevant Brands": "relevant_brands",
    "Relevant Vehicles / Platforms": "relevant_vehicles_platforms",
    "Target Customer": "target_customer",
    "Commercial Potential": "commercial_potential",
    "B2B Relevance": "b2b_relevance",
    "Suggested Action": "suggested_action",
    "Tags": "tags",
}

FIELD_ORDER = list(INLINE_FIELDS) + list(MULTILINE_FIELDS)


def parse_markdown_entries(content: str, target_file: TargetFile) -> list[SignalEntry]:
    if not content.strip():
        return []
    blocks = [block.strip() for block in content.split("\n---") if block.strip()]
    entries: list[SignalEntry] = []
    for block in blocks:
        parsed = _parse_block(block, target_file)
        if parsed:
            entries.append(parsed)
    return entries


def _parse_block(block: str, target_file: TargetFile) -> SignalEntry | None:
    lines = [line.rstrip() for line in block.splitlines()]
    if not lines:
        return None
    resource_line = lines[0].strip()
    if not resource_line.startswith("[") or not resource_line.endswith("]"):
        return None

    payload: dict[str, object] = {
        "resource_name": resource_line[1:-1],
        "target_file": target_file.value,
        "signal_score": None,
        "confidence": None,
        "notes_optional": None,
    }
    index = 1
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        matched_label = next((label for label in FIELD_ORDER if line.startswith(f"{label}:")), None)
        if not matched_label:
            index += 1
            continue
        raw_value = line.split(":", 1)[1].strip()
        if matched_label in INLINE_FIELDS:
            field_name = INLINE_FIELDS[matched_label]
            if field_name in {"relevant_brands", "relevant_vehicles_platforms", "tags"}:
                payload[field_name] = [item.strip() for item in raw_value.split(",") if item.strip()]
            else:
                payload[field_name] = raw_value
            index += 1
            continue

        field_name = MULTILINE_FIELDS[matched_label]
        collected: list[str] = []
        if raw_value:
            collected.append(raw_value)
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if candidate and any(candidate.startswith(f"{label}:") for label in FIELD_ORDER):
                break
            collected.append(lines[index].rstrip())
            index += 1
        payload[field_name] = "\n".join(part for part in collected if part.strip()).strip()

    try:
        return SignalEntry.model_validate(payload)
    except Exception:
        return _repair_with_defaults(payload, target_file)


def _repair_with_defaults(payload: dict[str, object], target_file: TargetFile) -> SignalEntry | None:
    try:
        return SignalEntry(
            resource_name=str(payload.get("resource_name", "Unknown source")),
            source_type=str(payload.get("source_type", "Website")),
            platform=str(payload.get("platform", "Other")),
            link=str(payload.get("link", "")),
            category=str(payload.get("category", "Multi")),
            relevant_brands=list(payload.get("relevant_brands", [])),
            relevant_vehicles_platforms=list(payload.get("relevant_vehicles_platforms", [])),
            target_customer=str(payload.get("target_customer", "Multi")),
            what_it_does=str(payload.get("what_it_does", "Запис потребує ручного перегляду.")),
            demand_signals=str(payload.get("demand_signals", "Запис потребує повторного аналізу.")),
            why_it_matters_for_one_company=str(
                payload.get("why_it_matters_for_one_company", "Запис треба уточнити перед бізнес-використанням.")
            ),
            commercial_potential=str(payload.get("commercial_potential", PriorityLevel.LOW.value)),
            b2b_relevance=str(payload.get("b2b_relevance", PriorityLevel.LOW.value)),
            suggested_action=str(payload.get("suggested_action", SuggestedAction.MARKET_WATCH_ONLY.value)),
            tags=list(payload.get("tags", [])),
            target_file=target_file,
        )
    except Exception:
        return None
