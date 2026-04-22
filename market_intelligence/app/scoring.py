from __future__ import annotations

import re

from app.models import PriorityLevel, ScoreBreakdown, ScoreEstimationDraft, SignalEntry


BUYING_INTENT_CUES = [
    "price",
    "pricing",
    "how much",
    "where can i buy",
    "buy",
    "availability",
    "dealer",
    "distributor",
    "available for",
    "need this",
    "shipping",
    "install cost",
    "fitment",
    "ціна",
    "цін",
    "де купити",
    "купити",
    "дилер",
    "дистриб",
    "наявн",
    "доставка",
    "встанов",
    "потрібно",
]

B2B_CUES = [
    "dealer terms",
    "wholesale",
    "reseller",
    "installer",
    "install shop",
    "tuning shop",
    "workshop",
    "supplier",
    "stock",
    "margin",
    "dealer",
    "distributor",
    "partner",
    "майстерня",
    "установщик",
    "дилер",
    "партнер",
    "опт",
    "сервіс",
    "постачальник",
    "склад",
]

FITMENT_CUES = [
    "fitment",
    "compatible",
    "works with",
    "oem sensor",
    "sensor",
    "lead time",
    "no dealer",
    "wish there was",
    "how difficult is installation",
    "shipping to",
    "make this for",
    "opf",
    "підходить",
    "сумісн",
    "сенсор",
    "складно встановити",
    "термін поставки",
    "немає дилера",
    "чи є для",
]

CONTENT_CUES = [
    "macro",
    "cinematic",
    "rolling shot",
    "cold start",
    "studio light",
    "reel",
    "short-form",
    "close-up",
    "beauty shot",
    "детальний кадр",
    "макро",
    "ролик",
    "cold start",
    "студійне світло",
]

MARKET_CUES = [
    "launch",
    "new kit",
    "new product",
    "viral",
    "trend",
    "surge",
    "hype",
    "buzz",
    "seasonal",
    "drop",
    "launch edition",
    "запуск",
    "новинка",
    "хвиля",
    "ажиотаж",
    "тренд",
]

PREMIUM_BRANDS = {
    "akrapovic",
    "eventuri",
    "kw",
    "ohlins",
    "hre",
    "bbs",
    "brembo",
    "girodisc",
    "csf",
    "do88",
    "urban automotive",
    "adro",
    "novitec",
    "techart",
    "manthey",
    "capristo",
    "ipe",
    "armytrix",
    "vorsteiner",
    "rotiform",
    "milltek",
    "bilstein",
}


def _count_hits(text: str, cues: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for cue in cues if cue in lowered)


def _priority_bonus(level: PriorityLevel, high: int, medium: int) -> int:
    if level is PriorityLevel.HIGH:
        return high
    if level is PriorityLevel.MEDIUM:
        return medium
    return 0


def heuristic_score(entry: SignalEntry, context_text: str) -> ScoreBreakdown:
    combined = "\n".join(
        [
            entry.resource_name,
            entry.what_it_does,
            entry.demand_signals,
            entry.why_it_matters_for_one_company,
            context_text,
            " ".join(entry.relevant_brands),
            " ".join(entry.relevant_vehicles_platforms),
            " ".join(entry.tags),
        ]
    ).lower()

    buying_hits = min(_count_hits(combined, BUYING_INTENT_CUES), 5)
    b2b_hits = min(_count_hits(combined, B2B_CUES), 4)
    fitment_hits = min(_count_hits(combined, FITMENT_CUES), 4)
    content_hits = min(_count_hits(combined, CONTENT_CUES), 4)
    market_hits = min(_count_hits(combined, MARKET_CUES), 3)
    premium_hits = sum(1 for brand in entry.relevant_brands if brand.lower() in PREMIUM_BRANDS)

    breakdown = ScoreBreakdown(
        buying_intent=min(30, buying_hits * 6 + _priority_bonus(entry.commercial_potential, 10, 5)),
        b2b_relevance=min(20, b2b_hits * 4 + _priority_bonus(entry.b2b_relevance, 8, 4)),
        fitment_partner_utility=min(
            15,
            fitment_hits * 3
            + (5 if entry.suggested_action.value in {"Fitment Note", "Sales Follow-Up", "Partner Watch"} else 0),
        ),
        premium_product_fit=min(
            15,
            premium_hits * 4
            + (5 if entry.category.value in {"Exhaust", "Suspension", "Wheels & Tires", "Brakes", "Exterior & Aero", "Moto"} else 2),
        ),
        content_utility=min(
            10,
            content_hits * 2 + (4 if entry.suggested_action.value == "Content Reference" else 1),
        ),
        market_significance=min(
            5,
            market_hits * 2
            + (2 if entry.target_file.value == "trends_market_watch" else 0)
            + (1 if re.search(r"\b(g80|992|w463a|rs6|urus|panigale|m3|gt3|octa)\b", combined) else 0),
        ),
        confidence=min(
            5,
            1
            + (1 if entry.link else 0)
            + (1 if len(context_text) > 180 else 0)
            + (1 if entry.relevant_brands else 0)
            + (1 if entry.relevant_vehicles_platforms else 0),
        ),
    )
    return breakdown


def normalize_score_breakdown(
    entry: SignalEntry,
    context_text: str,
    llm_draft: ScoreEstimationDraft | None = None,
) -> ScoreBreakdown:
    if llm_draft is None:
        return heuristic_score(entry, context_text)
    breakdown = ScoreBreakdown.model_validate(llm_draft.model_dump())
    heuristic = heuristic_score(entry, context_text)
    if breakdown.total < 35:
        # Conservative floor from heuristics so obvious intent is not lost.
        breakdown = ScoreBreakdown(
            buying_intent=max(breakdown.buying_intent, heuristic.buying_intent),
            b2b_relevance=max(breakdown.b2b_relevance, heuristic.b2b_relevance),
            fitment_partner_utility=max(breakdown.fitment_partner_utility, heuristic.fitment_partner_utility),
            premium_product_fit=max(breakdown.premium_product_fit, heuristic.premium_product_fit),
            content_utility=max(breakdown.content_utility, heuristic.content_utility),
            market_significance=max(breakdown.market_significance, heuristic.market_significance),
            confidence=max(breakdown.confidence, heuristic.confidence),
        )
    return breakdown


def apply_score(entry: SignalEntry, breakdown: ScoreBreakdown) -> SignalEntry:
    updated = entry.model_copy(deep=True)
    updated.signal_score = breakdown.total
    updated.confidence = breakdown.confidence
    return updated
