from __future__ import annotations

import logging

from pydantic import ValidationError

from app.config import AppConfig
from app.formatter import format_entry_markdown
from app.llm_client import LLMClientError, LocalLLMClient
from app.models import (
    AnalysisResult,
    Category,
    PlatformName,
    PriorityLevel,
    ScoreEstimationDraft,
    ScoreBreakdown,
    SignalEntry,
    SignalEntryDraft,
    SourceCandidate,
    SourceType,
    SuggestedAction,
    TargetCustomer,
    TargetFile,
)
from app.prompts import (
    SCORE_ESTIMATION_SYSTEM_PROMPT,
    SOURCE_CLASSIFICATION_SYSTEM_PROMPT,
    build_score_estimation_prompt,
    build_source_classification_prompt,
)
from app.scoring import apply_score, normalize_score_breakdown
from app.utils import first_non_empty, normalize_url


PLATFORM_TO_SOURCE_TYPE: dict[PlatformName, SourceType] = {
    PlatformName.INSTAGRAM: SourceType.SOCIAL,
    PlatformName.TIKTOK: SourceType.SOCIAL,
    PlatformName.YOUTUBE: SourceType.VIDEO,
    PlatformName.TELEGRAM: SourceType.MESSENGER,
    PlatformName.REDDIT: SourceType.FORUM,
    PlatformName.PINTEREST: SourceType.SOCIAL,
    PlatformName.FORUM: SourceType.FORUM,
    PlatformName.BRAND_SITE: SourceType.WEBSITE,
    PlatformName.DEALER_SITE: SourceType.WEBSITE,
    PlatformName.MARKETPLACE: SourceType.MARKETPLACE,
    PlatformName.OTHER: SourceType.WEBSITE,
}


class MarketSignalClassifier:
    def __init__(self, config: AppConfig, llm_client: LocalLLMClient | None = None) -> None:
        self.config = config
        self.llm_client = llm_client or LocalLLMClient(config)

    def analyze(self, candidate: SourceCandidate) -> AnalysisResult:
        classification_payload = candidate.model_dump()
        schema = SignalEntryDraft.model_json_schema()

        raw_classification: dict | None = None
        raw_score_payload: dict | None = None

        try:
            classification_prompt = build_source_classification_prompt(classification_payload, schema)
            draft = self.llm_client.generate_json(
                classification_prompt,
                system_prompt=SOURCE_CLASSIFICATION_SYSTEM_PROMPT,
                response_model=SignalEntryDraft,
            )
            raw_classification = draft.model_dump()
            entry = self._build_entry_from_draft(draft, candidate)
        except (LLMClientError, ValidationError) as exc:
            logging.warning("Falling back to heuristic classifier: %s", exc)
            entry = self._heuristic_entry(candidate)

        try:
            score_prompt = build_score_estimation_prompt(entry.model_dump(mode="json"), ScoreEstimationDraft.model_json_schema())
            score_draft = self.llm_client.generate_json(
                score_prompt,
                system_prompt=SCORE_ESTIMATION_SYSTEM_PROMPT,
                response_model=ScoreEstimationDraft,
            )
            raw_score_payload = score_draft.model_dump()
        except (LLMClientError, ValidationError) as exc:
            logging.warning("Falling back to heuristic scoring: %s", exc)
            score_draft = None

        breakdown = normalize_score_breakdown(entry, candidate.combined_text(), score_draft)
        scored_entry = apply_score(entry, breakdown)
        preview = format_entry_markdown(scored_entry)

        return AnalysisResult(
            entry=scored_entry,
            score_breakdown=breakdown,
            preview_markdown=preview,
            should_auto_save=breakdown.total >= self.config.threshold_auto_save,
            raw_classification=raw_classification,
            raw_score_payload=raw_score_payload,
        )

    def _build_entry_from_draft(self, draft: SignalEntryDraft, candidate: SourceCandidate) -> SignalEntry:
        platform = self._coerce_platform(draft.platform or candidate.platform)
        source_type = self._coerce_source_type(draft.source_type, platform)
        return SignalEntry(
            resource_name=first_non_empty(draft.resource_name, candidate.title),
            source_type=source_type,
            platform=platform,
            link=normalize_url(first_non_empty(candidate.url, "")),
            category=self._coerce_enum(Category, draft.category, Category.MULTI),
            relevant_brands=draft.relevant_brands or candidate.brand_names,
            relevant_vehicles_platforms=draft.relevant_vehicles_platforms or candidate.vehicle_platforms,
            target_customer=self._coerce_enum(TargetCustomer, draft.target_customer, TargetCustomer.MULTI),
            what_it_does=draft.what_it_does,
            demand_signals=draft.demand_signals,
            why_it_matters_for_one_company=draft.why_it_matters_for_one_company,
            commercial_potential=self._coerce_enum(PriorityLevel, draft.commercial_potential, PriorityLevel.MEDIUM),
            b2b_relevance=self._coerce_enum(PriorityLevel, draft.b2b_relevance, PriorityLevel.MEDIUM),
            suggested_action=self._coerce_enum(SuggestedAction, draft.suggested_action, SuggestedAction.MARKET_WATCH_ONLY),
            tags=draft.tags,
            target_file=self._coerce_enum(TargetFile, draft.target_file, TargetFile.MARKET_WATCH),
            confidence=draft.confidence,
            notes_optional=draft.notes_optional,
        )

    def _heuristic_entry(self, candidate: SourceCandidate) -> SignalEntry:
        combined = candidate.combined_text().lower()
        platform = self._coerce_platform(candidate.platform)
        source_type = PLATFORM_TO_SOURCE_TYPE.get(platform, SourceType.WEBSITE)

        if any(token in combined for token in ["fitment", "compatible", "sensor", "make this for", "чи є для", "підходить"]):
            target_file = TargetFile.FITMENT_AND_PAIN_POINTS
            action = SuggestedAction.FITMENT_NOTE
        elif any(token in combined for token in ["dealer", "workshop", "installer", "wholesale", "дилер", "майстерня", "партнер"]):
            target_file = TargetFile.B2B_PARTNER_SIGNALS
            action = SuggestedAction.PARTNER_WATCH
        elif any(token in combined for token in ["cinematic", "macro", "reel", "rolling", "cold start", "макро", "ролик"]):
            target_file = TargetFile.CREATIVES_MARKETING
            action = SuggestedAction.CONTENT_REFERENCE
        elif any(token in combined for token in ["launch", "trend", "viral", "drop", "новинка", "запуск", "ажиотаж"]):
            target_file = TargetFile.MARKET_WATCH
            action = SuggestedAction.MARKET_WATCH_ONLY
        else:
            target_file = TargetFile.PRODUCT_DEMAND
            action = SuggestedAction.CATALOG_CANDIDATE

        what_it_does = (
            f"Джерело показує інтерес до теми «{candidate.title}» у контексті premium automotive / moto tuning. "
            "Сигнал зібраний з ручних нотаток, коментарів або публічного опису."
        )
        demand_signals = (
            "У матеріалі є ознаки інтересу до конкретного продукту, бренду або платформи. "
            "Окремо варто перевірити повторюваність запитів про купівлю, встановлення, дилерське покриття або fitment."
        )
        why_it_matters = (
            "Для One Company це корисно як орієнтир для поповнення каталогу, B2B outreach або контент-плану. "
            "Запис варто вважати робочою гіпотезою до підтвердження новими сигналами."
        )

        return SignalEntry(
            resource_name=candidate.title,
            source_type=source_type,
            platform=platform,
            link=normalize_url(candidate.url),
            category=self._heuristic_category(combined),
            relevant_brands=candidate.brand_names,
            relevant_vehicles_platforms=candidate.vehicle_platforms,
            target_customer=self._heuristic_target_customer(target_file),
            what_it_does=what_it_does,
            demand_signals=demand_signals,
            why_it_matters_for_one_company=why_it_matters,
            commercial_potential=PriorityLevel.MEDIUM,
            b2b_relevance=PriorityLevel.HIGH if target_file is TargetFile.B2B_PARTNER_SIGNALS else PriorityLevel.MEDIUM,
            suggested_action=action,
            tags=self._heuristic_tags(candidate),
            target_file=target_file,
            confidence=2,
        )

    def _heuristic_category(self, text: str) -> Category:
        mapping = {
            "exhaust": Category.EXHAUST,
            "intake": Category.INTAKE,
            "wheel": Category.WHEELS_TIRES,
            "tire": Category.WHEELS_TIRES,
            "brake": Category.BRAKES,
            "suspension": Category.SUSPENSION,
            "spring": Category.SUSPENSION,
            "coilover": Category.SUSPENSION,
            "aero": Category.EXTERIOR_AERO,
            "carbon": Category.EXTERIOR_AERO,
            "cooling": Category.COOLING,
            "radiator": Category.COOLING,
            "ecu": Category.TUNING_ELECTRONICS,
            "tune": Category.TUNING_ELECTRONICS,
            "motorcycle": Category.MOTO,
            "moto": Category.MOTO,
        }
        for token, category in mapping.items():
            if token in text:
                return category
        return Category.MULTI

    def _heuristic_target_customer(self, target_file: TargetFile) -> TargetCustomer:
        if target_file is TargetFile.B2B_PARTNER_SIGNALS:
            return TargetCustomer.TUNING_SHOP
        if target_file is TargetFile.CREATIVES_MARKETING:
            return TargetCustomer.MULTI
        if target_file is TargetFile.PRODUCT_DEMAND:
            return TargetCustomer.END_CUSTOMER
        return TargetCustomer.MULTI

    def _heuristic_tags(self, candidate: SourceCandidate) -> list[str]:
        tags: list[str] = []
        for item in candidate.brand_names + candidate.vehicle_platforms:
            slug = item.strip().lower().replace(" ", "-")
            if slug and slug not in tags:
                tags.append(slug)
        platform_tag = candidate.platform.strip().lower().replace(" ", "-")
        if platform_tag and platform_tag not in tags:
            tags.append(platform_tag)
        return tags

    def _coerce_platform(self, value: str) -> PlatformName:
        normalized = value.strip().lower()
        mapping = {
            "instagram": PlatformName.INSTAGRAM,
            "tiktok": PlatformName.TIKTOK,
            "youtube": PlatformName.YOUTUBE,
            "telegram": PlatformName.TELEGRAM,
            "reddit": PlatformName.REDDIT,
            "pinterest": PlatformName.PINTEREST,
            "forum": PlatformName.FORUM,
            "brand site": PlatformName.BRAND_SITE,
            "dealer site": PlatformName.DEALER_SITE,
            "marketplace": PlatformName.MARKETPLACE,
            "other": PlatformName.OTHER,
        }
        return mapping.get(normalized, PlatformName.OTHER)

    def _coerce_source_type(self, value: str, platform: PlatformName) -> SourceType:
        try:
            return self._coerce_enum(SourceType, value, PLATFORM_TO_SOURCE_TYPE.get(platform, SourceType.WEBSITE))
        except ValueError:
            return PLATFORM_TO_SOURCE_TYPE.get(platform, SourceType.WEBSITE)

    @staticmethod
    def _coerce_enum(enum_cls, value: str, fallback):
        normalized = value.strip().lower()
        for item in enum_cls:
            if item.value.lower() == normalized or item.name.lower() == normalized:
                return item
        return fallback

