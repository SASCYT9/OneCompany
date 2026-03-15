# Urban Shop та портал магазинів — що робили і що планували

Документ фіксує контекст, виконану роботу та залишки по Urban і порталу «Наші магазини» на сайті One Company.

---

## 1. Що планували (цілі)

### 1.1 Загальний напрямок (з `docs/onecompany-shop-plan.md` та `AGENTS.md`)

- **Портал магазинів:** головна сторінка `/shop` — це «Наші магазини»: картки з посиланнями на існуючі магазини (Urban на нашому домені, KW, FI, Eventuri — зовнішні). Не Shopify-інтеграція, тільки навігація.
- **Urban на нашому домені:** один магазин (бренд Urban) живе в складі нашого сайту (Next.js). Дизайн і структура — з референсної Shopify-теми Urban (`reference/urban-shopify-theme/`). Бекенд — наш (каталог, кошик, checkout за планом One Company SHOP).
- **Референс теми:** використовувати Liquid-тему з `reference/urban-shopify-theme/` для повторення layout, секцій, стилів, даних (index.json, collection.*.json тощо).

### 1.2 Конкретні вимоги з розмов

- Додати **реальні магазини** у «Наші магазини»: Urban (наш сайт), KW Suspension, FI Exhaust, Eventuri — дані/посилання з загальних брендів.
- Сторінка магазину в стилі **One Company**, не в стилі окремого бренду (Urban — виняток, у нього своя тема).
- **Urban:** усі кнопки мають працювати; хедер на Urban — лого → головна Urban, замість Авто/Мото — «Колекції» та «Усі магазини»; кошик тільки в контексті Urban; кошик оформити «нормально», як у магазині.
- **Колекції:** не вигадувати нове — використовувати **готову реалізацію з теми** (Liquid). Тобто переносити тему з Liquid на наш сайт, а не будувати окремі React-сторінки з нуля.
- **Продовжити перенос теми з Liquid на наш сайт** — повністю: домашня, список колекцій, сторінка колекції (наприклад Defender 110 з пакетами), далі продукт/кошик за планом.

### 1.3 План One Company SHOP (AGENTS.md) — щодо Urban

- Phase A: Security Foundation (ролі, RBAC, аудит) — перед e-commerce.
- Phase B: Catalog + Pricing + Inventory (товари, варіанти, категорії, ціни, склад).
- Phase C: Storefront + Cart + Checkout (сторінки shop list, product, cart, checkout, order confirmation).
- Phase D: Admin Order Operations (замовлення, статуси, tax/shipping, B2B).
- Phase E: CSV Import Center.
- Phase F: SEO + Launch Hardening.

Urban storefront (сторінки, колекції, товари) — частина Phase C; бекенд (каталог, кошик, checkout) — за цим же планом.

---

## 2. Що робили (хронологія робіт)

### 2.1 Портал «Наші магазини»

- **Дані:** `src/app/[locale]/shop/data/ourStores.ts` — список магазинів: Urban (внутрішнє посилання на наш сайт), KW, FI, Eventuri (зовнішні посилання), з описом EN/UA та логотипами.
- **Сторінка /shop:** `src/app/[locale]/shop/page.tsx` — рендер лише `OurStoresPortal` (картки «Наші магазини»). Без `ShopPageClient`, без каталогу «Обери бренд».
- **Компонент:** `OurStoresPortal.tsx` — сітка карток у стилі One Company (світлий фон), посилання на Urban (`/shop/urban`) та на зовнішні сайти.

### 2.2 Urban — окрема тема та навігація

- **Layout Urban:** `src/app/[locale]/shop/urban/layout.tsx` — підключені стилі Urban (`urban-shop.css`, `uh7-theme.css`, `urban-collections.css`), обгортка `urban-shop-page`. Тільки для шляхів під `/shop/urban`.
- **Головна Urban:** `src/app/[locale]/shop/urban/page.tsx` — рендер `UrbanHomeSignature` (hero, trust, fleet, Defender-блок).
- **Хедер:** `src/components/layout/Header.tsx` — якщо path містить `/shop/urban` або `/shop/cart`: режим Urban — лого веде на `/[locale]/shop/urban`, пункти «Колекції» та «Усі магазини», іконка кошика (тільки в контексті Urban). «Колекції» спочатку вели на якір `#UrbanHomeV7-fleet`, потім змінено на сторінку **`/[locale]/shop/urban/collections`**.
- **Кошик:** `src/app/[locale]/shop/cart/page.tsx` — окрема сторінка кошика (темний блок, заголовок «Кошик», посилання назад на Urban і колекції). Логіка кошика (додавання з каталогу) — окремо, за Phase C.

### 2.3 Urban Home — hero, fleet, Defender

- **Дані:** `src/app/[locale]/shop/data/urbanHomeData.ts` — hero (eyebrow, title, subtitle, кнопки, heroImageUrl), масив `URBAN_FEATURED_MODELS` (6 моделей: Cullinan, Defender, G-Wagon, Urus, Ghost, Range Rover) з посиланнями, підписами, зображеннями (URL з smgassets).
- **Компонент:** `UrbanHomeSignature.tsx` — loader, hero з рамкою/частинками, trust-стрічка, заголовок секції флоту, сітка **fleet cards** (6 карток з посиланнями на колекції), блок Defender (велике фото, Widetrack, кнопка «Дослідити Defender»).
- **Посилання з головної:** усі ведуть на **наш сайт**: кнопка «Переглянути модельний ряд Urban» → `/[locale]/shop/urban/collections`; кожна fleet-картка → `/[locale]/shop/urban/collections/[handle]`; «Дослідити Defender» → `/[locale]/shop/urban/collections/land-rover-defender-110`.
- **Стилі/скрипти:** `uh7-theme.css`, `UrbanThemeScript.tsx` (loader, progress, reveal, tilt тощо). Для зображень fleet додано `referrerPolicy="no-referrer"` для коректного завантаження з CDN.

### 2.4 Перенос теми з Liquid — список колекцій

- **Дані з теми:** з `reference/urban-shopify-theme/templates/list-collections.json` — 27 карток колекцій (title, brand, collection_handle, external_image_url).
- **Файл даних:** `src/app/[locale]/shop/data/urbanCollectionsList.ts` — `URBAN_COLLECTION_CARDS`, `URBAN_COLLECTIONS_GRID_SETTINGS`, `URBAN_COLLECTION_BRANDS` для фільтрів.
- **Сторінка:** `src/app/[locale]/shop/urban/collections/page.tsx` — список колекцій Urban. Рендер `UrbanCollectionsGrid` + посилання «назад» на Urban.
- **Компонент:** `UrbanCollectionsGrid.tsx` — hero-банер з логотипом і підзаголовком, фільтри по брендах (All, Land Rover, Lamborghini, …), сітка карток. Кожна картка веде на `/[locale]/shop/urban/collections/[handle]`.
- **Стилі:** `src/styles/urban-collections.css` — класи `.ucg`, сітка, картки, фільтри (відповідно до теми section-urban-collections-grid).

### 2.5 Перенос теми — сторінка колекції (наприклад Defender 110)

- **Дані з теми:** з `reference/urban-shopify-theme/templates/collection.land-rover-defender-110.json` — порядок секцій: hero, overview, gallery, video, banner stack, blueprint kit, product grid.
- **Файл даних:** `src/app/[locale]/shop/data/urbanCollectionPages.ts` — типи конфігу (hero, overview, gallery, video, banner, blueprint), функція `getUrbanCollectionPageConfig(handle)`. Повний конфіг реалізовано для **land-rover-defender-110** (hero, overview з highlights, галерея з 20 слайдами, video pointer, banner stack, blueprint kit з 4 пакетами Front/Side/Wheel/Rear).
- **Сторінка:** `src/app/[locale]/shop/urban/collections/[handle]/page.tsx` — динамічна сторінка колекції. Якщо є конфіг (Defender 110) — рендер усіх секцій; інакше — заглушка «Сторінка колекції готується» з посиланням на список колекцій. В кінці — блок «Товари колекції» (заглушка під майбутній каталог).
- **Компоненти секцій:** `UrbanCollectionSections.tsx` — `UrbanCinematicHero`, `UrbanModelOverview`, `UrbanGalleryCarousel`, `UrbanVideoPointer`, `UrbanBannerStack`, `UrbanBlueprintKit`. Локалізація EN/UA, посилання (contact, колекції) ведуть на наш сайт (`/[locale]/#contact`, `/[locale]/shop/urban/collections/...`).
- **Стилі:** у `urban-collections.css` додано стилі для hero, overview, gallery, video, banner stack, blueprint (відповідно до Liquid-секцій теми).

### 2.6 Виправлення після зворотного зв’язку

- **Кнопка «Колекції» не працювала:** у Header посилання «Колекції» змінено з якоря `#UrbanHomeV7-fleet` на сторінку **`/shop/urban/collections`**.
- **Частина фото не завантажувалась:** для зображень у fleet-картках додано **`referrerPolicy="no-referrer"`** (CDN smgassets може блокувати за referrer).
- **404 на rolls-royce-ghost-series-i:** у даних коректний handle — **rolls-royce-ghost-series-ii** (дві «i»). Якщо відкривали URL з однією «i» — це помилковий/застарілий URL.

### 2.7 Merge conflicts

- У `src/app/[locale]/shop/page.tsx` — об’єднано коментарі (тільки «Наші магазини», без ShopPageClient/каталогу).
- У `docs/urban-shop-results.md` — збережено повну документацію з вхідного варіанту (опис структури Urban, кнопок, файлів).

---

## 3. Поточний стан (що є зараз)

| Що | Стан |
|----|------|
| Сторінка `/shop` | Тільки «Наші магазини» (OurStoresPortal). |
| Дані ourStores | Urban, KW, FI, Eventuri з посиланнями та логотипами. |
| Urban головна `/shop/urban` | Hero, trust, fleet (6 карток), Defender-блок. Усі посилання на наш сайт (колекції). |
| Хедер на Urban | Лого → Urban, «Колекції» → `/shop/urban/collections`, «Усі магазини» → `/shop`, кошик. |
| Сторінка колекцій `/shop/urban/collections` | Сітка 27 колекцій, фільтри по брендах, посилання на `/[handle]`. |
| Сторінка колекції Defender 110 | Hero, overview, gallery, video, banners, blueprint kit (4 пакети), заглушка «Товари колекції». |
| Інші колекції (Urus, Cullinan тощо) | Одна сторінка з заглушкою «Сторінка колекції готується». Конфіги можна додати за типом Defender 110. |
| Кошик `/shop/cart` | Сторінка є; логіка додавання з каталогу — окремо. |
| Референс теми | Використано: index.json, list-collections.json, collection.land-rover-defender-110.json, секції (collections grid, cinematic hero, model overview, gallery, video, banner stack, blueprint kit). |

---

## 4. Що планували і ще не зроблено (відповідно до плану)

### 4.1 Тема Urban (перенос з Liquid)

- **Що зроблено:** головна Urban, список колекцій, повна сторінка колекції для Defender 110 (hero, overview, gallery, video, banners, blueprint). Посилання та навігація на нашому сайті.
- **Що залишилось (опційно):**  
  - Додати конфіги з теми для інших колекцій (Urus, Cullinan, G-Wagon тощо) за типом Defender 110, якщо потрібні повноцінні landing-и.  
  - Секція product grid на сторінці колекції зараз — заглушка; підключити реальний каталог (Phase B/C).

### 4.2 One Company SHOP (бекенд і повноцінний магазин)

- **Phase A (Security):** ролі/дозволи, RBAC для admin, аудит, rate limit — не реалізовано в межах цієї роботи.
- **Phase B (Catalog):** CRUD товарів, варіантів, категорій, ціни, склад — каталог для Urban ще не підключено до storefront.
- **Phase C (Storefront):** сторінки product, кошик з додаванням з каталогу, checkout, order confirmation — частково: сторінки Urban/колекції є, кошик як сторінка є; продуктів з бекенду і повного checkout flow ще немає.
- **Phase D–F:** адмін замовлень, tax/shipping, CSV-імпорт, SEO — не входило в поточний обсяг.

### 4.3 Документація та довідка

- **Оновлення `docs/urban-shop-results.md`:** зараз там опис з якорями (Showcases, Fleet). Має сенс оновити під поточний стан: кнопки ведуть на `/shop/urban/collections` та на сторінки колекцій, додати посилання на `urban-collections`, `urbanCollectionPages`, `UrbanCollectionsGrid`, `UrbanCollectionSections`.

---

## 5. Ключові файли (довідка)

| Призначення | Шлях |
|-------------|------|
| Портал /shop | `src/app/[locale]/shop/page.tsx`, `OurStoresPortal.tsx`, `ourStores.ts` |
| Urban головна | `src/app/[locale]/shop/urban/page.tsx`, `UrbanHomeSignature.tsx`, `urbanHomeData.ts` |
| Urban layout/стилі | `shop/urban/layout.tsx`, `urban-shop.css`, `uh7-theme.css`, `urban-collections.css` |
| Список колекцій | `shop/urban/collections/page.tsx`, `UrbanCollectionsGrid.tsx`, `urbanCollectionsList.ts` |
| Сторінка колекції | `shop/urban/collections/[handle]/page.tsx`, `UrbanCollectionSections.tsx`, `urbanCollectionPages.ts` |
| Хедер (Urban режим) | `src/components/layout/Header.tsx` |
| Кошик | `src/app/[locale]/shop/cart/page.tsx` |
| План магазину | `AGENTS.md`, `docs/onecompany-shop-plan.md` |
| Референс теми | `reference/urban-shopify-theme/` |

---

*Документ оновлено за підсумками робіт з Urban та порталом магазинів.*
