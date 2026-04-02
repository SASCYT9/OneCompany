---
tags: [phase, csv, import]
status: in-progress
progress: 10
---

# 📄 Phase E — CSV Import Center

> [!caution] Статус: **10%** — Базова сторінка є, wizard ще не реалізований

---

## Поточний Стан

- ✅ Базова сторінка `/admin/shop/stock` існує
- ❌ CSV upload wizard — не реалізований
- ❌ Column mapping UI — не реалізований
- ❌ Dry-run validation — не реалізований
- ❌ Error reporting — не реалізований

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

- [ ] Імпорт 5к+ рядків без падіння
- [ ] Повний error report по кожному рядку
- [ ] Шаблони зберігаються і перевикористовуються
- [ ] Dry-run показує точний preview змін

← [[Home]]
