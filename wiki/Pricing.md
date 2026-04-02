---
tags: [infra, pricing, b2b]
aliases: [Ціноутворення, Ціни, B2B]
---

# 💰 Архітектура Ціноутворення

> [!info] Від cost price до фінальної ціни для B2B/B2C клієнтів

---

## Формула

```
        ┌────────────────────────────┐
        │    ДЖЕРЕЛО ЦІНИ (Cost)     │
        │                            │
        │  Turn14 API → cost price   │
        │  DO88 (EU)  → EUR price    │
        │  Brabus     → manual price │
        │  Atomic CSV → їхні ціни    │
        │  Burger     → fixed price  │
        └─────────────┬──────────────┘
                      │
                      ▼
        ┌────────────────────────────┐
        │      РОЗРАХУНОК            │
        │                            │
        │  + Inbound Shipping        │
        │    (T14 Quote / fixed)     │
        │                            │
        │  × Brand Markup %          │
        │    (admin per brand)       │
        │                            │
        │  + Regional Tax            │
        │    (VAT / Customs Duty)    │
        │                            │
        │  + Outbound Shipping       │
        │    (zone × weight + vol)   │
        └─────────────┬──────────────┘
                      │
                      ▼
        ┌────────────────────────────┐
        │     ФІНАЛЬНА ЦІНА          │
        │                            │
        │  B2C → Full price          │
        │  B2B → Price − Discount %  │
        └────────────────────────────┘
```

---

## Компоненти Ціни

### 1. Cost Price (Собівартість)
Залежить від джерела — [[Brands]]

### 2. Inbound Shipping
Вартість доставки до нашого складу:
- Turn14 → `POST /v1/quote` (⏳ [[TODO]])
- EU бренди → фіксована ставка per brand
- Залежить від → [[Logistics]]

### 3. Brand Markup %
- Налаштовується в адмінці per brand
- `/admin/shop/integrations` — для Turn14 брендів
- `ShopBrandLogistics` — per brand config

### 4. Regional Tax
- `ShopTaxRegionRule` → [[Logistics]]
- VAT, Customs Duty, GST
- Inclusive / Exclusive mode

### 5. Outbound Shipping
- `ShopShippingZone` per warehouse → [[Logistics]]
- `ratePerKg × actualWeight + volSurcharge`
- `baseFee` додається

---

## B2B vs B2C

| | B2C | B2B |
|---|---|---|
| **Ціна** | Повна | − Customer Discount % |
| **Група** | `B2C` | `B2B_APPROVED` |
| **Markup** | Стандартний | Може бути зменшений |
| **Видимість** | Завжди | Залежить від `b2bVisibilityMode` |

### B2B Visibility Modes
- `approved_only` — тільки для підтверджених B2B (default)
- `public_dual` — бачать всі, B2B бачить свої ціни
- `request_quote` — B2B запитує ціну

Налаштовується в адмінці без релізу.

### Customer Groups
- `B2C` — звичайний клієнт
- `B2B_PENDING` — подав заявку, чекає
- `B2B_APPROVED` — підтверджений, бачить свої ціни

---

## ⏳ Чекаємо

> [!warning] Формули per континент
> Команда ще не визначилась з уніфікованою формулою.
> **Хто:** Ваня + Ігнаточ
> → [[Blockers]]

---

## Ключові Файли

| Файл | Призначення |
|---|---|
| `/admin/shop/pricing/page.tsx` | Markup per customer |
| `/admin/shop/customers/page.tsx` | Customer groups |
| `src/lib/shippingCalc.ts` | Shipping calculator |

---

## Зв'язки

- Ціни для checkout → [[Phase C — Storefront]]
- Залежить від shipping → [[Logistics]]
- Cost price з → [[Turn14]], [[Brands]]
- Snapshot при замовленні → [[Phase D — Orders]]

← [[Home]]
