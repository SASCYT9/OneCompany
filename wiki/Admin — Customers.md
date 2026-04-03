---
tags: [admin, customers, b2b, b2c]
aliases: [Клієнти адмінки]
parent: "[[Admin Panel]]"
---

# 👥 Admin — Customers

> [!info] B2B/B2C Customer Management
> Управління клієнтами магазину з інтеграцією CRM.

---

## Розмір

`customers/page.tsx` — **12 KB** / 253 рядки

---

## Функціонал

| Функція | Деталі |
|---------|--------|
| **Список** | Таблиця: email, ім'я, компанія, телефон, група, статус |
| **Фільтри** | Пошук + група (B2C/B2B_PENDING/B2B_APPROVED) + статус |
| **CRM Link** | Бейдж «Linked» для клієнтів з Airtable |
| **Метрики** | Кількість замовлень, кошиків, адрес per-customer |
| **Створення** | Повна форма нового клієнта |
| **Деталі** | Картка клієнта з історією замовлень |

---

## Групи клієнтів

| Група | Опис | Badge |
|-------|------|-------|
| `B2C` | Роздрібний покупець | 🔘 Сірий |
| `B2B_PENDING` | Запит на оптову співпрацю | 🟡 Amber |
| `B2B_APPROVED` | Схвалений B2B-клієнт | 🟢 Emerald |

> [!tip] B2B Visibility
> Режим видимості (approved_only / public_dual / request_quote) налаштовується в [[Admin — Settings]].

---

## Summary bar

```
XX customers · Y pending B2B · Z approved B2B · W orders total
```

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — Orders]] — Замовлення клієнтів
- [[Admin — CRM]] — CRM дашборд
- [[B2B Operations]] — B2B процеси
