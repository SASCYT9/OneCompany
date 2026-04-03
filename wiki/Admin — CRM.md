---
tags: [admin, crm, airtable, analytics]
aliases: [CRM Дашборд]
parent: "[[Admin Panel]]"
---

# 📋 Admin — CRM

> [!info] Dual-source CRM
> Airtable Live Data + PostgreSQL Analytics в єдиному дашборді.

---

## Розмір

`crm/page.tsx` — **36 KB** / 746 рядків

---

## Три вкладки

### 📊 Огляд (Overview)
- **KPI-карти**: Виручка, Прибуток, Маржинальність, Активні замовлення
- **SVG Sparklines**: Виручка та прибуток за останні 12 угод
- **Donut Chart**: Розподіл по статусах (Новий, В обробці, В виробництві, В дорозі, Виконаний, Скасований)
- **Bar Chart**: ТОП-8 клієнтів за продажами
- **Баланси контрагентів**: Хто кому скільки винен
- **Таблиця замовлень**: Останні 10 угод зі статусом, оплатою, прибутком

### 👥 Клієнти (Customers)
- Пошукова сітка карток клієнтів
- Кожна картка: ім'я, email, компанія, баланс
- Метрики: продажі ($), кількість замовлень, статус боргу
- Кнопка «Зв'язати з акаунтом» — link CRM → Shop customer

### 📦 Замовлення (Orders)
- Лінійний список: №, назва, статус, оплата
- Сума з B2B калькуляцією (calc: $XX.XX)
- Прибуток + маржа % на кожне замовлення
- Статус badge: PAID / PENDING

---

## Інтеграції

| Джерело | Endpoint | Дані |
|---------|----------|------|
| **Airtable** | `/api/admin/crm/link-customer` | Клієнти (live) |
| **Airtable** | `/api/admin/crm?type=orders` | Замовлення (live) |
| **PostgreSQL** | `/api/admin/crm/analytics?type=dashboard` | Агреговані KPI |
| **Full Sync** | POST `/api/admin/crm/full-sync` | Синхронізація CRM → PostgreSQL |
| **Webhook** | POST `/api/webhooks/airtable` | Fire-and-forget sync trigger |

---

## Auto-refresh

- 30 секунд між запитами
- Зелений LIVE індикатор з пульсом
- Timestamp останнього оновлення
- Manual «Повна синхронізація» button

---

## SVG Charts (вбудовані)

| Компонент | Тип | Опис |
|-----------|-----|------|
| `SparklineChart` | Line + area fill | Мікро-графік тренду |
| `DonutChart` | Ring segments | Розподіл по категоріях |
| `BarChartSvg` | Vertical bars | ТОП-N порівняння |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — Dashboard]] — Головний дашборд
- [[Admin — Customers]] — Shop клієнти
- [[B2B Operations]] — B2B workflow
