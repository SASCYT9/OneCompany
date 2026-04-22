from __future__ import annotations

from app.models import AnalysisResult, SignalEntry


def _join_list(values: list[str]) -> str:
    return ", ".join(values)


def format_entry_markdown(entry: SignalEntry) -> str:
    lines = [
        f"[{entry.resource_name}]",
        "",
        f"Type: {entry.source_type.value}",
        f"Platform: {entry.platform.value}",
        f"Link: {entry.link}",
        "",
        f"Category: {entry.category.value}",
        f"Relevant Brands: {_join_list(entry.relevant_brands)}",
        f"Relevant Vehicles / Platforms: {_join_list(entry.relevant_vehicles_platforms)}",
        f"Target Customer: {entry.target_customer.value}",
        "",
        "What it does:",
        entry.what_it_does.strip(),
        "",
        "Demand Signals:",
        entry.demand_signals.strip(),
        "",
        "Why it matters for One Company:",
        entry.why_it_matters_for_one_company.strip(),
        "",
        f"Commercial Potential: {entry.commercial_potential.value}",
        f"B2B Relevance: {entry.b2b_relevance.value}",
        f"Suggested Action: {entry.suggested_action.value}",
        f"Tags: {_join_list(entry.tags)}",
        "",
        "---",
    ]
    return "\n".join(lines).strip() + "\n"


def format_analysis_preview(result: AnalysisResult) -> str:
    entry = result.entry
    lines = [
        f"Target file: {entry.target_file.markdown_filename}",
        f"Signal score: {entry.signal_score}/100",
        f"Confidence: {entry.confidence}/5",
        f"Auto-save: {'yes' if result.should_auto_save else 'no'}",
        "",
        "Markdown preview:",
        result.preview_markdown,
    ]
    return "\n".join(lines)

