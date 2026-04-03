---
tags: [admin, audit, security]
aliases: [Аудит]
parent: "[[Admin Panel]]"
---

# 📊 Admin — Audit

> [!info] Журнал дій
> Хронологічний лог всіх адміністративних дій.

---

## Розмір

`audit/page.tsx` — **7 KB**

---

## Функціонал

- Хронологічний лог дій: хто, що, коли змінив
- Фільтрація по типу дії
- Деталі кожної зміни (old → new value)
- Пошук по user / action / entity

---

## Типи дій

| Дія | Приклади |
|-----|----------|
| `CREATE` | Створення товару, замовлення, клієнта |
| `UPDATE` | Зміна статусу, ціни, кількості |
| `DELETE` | Видалення позиції, шаблону |
| `IMPORT` | CSV dry-run або commit |
| `STATUS_CHANGE` | Order status transition |
| `PAYMENT` | Додавання платежу |

---

## Структура запису

```
{
  actor: "admin@onecompany.global",
  action: "STATUS_CHANGE",
  entity: "Order #1234",
  oldValue: "CONFIRMED",
  newValue: "PROCESSING",
  timestamp: "2026-04-03T15:30:00Z",
  note: "Підготовка до відправки"
}
```

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Phase A — Security]] — Безпека та RBAC
