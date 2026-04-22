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
from app.scoring import heuristic_score


def build_entry() -> SignalEntry:
    return SignalEntry(
        resource_name="Eventuri 992 Turbo S thread",
        source_type=SourceType.FORUM,
        platform=PlatformName.FORUM,
        link="https://forum.example/eventuri-992",
        category=Category.INTAKE,
        relevant_brands=["Eventuri"],
        relevant_vehicles_platforms=["Porsche 992 Turbo S"],
        target_customer=TargetCustomer.MULTI,
        what_it_does="Тред збирає fitment питання по intake setup.",
        demand_signals="Є питання про price, dealer coverage, OEM sensors і install complexity.",
        why_it_matters_for_one_company="Це fitment pain point і sales enablement opportunity.",
        commercial_potential=PriorityLevel.HIGH,
        b2b_relevance=PriorityLevel.MEDIUM,
        suggested_action=SuggestedAction.FITMENT_NOTE,
        tags=["eventuri", "porsche-992-turbo-s", "fitment-request", "oem-sensors"],
        target_file=TargetFile.FITMENT_AND_PAIN_POINTS,
    )


def test_heuristic_score_rewards_buying_intent_and_fitment_cues() -> None:
    breakdown = heuristic_score(
        build_entry(),
        "Need this for my 992 Turbo S. Price? Dealer in my region? Does it work with OEM sensors?",
    )
    assert breakdown.buying_intent >= 18
    assert breakdown.fitment_partner_utility >= 9
    assert breakdown.total >= 55

