# Urban Home — результати імпорту теми

**Urban — власний магазин на нашому сайті (Next.js + наш бекенд). Без Shopify.**

## Чеклист ✓

- [x] Loader (One Company x Urban)
- [x] Hero з анімаціями (frame, corners, particles, shutter, split title)
- [x] Trust ribbon (4 пункти)
- [x] 8 cinematic showcases з фото + Vimeo (lazy)
- [x] Fleet cards (6 карток, 3D tilt)
- [x] Defender section (Widetrack)
- [x] Усі кнопки ведуть на якорі або зовнішні посилання
- [x] UA/EN локалізація
- [x] Sitemap: `/shop`, `/shop/urban`
- [x] Портал `/shop` → картка Urban веде на `/shop/urban`

## Як переглянути

- **Портал магазинів:** `http://localhost:3001/ua/shop` або `/en/shop`
- **Сторінка Urban:** `http://localhost:3001/ua/shop/urban` або `http://localhost:3001/en/shop/urban`

Запуск: `npm run dev` (порт 3000 або 3001, якщо 3000 зайнятий).

---

## Структура сторінки Urban (повна копія теми, без header/footer)

| # | Блок | Опис |
|---|------|------|
| 0 | **Back to stores** | Посилання «← Усі наші магазини» на `/shop` |
| 1 | **Scroll progress** | Тонка смуга прогресу скролу зверху |
| 2 | **Loader** | Екран завантаження (One Company x Urban), зникає через ~2.4 с або по кліку |
| 3 | **Hero** | Повноекранний hero: фон, letterbox, shutter, frame, corners, particles, бренди, заголовок з shimmer, підзаголовок, дві кнопки |
| 4 | **Trust ribbon** | 4 пункти: офіційний постачальник, доставка по світу, ручна робота в Англії, онлайн-магазин |
| 5 | **8 Showcases (uh7-sc)** | Cullinan Series II, Defender Widetrack, G-Wagon W465, Urus, RS6 Avant, RSQ8 Urban Edition, Range Rover L460, Bentley Continental GT. Кожен: фото, Vimeo (lazy), badge, назва, опис, Explore + Shop Programme, availability |
| 6 | **Fleet cards** | 6 карток з 3D tilt: Cullinan, Defender, G-Wagon, Urus, Ghost, Range Rover L460 |
| 7 | **Defender section (uh7-def)** | Великий блок Defender Widetrack: зображення, лого Widetrack, заголовок, опис, 3 фічі, CTA, 4 стати |

Gallery, CTA, Partners, Ticker у темі позначені як «removed by request» — не додавались.

---

## Кнопки (усі працюють)

- **Hero «Explore Urban Range»** → скрол до блоків showcase (`#UrbanHomeV7-showcases`)
- **Hero «About One Company»** → зовнішнє посилання на onecompany.global
- **У кожному showcase:** «Explore» і «Shop Programme» → скрол до fleet (`#UrbanHomeV7-fleet`)
- **Fleet cards** → скрол до fleet (той самий блок)
- **Defender «Explore Defenders»** → скрол до fleet

Пізніше посилання замінимо на власні колекції/каталог (наш бекенд, без Shopify).

---

## Файли

- `src/app/[locale]/shop/urban/page.tsx` — сторінка Urban
- `src/app/[locale]/shop/components/UrbanHomeSignature.tsx` — розмітка всіх блоків
- `src/app/[locale]/shop/components/UrbanThemeScript.tsx` — loader, progress, split title, reveal, tilt, parallax, **Vimeo lazy-load**
- `src/app/[locale]/shop/data/urbanHomeData.ts` — hero + fleet models
- `src/app/[locale]/shop/data/urbanShowcasesData.ts` — 8 showcase-блоків (en/ua)
- `src/styles/uh7-theme.css` — стилі теми Urban v7
- `src/styles/urban-shop.css` — додаткові стилі (back link тощо)

---

## Мови

- **UA:** `/ua/shop/urban`
- **EN:** `/en/shop/urban`

Тексти hero, trust, showcases, fleet, Defender — у двох мовах.
