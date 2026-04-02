---
tags: [phase, orders, admin]
status: waiting
progress: 85
---

# 📋 Phase D — Admin Order Operations

> [!warning] Статус: **85%** — Чекаємо Turn14 Quote API

---

## Що Реалізовано

### Таблиця Замовлень
- Список всіх замовлень з фільтрами
- Пошук по номеру, клієнту, email
- Фільтр по статусу
- Сортування по даті

### Статуси Замовлень

```
DRAFT → PENDING_REVIEW → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                                                          ↘ CANCELLED
                                                          ↘ REFUNDED
```

- Ручна зміна з валідацією переходів
- Timeline подій з timestamps
- Коментарі менеджера

### Настройки Адмінки
- ✅ Tax / Shipping правила
- ✅ Регіональні tax rules (окрема сторінка)
- ✅ Worldwide shipping zones + manual rates
- ✅ B2B режим видимості

---

## ⏳ Чекаємо

> [!important] Turn14 Shipping Quote
> Endpoint `POST /v1/quote` дає реальну вартість доставки від Turn14 до складу.
> Потрібно написати `fetchTurn14ShippingQuote()` — це можна зробити зараз.

Детальніше → [[TODO]]

---

## Зв'язки

- Замовлення створюються з → [[Phase C — Storefront]]
- Shipping розрахунки через → [[Logistics]]
- Turn14 товари через → [[Turn14]]
- Ціноутворення → [[Pricing]]

← [[Home]]
