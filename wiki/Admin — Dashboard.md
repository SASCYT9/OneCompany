---
tags: [admin, dashboard, kpi]
aliases: [Дашборд, Dashboard]
parent: "[[Admin Panel]]"
---

# 📊 Admin — Dashboard v2

> [!tip] Командний центр
> Головна сторінка після входу. Real-time BI дашборд з окремими метриками Shop (€) і CRM ($).

---

## Компоненти

| Компонент | Опис |
|-----------|------|
| **KPI-карти (×5)** | Виручка Shop (€), CRM Виручка ($), CRM Прибуток ($) з маржою, AOV (€), Борги ($) |
| **Source Badges** | Кожна KPI-карта має badge `SHOP €` або `CRM $` для чіткої ідентифікації джерела |
| **Monthly Revenue Chart** | SVG dual-bar chart: зелений = CRM ($), індиго = Shop (€), 12 міс. |
| **Conversion Funnel** | Горизонтальна pipeline-візуалізація: PENDING → CONFIRMED → SHIPPED → DELIVERED |
| **Brand Breakdown** | TOP-8 брендів за виручкою (CRM) з горизонтальними барами |
| **CRM Orders Table** | Останні 6 угод з PostgreSQL з ім'ям клієнта та маржою |
| **Shop Orders Table** | Останні 6 замовлень з сайту з ім'ям клієнта та статусом оплати |
| **Top Products** | ТОП-6 продуктів за виручкою з кількістю та к-стю замовлень |
| **Data Quality Badge** | Score 0-100% з деталізацією: без клієнта, нульова сума, без дати |
| **Turn14 Sync Status** | К-сть брендів, активних синхронізацій, дата останнього оновлення |
| **VIP Акаунти** | ТОП-5 клієнтів за обсягом продажів + борги |
| **Quick Actions (×6)** | Новий чек, CSV Імпорт, БД Бекап, ROI Націнки, CRM, Shop замовлення |

---

## Технічні деталі

- **Single API call**: весь дашборд живиться одним `/api/admin/dashboard` GET
- **Structured Response**: `{ shop, crm, system }` — три namespace
- **Auto-refresh**: кожні 60 секунд
- **Customer Attribution**: `resolveCustomerName()` з fallback: firstName → customerName → email prefix
- **Data Quality Score**: `(totalOrders - issues) / totalOrders * 100`
- **Charts**: Inline SVG з Framer Motion анімаціями
- **Data Source**: 100% PostgreSQL (CRM orders через sync, не live Airtable)

---

## API Endpoints

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/admin/dashboard` | GET | Повна структура: shop + crm + system метрики |

### Response Structure:
```
shop: totalRevenue, totalInvoiced, aov, conversionFunnel, monthlyRevenue, topProducts, paymentMethods, recentOrders
crm: totalRevenue, totalProfit, avgMargin, brandBreakdown, monthlyRevenue, topCustomers, debtors, recentOrders
system: turn14Stats, lastCrmSyncAt, dataQuality { score, ordersWithoutCustomer, ordersWithZeroTotal, crmOrdersWithoutDate }
```

---

## Файли

| Файл | Опис |
|------|------|
| `src/app/admin/page.tsx` | Головна сторінка дашборду (UI) |
| `src/app/api/admin/dashboard/route.ts` | API endpoint з усіма метриками |
| `src/lib/dashboard/dataQuality.ts` | Утиліта підрахунку якості даних |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — CRM]] — CRM дашборд
- [[Admin — Orders]] — Замовлення
