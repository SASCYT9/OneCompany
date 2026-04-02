---
tags: [phase, seo, analytics]
status: done
progress: 80
---

# 🔍 Phase F — SEO + Launch Hardening

> [!success] Статус: **80% Готово**

---

## Що Реалізовано

### Sitemap
- ✅ `/shop` — головна магазину
- ✅ `/shop/urban` — колекція
- ✅ Колекції всіх брендів
- ✅ Сторінки товарів

### Product Metadata
- ✅ `generateMetadata` через `getShopProductPageMetadata`
- ✅ Title, description
- ✅ Open Graph / Twitter Cards
- ✅ Product image as og:image

### Structured Data (JSON-LD)
- ✅ `Product` schema
- ✅ name, description, image, brand
- ✅ offers (price, currency, availability)
- ✅ sku, priceValidUntil

### Analytics Events

| Event | Де Викликається |
|---|---|
| `shop_view_product` | Сторінка товару |
| `shop_add_to_cart` | Кнопка "Додати" |
| `shop_view_cart` | Сторінка кошику |
| `shop_begin_checkout` | Checkout page |
| `shop_order_placed` | Order confirmation |

**Платформи:**
- Plausible — custom events
- GA4 — custom events
- Meta Pixel — ViewContent, AddToCart, InitiateCheckout, Purchase

### Google Merchant Center
- ✅ XML фід: `GET /api/shop/feed/products`
- ✅ Query params: `locale`, `currency`
- 📖 Інструкція: `docs/SHOP_GOOGLE_MERCHANT_CENTER.md`

---

## Що Залишилось

- [ ] Seed data для smoke-тестів
- [ ] Перевірка доступів ролей перед запуском
- [ ] Backup / rollback план міграцій

---

## Зв'язки

- SEO для сторінок → [[Phase C — Storefront]]
- Metadata з товарів → [[Phase B — Catalog]]
- GMC Feed підтягує → [[Pricing]]

← [[Home]]
