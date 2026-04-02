---
tags: [infra, logistics, warehouse, shipping]
aliases: [Логістика, Warehouses, Shipping]
---

# 🚛 Логістика (Multi-Warehouse)

> [!success] Повністю реалізовано (01.04.2026)

---

## 🏭 Склади

| Код | Назва | Країна | Місто | Статус |
|---|---|---|---|---|
| `US_NY` | Транзитний Склад США | US | New York | ✅ Active |
| `EU_PL` | Транзитний Склад Європа | PL | Warsaw | ✅ Active |
| `UA_KYIV` | Склад Україна | UA | Kyiv | ✅ Active |

Кожен склад має:
- 🌍 Свої **Shipping Zones** з окремими тарифами
- 📅 **ETA** (мін-макс днів) per zone
- 🏷 **Бренди** прив'язані до складу

---

## 🌍 Shipping Zones

Кожна зона belong до конкретного складу. Однакова зона (UA) може мати різні тарифи з різних складів.

**Параметри зони:**
- `ratePerKg` — $/кг
- `volSurchargePerKg` — штраф за об'ємну вагу
- `baseFee` — фіксована комісія
- `etaMinDays` / `etaMaxDays` — оцінка доставки

---

## 💸 Податки (Taxes)

Окрема сторінка: `/admin/shop/logistics/taxes`

| Тип | Приклад |
|---|---|
| `VAT` | 20% EU VAT |
| `CUSTOMS_DUTY` | 5% мито |
| `SALES_TAX` | State tax (US) |
| `GST` | Goods & Services Tax |
| `NONE` | Без податку |

**Режими:**
- **Inclusive** — податок вже в ціні
- **Exclusive** — додається зверху

---

## 🔗 Brand → Warehouse Mapping

| Бренд | Склад | Inbound |
|---|---|---|
| Burger | EU_PL | Direct shipping |
| DO88 | EU_PL | EU supplier |
| Brabus | EU_PL | EU supplier |
| RaceChip | EU_PL | EU import |
| Turn14 brands | US_NY | Turn14 API |

---

## Ключові Файли

| Файл | Призначення |
|---|---|
| `/admin/shop/logistics/page.tsx` | UI складів та зон |
| `/admin/shop/logistics/taxes/page.tsx` | UI податків |
| `/api/admin/shop/logistics/warehouses/` | API складів |
| `/api/admin/shop/logistics/zones/` | API зон |
| `/api/admin/shop/logistics/taxes/` | API податків |
| `/api/admin/shop/logistics/brands/` | API brand→warehouse |
| `src/lib/shippingCalc.ts` | Калькулятор доставки |

---

## DB Models

```
ShopWarehouse
  ├── id, code, name, nameUa
  ├── country, city
  ├── isActive, sortOrder
  ├── → ShopShippingZone[]
  └── → ShopBrandLogistics[]

ShopShippingZone
  ├── warehouseId → ShopWarehouse
  ├── zoneCode, label, labelUa
  ├── ratePerKg, volSurchargePerKg, baseFee
  └── etaMinDays, etaMaxDays

ShopTaxRegionRule
  ├── regionCode, label, labelUa
  ├── taxType (VAT/GST/SALES_TAX/CUSTOMS_DUTY/NONE)
  ├── taxRate, customsDutyPct
  ├── isInclusive
  └── notes
```

---

## Зв'язки

- Використовується в checkout → [[Phase C — Storefront]]
- Ціни враховують shipping → [[Pricing]]
- Бренди прив'язані → [[Brands]]
- Turn14 Quote API → [[Turn14]]

← [[Home]]
