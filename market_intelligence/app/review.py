from __future__ import annotations

from itertools import chain

from app.models import ParsedFile, ReviewSummary, SignalEntry, WeeklyDigestSummary
from app.scoring import apply_score, heuristic_score
from app.utils import top_counts, truncate


def hydrate_entries(entries: list[SignalEntry]) -> list[SignalEntry]:
    hydrated: list[SignalEntry] = []
    for entry in entries:
        if entry.signal_score is None:
            hydrated.append(apply_score(entry, heuristic_score(entry, "")))
        else:
            hydrated.append(entry)
    return hydrated


def build_review_summary(title: str, entries: list[SignalEntry]) -> ReviewSummary:
    hydrated = hydrate_entries(entries)
    sorted_entries = sorted(hydrated, key=lambda item: item.signal_score or 0, reverse=True)

    strongest_commercial = [
        f"{item.resource_name} — score {item.signal_score}, action {item.suggested_action.value}, category {item.category.value}"
        for item in sorted_entries[:5]
    ]

    strongest_b2b = [
        f"{item.resource_name} — B2B {item.b2b_relevance.value}, customer {item.target_customer.value}"
        for item in sorted_entries
        if item.b2b_relevance.value == "High" or item.target_customer.value in {"Workshop", "Dealer", "Tuning Shop", "Distributor"}
    ][:5]

    fitment_entries = [
        f"{item.resource_name} — {truncate(item.demand_signals, 140)}"
        for item in sorted_entries
        if "fitment" in " ".join(item.tags) or "sensor" in item.demand_signals.lower() or "підход" in item.demand_signals.lower()
    ][:5]

    content_entries = [
        f"{item.resource_name} — {truncate(item.what_it_does, 140)}"
        for item in sorted_entries
        if item.suggested_action.value == "Content Reference"
    ][:5]

    brand_counts = [f"{brand} — {count}" for brand, count in top_counts(chain.from_iterable(item.relevant_brands for item in hydrated), 5)]
    platform_counts = [
        f"{platform} — {count}" for platform, count in top_counts(chain.from_iterable(item.relevant_vehicles_platforms for item in hydrated), 5)
    ]
    category_counts = [f"{category} — {count}" for category, count in top_counts([item.category.value for item in hydrated], 5)]

    weak_entries = [
        f"{item.resource_name} — score {item.signal_score}, confidence {item.confidence}"
        for item in sorted_entries
        if (item.signal_score or 0) < 60 or (item.confidence or 0) <= 2
    ][:5]

    next_actions = [
        "Підготувати shortlist для каталогу з найсильніших product-demand сигналів.",
        "Передати B2B partner signals сейлз-команді для partner outreach.",
        "Перевірити fitment pain points на предмет відсутніх платформ у каталозі.",
        "Вибрати 2-3 creatives_marketing записи як референси для контент-зйомки.",
        "Зібрати weekly watchlist брендів і платформ з повторюваною traction.",
    ]

    return ReviewSummary(
        title=title,
        strongest_commercial_signals=strongest_commercial,
        strongest_b2b_signals=strongest_b2b,
        repeated_fitment_issues=fitment_entries,
        strongest_content_references=content_entries,
        brands_showing_traction=brand_counts,
        platforms_showing_traction=platform_counts,
        categories_showing_traction=category_counts,
        weak_entries_to_review=weak_entries,
        concrete_next_actions=next_actions,
    )


def build_weekly_digest(parsed_files: list[ParsedFile]) -> WeeklyDigestSummary:
    all_entries = hydrate_entries(list(chain.from_iterable(item.entries for item in parsed_files)))
    top_entries = sorted(all_entries, key=lambda item: item.signal_score or 0, reverse=True)

    def top_for(target_file: str, limit: int = 5) -> list[str]:
        return [
            f"{entry.resource_name} — score {entry.signal_score}, {entry.suggested_action.value}"
            for entry in top_entries
            if entry.target_file.value == target_file
        ][:limit]

    emerging_values = list(
        chain.from_iterable(item.relevant_brands for item in all_entries)
    ) + list(chain.from_iterable(item.relevant_vehicles_platforms for item in all_entries)) + [
        item.category.value for item in all_entries
    ]
    emerging = [f"{name} — {count}" for name, count in top_counts(emerging_values, 8)]

    priorities = [
        "Оновити watchlist по брендах і платформах, що повторюються у двох і більше файлах.",
        "Перетворити сильні fitment питання на FAQ, sales enablement і sourcing backlog.",
        "Підняти в outreach ті B2B сигнали, де видно installer або dealer intent.",
        "Планувати контент навколо найдорожчих візуально сильних категорій: exhaust, wheels, aero, brakes.",
        "Щотижня чистити слабкі або дубльовані записи, щоб база лишалась комерційно корисною.",
    ]

    return WeeklyDigestSummary(
        top_product_opportunities=top_for("trends_product_demand", 10),
        top_partner_signals=top_for("trends_b2b_partner_signals", 5),
        top_fitment_pain_points=top_for("trends_fitment_and_pain_points", 5),
        top_content_references=top_for("creatives_marketing", 5),
        emerging_brands_categories_platforms=emerging[:8],
        recommended_priorities_for_next_week=priorities,
    )


def render_review_summary(summary: ReviewSummary) -> str:
    def bullet_lines(items: list[str]) -> list[str]:
        return [f"- {item}" for item in items] if items else ["- Немає даних."]

    sections = [
        f"# {summary.title}",
        "",
        "## Strongest Commercial Signals",
        *bullet_lines(summary.strongest_commercial_signals),
        "",
        "## Strongest B2B Signals",
        *bullet_lines(summary.strongest_b2b_signals),
        "",
        "## Repeated Fitment Issues",
        *bullet_lines(summary.repeated_fitment_issues),
        "",
        "## Strongest Content References",
        *bullet_lines(summary.strongest_content_references),
        "",
        "## Brands Showing Traction",
        *bullet_lines(summary.brands_showing_traction),
        "",
        "## Platforms Showing Traction",
        *bullet_lines(summary.platforms_showing_traction),
        "",
        "## Categories Showing Traction",
        *bullet_lines(summary.categories_showing_traction),
        "",
        "## Weak Entries To Review",
        *bullet_lines(summary.weak_entries_to_review),
        "",
        "## Concrete Next Actions",
        *[f"- {item}" for item in summary.concrete_next_actions],
    ]
    return "\n".join(sections) + "\n"


def render_weekly_digest(summary: WeeklyDigestSummary) -> str:
    def bullet_lines(items: list[str]) -> list[str]:
        return [f"- {item}" for item in items] if items else ["- Немає даних."]

    sections = [
        "# Weekly Digest",
        "",
        "## Top Product Opportunities",
        *bullet_lines(summary.top_product_opportunities),
        "",
        "## Top Partner Signals",
        *bullet_lines(summary.top_partner_signals),
        "",
        "## Top Fitment / Pain-Point Signals",
        *bullet_lines(summary.top_fitment_pain_points),
        "",
        "## Top Content References",
        *bullet_lines(summary.top_content_references),
        "",
        "## Emerging Brands / Categories / Platforms",
        *bullet_lines(summary.emerging_brands_categories_platforms),
        "",
        "## Recommended Priorities For Next Week",
        *[f"- {item}" for item in summary.recommended_priorities_for_next_week],
    ]
    return "\n".join(sections) + "\n"
