---
tags: [admin, orders, sales]
aliases: [Замовлення]
parent: "[[Admin Panel]]"
---

# 🧾 Admin — Orders

> [!info] Управління замовленнями
> Повноцінний order management з повним lifecycle від створення до доставки.

---

## Сторінки модуля

| Сторінка | Розмір | Опис |
|----------|--------|------|
| `orders/page.tsx` | 25 KB | Список замовлень з фільтрами та bulk actions |
| `orders/[id]/page.tsx` | **76 KB** | Деталі замовлення — найбільша сторінка |
| `orders/create/page.tsx` | 42 KB | Створення B2B замовлення |

---

## Lifecycle замовлення

```
PENDING_PAYMENT → PENDING_REVIEW → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                                        ↓              ↓          ↓
                                   CANCELLED      CANCELLED    REFUNDED
```

### Статуси

| Статус | Опис | Колір |
|--------|------|-------|
| `PENDING_PAYMENT` | Очікує оплату після checkout | 🔵 Blue |
| `PENDING_REVIEW` | Оплата отримана, менеджер перевіряє | 🟡 Amber |
| `CONFIRMED` | Підтверджено менеджером | 🟢 Green |
| `PROCESSING` | В обробці / виробництві | 🟣 Purple |
| `SHIPPED` | Відправлено клієнту | 🔷 Cyan |
| `DELIVERED` | Доставлено | ✅ Emerald |
| `CANCELLED` | Скасовано | 🔴 Red |
| `REFUNDED` | Повернення коштів | 🔴 Red |

---

## Список замовлень (orders/page.tsx)

### Фільтри
- Статус замовлення (dropdown)
- Валюта (EUR/USD/UAH)
- Зона доставки
- Правило податку
- Текстовий пошук

### Status Distribution Bar
Кольорова прогрес-бар з лейблами для кожного статусу (візуальний розподіл).

### Масові дії
- Checkbox-вибір кількох замовлень
- Bulk status update з обов'язковою нотаткою

### Summary cards
Видимих замовлень · Очікує оплату · На перевірці · В обробці · Відправлено

---

## Деталі замовлення (orders/[id]/page.tsx)

> [!warning] Найбільша сторінка адмінки
> 76 KB / 1,595 рядків — повний контроль над замовленням

### Блоки

| Блок | Функціонал |
|------|------------|
| **Зміна статусу** | Dropdown + швидкі кнопки переходів з валідацією дозволених transitions |
| **Оплата** | Модальне вікно: додати платіж / встановити суму. Автоматичний UNPAID → PARTIALLY_PAID → PAID |
| **Whitepay** | Генерація платіжного лінку Hutko / Whitepay + копіювання |
| **Shipments** | CRUD: carrier, tracking number, URL, status (LABEL_CREATED → IN_TRANSIT → DELIVERED) |
| **Позиції** | Додавання/редагування/видалення order items inline |
| **Timeline** | Повна історія подій: хто, коли, що змінив |
| **B2B бейдж** | Група, знижка, нотатки для B2B-клієнта |
| **Client link** | URL для клієнта (view token) — копіювання та відкриття |

---

## Створення B2B замовлення (orders/create/page.tsx)

1. Пошук товарів з каталогу
2. Вибір клієнта з бази або створення нового
3. Додавання позицій з ціною продажу
4. Автоматичний розрахунок subtotal / shipping / tax
5. Вибір зони доставки та податкового правила

---

## API

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/admin/shop/orders` | GET | Список замовлень з фільтрами |
| `/api/admin/shop/orders` | POST | Створення замовлення |
| `/api/admin/shop/orders/[id]` | GET | Деталі замовлення |
| `/api/admin/shop/orders/[id]/status` | PATCH | Зміна статусу |
| `/api/admin/shop/orders/[id]/items` | POST/DELETE | Позиції |
| `/api/admin/shop/orders/[id]/payments` | POST | Додати платіж |
| `/api/admin/shop/orders/[id]/shipments` | POST/PATCH | Відправлення |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — Logistics]] — Зони доставки та склади
- [[Admin — Customers]] — Клієнти
- [[Order Processing Playbook]] — SOP для менеджерів
