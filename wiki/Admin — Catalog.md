---
tags: [admin, catalog, products]
aliases: [Каталог]
parent: "[[Admin Panel]]"
---

# 📦 Admin — Catalog

> [!info] Каталог товарів
> Повноцінний CRUD продуктів з варіантами, медіа, перекладами та бандлами.

---

## Сторінки модуля

| Сторінка | Розмір | Опис |
|----------|--------|------|
| `shop/page.tsx` | 22 KB | Головна — список товарів з пошуком |
| `shop/new/page.tsx` | Router | Створення нового товару |
| `shop/[id]/page.tsx` | Router | Редагування товару |
| `shop/categories/` | 9 KB | CRUD категорій (ієрархія, slug, SEO) |
| `shop/collections/` | 9 KB | CRUD колекцій (групування, фільтрація) |
| `shop/bundles/` | 21 KB | Бандли (товар з компонентами) |
| `shop/media/` | 14 KB | Медіа-бібліотека |
| `shop/inventory/` | 18 KB | Складський облік по SKU |
| `shop/stock/` | 15 KB | Stock movement tracking |

---

## Ключові можливості

- ✅ Товари з **множинними варіантами** (розмір, колір, SKU)
- ✅ **Мультимовність** UA/EN (`ProductTranslation`)
- ✅ **Мультивалютність** UAH, EUR, USD (`VariantPrice`)
- ✅ **Бандли** — товар-комплект з автоматичним розрахунком залишків (мінімум компонентів)
- ✅ **Категорії та колекції** — незалежні ієрархії для навігації
- ✅ **Медіа-бібліотека** — CDN URL та локальні файли
- ✅ **Складський облік** — per-SKU tracking + stock movements

---

## Структура товару

```
Product
├── title, slug, description, status
├── brand, categoryId, collectionId
├── ProductTranslation[] (ua, en)
├── ProductMedia[] (url, alt, sortOrder)
└── ProductVariant[]
    ├── sku, title, weight, dimensions
    ├── VariantPrice[] (currency, amount, B2B/B2C)
    └── InventoryLevel (quantity, warehouseId)
```

---

## API

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/admin/shop/products` | GET/POST | Список / створення |
| `/api/admin/shop/products/[id]` | GET/PATCH/DELETE | CRUD товару |
| `/api/admin/shop/variants` | POST/PATCH/DELETE | Варіанти |
| `/api/admin/shop/categories` | CRUD | Категорії |
| `/api/admin/shop/collections` | CRUD | Колекції |
| `/api/admin/shop/bundles` | CRUD | Бандли та компоненти |
| `/api/admin/shop/media` | POST/DELETE | Медіа файли |
| `/api/admin/shop/inventory` | GET/PATCH | Залишки по SKU |

---

## Пов'язане

- [[Admin Panel]] — Загальний огляд
- [[Admin — Pricing]] — Ціноутворення
- [[Admin — CSV Import]] — Імпорт товарів
- [[Phase B — Catalog]] — Фаза розробки
