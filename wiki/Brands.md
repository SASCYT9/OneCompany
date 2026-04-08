---
tags: [brand, catalog]
aliases: [Бренди]
---

# 🏷 Бренди

> [!info] Всі бренди One Company SHOP з джерелами даних та статусами

---

## 🏎 Brabus

| | |
|---|---|
| **Тип** | EU Direct (Німеччина) |
| **Продукти** | Преміум тюнінг Mercedes |
| **Каталог** | ✅ Мануальне введення |
| **Ціни** | Manual pricing |
| **Склад** | EU warehouse |

---

## 🏙 Urban Automotive

| | |
|---|---|
| **Тип** | UK Direct (Великобританія) |
| **Продукти** | Тюнінг Land Rover, Rolls-Royce, G-Class |
| **Каталог** | ✅ Локальний |
| **Ціни** | Прайс від виробника |
| **Склад** | UK warehouse |

---

## 🔩 Akrapovič

| | |
|---|---|
| **Тип** | Turn14 Distribution |
| **Продукти** | Титанові та карбонові вихлопні системи |
| **Каталог** | ✅ Через Turn14 API → Supabase cache |
| **Ціни** | Turn14 cost + Brand Markup % |
| **Склад** | US warehouse (Turn14) |
| **Storefront** | ✅ `/shop/akrapovic` — Cinematic "Sound of Perfection" |
| **Секції** | Hero video, Sound Wave, Materials, Product Lines, Sound Grid, Heritage, Stats, CTA |
| **SEO** | ✅ Sitemap, metadata UA/EN |

> [!tip] Наступні кроки
> - Завантажити реальні відео Akrapovič (hero + factory)
> - Додати sound clips (MP3, 3-5 сек) для інтерактивної сітки
> - Імпортувати товари з Turn14 API в каталог

---

## 🌬 Eventuri

| | |
|---|---|
| **Тип** | Shopify Storefront |
| **Продукти** | Впускні системи |
| **Каталог** | ✅ Імпортовано через CSV на Shopify |
| **Ціни** | Синхронізовані |
| **Склад** | UK / EU warehouse |
| **Storefront** | `eventuri.onecompany.global` |

---

## 📉 KW Automotive

| | |
|---|---|
| **Тип** | Shopify Storefront |
| **Продукти** | Підвіски та койловери |
| **Каталог** | ✅ Запущено |
| **Storefront** | `kw.onecompany.global` |

---

## 🥶 CSF Racing

| | |
|---|---|
| **Тип** | Turn14 Distribution |
| **Продукти** | Преміальні радіатори, інтеркулери |
| **Каталог** | Turn14 API |
| **Склад** | US warehouse |

---

## 🍔 Burger Motorsports

| | |
|---|---|
| **Тип** | Direct / Власний бренд |
| **Продукти** | RaceChip чіпи для тюнінгу (BMW, Mercedes, Audi, VW) |
| **Каталог** | ✅ Повний (7700+ конфігурацій з скрейпінгу) |
| **Ціни** | Fixed price від Burger |
| **Доставка** | ⏳ Потрібно захардкодити розміри коробки |
| **Склад** | EU warehouse |

> [!todo] Burger Box Dimensions
> Всі RaceChip чіпи їдуть в однаковій коробці. Захардкодити weight/dimensions.
> Час: ~15 хв → [[TODO]]

---

## 🔧 DO88

| | |
|---|---|
| **Тип** | EU Direct (Швеція) |
| **Продукти** | Радіатори, інтеркулери, патрубки |
| **Каталог** | ✅ Локальний каталог з повними даними |
| **Ціни** | EUR від виробника |
| **Склад** | EU warehouse |

---

## ⚡ RaceChip

| | |
|---|---|
| **Тип** | EU Import |
| **Продукти** | 7700+ конфігурацій чіп-тюнінгу |
| **Каталог** | ✅ Автоматичний скрейпінг RaceChip EU |
| **Ціни** | Scraped EUR prices |
| **Склад** | EU warehouse |

---

## 📡 Turn14 Distribution (Загальне)

~700к товарів від 448 брендів. Детальніше → [[Turn14]]

**Відомі бренди для синхронізації:**
KW, DO88 (skip — локальний), Akrapovic, CSF, EBC, Mishimoto (skip — локальний)

> [!warning] Фінальний список брендів
> Ігор ще не визначився які бренди синхронізувати → [[Blockers]]

---

## Зв'язки

- Каталог → [[Phase B — Catalog]]
- Логістика → [[Logistics]]
- Імпорт → [[Phase E — CSV Import]]

← [[Home]]
