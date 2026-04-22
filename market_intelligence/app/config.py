from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field


class ModelSettings(BaseModel):
    endpoint: str = Field(default="http://localhost:11434/api/generate")
    model: str = Field(default="llama3.1:8b-instruct")
    temperature: float = Field(default=0.2, ge=0, le=1)
    timeout_seconds: int = Field(default=120, ge=10)
    max_retries: int = Field(default=2, ge=0)
    keep_alive: str = Field(default="5m")


class AppConfig(BaseModel):
    project_root: Path
    data_dir: Path
    logs_dir: Path
    threshold_auto_save: int = Field(default=60, ge=0, le=100)
    fuzzy_dedupe_threshold: float = Field(default=0.86, ge=0, le=1)
    save_scores_in_markdown: bool = False
    model: ModelSettings = Field(default_factory=ModelSettings)


@lru_cache(maxsize=1)
def load_config() -> AppConfig:
    project_root = Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"
    logs_dir = project_root / "logs"

    model = ModelSettings(
        endpoint=os.getenv("ONECO_MI_OLLAMA_ENDPOINT", "http://localhost:11434/api/generate"),
        model=os.getenv("ONECO_MI_OLLAMA_MODEL", "llama3.1:8b-instruct"),
        temperature=float(os.getenv("ONECO_MI_OLLAMA_TEMPERATURE", "0.2")),
        timeout_seconds=int(os.getenv("ONECO_MI_OLLAMA_TIMEOUT", "120")),
        max_retries=int(os.getenv("ONECO_MI_OLLAMA_RETRIES", "2")),
        keep_alive=os.getenv("ONECO_MI_OLLAMA_KEEP_ALIVE", "5m"),
    )

    return AppConfig(
        project_root=project_root,
        data_dir=data_dir,
        logs_dir=logs_dir,
        threshold_auto_save=int(os.getenv("ONECO_MI_SAVE_THRESHOLD", "60")),
        fuzzy_dedupe_threshold=float(os.getenv("ONECO_MI_DEDUPE_THRESHOLD", "0.86")),
        save_scores_in_markdown=os.getenv("ONECO_MI_SAVE_SCORES", "false").lower() == "true",
        model=model,
    )

