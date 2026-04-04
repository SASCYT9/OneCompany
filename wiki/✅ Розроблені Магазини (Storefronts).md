---
tags: [storefront, brands, status, visuals]
aliases: [Візуал Магазинів, Storefronts, Розроблені Магазини]
---

# 🛍️ Візуальний Стан Storefront (Готові Магазини)

> [!info] Цей документ відображає поточний реальний стан усіх розроблених клієнтських магазинів в екосистемі `OneCompany`.

---

## 🧭 Загальна Архітектура Сайту (Спільні Сторінки)

Кожен бренд має власну "мікро-екосистему" зі своїм унікальним дизайном, але всі вони використовують спільний кошик та єдину систему дилерських акаунтів.

| Тип Сторінки | Роут (URL) | Опис та Функціонал |
|--------------|------------|---------------------|
| **Головна Маркетплейсу** | `/{locale}/shop` | Базовий портал доступу до всіх наявних брендів. |
| **Спільний Кошик** | `/{locale}/shop/cart` | Об'єднаний кошик для товарів від різних брендів. Злиття Guest + DB Session. |
| **Центр Оформлення** | `/{locale}/shop/checkout` | Загальний чекаут з інтеграцією доставки Turn14 та вибором податкових зон. |
| **Кабінет Клієнта** | `/{locale}/shop/account` | Профіль клієнта / СТО. Трекінг лояльності (B2B tier), історія. |

---

## 🏎️ 1. Öhlins Motorsport (Stealth Wealth V2)

> [!example] Інтерфейс Öhlins
> ![[screenshots/real_ohlins.png]]

- **Головна:** `/{locale}/shop/ohlins`
- **Дизайн Концепт:** *Motorsport Monument*. Використовує темно-графітовий фон, золоті акценти (спадщина фірмового кольору Öhlins) та динамічний ефект particles. High-fidelity UI.

---

## 💨 2. Akrapovič (Sound of Perfection)

> [!example] Інтерфейс Akrapovič
> ![[screenshots/real_akrapovic.png]]

- **Головна:** `/{locale}/shop/akrapovic`
- **Каталог/Колекції:** `/{locale}/shop/akrapovic/collections`
- **Сторінка товару:** `/{locale}/shop/akrapovic/products/[slug]`
- **Дизайн Концепт:** *Cinematic & Acoustic*. Максимум карбону та титану в UI.
- **Особливості:** Інтерактивна "Sound Grid" з живим аудіо відгуком, Video Hero section.

---

## 🏙️ 3. Urban Automotive (Bespoke Tuning)

> [!example] Інтерфейс Urban
> ![[screenshots/real_urban.png]]

- **Головна:** `/{locale}/shop/urban`
- **Дизайн Концепт:** Люксовий, стриманий дизайн екстер'єрів. Black-on-Black естетика, яка детально описана у [[Urban Theme]].

---

## 🛑 4. GiroDisc (Precision Braking)
- **Головна:** `/{locale}/shop/girodisc`
- **Дизайн Концепт:** *Stealth Redesign*. Pixel-perfect паритет зі стандартним OneCompany дизайном. 

---

## 🍔 5. Burger Motorsports & RaceChip

> [!example] Інтерфейс Burger Motorsports
> ![[screenshots/real_burger.png]]

- **Головна:** `/{locale}/shop/burger` та `/{locale}/shop/racechip`
- **Каталог:** `/{locale}/shop/burger/products/[slug]`
- **Особливості:** Каталог на **7700+** конфігурацій. Найактивніша фільтрація по авто (Make/Model/Year).

---

## ❄️ 6. Глобальний Каталог Turn14
- **Каталог:** `/{locale}/shop/turn14`
- **Особливості:** Direct Integration. Клієнтська видача на льоту з бази на понад 700 000 товарів.

---

## 📁 Додаткові Роути (Готові Мікро-сайти)
- `/{locale}/shop/adro` (Карбоновий боді-кіт)
- `/{locale}/shop/brabus` (Mercedes)
- `/{locale}/shop/csf` (Охолодження)
- `/{locale}/shop/do88` (Радіатори)
- `/{locale}/shop/ipe` (Innotech Performance Exhaust)

---
← Повернутися на [[Home|Головну]]
