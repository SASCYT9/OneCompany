> Service note: This file is a full copy of the master One Company SHOP implementation plan.

## One Company SHOP: Shopify-Style План Реалізації (MVP -> Pro)

### 1. Summary
- Реалізувати `One Company SHOP` як власний модуль у поточному стеку `Next.js + Prisma + PostgreSQL`, без винесення в окремий Shopify.
- Запускати фазами: спочатку стабільний `MVP` продажів, потім `Pro`-можливості.
- Підтримка одразу `B2B + B2C`, `guest + account checkout`, мультивалюта, регіональні податки, worldwide доставка.
- На MVP оплата без онлайн-еквайрингу: checkout створює замовлення, далі менеджер обробляє.
- Адмінку посилити одразу: ролі/права, аудит, безпечні сесії.

### 2. Ключові Зміни (Інтерфейси, Дані, API)
- Додати e-commerce домен в БД:
  - `AdminUser`, `Role`, `Permission`, `AdminUserRole`, `AuditLog`.
  - `Customer`, `CustomerAccount`, `CustomerGroup(B2B/B2C)`, `Address`.
  - `Category`, `Collection`, `Product`, `ProductTranslation(ua/en)`, `ProductMedia`.
  - `ProductVariant`, `VariantPrice` (валюта + ціна), `InventoryLevel`, `StockMovement`.
  - `Bundle`, `BundleItem` (bundle як окремий товар з компонентами).
  - `Cart`, `CartItem`.
  - `Order`, `OrderItem`, `OrderStatusEvent`, `Shipment`.
  - `TaxRegionRule`, `ShippingZone`, `ShippingRate`, `CurrencyRate`.
  - `ImportTemplate`, `ImportJob`, `ImportRowError`.
- Зафіксувати enum-статуси:
  - `OrderStatus`: `DRAFT`, `PENDING_REVIEW`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`.
  - `CustomerGroup`: `B2C`, `B2B_PENDING`, `B2B_APPROVED`.
- Зафіксувати правила B2B:
  - Глобальна настройка `b2bVisibilityMode` в адмінці з режимами `approved_only`, `public_dual`, `request_quote`.
  - Default: `approved_only`, але змінюється з адмінки без релізу.
- Валюти:
  - Підтримка `UAH`, `EUR`, `USD`.
  - На замовленні завжди фіксується snapshot курсу/податку/доставки на момент checkout.
- CSV та ручний ввід:
  - Обов’язково підтримати обидва сценарії: ручне створення товарів і CSV-імпорт.
  - CSV-імпорт через мапінг колонок + dry-run + commit + журнал помилок.
- Публічні API:
  - `GET /api/shop/products`, `GET /api/shop/products/[slug]`, `GET /api/shop/categories`.
  - `POST /api/shop/cart/items`, `PATCH /api/shop/cart/items/[itemId]`, `DELETE /api/shop/cart/items/[itemId]`.
  - `POST /api/shop/checkout`.
  - `GET /api/shop/orders/[orderNumber]` (гостьовий перегляд по токену).
- Admin API:
  - `CRUD /api/admin/shop/products`, `CRUD /api/admin/shop/variants`, `CRUD /api/admin/shop/bundles`.
  - `CRUD /api/admin/shop/categories`, `CRUD /api/admin/shop/pricing`, `CRUD /api/admin/shop/inventory`.
  - `POST /api/admin/shop/imports/csv/dry-run`, `POST /api/admin/shop/imports/csv/commit`, `GET /api/admin/shop/imports/[id]`.
  - `GET/PATCH /api/admin/shop/orders`, `PATCH /api/admin/shop/orders/[id]/status`.
  - `GET/PATCH /api/admin/shop/settings` (B2B visibility, tax, shipping, currency rates).

### 3. План По Фазах
1. **Phase A: Security Foundation (обов’язково перед ecommerce)**
- Перевести адмін-доступ на повноцінні ролі/дозволи для ecommerce-операцій.
- Ввести RBAC-перевірки на всі admin write-endpoints.
- Додати аудит дій: хто, що, коли змінив (товар, ціна, статус замовлення, імпорт).
- Додати rate limit на admin auth та критичні API.

2. **Phase B: Catalog + Pricing + Inventory Core**
- Реалізувати CRUD для товарів, варіантів, бандлів, категорій, медіа.
- Реалізувати мультивалютні ціни та окремі price rules для B2B/B2C.
- Реалізувати складський облік по SKU.
- Для бандлів: на MVP доступний залишок = мінімум доступних компонентів.

3. **Phase C: Storefront + Cart + Checkout**
- Нові сторінки: `shop list`, `product`, `cart`, `checkout`, `order confirmation`.
- Guest cart в cookie/session + customer cart в БД (злиття при логіні).
- Checkout: контактні дані, адреса, спосіб доставки, tax-регіон, підтвердження.
- Створення замовлення зі статусом `PENDING_REVIEW`.
- Email підтвердження замовлення клієнту + сповіщення в адмінку (email/telegram).

4. **Phase D: Admin Order Operations**
- Таблиця замовлень з фільтрами, пошуком, таймлайном статусів.
- Ручна зміна статусів із валідацією переходів.
- Панель tax/shipping правил:
  - регіональні tax правила.
  - worldwide shipping zones + manual rates.
- Налаштування B2B режиму видимості з миттєвим застосуванням.

5. **Phase E: CSV Import Center**
- Wizard:
  - завантаження CSV.
  - мапінг колонок на canonical поля.
  - dry-run валідація.
  - commit імпорту.
  - звіт по помилках рядків.
- Підтримка шаблонів мапінгу по постачальнику.
- Поведінка on conflict:
  - ключ SKU.
  - режими `skip`, `update`, `create`.

6. **Phase F: SEO + Launch Hardening**
- Додати shop-сторінки в sitemap.
- Product metadata + structured data.
- Подієва аналітика: view product, add to cart, begin checkout, order placed.
- Перед релізом: дані seed, smoke-тести, доступи ролей, backup/rollback міграцій.

**Phase F — поточний стан:** Sitemap включає `/shop`, `/shop/urban`, колекції та сторінки товарів. Сторінки товарів: `generateMetadata` через `getShopProductPageMetadata` (title, description, og/twitter, image), JSON-LD `Product` (name, description, image, brand, offers, sku, priceValidUntil). Аналітика: `shop_view_product`, `shop_add_to_cart`, `shop_view_cart`, `shop_begin_checkout`, `shop_order_placed` викликаються з відповідних компонентів; Plausible/GA4 отримують custom events, Meta Pixel — стандартні (ViewContent, AddToCart, InitiateCheckout, Purchase). **Google Merchant Center:** XML-фід товарів доступний за GET `/api/shop/feed/products` (query: `locale`, `currency`); інструкція — `docs/SHOP_GOOGLE_MERCHANT_CENTER.md`.

### 4. Test Plan (обов’язкові сценарії)
- Unit:
  - калькуляція ціни (валюти/B2B/B2C).
  - tax engine по регіонах.
  - shipping calculator по zones/rates.
  - валідація bundle stock.
- Integration:
  - cart lifecycle (add/update/remove).
  - checkout -> order creation -> notifications.
  - status transitions замовлень.
  - CSV dry-run/commit та обробка помилок.
  - RBAC доступ/заборона на admin endpoints.
- E2E:
  - B2C guest checkout end-to-end.
  - customer login + повторне замовлення.
  - B2B approved user бачить свої ціни.
  - admin імпортує CSV, публікує товар, проводить замовлення до `SHIPPED`.
- Acceptance Criteria:
  - товар з варіантами та бандл коректно купується.
  - всі суми в checkout збігаються з order snapshot.
  - імпорт 5k+ рядків проходить без падіння, з повним error report.
  - неавторизований доступ до admin shop API неможливий.
  - підтвердження замовлення відправляється клієнту автоматично.

### 5. Assumptions And Defaults
- MVP без онлайн-еквайрингу (тільки створення замовлення + ручна обробка).
- Документи MVP: підтвердження замовлення (без автоматичного PDF інвойсу).
- B2B режим за замовчуванням `approved_only`, але налаштовується з адмінки.
- Мови storefront: `ua` та `en`.
- Валюти: `UAH`, `EUR`, `USD`.
- Доставка: worldwide через shipping zones + manual rates.
- Податки: регіональні tax rules в адмінці.
- CSV + ручний ввід — обидва обов’язкові в першому релізі.
