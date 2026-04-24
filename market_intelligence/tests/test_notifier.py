import sys
from pathlib import Path

from app.config import AppConfig, ModelSettings, OpenClawSettings
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
from app.notifier import OpenClawNotifier
from app.storage import MarketStorage


def build_config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        project_root=tmp_path,
        data_dir=tmp_path / "data",
        logs_dir=tmp_path / "logs",
        threshold_auto_save=60,
        model=ModelSettings(),
        openclaw=OpenClawSettings(
            executable=sys.executable,
            targets=["478891619"],
            state_file=tmp_path / "logs" / "openclaw_notifier_state.json",
        ),
    )


def build_entry() -> SignalEntry:
    return SignalEntry(
        resource_name="Akrapovic BMW G80 cold-start reel",
        source_type=SourceType.SOCIAL,
        platform=PlatformName.INSTAGRAM,
        link="https://instagram.com/p/demo",
        category=Category.EXHAUST,
        relevant_brands=["Akrapovic"],
        relevant_vehicles_platforms=["BMW G80"],
        target_customer=TargetCustomer.END_CUSTOMER,
        what_it_does="Показує premium exhaust reel для BMW G80 з фокусом на cold-start.",
        demand_signals="У коментарях є питання про ціну, дилера і доступність для BMW G80.",
        why_it_matters_for_one_company="Це прямий exhaust signal для каталогу і подальшого sales follow-up.",
        commercial_potential=PriorityLevel.HIGH,
        b2b_relevance=PriorityLevel.MEDIUM,
        suggested_action=SuggestedAction.CATALOG_CANDIDATE,
        tags=["akrapovic", "bmw-g80", "exhaust"],
        target_file=TargetFile.PRODUCT_DEMAND,
        signal_score=74,
        confidence=4,
    )


def test_notifier_sends_pending_entries_once(tmp_path: Path) -> None:
    config = build_config(tmp_path)
    storage = MarketStorage(config)
    storage.ensure_data_files()
    storage.append_entry(build_entry())

    notifier = OpenClawNotifier(config)
    sent_messages: list[tuple[str, str]] = []
    notifier._send_message = lambda target, message, dry_run=False: sent_messages.append((target, message))  # type: ignore[method-assign]

    first_run = notifier.notify_pending_entries(storage)
    second_run = notifier.notify_pending_entries(storage)

    assert len(first_run) == 1
    assert len(second_run) == 0
    assert len(sent_messages) == 1
    assert sent_messages[0][0] == "478891619"
    assert "Новий сигнал: Akrapovic BMW G80 cold-start reel" in sent_messages[0][1]


def test_notifier_uses_openclaw_config_fallback_targets(tmp_path: Path) -> None:
    config_path = tmp_path / "openclaw.json"
    config_path.write_text(
        """
{
  "channels": {
    "telegram": {
      "defaultTo": "tg:111111111",
      "allowFrom": ["tg:222222222"]
    }
  }
}
""".strip(),
        encoding="utf-8",
    )
    config = AppConfig(
        project_root=tmp_path,
        data_dir=tmp_path / "data",
        logs_dir=tmp_path / "logs",
        threshold_auto_save=60,
        model=ModelSettings(),
        openclaw=OpenClawSettings(
            executable=sys.executable,
            targets=[],
            config_path=config_path,
            state_file=tmp_path / "logs" / "openclaw_notifier_state.json",
        ),
    )

    notifier = OpenClawNotifier(config)

    assert notifier.resolve_targets() == ["111111111"]
