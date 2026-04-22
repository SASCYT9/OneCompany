from __future__ import annotations

from pathlib import Path

from app.config import AppConfig
from app.formatter import format_entry_markdown
from app.models import ParsedFile, SignalEntry, TargetFile
from app.parser import parse_markdown_entries
from app.utils import atomic_write_text, ensure_directory, safe_append_text


class MarketStorage:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def ensure_data_files(self) -> None:
        ensure_directory(self.config.data_dir)
        ensure_directory(self.config.logs_dir)
        for target in TargetFile:
            path = self.path_for(target)
            if not path.exists():
                path.write_text("", encoding="utf-8", newline="\n")

    def path_for(self, target_file: TargetFile) -> Path:
        return self.config.data_dir / target_file.markdown_filename

    def append_entry(self, entry: SignalEntry) -> Path:
        self.ensure_data_files()
        path = self.path_for(entry.target_file)
        safe_append_text(path, format_entry_markdown(entry))
        return path

    def load_file(self, target_file: TargetFile) -> ParsedFile:
        self.ensure_data_files()
        path = self.path_for(target_file)
        return ParsedFile(target_file=target_file, entries=parse_markdown_entries(path.read_text(encoding="utf-8"), target_file))

    def load_all(self) -> list[ParsedFile]:
        return [self.load_file(target) for target in TargetFile]

    def rewrite_file(self, target_file: TargetFile, entries: list[SignalEntry]) -> Path:
        path = self.path_for(target_file)
        rendered = "\n".join(format_entry_markdown(entry).strip() for entry in entries).strip()
        if rendered:
            rendered += "\n"
        atomic_write_text(path, rendered)
        return path

