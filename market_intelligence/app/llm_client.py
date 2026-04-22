from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import AppConfig
from app.prompts import build_json_repair_prompt

T = TypeVar("T", bound=BaseModel)


class LLMClientError(RuntimeError):
    pass


class LocalLLMClient:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def generate(
        self,
        prompt: str,
        *,
        system_prompt: str | None = None,
        expect_json: bool = False,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self.config.model.model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": self.config.model.keep_alive,
            "options": {
                "temperature": self.config.model.temperature,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt
        if expect_json:
            payload["format"] = "json"

        last_error: Exception | None = None
        for attempt in range(self.config.model.max_retries + 1):
            try:
                with httpx.Client(timeout=self.config.model.timeout_seconds) as client:
                    response = client.post(self.config.model.endpoint, json=payload)
                    response.raise_for_status()
                data = response.json()
                text = str(data.get("response", "")).strip()
                if not text:
                    raise LLMClientError("Empty response from local model.")
                return text
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logging.warning("LLM call failed on attempt %s: %s", attempt + 1, exc)
                if attempt < self.config.model.max_retries:
                    time.sleep(1.25 * (attempt + 1))
        raise LLMClientError(str(last_error) if last_error else "Local model call failed.")

    def generate_json(self, prompt: str, *, system_prompt: str, response_model: type[T]) -> T:
        schema = response_model.model_json_schema()
        raw = self.generate(prompt, system_prompt=system_prompt, expect_json=True)
        try:
            return self._parse_response(raw, response_model)
        except Exception as first_error:  # noqa: BLE001
            logging.warning("Primary JSON parse failed: %s", first_error)

        extracted = self._extract_json_object(raw)
        if extracted:
            try:
                return self._parse_response(extracted, response_model)
            except Exception as second_error:  # noqa: BLE001
                logging.warning("Extracted JSON parse failed: %s", second_error)

        repaired_prompt = build_json_repair_prompt(raw, schema)
        repaired = self.generate(repaired_prompt, system_prompt="Return only valid JSON.", expect_json=True)
        return self._parse_response(repaired, response_model)

    def _parse_response(self, raw: str, response_model: type[T]) -> T:
        parsed = json.loads(raw)
        return response_model.model_validate(parsed)

    @staticmethod
    def _extract_json_object(raw: str) -> str | None:
        cleaned = raw.strip()
        cleaned = re.sub(r"^```json\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        if cleaned.startswith("{") or cleaned.startswith("["):
            return cleaned
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if match:
            return match.group(1)
        return None


class StubLLMClient:
    def __init__(self, payloads: list[dict[str, Any]]) -> None:
        self.payloads = payloads

    def generate_json(self, prompt: str, *, system_prompt: str, response_model: type[T]) -> T:
        if not self.payloads:
            raise LLMClientError("Stub LLM payloads exhausted.")
        payload = self.payloads.pop(0)
        try:
            return response_model.model_validate(payload)
        except ValidationError as exc:  # noqa: BLE001
            raise LLMClientError(str(exc)) from exc

