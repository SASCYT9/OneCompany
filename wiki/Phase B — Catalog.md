---
tags: [phase, catalog, pricing]
status: done
progress: 95
---

# 📦 Phase B — Catalog + Pricing + Inventory

> [!success] Статус: **95% Готово**
> Залишилось: Burger box dimensions

---

## Що Реалізовано

### Товари
- CRUD товарів з варіантами (size, color, config)
- Media upload (зображення, відео)
- Переклади UA / EN (`ProductTranslation`)
- Slug-based URLs для storefront

### Варіанти & Ціни
- `ProductVariant` з SKU, вагою, розмірами
- `VariantPrice` — мультивалютність (UAH, EUR, USD)
- B2B / B2C окремі price rules

### Категорії & Колекції
- Ієрархічні категорії
- Колекції (Burger, DO88, Brabus, RaceChip, Urban)
- Фільтрація по колекціях на storefront

### Інвентар
- `InventoryLevel` per variant per warehouse
- `StockMovement` — журнал змін
- Bundle stock = мінімум компонентів

---

## Бренди в Каталозі

| Бренд | Джерело | Статус |
|---|---|---|
| Burger Motorsports | Direct | ✅ Повний каталог |
| DO88 | EU Direct | ✅ Повний каталог |
| Brabus | EU Direct | ✅ Повний каталог |
| RaceChip | Scraped (7700+) | ✅ Імпортовано |
| Akrapovič | CSV від бренду | ✅ Storefront готовий |
| Turn14 brands | API (~700к) | ✅ Supabase cache |
| Eventuri | ⏳ Файл | ⏳ Чекаємо прайс |

Детальніше → [[Brands]]

---

## 🔑 Пріоритет Даних (Правило)

> [!important] Це правило діє для ВСІХ товарів усіх брендів

| Пріоритет | Джерело | Опис |
|---|---|---|
| **1 — Найвищий** | Ручне введення / CSV від бренду | Завжди пріоритет. Ціни, описи, зображення, вага — якщо є, не перезаписуються |
| **2 — Fallback** | Turn14 API cache | Використовується ТІЛЬКИ якщо поле порожнє в основному джерелі |

**Приклад:** Akrapovič надає CSV з цінами та фото, але без ваги → система автоматично підтягне вагу з Turn14 по SKU-матчингу. Якщо і в Turn14 немає — товар маркується як "needs_shipping_data".

---

## Зв'язки

- Товари відображаються на → [[Phase C — Storefront]]
- Ціни використовуються в → [[Pricing]]
- Імпорт товарів через → [[Phase E — CSV Import]]

← [[Home]]
