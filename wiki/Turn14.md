---
tags: [infra, turn14, integration]
aliases: [Turn14 Distribution, T14]
---

# 📡 Turn14 Integration

> [!success] Базова інтеграція готова. Quote API — в TODO.

---

## Огляд

Turn14 Distribution — американський дистриб'ютор автозапчастин з ~700 000 товарів від 448 брендів.

---

## Що Реалізовано

### OAuth 2.0 Клієнт
- `src/lib/turn14.ts` — повний API клієнт
- Automatic token refresh
- Rate limiting compliance

### Локальний Кеш (Supabase)
- ~700к товарів синхронізовано
- `scripts/turn14-supabase-sync.mjs` — скрипт синхронізації
- **Exclusion list** — DO88, Akrapovic, Mishimoto (керуються локально)

### 🛡️ Архітектурне Правило (Data Merge)
> [!WARNING] **CRITICAL RULE**
> Якщо товар вже існує у нашій базі (`ShopProduct`), заповнений вручну або імпортований з CSV (наприклад, Atomic Shop), ми **не показуємо** його дублікат з Turn14. Turn14 використовується виключно як донор даних (ми лише «додаємо» сток/ціну до нашого існуючого товару).

### Пошук
- По бренду (brand name/id)
- По keyword (part number, description)
- По fitment (make/model/year)
- Результати з Supabase (швидко) + Turn14 API (повні дані)

### AI Estimation Розмірів
- Cloudflare Workers AI
- Оцінює weight / dimensions для товарів без даних
- Reasoning пояснення

### Brand Markup
- Per-brand markup % в адмінці
- Настроюється через `/admin/shop/integrations`

### Enrichment Script
- `scripts/enrich-local-dimensions-from-turn14.mjs`
- Збагачує локальні варіанти даними ваги/розмірів з Turn14 кешу

---

## ⏳ Shipping Quote API

> [!todo] Turn14 Shipping Quote
> Endpoint: `POST /v1/quote`
> Дає реальну вартість доставки від Turn14/виробника до нашого складу.
> 
> **Що написати:** `fetchTurn14ShippingQuote()` в `turn14.ts`
> **Залежність:** Адреса складу (вже є через [[Logistics]])
> **Час:** ~2-3 години
> → [[TODO]]

---

## API Endpoints (Turn14)

| Endpoint | Призначення |
|---|---|
| `GET /v1/items` | Каталог товарів |
| `GET /v1/items/{id}` | Деталі товару |
| `GET /v1/items/data/{id}` | Fitment, media, docs |
| `POST /v1/quote` | ⏳ Shipping quote |
| `POST /v1/order` | 🔮 Future: auto-order |

---

## Ключові Файли

| Файл | Призначення |
|---|---|
| `src/lib/turn14.ts` | API клієнт |
| `scripts/turn14-supabase-sync.mjs` | Sync → Supabase |
| `scripts/enrich-local-dimensions-from-turn14.mjs` | Enrichment |
| `src/app/admin/shop/integrations/` | Admin UI |

---

## Зв'язки

- Товари йдуть в → [[Phase B — Catalog]]
- Quote API потрібен для → [[Phase D — Orders]]
- Ціни розраховуються через → [[Pricing]]
- Доставка через → [[Logistics]]

← [[Home]]
