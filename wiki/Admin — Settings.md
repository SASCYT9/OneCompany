---
tags: [admin, settings, config]
aliases: [Налаштування адмінки]
parent: "[[Admin Panel]]"
---

# ⚙️ Admin — Settings

> [!warning] Найбільша сторінка адмінки
> `settings/page.tsx` — **90 KB** / 2,100+ рядків — центральна конфігурація всього магазину.

---

## Секції налаштувань

| Секція | Параметри |
|--------|-----------|
| **B2B Режим** | `approved_only` / `public_dual` / `request_quote` + default discount % |
| **Валюти** | Toggle EUR/USD/UAH + курси + «Синхронізація з НБУ» |
| **Зони доставки** | CRUD: назва, країни, тарифи (flat/volumetric), fallback габарити |
| **Brand Shipping** | Per-brand overrides: fixed/multiplier/free + warehouse |
| **Податки** | Rate % + appliesToShipping toggle |
| **Regional Pricing** | % або fixed корекція цін по країнах |
| **Notifications** | Email для нових замовлень |
| **FOP Реквізити** | Назва ФОП, IBAN, банк, ЄДРПОУ |
| **Платіжні шлюзи** | Toggle Stripe та WhiteBit |
| **EN Translations** | Auto-translate UA→EN (dry-run / commit) |
| **Preview Calculator** | Real-time калькулятор pricing |

---

## Preview Calculator

> [!tip] Instant preview
> Ввести subtotal, кількість, країну — побачити розрахунок:

```
Input:  Currency=EUR, Subtotal=1200, Items=2, Country=Germany
Output: Regional adj: +€XX
        Shipping: €XX
        Tax: €XX (19% Germany)
        ─────────
        Total: €XXXX
        Zone: "EU-DE"
        Tax Rule: "Germany 19%"
```

---

## B2B Visibility Modes

| Режим | Опис |
|-------|------|
| `approved_only` | Тільки схвалені B2B-клієнти бачать оптові ціни |
| `public_dual` | Всі бачать обидві ціни (retail + wholesale) |
| `request_quote` | Оптові ціни приховані, кнопка «Запитати ціну» |

---

## FOP Реквізити

Для виставлення рахунків українським клієнтам:
- Назва ФОП
- IBAN
- Банк
- ЄДРПОУ
- Додаткові реквізити (text)

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — Logistics]] — Зони та податки
- [[Admin — Pricing]] — Ціноутворення
