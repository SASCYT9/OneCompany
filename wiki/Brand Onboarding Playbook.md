---
tags: [sop, ops, brands]
aliases: [Додавання Бренду]
---

# 🆕 Brand Onboarding Playbook

> [!info] SOP: Що робити, коли One Company підписує контракт з новим брендом (наприклад, Eventuri чи Wagner).

---

## Етап 1: Отримання Даних (Data Source)

Перед тим як додати бренд, потрібно зрозуміти, **звідки брати дані**:
- **Варіант А (CSV / Excel прайс-лист)** → Використовуватимемо `CSV Import Wizard` (Phase E).
- **Варіант B (API)** → Писати кастомний сінкер (як для Turn14).
- **Варіант C (Scraping)** → Писати парсер (як ми робили для 7700+ моделей RaceChip).

## Етап 2: Конфігурація Адмінки

1. **Створити Бренд:** `Admin -> Catalog -> Brands -> Add New`. Заповнити логотип, опис та мету (slug).
2. **Логістика (Warehouse):** `Admin -> Logistics -> Brands`.
   - До якого складу прив'язати цей бренд при розрахунках? (Наприклад: EU Warehouses).
   - Зафіксувати габарити (якщо фіксовані, як у Burger).
3. **Ціноутворення (Pricing):** 
   - Виставити `Brand Markup %` для розрахунку роздрібної ціни.
   - Виставити B2B знижку (global policy).

## Етап 3: Імпорт Каталогу

Якщо це **CSV (Atomic / Eventuri):**
1. Відкрити `/admin/shop/imports/csv`.
2. Завантажити файл.
3. Зробити **Column Mapping** (зіставити колонки файлу з базою Prisma).
4. Run `Dry-Run`. Перевірити, чи немає конфліктів по SKU.
5. Натиснути `Commit`.

## Етап 4: Візуальне Оформлення (Storefront)

1. Створити **Collection** у Shopify-темі (або в адмінці) під цей бренд (наприклад, `urban/collections/eventuri`).
2. Прив'язати красиве Hero Video або Photo для цієї колекції.
3. Налаштувати SEO metadata для Collection page (Title, Description).

## Етап 5: Marketing Launch 🚀

Бренд не почне продаватись сам.
Передати SMM спеціалісту задачу:
1. Закинути логотип на Головну (Portal).
2. Створити Reel ("Eventuri now officially in Ukraine / One Company").
3. Написати допис в Блог ("Чому ми обрали карбон від Eventuri").

← [[Home]]
