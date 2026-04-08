---
task: "Створити Instagram Highlight Covers для топ-брендів"
created_by: antigravity
assigned_to: claude-code
status: PENDING
priority: high
created_at: 2026-04-07T13:20:00+03:00
updated_at: 2026-04-07T13:20:00+03:00
kanban_ref: "wiki/Tasks Kanban.md → Оформлення Instagram Highlight Covers"
brands:
  - Akrapovič
  - Brabus
  - Urban Automotive
  - KW Automotive
  - CSF Racing
---

# 🎯 Задача: Instagram Highlight Covers — Контент-план

## Контекст
Antigravity вже згенерував 4 візуальні концепти обкладинок для Instagram Highlights
(Exhaust, Carbon, Suspension, Wheels). Тепер потрібно створити **контент-план описів**
для кожного бренду під кожну категорію.

## Що потрібно зробити

### 1. Для кожного бренду створити текстовий файл:
```
.agents/handoffs/output/instagram/<brand_slug>.json
```

### 2. Формат JSON:
```json
{
  "brand": "Akrapovič",
  "highlights": [
    {
      "category": "Exhaust Systems",
      "cover_title_en": "EXHAUST",
      "cover_title_ua": "ВИХЛОП",
      "stories_ideas": [
        "Product showcase: Evolution Line (Titanium)",
        "Behind the scenes: Akrapovič factory in Slovenia",
        "Sound comparison: Stock vs Akrapovič"
      ],
      "caption_template_en": "The art of exhaust engineering. #Akrapovic #ExhaustSystem",
      "caption_template_ua": "Мистецтво інженерії вихлопу. #Akrapovic #ExhaustSystem"
    }
  ]
}
```

### 3. Категорії для кожного бренду:
- **Akrapovič**: Exhaust, Technology, Motorsport, Lifestyle
- **Brabus**: Power, Interior, Exterior, Lifestyle
- **Urban Automotive**: Aero, Wheels, Projects, Lifestyle
- **KW Automotive**: Suspension, Track, Street, Lifestyle
- **CSF Racing**: Cooling, Performance, Motorsport, Lifestyle

## Вимоги
- Мова: EN + UA для кожного поля
- Стиль: "Stealth Wealth" — преміальний, лаконічний, без емодзі-спаму
- Мінімум 3 ідеї Stories на кожну категорію
- Хештеги: бренд + категорія + onecompany

## Після завершення
1. Зміни `status` у цьому файлі на `REVIEW`
2. Зміни `updated_at` на поточну дату/час
3. Залиш коментар у кінці файлу з summary

---
*Handoff створено: Antigravity → Claude Code*
*Очікуваний час виконання: ~15 хв*
