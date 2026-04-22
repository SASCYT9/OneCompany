from app.dedupe import find_duplicates
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


def build_entry(name: str, link: str) -> SignalEntry:
    return SignalEntry(
        resource_name=name,
        source_type=SourceType.SOCIAL,
        platform=PlatformName.INSTAGRAM,
        link=link,
        category=Category.EXHAUST,
        relevant_brands=["Akrapovic"],
        relevant_vehicles_platforms=["BMW G80"],
        target_customer=TargetCustomer.END_CUSTOMER,
        what_it_does="Показує premium exhaust reel.",
        demand_signals="Є запити про купівлю і fitment.",
        why_it_matters_for_one_company="Підходить для exhaust watchlist.",
        commercial_potential=PriorityLevel.HIGH,
        b2b_relevance=PriorityLevel.MEDIUM,
        suggested_action=SuggestedAction.CATALOG_CANDIDATE,
        tags=["akrapovic", "bmw-g80", "exhaust"],
        target_file=TargetFile.PRODUCT_DEMAND,
    )


def test_find_duplicates_detects_exact_url_after_normalization() -> None:
    first = build_entry("Akrapovic G80 reel", "https://instagram.com/p/abc/?utm_source=test")
    second = build_entry("Akrapovic G80 reel repost", "https://instagram.com/p/abc")
    duplicates = find_duplicates(TargetFile.PRODUCT_DEMAND, [first, second], threshold=0.86)
    assert len(duplicates) == 1
    assert duplicates[0].reason == "exact_url"
    assert duplicates[0].similarity == 1.0

