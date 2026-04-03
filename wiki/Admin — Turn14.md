---
tags: [admin, turn14, integration, b2b]
aliases: [Turn14 Інтеграція]
parent: "[[Admin Panel]]"
---

# 🌐 Admin — Turn14

> [!info] Turn14 Distribution Integration
> Пряма інтеграція з багатомільйонним каталогом запчастин Turn14 Distribution.

---

## Сторінки

| Сторінка | Розмір | Опис |
|----------|--------|------|
| `turn14/page.tsx` | 25 KB | Пошук, імпорт, quick order |
| `turn14/markups/page.tsx` | 22 KB | Brand Markup Editor |

---

## Функціонал

### Пошук каталогу
- Real-time пошук в Turn14 API за брендом/назвою
- Картки товарів: зображення, назва, артикул, бренд
- Автоматична перевірка наявності в OC (One Company)

### Stock Check фільтри

| Фільтр | Опис |
|--------|------|
| **Всі** | Показати все знайдене |
| **В наявності OC** 🟢 | Товари що вже є в нашому каталозі |
| **Немає в OC** 🟡 | Товари що можна імпортувати |

### Імпорт одним кліком
Кнопка `PackagePlus` на кожній картці → POST в `/api/admin/shop/turn14/import` → товар з'являється в нашому каталозі.

### Quick Order (для клієнта)
Модальне вікно:
1. Email клієнта
2. Ціна продажу (EUR)
3. → Створює UNPAID замовлення в системі

### Background Sync
Масова синхронізація бренду (напр. Urban Automotive):
- POST `/api/admin/shop/turn14/sync`
- Завантажує всі нові продукти через Turn14 API
- Звіт: створено / оновлено / помилок / загалом

---

## Brand Markup Editor

> [!tip] Націнки per-brand
> Сторінка `turn14/markups/page.tsx` — налаштування ROI/margin per-brand.

- Wholesale price з Turn14
- Markup % або fixed amount
- Auto-calculated retail price
- Per-brand margin targets

---

## API

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/admin/shop/turn14` | GET | Пошук в каталозі (?q=brand) |
| `/api/admin/shop/turn14/import` | POST | Імпорт товару |
| `/api/admin/shop/turn14/sync` | POST | Масова синхронізація бренду |
| `/api/admin/shop/turn14/stock-check` | POST | Перевірка наявності |
| `/api/admin/shop/turn14/quick-order` | POST | Швидке замовлення |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Turn14]] — Бізнес-сторінка Turn14
- [[Admin — Catalog]] — Каталог товарів
- [[Admin — Pricing]] — Ціноутворення
