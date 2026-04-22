from app.formatter import format_entry_markdown
from app.models import (
    Category,
    PlatformName,
    PriorityLevel,
    SignalEntry,
    SourceType,
    SuggestedAction,
    TargetCustomer,
    TargetFile,
)


def build_entry() -> SignalEntry:
    return SignalEntry(
        resource_name="Akrapovic G80 demo",
        source_type=SourceType.SOCIAL,
        platform=PlatformName.INSTAGRAM,
        link="https://instagram.com/example",
        category=Category.EXHAUST,
        relevant_brands=["Akrapovic"],
        relevant_vehicles_platforms=["BMW G80"],
        target_customer=TargetCustomer.END_CUSTOMER,
        what_it_does="Показує вихлоп у короткому premium reel форматі.",
        demand_signals="Є питання про ціну, availability і fitment.",
        why_it_matters_for_one_company="Це корисно для exhaust catalog watch.",
        commercial_potential=PriorityLevel.HIGH,
        b2b_relevance=PriorityLevel.MEDIUM,
        suggested_action=SuggestedAction.CATALOG_CANDIDATE,
        tags=["akrapovic", "bmw-g80", "exhaust"],
        target_file=TargetFile.PRODUCT_DEMAND,
        signal_score=74,
        confidence=4,
    )


def test_format_entry_markdown_has_required_sections() -> None:
    markdown = format_entry_markdown(build_entry())
    assert "[Akrapovic G80 demo]" in markdown
    assert "Type: Social" in markdown
    assert "Platform: Instagram" in markdown
    assert "What it does:" in markdown
    assert "Demand Signals:" in markdown
    assert "Why it matters for One Company:" in markdown
    assert "Tags: akrapovic, bmw-g80, exhaust" in markdown
    assert markdown.endswith("---\n")
    assert "Signal score" not in markdown

