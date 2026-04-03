---
tags: [admin, dashboard, shop]
aliases: [Адмінка, Admin, Адмін-панель]
status: complete
---

# 🖥️ Admin Panel — Огляд

> [!info] Адміністративна панель One Company
> Повноцінна ERP-система для управління e-commerce, логістикою, CRM та контентом.
> URL: `onecompany.global/admin`

---

## 📊 Статистика

| Метрика | Значення |
|---------|----------|
| Сторінок адмінки | **37** TSX page files |
| Обсяг коду | **~780 KB** чистого TSX |
| API endpoints | **30+** REST endpoints |
| Зовнішні інтеграції | Airtable, Turn14, НБУ, Stripe, WhiteBit |
| Дизайн | Dark theme, glassmorphism, Framer Motion |
| Мова | Українська (основна) + English (CRM) |

---

## 🧭 Модулі

### 🏪 Sales & Commerce
- [[Admin — Dashboard]] — Командний центр з live KPI
- [[Admin — Orders]] — Управління замовленнями (lifecycle, shipments, платежі)
- [[Admin — Customers]] — B2B/B2C клієнти

### 📦 Catalog & Inventory
- [[Admin — Catalog]] — Товари, варіанти, бандли, медіа
- [[Admin — Pricing]] — Мультивалютне ціноутворення
- [[Admin — CSV Import]] — Імпорт з CSV (Shopify-формат)

### 🚚 Logistics & Tax
- [[Admin — Logistics]] — Мультисклад, зони доставки, податки

### 🔗 Integrations
- [[Admin — Turn14]] — Каталог Turn14 Distribution
- [[Admin — CRM]] — Airtable + PostgreSQL CRM

### ⚙️ System
- [[Admin — Settings]] — Глобальні налаштування магазину
- [[Admin — Audit]] — Журнал дій

---

## 🏗 Архітектура Навігації

```
admin/
├── 📊 Dashboard (page.tsx)
├── 🛒 shop/
│   ├── 📦 Catalog (page.tsx, [id], new)
│   ├── 📁 categories/
│   ├── 📁 collections/
│   ├── 🎁 bundles/
│   ├── 🖼 media/
│   ├── 📊 inventory/
│   ├── 📈 stock/
│   ├── 🧾 orders/ (list, [id], create)
│   ├── 💰 pricing/
│   ├── 🚚 logistics/ (zones, taxes)
│   ├── 📥 import/
│   ├── 🌐 turn14/ (search, markups)
│   ├── 👥 customers/ (list, [id], new)
│   ├── ⚙️ settings/
│   └── 📋 audit/
├── 📋 crm/
├── 📝 blog/
├── 💬 messages/
├── 👤 users/
├── 💾 backups/
└── ⚙️ settings/
```

---

## 🔐 Безпека

- **Auth**: Session-based via `sessionStorage` + `/api/admin/auth`
- **RBAC**: Ролі/дозволи для ecommerce-операцій
- **Audit**: Лог дій — хто, що, коли змінив
- **Rate Limit**: На auth та критичні API

---

## 🔗 Пов'язане

- [[Architecture]] — Загальна архітектура системи
- [[Shop Overview]] — Огляд магазину (фази A-F)
- [[DevOps]] — Інфраструктура та деплой
- [[Team]] — Команда та ролі
