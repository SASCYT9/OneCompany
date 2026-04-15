---
tags: [todo, status, kanban]
aliases: [Задачі, Tasks, Kanban Board]
kanban-plugin: basic
---

## 📋 To Do (Sprint 2)

- [ ] 📄 **CSV Import Wizard (Phase E)** 🔴 Important<br>Повний wizard для імпорту товарів з CSV: Upload → Column mapping → Dry-run → Commit. ^e2a1b1
- [ ] 💸 **WhitePay API інтеграція**<br>Потрібно спочатку отримати SDK. ^f3b2c2
- [x] 🌐 **Переклад товарів (Gemini API)** 🔴 Important<br>Локальна модель (translategemma) забракована через низьку якість. Переписати `translate-products.mjs` на використання Google Gemini 1.5 Flash API. ^tr1n2l

## ⏳ In Progress (В роботі)

- [ ] 🛍️ **Storefront Checkout Flow (Phase C)** 🟡 Medium<br>Pixel-perfect UI для оформлення замовлення, інтеграція доставки. ^d4c3b2
- [ ] 🛒 **Guest/Customer Cart Logic**<br>Злиття кошиків при логіні. ^g7h8i9

## ✅ Done (Перший Спринт)

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
