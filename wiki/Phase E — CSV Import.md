---
tags: [phase, csv, import]
status: done
progress: 100
---

# 📄 Phase E — CSV Import Center

> [!success] Статус: **100%** — Повний CSV Import Wizard реалізовано (882 рядки UI + API)

---

## Поточний Стан

- ✅ Базова сторінка `/admin/shop/stock` існує
- ✅ CSV upload wizard — реалізовано (`/admin/shop/import`)
- ✅ Column mapping UI — реалізовано (шаблони мапінгу колонок)
- ✅ Dry-run validation — реалізовано
- ✅ Error reporting — реалізовано (помилки по рядках)

---

## Планований Flow

### CSV Import Wizard (5 кроків)

```
1. 📁 Upload CSV
   ↓
2. 🗺 Column Mapping
   Мати шаблони по постачальнику
   ↓
3. 🔍 Dry-run Validation
   Показати що буде створено/оновлено/пропущено
   ↓
4. ✅ Commit Import
   Застосувати зміни в БД
   ↓
5. 📊 Error Report
   Детальний звіт по рядках з помилками
```

### On Conflict Behavior
- **Ключ**: SKU
- **Режими**: `skip` | `update` | `create`

### Import Templates
- Зберігати шаблони мапінгу по постачальнику
- Atomic, Eventuri, RaceChip — різні формати CSV

---

## API Routes (Плановані)

| Route | Метод | Призначення |
|---|---|---|
| `/api/admin/shop/imports/csv/dry-run` | POST | Валідація без запису |
| `/api/admin/shop/imports/csv/commit` | POST | Застосувати імпорт |
| `/api/admin/shop/imports/[id]` | GET | Статус імпорту |

---

## Залежності

- Потрібно для: Atomic CSV, Eventuri прайс → [[Blockers]]
- Імпортує товари в → [[Phase B — Catalog]]
- Захищено через → [[Phase A — Security]]

---

## Acceptance Criteria

- [x] Імпорт 5к+ рядків без падіння
- [x] Повний error report по кожному рядку
- [x] Шаблони зберігаються і перевикористовуються
- [x] Dry-run показує точний preview змін

← [[Home]]
