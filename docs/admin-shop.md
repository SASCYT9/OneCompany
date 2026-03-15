# Admin Shop (магазин в адмінці)

Функціонал магазину за аналогом Shopify: додавання товарів, редагування, імпорт через CSV. **Без Shopify** — дані зберігаються в нашій БД (Prisma + PostgreSQL).

## Міграція БД

Файл міграції вже створений: `prisma/migrations/20250315000000_add_shop_product/migration.sql`.

Коли в проєкті налаштовано `DATABASE_URL` (PostgreSQL), застосуй міграції:

```bash
npm run db:migrate
```

або:

```bash
npx prisma migrate deploy
```

У проєкті в `package.json` є скрипт `db:migrate`. У `.env.example` додано змінну `DATABASE_URL` — скопіюй її в `.env.local` і вкажи свій рядок підключення до PostgreSQL.

Після цього таблиця `ShopProduct` з’явиться в БД, і товари з адмінки будуть зберігатися та показуватися на сайті (сторінка товару та sitemap беруть дані з БД + статичний каталог).

## Адмінка

- **Список товарів:** `/admin/shop` (після логіну в адмінку)
- **Новий товар:** `/admin/shop/new`
- **Редагування:** `/admin/shop/[id]`
- **Імпорт CSV:** `/admin/shop/import`

У шапці адмінки з’явилась вкладка **Shop**.

## API (внутрішні, з cookie-авторизацією)

- `GET /api/admin/shop/products` — список товарів
- `POST /api/admin/shop/products` — створити товар
- `GET /api/admin/shop/products/[id]` — один товар
- `PATCH /api/admin/shop/products/[id]` — оновити
- `DELETE /api/admin/shop/products/[id]` — видалити
- `POST /api/admin/shop/import/csv` — імпорт CSV (body: `{ csv: string, action: 'dry-run' | 'commit' }`)

## CSV імпорт

1. **Dry run** — перевірка без змін у БД. Повертає кількість валідних рядків і помилки по рядках.
2. **Commit** — створення/оновлення товарів по `slug`. Якщо товар з таким `slug` вже є — оновлення, інакше — створення.

**Колонки CSV (перший рядок — заголовки):**

- `slug` * (унікальний)
- `title_en`, `title_ua` (або `title`)
- `scope` (auto | moto)
- `brand`, `category_en`, `category_ua`, `collection_en`, `collection_ua`
- `short_desc_en`, `short_desc_ua`
- `price_eur`, `price_usd`, `price_uah` (числа)
- `stock` (inStock | preOrder)
- `image` (URL або шлях)

Приклад:

```csv
slug,title_en,title_ua,scope,brand,category_en,price_eur,price_usd,price_uah,stock,image
my-product,My Product,Мій товар,auto,Brand,Category,100,110,4200,inStock,https://example.com/image.jpg
```

## Urban сторінка

Фото та відео на сторінці Urban вирівняні з референсною темою:

- 8 cinematic showcases з тими ж Vimeo ID та smgassets-зображеннями.
- Fleet cards: 8 карток (додано Bentley Continental GT та Audi RSQ8), зображення з тієї ж теми.

**Підключення до публічного каталогу:** сторінка товару `/[locale]/shop/[slug]` та sitemap використовують `getShopProductsServer` / `getShopProductBySlugServer` з `lib/shopCatalogServer.ts`: спочатку беруться опубліковані товари з БД, по slug додаються статичні товари з `shopCatalog.ts`. Товари, додані в адмінці, автоматично з’являються на сайті після застосування міграції та налаштування БД.
