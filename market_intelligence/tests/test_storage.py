from pathlib import Path

from app.config import AppConfig, ModelSettings
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
from app.storage import MarketStorage


def build_entry() -> SignalEntry:
    return SignalEntry(
        resource_name="KW G80 installer signal",
        source_type=SourceType.WEBSITE,
        platform=PlatformName.DEALER_SITE,
        link="https://dealer.example/kw-g80",
        category=Category.SUSPENSION,
        relevant_brands=["KW"],
        relevant_vehicles_platforms=["BMW G80"],
        target_customer=TargetCustomer.TUNING_SHOP,
        what_it_does="Описує installer-led попит на KW setup.",
        demand_signals="Є питання про supplier path, stock і install workflow.",
        why_it_matters_for_one_company="Це прямий B2B сигнал для partner outreach.",
        commercial_potential=PriorityLevel.HIGH,
        b2b_relevance=PriorityLevel.HIGH,
        suggested_action=SuggestedAction.PARTNER_WATCH,
        tags=["kw", "bmw-g80", "installer-demand"],
        target_file=TargetFile.B2B_PARTNER_SIGNALS,
    )


def build_storage(tmp_path: Path) -> MarketStorage:
    config = AppConfig(
        project_root=tmp_path,
        data_dir=tmp_path / "data",
        logs_dir=tmp_path / "logs",
        model=ModelSettings(),
    )
    return MarketStorage(config)


def test_storage_creates_required_data_files(tmp_path: Path) -> None:
    storage = build_storage(tmp_path)
    storage.ensure_data_files()
    expected = {
        "trends_product_demand.md",
        "trends_b2b_partner_signals.md",
        "trends_fitment_and_pain_points.md",
        "creatives_marketing.md",
        "trends_market_watch.md",
    }
    created = {path.name for path in (tmp_path / "data").iterdir()}
    assert expected == created


def test_storage_appends_and_parses_entries(tmp_path: Path) -> None:
    storage = build_storage(tmp_path)
    storage.ensure_data_files()
    storage.append_entry(build_entry())
    parsed = storage.load_file(TargetFile.B2B_PARTNER_SIGNALS)
    assert len(parsed.entries) == 1
    assert parsed.entries[0].resource_name == "KW G80 installer signal"
    assert parsed.entries[0].target_file == TargetFile.B2B_PARTNER_SIGNALS

