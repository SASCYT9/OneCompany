from pathlib import Path

from app.classifier import MarketSignalClassifier
from app.config import AppConfig, ModelSettings
from app.llm_client import StubLLMClient
from app.models import SourceCandidate, TargetFile


def build_config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        project_root=tmp_path,
        data_dir=tmp_path / "data",
        logs_dir=tmp_path / "logs",
        threshold_auto_save=60,
        model=ModelSettings(),
    )


def test_classifier_uses_stubbed_llm_payloads(tmp_path: Path) -> None:
    llm = StubLLMClient(
        [
            {
                "resource_name": "Akrapovic BMW G80 cold-start reel",
                "source_type": "Social",
                "platform": "Instagram",
                "category": "Exhaust",
                "relevant_brands": ["Akrapovic", "BMW M"],
                "relevant_vehicles_platforms": ["BMW G80"],
                "target_customer": "End Customer",
                "what_it_does": "Показує premium cold-start контент по BMW G80.",
                "demand_signals": "Є питання про price, dealer і availability for G80.",
                "why_it_matters_for_one_company": "Це сильний exhaust catalog signal для BMW G80.",
                "commercial_potential": "High",
                "b2b_relevance": "Medium",
                "suggested_action": "Catalog Candidate",
                "tags": ["akrapovic", "bmw-g80", "exhaust"],
                "target_file": "trends_product_demand",
                "confidence": 4,
            },
            {
                "buying_intent": 24,
                "b2b_relevance": 11,
                "fitment_partner_utility": 10,
                "premium_product_fit": 13,
                "content_utility": 6,
                "market_significance": 4,
                "confidence": 4,
            },
        ]
    )
    classifier = MarketSignalClassifier(build_config(tmp_path), llm_client=llm)
    candidate = SourceCandidate(
        title="Akrapovic BMW G80 cold-start reel",
        platform="Instagram",
        url="https://instagram.com/p/abc",
        raw_notes="Users ask about price and fitment.",
        copied_comments="Need this for my G80. Dealer in EU?",
        brand_names=["Akrapovic", "BMW M"],
        vehicle_platforms=["BMW G80"],
    )

    result = classifier.analyze(candidate)
    assert result.entry.target_file == TargetFile.PRODUCT_DEMAND
    assert result.entry.signal_score == 72
    assert result.should_auto_save is True
    assert result.entry.tags == ["akrapovic", "bmw-g80", "exhaust"]

