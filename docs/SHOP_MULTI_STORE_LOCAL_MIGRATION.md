# Shop Multi-Store: Local Migration Flow

Цей документ фіксує локальний порядок переходу на `ShopStore` + `storeKey` у shop-модулі.

## Що вже є в коді

- Таблиця `ShopStore`
- `storeKey` для:
  - `ShopProduct`
  - `ShopCollection`
  - `ShopCategory`
  - `ShopImportTemplate`
  - `ShopImportJob`
  - `ShopCart`
  - `ShopOrder`
- Store-scoped admin flow:
  - продукти
  - категорії
  - колекції
  - імпорт CSV
  - замовлення
  - клієнти
- Store-scoped storefront flow:
  - add to cart
  - cart
  - checkout
  - account
  - order success
- Admin page `/admin/shop/stores` для створення й редагування магазинів

## Локальний порядок запуску

1. Згенерувати Prisma client:

```powershell
npx prisma generate
```

2. Застосувати міграції до локальної БД:

```powershell
npx prisma migrate deploy
```

Для чисто локальної dev-бази також можна:

```powershell
npx prisma migrate dev
```

3. Переконатися, що дефолтний store існує:

- `urban` створюється міграцією
- додатково runtime викликає `ensureDefaultShopStores(...)`

4. Відкрити адмінку:

- `/admin/shop/stores`

5. Створити нові магазини, якщо потрібно:

- приклад `key`: `kw`
- приклад `key`: `fi`
- приклад `key`: `eventuri`

6. Імпортувати товари окремо в потрібний store:

- через `/admin/shop/import`
- або через admin API з `storeKey`

## Що відбувається з поточними даними

- Існуючі товари, колекції, категорії, кошики та замовлення отримують `storeKey = 'urban'`
- Це дозволяє не ламати поточний Urban storefront під час переходу

## Що ще лишається наступним етапом

- storefront routing для окремих не-Urban магазинів
- окремі store-specific theme/data sources
- store-specific settings, якщо знадобиться:
  - валюта
  - shipping
  - tax
  - payment options

## Перевірка

Базова типова перевірка:

```powershell
npx tsc --noEmit --incremental false
```

На поточному етапі вона проходить успішно.
