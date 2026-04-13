# System Audit Report - 2026-04-13

## 1. Static Analysis
- **Linting (`npm run lint`):** All clear! Zero critical errors.
- **Prisma Schema (`npx prisma validate` & `npx prisma format`):** Schema is valid and correctly formatted.

## 2. Visual UI Audit (Browser Subagent)
A full traversal of `http://localhost:3001/ua/shop` was completed with the following findings:

### 🟢 Active & Stable
- **RaceChip**: ~4914 items
- **GiroDisc**: ~958 items
- **Akrapovič**: Каталог активний (був знайдений 1 тестовий товар, але на рівні бази він вже не ідентифікується за ключем `TEST`).

### 🔴 Broken Categories / Brands
1. **Milltek, EBC:** Сторінки `/shop/milltek` та `/shop/ebc` зависають у стані `Loading...`.
2. **AMS, MST:** Прямий доступ до їхніх сторінок видає 404.
   - **Причина (Dependency Trace):** Ці бренди визначені у `src/lib/brands.ts`, **АЛЕ** у них відсутня власна директорія в `src/app/[locale]/shop/` (на відміну від `racechip` чи `girodisc`). Через це Next.js сприймає шлях `/shop/milltek` як товар (відправляє на `[slug]/page.tsx`), не знаходить товар і викидає `notFound()` або зависає в UI через специфіку `ShopProductDetailPage`.
3. **ADRO:** Лендінг працює, але кнопка "Переглянути колекцію" веде на `/ua/shop/adro/collections` - **404 Error**. 
   - **Причина:** В директорії `src/app/[locale]/shop/adro/` є тільки `page.tsx`, немає підкаталогу `collections`.
4. **Eventuri, KW Suspension, FI Exhaust:** Посилання на головній сторінці ведуть на зовнішні сайти (наприклад, `.shop` домени), а не на локальні сторінки каталогу. Якщо це була задумка - працює коректно, але якщо користувач очікує єдиний каталог - це потребує змін.

### 🟡 Cart & Checkout
- Функціонал "Додавання в кошик" спрацював на RaceChip.
- **Проблема сторінки Кошика:** Під час тестування браузером сторінка `/ua/shop/cart` зависла на "Завантаження кошика...". Проте прямий запит до `/api/shop/cart` повертає статус 200 `{items: [], totalItems: 0}`. Імовірно, при наявності реального товару в сесії, десь на клієнті в `ShopCartClient.tsx` відбувається безкінечний цикл або помилка рендерингу ціни для деяких товарних об'єктів.

## 3. Conclusions & Next Steps
- **Проблема архітектури брендів:** Потрібно або створити директорії для `milltek`, `ebc`, `ams`, `mst` в `src/app/[locale]/shop/`, або переписати константи в `ShopPageClient.tsx` так, щоб ці кнопки вели на універсальний каталог типу `/shop?brand=milltek`.
- **ADRO 404:** Виправити лінк "Переглянути колекції" на `/ua/shop/adro` замість `/ua/shop/adro/collections`.
- **Кошик:** Детальніше до-відлагодити поведінку `<ShopCartClient>` у стані "має 1 товар усередині", перевіривши `getPrice` логіку.
