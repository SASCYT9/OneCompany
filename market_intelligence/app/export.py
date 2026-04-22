from __future__ import annotations

import json
from pathlib import Path

from app.models import SignalEntry
from app.scoring import apply_score, heuristic_score


def entries_to_json(entries: list[SignalEntry]) -> str:
    payload = []
    for entry in entries:
        scored = entry if entry.signal_score is not None else apply_score(entry, heuristic_score(entry, ""))
        payload.append(scored.model_dump(mode="json"))
    return json.dumps(payload, ensure_ascii=False, indent=2)


def export_entries(entries: list[SignalEntry], output_path: Path | None = None) -> str:
    payload = entries_to_json(entries)
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(payload, encoding="utf-8", newline="\n")
    return payload

