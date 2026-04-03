---
tags: [admin, dashboard, kpi]
aliases: [Дашборд, Dashboard]
parent: "[[Admin Panel]]"
---

# 📊 Admin — Dashboard

> [!tip] Командний центр
> Головна сторінка після входу. Збирає телеметрію з усіх джерел у єдиний live-дашборд.

---

## Компоненти

| Компонент | Опис |
|-----------|------|
| **KPI-карти** | 5 key metrics: дохід Shop (€), CRM Виручка ($), CRM Прибуток ($), Активні замовлення, Борги |
| **Sparkline-графіки** | SVG мікро-графіки виручки та прибутку на базі останніх 15 угод |
| **CRM DB Analytics** | 6-metric row з PostgreSQL: клієнти, замовлення, позиції, виручка, прибуток, маржа |
| **Airtable CRM Live** | Таблиця останніх 6 угод з Airtable: номер, назва, статус, сума, прибуток |
| **Shop Кошики** | Recent orders з сайту: номер, клієнт, сума, статус оплати |
| **Pipeline Аналітика** | SVG Donut chart — візуальний розподіл замовлень по статусах |
| **VIP Акаунти** | ТОП-5 клієнтів за обсягом продажів + борги |
| **Навігатор Дій** | Quick-action buttons: Новий чек, CSV Імпорт, Бекап БД, ROI Націнки |

---

## Технічні деталі

- **Auto-refresh**: кожні 30 секунд
- **Live-індикатор**: зелений пульс + timestamp
- **Анімації**: Framer Motion stagger для таблиць і карт
- **Розмір**: `page.tsx` — 22 KB, 482 рядки

---

## API Endpoints

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/admin/dashboard` | GET | Агреговані KPI з Shop |
| `/api/admin/crm` | GET | Останні замовлення з Airtable |
| `/api/admin/crm/analytics` | GET | KPI з PostgreSQL |
| `/api/admin/crm/link-customer` | GET | Список CRM-клієнтів |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — CRM]] — CRM дашборд
- [[Admin — Orders]] — Замовлення
