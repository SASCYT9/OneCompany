from __future__ import annotations

import json
from typing import Any

from app.models import PlatformName, SourceType


SOURCE_CLASSIFICATION_SYSTEM_PROMPT = """
Ти внутрішній market intelligence асистент One Company.
Пиши простою практичною українською.
Фокус тільки на premium automotive / moto tuning B2B сигналах.
Не вигадуй фактів, цін, дилерських умов, fitment або доступності.
Класифікуй консервативно.
Поверни тільки валідний JSON без markdown, без пояснень, без коментарів.
""".strip()


SCORE_ESTIMATION_SYSTEM_PROMPT = """
Ти оцінюєш лише комерційний сигнал для One Company.
Поверни тільки JSON з числовими підоцінками.
Оцінюй строго, без завищення.
""".strip()


WEEKLY_REVIEW_SYSTEM_PROMPT = """
Ти готуєш бізнес-огляд для One Company.
Поверни тільки JSON. Пиши коротко, конкретно, без загальних фраз.
Пріоритет: catalog expansion, B2B sales, partner outreach, content production, fitment support, market monitoring.
""".strip()


WEAK_ENTRY_SYSTEM_PROMPT = """
Ти виявляєш слабкі або шумові записи у внутрішній базі market intelligence.
Поверни тільки JSON. Позначай слабкі записи лише якщо комерційний сигнал реально слабкий.
""".strip()


JSON_REPAIR_SYSTEM_PROMPT = """
Ти виправляєш зламаний JSON.
Не змінюй сенс.
Поверни тільки валідний JSON без markdown.
""".strip()


def build_source_classification_prompt(candidate_payload: dict[str, Any], schema: dict[str, Any]) -> str:
    allowed_source_types = ", ".join(item.value for item in SourceType)
    allowed_platforms = ", ".join(item.value for item in PlatformName)
    allowed_target_files = ", ".join(
        [
            "trends_product_demand",
            "trends_b2b_partner_signals",
            "trends_fitment_and_pain_points",
            "creatives_marketing",
            "trends_market_watch",
        ]
    )
    return f"""
Завдання:
Проаналізуй джерело для внутрішньої системи market intelligence One Company.
Потрібно:
1. класифікувати джерело в РІВНО ОДИН target_file
2. згенерувати готовий структурований запис українською
3. не вигадувати факти, яких немає у вхідних даних
4. зберегти бренди, продукти і vehicle platforms у оригінальному написанні Latin, якщо вони є

Бізнес-контекст One Company:
- premium automotive / motorcycle tuning distributor
- B2B фокус: workshops, dealers, installers, tuning shops, distributors, partner outreach
- ключові категорії: exhaust, suspension, wheels & tires, brakes, intake, interior, exterior & aero, cooling, performance, transmission, tuning & electronics, OEM, motorsport, moto
- важливо відсіювати слабкий шум і generic accessory content

Правила класифікації:
- direct product demand => trends_product_demand
- dealer / workshop / installer / reseller angle => trends_b2b_partner_signals
- compatibility / missing fitment / pain points => trends_fitment_and_pain_points
- premium filming / presentation / content format => creatives_marketing
- launches / repeated hype / category waves / platform traction => trends_market_watch

Дозволені значення:
- source_type: {allowed_source_types}
- platform: {allowed_platforms}
- target_file: {allowed_target_files}
- target_customer: End Customer / Workshop / Dealer / Detailing Studio / Tuning Shop / Distributor / Multi
- commercial_potential: High / Medium / Low
- b2b_relevance: High / Medium / Low
- suggested_action: Catalog Candidate / Content Reference / Partner Watch / Fitment Note / Sales Follow-Up / Market Watch Only

JSON schema:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Вхідні дані:
{json.dumps(candidate_payload, ensure_ascii=False, indent=2)}

Відповідь:
- тільки JSON
- what_it_does, demand_signals, why_it_matters_for_one_company мають бути українською
- tags тільки lowercase
- релевантних брендів і платформ не вигадувати
""".strip()


def build_score_estimation_prompt(entry_payload: dict[str, Any], schema: dict[str, Any]) -> str:
    return f"""
Оціни комерційний сигнал джерела для One Company за шкалою 0-100 через такі ваги:
- buying_intent: 0-30
- b2b_relevance: 0-20
- fitment_partner_utility: 0-15
- premium_product_fit: 0-15
- content_utility: 0-10
- market_significance: 0-5
- confidence: 0-5

Оцінюй тільки з того, що реально видно у даних.
Високий buying_intent тільки якщо є явні сигнали типу price / where to buy / dealer / distributor / available for / shipping / install / need this.

JSON schema:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Entry payload:
{json.dumps(entry_payload, ensure_ascii=False, indent=2)}

Поверни тільки JSON.
""".strip()


def build_weekly_review_prompt(summary_payload: dict[str, Any], schema: dict[str, Any]) -> str:
    return f"""
Побудуй weekly digest для One Company.
Фокус:
- top product opportunities
- partner signals
- fitment pain points
- content references
- emerging brands / categories / platforms
- priorities for next week

JSON schema:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Summary payload:
{json.dumps(summary_payload, ensure_ascii=False, indent=2)}

Поверни тільки JSON українською.
""".strip()


def build_weak_entry_prompt(summary_payload: dict[str, Any], schema: dict[str, Any]) -> str:
    return f"""
Переглянь записи й знайди слабкі або шумові елементи.
Причини можуть бути лише такі:
- слабкий buying intent
- слабкий B2B сенс
- дуже загальний market noise
- дублювання сенсу без нової користі

JSON schema:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Payload:
{json.dumps(summary_payload, ensure_ascii=False, indent=2)}

Поверни тільки JSON українською.
""".strip()


def build_json_repair_prompt(raw_text: str, schema: dict[str, Any]) -> str:
    return f"""
Ось зламаний JSON. Віднови його без зміни змісту.

Очікувана схема:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Зламаний JSON:
{raw_text}

Поверни тільки валідний JSON.
""".strip()

