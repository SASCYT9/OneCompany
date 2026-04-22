from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class StringEnum(str, Enum):
    def __str__(self) -> str:
        return self.value


class SourceType(StringEnum):
    SOCIAL = "Social"
    WEBSITE = "Website"
    FORUM = "Forum"
    MESSENGER = "Messenger"
    MARKETPLACE = "Marketplace"
    BLOG = "Blog"
    VIDEO = "Video"


class PlatformName(StringEnum):
    INSTAGRAM = "Instagram"
    TIKTOK = "TikTok"
    YOUTUBE = "YouTube"
    TELEGRAM = "Telegram"
    REDDIT = "Reddit"
    PINTEREST = "Pinterest"
    FORUM = "Forum"
    BRAND_SITE = "Brand Site"
    DEALER_SITE = "Dealer Site"
    MARKETPLACE = "Marketplace"
    OTHER = "Other"


class Category(StringEnum):
    EXHAUST = "Exhaust"
    SUSPENSION = "Suspension"
    WHEELS_TIRES = "Wheels & Tires"
    BRAKES = "Brakes"
    INTAKE = "Intake"
    INTERIOR = "Interior"
    EXTERIOR_AERO = "Exterior & Aero"
    COOLING = "Cooling"
    PERFORMANCE = "Performance"
    TRANSMISSION = "Transmission"
    TUNING_ELECTRONICS = "Tuning & Electronics"
    OEM = "OEM"
    MOTORSPORT = "Motorsport"
    MOTO = "Moto"
    MULTI = "Multi"


class TargetCustomer(StringEnum):
    END_CUSTOMER = "End Customer"
    WORKSHOP = "Workshop"
    DEALER = "Dealer"
    DETAILING_STUDIO = "Detailing Studio"
    TUNING_SHOP = "Tuning Shop"
    DISTRIBUTOR = "Distributor"
    MULTI = "Multi"


class PriorityLevel(StringEnum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class SuggestedAction(StringEnum):
    CATALOG_CANDIDATE = "Catalog Candidate"
    CONTENT_REFERENCE = "Content Reference"
    PARTNER_WATCH = "Partner Watch"
    FITMENT_NOTE = "Fitment Note"
    SALES_FOLLOW_UP = "Sales Follow-Up"
    MARKET_WATCH_ONLY = "Market Watch Only"


class TargetFile(StringEnum):
    PRODUCT_DEMAND = "trends_product_demand"
    B2B_PARTNER_SIGNALS = "trends_b2b_partner_signals"
    FITMENT_AND_PAIN_POINTS = "trends_fitment_and_pain_points"
    CREATIVES_MARKETING = "creatives_marketing"
    MARKET_WATCH = "trends_market_watch"

    @property
    def markdown_filename(self) -> str:
        return f"{self.value}.md"


TARGET_FILE_TITLES: dict[TargetFile, str] = {
    TargetFile.PRODUCT_DEMAND: "Product demand signals",
    TargetFile.B2B_PARTNER_SIGNALS: "B2B partner signals",
    TargetFile.FITMENT_AND_PAIN_POINTS: "Fitment and pain-point signals",
    TargetFile.CREATIVES_MARKETING: "Premium creative references",
    TargetFile.MARKET_WATCH: "Market-watch signals",
}


class SourceCandidate(BaseModel):
    title: str = Field(..., min_length=3)
    platform: str = Field(default="Other")
    url: str = ""
    raw_notes: str = ""
    copied_comments: str = ""
    brand_names: list[str] = Field(default_factory=list)
    vehicle_platforms: list[str] = Field(default_factory=list)
    meta_title: str | None = None
    meta_description: str | None = None

    @field_validator("title", "platform", "url", "raw_notes", "copied_comments", "meta_title", "meta_description")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("brand_names", "vehicle_platforms")
    @classmethod
    def normalize_list(cls, value: list[str]) -> list[str]:
        clean: list[str] = []
        for item in value:
            stripped = item.strip()
            if stripped and stripped not in clean:
                clean.append(stripped)
        return clean

    def combined_text(self) -> str:
        parts = [
            self.title,
            self.meta_title or "",
            self.meta_description or "",
            self.raw_notes,
            self.copied_comments,
            ", ".join(self.brand_names),
            ", ".join(self.vehicle_platforms),
        ]
        return "\n".join(part for part in parts if part).strip()


class ScoreBreakdown(BaseModel):
    buying_intent: int = Field(default=0, ge=0, le=30)
    b2b_relevance: int = Field(default=0, ge=0, le=20)
    fitment_partner_utility: int = Field(default=0, ge=0, le=15)
    premium_product_fit: int = Field(default=0, ge=0, le=15)
    content_utility: int = Field(default=0, ge=0, le=10)
    market_significance: int = Field(default=0, ge=0, le=5)
    confidence: int = Field(default=0, ge=0, le=5)

    @property
    def total(self) -> int:
        return (
            self.buying_intent
            + self.b2b_relevance
            + self.fitment_partner_utility
            + self.premium_product_fit
            + self.content_utility
            + self.market_significance
            + self.confidence
        )


class SignalEntry(BaseModel):
    resource_name: str = Field(..., min_length=3)
    source_type: SourceType
    platform: PlatformName
    link: str = ""
    category: Category
    relevant_brands: list[str] = Field(default_factory=list)
    relevant_vehicles_platforms: list[str] = Field(default_factory=list)
    target_customer: TargetCustomer
    what_it_does: str = Field(..., min_length=10)
    demand_signals: str = Field(..., min_length=10)
    why_it_matters_for_one_company: str = Field(..., min_length=10)
    commercial_potential: PriorityLevel
    b2b_relevance: PriorityLevel
    suggested_action: SuggestedAction
    tags: list[str] = Field(default_factory=list)
    target_file: TargetFile
    signal_score: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=5)
    notes_optional: str | None = None

    @field_validator(
        "resource_name",
        "link",
        "what_it_does",
        "demand_signals",
        "why_it_matters_for_one_company",
        "notes_optional",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("relevant_brands", "relevant_vehicles_platforms")
    @classmethod
    def normalize_preserved_lists(cls, value: list[str]) -> list[str]:
        clean: list[str] = []
        for item in value:
            stripped = item.strip()
            if stripped and stripped not in clean:
                clean.append(stripped)
        return clean

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        clean: list[str] = []
        for item in value:
            stripped = item.strip().lower().replace(" ", "-")
            if stripped and stripped not in clean:
                clean.append(stripped)
        return clean

    @model_validator(mode="after")
    def ensure_signal_score_consistency(self) -> "SignalEntry":
        if self.signal_score is not None and self.confidence is None:
            self.confidence = min(5, max(1, round(self.signal_score / 20)))
        return self


class SignalEntryDraft(BaseModel):
    resource_name: str
    source_type: str
    platform: str
    category: str
    relevant_brands: list[str] = Field(default_factory=list)
    relevant_vehicles_platforms: list[str] = Field(default_factory=list)
    target_customer: str
    what_it_does: str
    demand_signals: str
    why_it_matters_for_one_company: str
    commercial_potential: str
    b2b_relevance: str
    suggested_action: str
    tags: list[str] = Field(default_factory=list)
    target_file: str
    confidence: int = Field(default=3, ge=0, le=5)
    notes_optional: str | None = None


class ScoreEstimationDraft(BaseModel):
    buying_intent: int = Field(default=0, ge=0, le=30)
    b2b_relevance: int = Field(default=0, ge=0, le=20)
    fitment_partner_utility: int = Field(default=0, ge=0, le=15)
    premium_product_fit: int = Field(default=0, ge=0, le=15)
    content_utility: int = Field(default=0, ge=0, le=10)
    market_significance: int = Field(default=0, ge=0, le=5)
    confidence: int = Field(default=0, ge=0, le=5)


class AnalysisResult(BaseModel):
    entry: SignalEntry
    score_breakdown: ScoreBreakdown
    preview_markdown: str
    should_auto_save: bool
    raw_classification: dict[str, Any] | None = None
    raw_score_payload: dict[str, Any] | None = None


class ParsedFile(BaseModel):
    target_file: TargetFile
    entries: list[SignalEntry] = Field(default_factory=list)


class PotentialDuplicate(BaseModel):
    target_file: TargetFile
    kept_entry: SignalEntry
    duplicate_entry: SignalEntry
    similarity: float = Field(..., ge=0, le=1)
    reason: str


class ReviewSummary(BaseModel):
    title: str
    strongest_commercial_signals: list[str] = Field(default_factory=list)
    strongest_b2b_signals: list[str] = Field(default_factory=list)
    repeated_fitment_issues: list[str] = Field(default_factory=list)
    strongest_content_references: list[str] = Field(default_factory=list)
    brands_showing_traction: list[str] = Field(default_factory=list)
    platforms_showing_traction: list[str] = Field(default_factory=list)
    categories_showing_traction: list[str] = Field(default_factory=list)
    weak_entries_to_review: list[str] = Field(default_factory=list)
    concrete_next_actions: list[str] = Field(default_factory=list)


class WeeklyDigestSummary(BaseModel):
    top_product_opportunities: list[str] = Field(default_factory=list)
    top_partner_signals: list[str] = Field(default_factory=list)
    top_fitment_pain_points: list[str] = Field(default_factory=list)
    top_content_references: list[str] = Field(default_factory=list)
    emerging_brands_categories_platforms: list[str] = Field(default_factory=list)
    recommended_priorities_for_next_week: list[str] = Field(default_factory=list)
