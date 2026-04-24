from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import subprocess
import time
from pathlib import Path

from pydantic import BaseModel, Field

from app.config import AppConfig
from app.models import PriorityLevel, SignalEntry, SuggestedAction, TargetCustomer
from app.review import hydrate_entries
from app.storage import MarketStorage
from app.utils import atomic_write_text, ensure_directory, normalize_title, normalize_url, truncate


class NotificationState(BaseModel):
    sent_entry_ids: list[str] = Field(default_factory=list)


class OpenClawNotifierError(RuntimeError):
    pass


class OpenClawNotifier:
    def __init__(self, config: AppConfig) -> None:
        if config.openclaw is None:
            raise OpenClawNotifierError("OpenClaw settings are not configured.")
        self.config = config
        self.settings = config.openclaw
        self.executable_path = self._resolve_executable_path()
        self.command_prefix = self._resolve_command_prefix(self.executable_path)

    def notify_pending_entries(
        self,
        storage: MarketStorage,
        *,
        limit: int | None = None,
        dry_run: bool = False,
    ) -> list[SignalEntry]:
        targets = self.resolve_targets()
        entries = self._load_entries(storage)
        state = self._load_state()
        seen = set(state.sent_entry_ids)

        pending = [
            entry
            for entry in entries
            if (entry_id := self.entry_identity(entry)) not in seen and self._should_notify(entry)
        ]
        if limit is not None:
            pending = pending[:limit]

        if not pending:
            return []

        for entry in pending:
            message = self.format_notification(entry)
            for target in targets:
                self._send_message(target, message, dry_run=dry_run)
            if not dry_run:
                state.sent_entry_ids.append(self.entry_identity(entry))

        if not dry_run:
            self._save_state(state)
        return pending

    def seed_existing_entries(self, storage: MarketStorage) -> int:
        if self.settings.state_file.exists():
            return 0
        entries = self._load_entries(storage)
        state = NotificationState(sent_entry_ids=[self.entry_identity(entry) for entry in entries if self._should_notify(entry)])
        self._save_state(state)
        return len(state.sent_entry_ids)

    def watch(
        self,
        storage: MarketStorage,
        *,
        interval_seconds: int | None = None,
        once: bool = False,
        dry_run: bool = False,
    ) -> None:
        poll_interval = interval_seconds or self.settings.poll_interval_seconds
        while True:
            sent = self.notify_pending_entries(storage, dry_run=dry_run)
            if sent:
                logging.info("OpenClaw notified %s new signal(s).", len(sent))
            elif once:
                logging.info("No pending signals to notify.")
            if once:
                return
            time.sleep(poll_interval)

    def resolve_targets(self) -> list[str]:
        configured_targets = [normalized for item in self.settings.targets if (normalized := self._normalize_target(item))]
        if configured_targets:
            return configured_targets

        channel_config = self._read_openclaw_channel_config()
        default_target = self._normalize_target(channel_config.get("defaultTo"))
        if default_target:
            return [default_target]

        inferred: list[str] = []
        for item in channel_config.get("allowFrom", []):
            normalized = self._normalize_target(item)
            if normalized and normalized not in inferred:
                inferred.append(normalized)
        if not inferred:
            raise OpenClawNotifierError(
                "No OpenClaw Telegram targets found. Set ONECO_MI_OPENCLAW_TARGETS or configure channels.telegram.defaultTo / allowFrom."
            )
        return inferred

    def format_notification(self, entry: SignalEntry) -> str:
        brands = ", ".join(entry.relevant_brands) or "не вказано"
        vehicles = ", ".join(entry.relevant_vehicles_platforms) or "не вказано"
        score = entry.signal_score if entry.signal_score is not None else "n/a"
        lines = [
            "One Company Market Intelligence",
            f"Новий сигнал: {entry.resource_name}",
            f"Файл: {entry.target_file.markdown_filename}",
            f"Категорія: {entry.category.value}",
            f"Бренди: {brands}",
            f"Платформи: {vehicles}",
            f"Клієнт: {entry.target_customer.value}",
            f"Комерційний потенціал: {entry.commercial_potential.value}",
            f"B2B релевантність: {entry.b2b_relevance.value}",
            f"Score: {score}/100",
            f"Сигнал: {truncate(entry.demand_signals, 400)}",
            f"Чому це важливо: {truncate(entry.why_it_matters_for_one_company, 280)}",
            f"Дія: {entry.suggested_action.value}",
        ]
        if entry.link:
            lines.append(f"Link: {entry.link}")
        return "\n".join(lines)

    def entry_identity(self, entry: SignalEntry) -> str:
        payload = {
            "target_file": entry.target_file.value,
            "resource_name": normalize_title(entry.resource_name),
            "link": normalize_url(entry.link),
            "category": entry.category.value.lower(),
            "brands": [item.lower() for item in entry.relevant_brands],
            "vehicles": [item.lower() for item in entry.relevant_vehicles_platforms],
        }
        raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _should_notify(self, entry: SignalEntry) -> bool:
        score = entry.signal_score or 0
        if score >= self.settings.min_score:
            return True
        if entry.commercial_potential is PriorityLevel.HIGH:
            return True
        if entry.b2b_relevance is PriorityLevel.HIGH and entry.target_customer in {
            TargetCustomer.WORKSHOP,
            TargetCustomer.DEALER,
            TargetCustomer.TUNING_SHOP,
            TargetCustomer.DISTRIBUTOR,
        }:
            return True
        return entry.commercial_potential is not PriorityLevel.LOW and entry.suggested_action in {
            SuggestedAction.CATALOG_CANDIDATE,
            SuggestedAction.PARTNER_WATCH,
            SuggestedAction.FITMENT_NOTE,
            SuggestedAction.SALES_FOLLOW_UP,
        }

    def _load_entries(self, storage: MarketStorage) -> list[SignalEntry]:
        entries: list[SignalEntry] = []
        for parsed in storage.load_all():
            entries.extend(parsed.entries)
        return hydrate_entries(entries)

    def _load_state(self) -> NotificationState:
        path = self.settings.state_file
        if not path.exists():
            return NotificationState()
        try:
            return NotificationState.model_validate_json(path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise OpenClawNotifierError(f"Invalid notifier state file: {path} ({exc})") from exc

    def _save_state(self, state: NotificationState) -> None:
        ensure_directory(self.settings.state_file.parent)
        atomic_write_text(self.settings.state_file, state.model_dump_json(indent=2))

    def _read_openclaw_channel_config(self) -> dict:
        path = self.settings.config_path
        if not path.exists():
            raise OpenClawNotifierError(f"OpenClaw config not found: {path}")
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise OpenClawNotifierError(f"OpenClaw config is not valid JSON: {path}") from exc
        return payload.get("channels", {}).get(self.settings.channel, {})

    def _normalize_target(self, value: object) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        if not text:
            return ""
        if text.startswith("tg:"):
            return text[3:]
        if text.startswith("telegram:"):
            return text[9:]
        return text

    def _send_message(self, target: str, message: str, *, dry_run: bool) -> None:
        command = [
            *self.command_prefix,
            "message",
            "send",
            "--channel",
            self.settings.channel,
            "--target",
            target,
            "--message",
            message,
        ]
        if dry_run:
            logging.info("Dry-run OpenClaw send to %s", target)
            logging.info("Dry-run message body:\n%s", message)
            return

        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=self.settings.send_timeout_seconds,
            check=False,
        )
        if completed.returncode != 0:
            stderr = completed.stderr.strip() or completed.stdout.strip() or "unknown OpenClaw error"
            raise OpenClawNotifierError(f"OpenClaw send failed for target {target}: {stderr}")

    def _resolve_executable_path(self) -> str:
        configured = self.settings.executable.strip()
        if not configured:
            raise OpenClawNotifierError("OpenClaw executable is empty.")

        candidates = [configured]
        if os.name == "nt" and not Path(configured).suffix:
            candidates.extend([f"{configured}.cmd", f"{configured}.exe", f"{configured}.bat"])

        appdata = os.getenv("APPDATA")
        if appdata:
            npm_dir = Path(appdata) / "npm"
            candidates.extend(str(npm_dir / candidate) for candidate in candidates)

        seen: set[str] = set()
        for candidate in candidates:
            if candidate in seen:
                continue
            seen.add(candidate)
            resolved = shutil.which(candidate)
            if resolved:
                return resolved
            if Path(candidate).exists():
                return str(Path(candidate))

        raise OpenClawNotifierError(
            f"OpenClaw executable not found: {configured}. Set ONECO_MI_OPENCLAW_BIN to openclaw.cmd or the full path."
        )

    def _resolve_command_prefix(self, executable_path: str) -> list[str]:
        executable = Path(executable_path)
        if os.name != "nt" or executable.suffix.lower() != ".cmd":
            return [executable_path]

        mjs_path = executable.parent / "node_modules" / executable.stem / f"{executable.stem}.mjs"
        if not mjs_path.exists():
            return [executable_path]

        node_candidates = [
            shutil.which("node"),
            str(Path(os.getenv("ProgramFiles", "")) / "nodejs" / "node.exe"),
        ]
        for candidate in node_candidates:
            if candidate and Path(candidate).exists():
                return [str(Path(candidate)), str(mjs_path)]

        return [executable_path]
