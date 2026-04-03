---
tags: [admin, import, csv]
aliases: [CSV Імпорт]
parent: "[[Admin Panel]]"
---

# 📥 Admin — CSV Import

> [!info] Центр імпорту CSV
> Професійний wizard з dry-run, шаблонами мапінгу та звітами помилок.

---

## Розмір

`import/page.tsx` — **38 KB** / 882 рядки

---

## Workflow

```
📁 Upload CSV → 🗺️ Select Template → ⚙️ Conflict Mode → 🧪 Dry Run
                                                              ↓
                                                       Errors? → 🔍 Review
                                                              ↓
                                                       ✅ Commit → 📊 Report
```

---

## Функціонал

### Запуск імпорту
- **Завантаження CSV** — file upload або paste в textarea
- **Формат** — Shopify CSV (стандарт)
- **Ім'я файлу** — для ідентифікації
- **Постачальник** — для відстеження джерела

### Шаблони імпорту (Templates)
- CRUD шаблонів з мапінгом колонок
- Прив'язка до постачальника
- Режим конфлікту за замовчуванням
- Примітки для команди

### Мапінг колонок
Нестандартні CSV від постачальників:
```
"Product Name" → title
"Supplier SKU" → sku  
"Unit Price"   → price
"Stock Qty"    → inventory_quantity
```

### Conflict modes

| Режим | Опис |
|-------|------|
| `UPDATE` | Оновлювати існуючі товари (за ключем SKU) |
| `SKIP` | Пропускати існуючі товари |
| `CREATE` | Тільки створення, конфлікти як помилки |

---

## Деталі імпорту

Після dry-run або commit доступні:

| Метрика | Приклад |
|---------|---------|
| Рядків оброблено | 5,230 |
| Товарів виявлено | 1,847 |
| Варіантів | 3,291 |
| Валідних товарів | 1,820 |
| Створено | 1,200 |
| Оновлено | 620 |
| Пропущено | 0 |
| Помилок | 27 |

### Помилки по рядках
Таблиця з деталями:
- Номер рядка
- Handle (slug)
- Повідомлення про помилку
- Payload рядка

---

## API

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/admin/shop/imports/csv/dry-run` | POST | Пробний прогін |
| `/api/admin/shop/imports/csv/commit` | POST | Виконання імпорту |
| `/api/admin/shop/imports` | GET | Історія імпортів |
| `/api/admin/shop/imports/[id]` | GET | Деталі конкретного імпорту |
| `/api/admin/shop/imports/templates` | GET/POST | Шаблони |
| `/api/admin/shop/imports/templates/[id]` | PATCH/DELETE | CRUD шаблону |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — Catalog]] — Каталог товарів
- [[Phase E — CSV Import]] — Фаза розробки
