from __future__ import annotations

from difflib import SequenceMatcher
from itertools import combinations

from app.models import PotentialDuplicate, SignalEntry, TargetFile
from app.scoring import apply_score, heuristic_score
from app.utils import normalize_title, normalize_url


def similarity_score(first: SignalEntry, second: SignalEntry) -> tuple[float, str]:
    first_url = normalize_url(first.link)
    second_url = normalize_url(second.link)
    if first_url and second_url and first_url == second_url:
        return 1.0, "exact_url"

    title_similarity = SequenceMatcher(None, normalize_title(first.resource_name), normalize_title(second.resource_name)).ratio()
    tag_similarity = SequenceMatcher(None, " ".join(sorted(first.tags)), " ".join(sorted(second.tags))).ratio()
    brand_overlap = len(set(first.relevant_brands).intersection(second.relevant_brands))

    score = max(title_similarity, (title_similarity * 0.8) + (tag_similarity * 0.2))
    if brand_overlap:
        score = min(1.0, score + 0.05)
    return score, "fuzzy_title"


def find_duplicates(target_file: TargetFile, entries: list[SignalEntry], threshold: float) -> list[PotentialDuplicate]:
    duplicates: list[PotentialDuplicate] = []
    for first, second in combinations(entries, 2):
        similarity, reason = similarity_score(first, second)
        if similarity < threshold:
            continue
        kept, duplicate = _choose_entry_to_keep(first, second)
        duplicates.append(
            PotentialDuplicate(
                target_file=target_file,
                kept_entry=kept,
                duplicate_entry=duplicate,
                similarity=round(similarity, 3),
                reason=reason,
            )
        )
    return duplicates


def remove_duplicates(entries: list[SignalEntry], duplicates: list[PotentialDuplicate]) -> list[SignalEntry]:
    duplicate_names = {(item.duplicate_entry.resource_name, item.duplicate_entry.link) for item in duplicates}
    return [entry for entry in entries if (entry.resource_name, entry.link) not in duplicate_names]


def _choose_entry_to_keep(first: SignalEntry, second: SignalEntry) -> tuple[SignalEntry, SignalEntry]:
    first_score = first.signal_score or heuristic_score(first, "").total
    second_score = second.signal_score or heuristic_score(second, "").total
    if second_score > first_score:
        return second, first
    if len(second.demand_signals) > len(first.demand_signals):
        return second, first
    return first, second

