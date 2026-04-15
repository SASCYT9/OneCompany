---
tags: [todo, status, kanban]
aliases: [Задачі, Tasks, Kanban Board]
kanban-plugin: basic
---

## 📋 To Do (Sprint 3)

- [ ] 📡 **Webhook Migration** 🔴 Critical<br>При злитті `feature/shop` → `master`: оновити URL вебхуків у Shopify для ВСІХ магазинів з preview URL на production домен `onecompany.global`. ^w1h2k3

## ⏳ In Progress (В роботі)

## ✅ Done (Завершено)

- [x] 🛍️ **Storefront Checkout Flow (Phase C)** 💎<br>Pixel-perfect UI для оформлення замовлення, 4-кроковий checkout, shipping quote, мультивалютний кошик. ^d4c3b2
- [x] 🛒 **Guest/Customer Cart Logic**<br>Злиття кошиків при логіні: `resolveShopCart()` → `mergeCartItems()`. ^g7h8i9
- [x] 💸 **WhitePay API інтеграція**<br>Crypto (USDT/BTC/ETH) + Fiat (Apple/Google Pay) — повна реалізація checkout → redirect. ^f3b2c2
- [x] 📄 **CSV Import Wizard (Phase E)** 💎<br>Повний wizard: Upload → Column mapping → Templates → Dry-run → Commit → Error Report (882 рядки UI). ^e2a1b1
- [x] 🌐 **Переклад товарів (Gemini API)** 🔴 Important<br>1542 товари перекладено через `gemini-2.5-flash-lite`. 99.9% покриття. ^tr1n2l
- [x] 📦 **Burger Motorsports Fixed Box Size** 🟢 Easy win<br>Реалізовано в `ShopBrandLogistics` для точного розрахунку. ^x1y2z3
- [x] 🚚 **Turn14 Shipping Quote API** 🟡 Medium<br>Реалізовано `POST /v1/quote` в `turn14.ts`. ^c4b5a6
- [x] 🎨 **Storefront Mockups & UI Architecture** 💎<br>Додані візуальні діаграми та екрани `Phase C`. ^u1v2w3

***

## 🛑 Blocked (Блокери)

- [ ] 📥 **Atomic CSV імпорт** Файл `feed_tts.csv` перевірено — він не містить колонки з цінами! Потрібно попросити менеджера додати `price_uah`. ^j1k2l3
- [ ] 🌬 **Eventuri імпорт прайсу**<br>Чекаємо файл від Вані. ^m4n5o6

%% kanban:settings
```
{"kanban-plugin":"basic"}
```
%%
