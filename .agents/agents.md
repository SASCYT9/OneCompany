# OneCompany — Agent Role Definitions

> **Purpose:** This file defines specialized sub-agent roles for every major domain
> of the OneCompany platform. When working on a task, select the appropriate agent
> role and follow its scope, rules, and file boundaries.

---

## 🏗️ Architecture Overview

```
OneCompany Platform
├── Landing (3D experience, brands, categories)
├── Shop
│   ├── Urban Automotive (premium body kits)
│   ├── Brabus (tuning for Mercedes)
│   ├── DO88 (Swedish cooling systems)
│   └── General Catalog (Akrapovic, KW, Eventuri, etc.)
├── Admin Panel (CRM, Orders, Inventory, Settings)
├── Payment Gateways (Hutko UA, Stripe)
├── Turn14 Integration (US wholesale auto parts)
├── Telegram Bot (notifications, admin alerts)
├── SEO & i18n (UA/EN localization, sitemap, meta)
└── Database (Prisma + PostgreSQL)
```

---

## 1. 🎨 AGENT: Storefront Designer

**Scope:** Visual design, CSS, animations, and layout of all customer-facing shop pages.

**Responsibilities:**
- Hero sections, product grids, collection pages
- Dark-mode "Stealth Wealth" aesthetics (Brabus), glassmorphism (DO88), premium minimal (Urban)
- Responsive design (mobile-first), micro-animations, hover effects
- Ken Burns, fade-in-up, radial glows, gradient overlays

**Key Files:**
- `src/app/[locale]/shop/components/BrabusTechHUD.tsx`
- `src/app/[locale]/shop/components/BrabusVehicleFilter.tsx`
- `src/app/[locale]/shop/components/BrabusCollectionProductGrid.tsx`
- `src/app/[locale]/shop/components/UrbanCollectionProductGrid.tsx`
- `src/app/[locale]/shop/components/Do88CollectionsGrid.tsx`
- `src/app/[locale]/shop/components/Do88FeaturedModels.tsx`
- `src/app/[locale]/shop/components/ShopProductDetailPage.tsx`
- `src/app/[locale]/shop/do88/do88-shop.css`
- `src/styles/urban-shop.css`
- `src/styles/urban-collections.css`
- `src/styles/uh7-theme.css`

**Rules:**
- Always use the design language of the specific brand (Brabus = dark + red, DO88 = b&w glass, Urban = stealth dark)
- Never mix Tailwind utility classes with vanilla CSS in the same component without reason
- All images must use Next.js `<Image>` with proper `sizes` attribute
- Test at 1440px, 768px, and 375px breakpoints

---

## 2. 💰 AGENT: Pricing & Currency Engineer

**Scope:** All price display, currency conversion, B2B/B2C pricing logic, and exchange rates.

**Responsibilities:**
- `computePricesFromUah()` functions across all grid components
- NBU exchange rate fetching and caching
- B2B discount calculations, compare-at pricing
- Multi-currency display (UAH / EUR / USD)

**Key Files:**
- `src/components/shop/CurrencyContext.tsx` — rates provider (NBU API)
- `src/components/shop/ShopPrimaryPriceBox.tsx` — product detail price display
- `src/lib/shopPricingAudience.ts` — B2B/B2C band resolution
- `src/lib/shopCurrencyNbu.ts` — server-side NBU rates
- `src/lib/shopMoneyFormat.ts` — formatting helpers
- All `computePricesFromUah()` in: `ShopPageClient.tsx`, `BrabusVehicleFilter.tsx`, `BrabusCollectionProductGrid.tsx`, `UrbanCollectionProductGrid.tsx`

**Rules:**
- `rates.EUR = 1` (base), `rates.UAH = NBU EUR rate (~45-50)`, `rates.USD = EUR/USD ratio`
- When converting EUR→UAH, ALWAYS multiply by `rates.UAH`, NOT `rates.EUR`
- When converting UAH→EUR, ALWAYS divide by `rates.UAH`
- Round displayed prices to whole numbers with `Math.round()`
- EUR-origin products have `price.uah === 0`; USD-origin (Turn14) have `price.eur === 0 && price.uah === 0`

---

## 3. 🛒 AGENT: Cart & Checkout Engineer

**Scope:** Shopping cart, checkout flow, order creation, payment processing.

**Responsibilities:**
- Add/remove/update cart items
- Checkout form (shipping, billing)
- Payment method selection (Hutko for UA, Stripe for international)
- Order creation and confirmation
- Post-payment emails and Telegram notifications

**Key Files:**
- `src/app/[locale]/shop/cart/ShopCartClient.tsx`
- `src/app/[locale]/shop/checkout/ShopCheckoutClient.tsx`
- `src/app/[locale]/shop/checkout/success/ShopOrderSuccessClient.tsx`
- `src/lib/shopCart.ts` — cart CRUD logic
- `src/lib/shopCheckout.ts` — order creation
- `src/lib/shopHutko.ts` — Hutko payment gateway
- `src/lib/shopStripe.ts` — Stripe integration
- `src/lib/shippingCalc.ts` — shipping cost calculation
- `src/app/api/shop/cart/` — cart API routes
- `src/app/api/shop/checkout/` — checkout API routes
- `src/app/api/shop/hutko/callback/route.ts` — payment callback
- `src/app/api/shop/stripe/` — Stripe webhook
- `src/components/emails/OrderConfirmationEmail.tsx`

**Rules:**
- Hutko is UA-only (UAH currency); Stripe handles EUR/USD
- Always verify Hutko signature before processing callbacks
- Send confirmation email AND Telegram notification on successful payment
- Cart uses session cookies, not localStorage

---

## 4. 📦 AGENT: Catalog & Product Data Manager

**Scope:** Product CRUD, catalog structure, collections, categories, bundles.

**Responsibilities:**
- Creating/editing products in admin
- Collection matching (which products belong to which collection)
- Product import (CSV, API)
- Static catalog fallback (`SHOP_PRODUCTS` array)
- Bundle inventory resolution

**Key Files:**
- `src/lib/shopCatalog.ts` — static product definitions + types
- `src/lib/shopCatalogServer.ts` — DB-backed product fetching
- `src/lib/shopAdminCatalog.ts` — admin CRUD operations
- `src/lib/shopAdminCollections.ts` — collection management
- `src/lib/shopAdminCategories.ts` — category tree
- `src/lib/shopAdminCsv.ts` — CSV import parsing
- `src/lib/shopAdminImports.ts` — import pipeline
- `src/lib/shopBundles.ts` — bundle inventory
- `src/lib/urbanCollectionMatcher.ts` — Urban collection → product mapping
- `src/lib/brabusCollectionMatcher.ts` — Brabus collection → product mapping
- `src/lib/do88CollectionMatcher.ts` — DO88 collection → product mapping
- `src/app/[locale]/shop/data/` — collection cards, home data, showcase data per brand
- `prisma/schema.prisma` — ShopProduct, ShopCollection, ShopCategory models

**Rules:**
- DB products override static catalog (by slug)
- Only `isPublished: true` products appear on frontend
- Brand field determines storefront routing (Urban vs Brabus vs DO88)
- Tags array used for collection filtering (e.g., `tags.includes('g-class-tuning')`)

---

## 5. 🔄 AGENT: Turn14 Integration Specialist

**Scope:** Turn14 wholesale API, product sync, pricing markup, B2B ordering.

**Responsibilities:**
- Fetching items by brand from Turn14 API
- Syncing to local `Turn14Item` table
- Applying brand-level markups (`Turn14BrandMarkup`)
- Fitment data management
- Volume data (weight, dimensions) for shipping
- Placing Turn14 purchase orders

**Key Files:**
- `src/lib/turn14.ts` — API client (auth, fetch items)
- `src/lib/turn14Sync.ts` — sync orchestration
- `src/lib/turn14Pricing.ts` — markup calculation
- `src/app/api/admin/turn14-sync/route.ts` — sync cron endpoint
- `src/app/api/shop/turn14/fitment/route.ts` — fitment lookup
- `src/app/api/shop/turn14/order/route.ts` — order placement
- `src/app/admin/shop/turn14/` — admin UI pages
- `src/app/admin/shop/turn14/markups/page.tsx` — brand markup editor

**Rules:**
- Turn14 prices are in USD; must convert to EUR/UAH using exchange rates
- Sync runs page-by-page (50 items/chunk) to avoid memory overload
- Brand markup is applied on top of wholesale price
- `maxDuration = 300` for sync endpoints (Vercel Pro limit)

---

## 6. 🖥️ AGENT: Admin Panel Developer

**Scope:** All admin UI pages and backend logic.

**Responsibilities:**
- Admin dashboard, navigation, and layout
- CRM (customers, orders management)
- Inventory/stock management
- Shop settings (currencies, shipping zones, taxes)
- User/role management
- Audit logging
- Blog editor

**Key Files:**
- `src/app/admin/page.tsx` — dashboard
- `src/app/admin/layout.tsx` — admin shell & navigation
- `src/app/admin/shop/page.tsx` — product catalog manager
- `src/app/admin/shop/orders/` — order management
- `src/app/admin/shop/inventory/page.tsx`
- `src/app/admin/shop/settings/page.tsx`
- `src/app/admin/crm/` — CRM pages
- `src/app/admin/blog/page.tsx`
- `src/app/admin/users/` — user management
- `src/lib/shopAdminOrders.ts`
- `src/lib/shopAdminCustomers.ts`
- `src/lib/crmSync.ts`
- `src/lib/adminAuth.ts` — admin authentication
- `src/lib/adminRbac.ts` — role-based access control

**Rules:**
- All admin routes require authentication (`adminAuth.ts`)
- UI language is Ukrainian (admin is internal)
- Use `fetch('/api/admin/...')` for all data operations
- Dark theme throughout (`bg-zinc-950`, `text-white`)

---

## 7. 🌍 AGENT: SEO & Localization Engineer

**Scope:** Internationalization (UA/EN), metadata, sitemap, translations.

**Responsibilities:**
- UA ↔ EN translations for all shop content
- Meta titles, descriptions, Open Graph tags
- Sitemap generation
- `hreflang` and canonical URLs
- Product title/description localization

**Key Files:**
- `src/lib/seo.ts` — metadata builder, locale resolver
- `src/lib/seoIndexPolicy.ts` — which pages to index
- `src/lib/translations.ts` — UI string translations
- `src/lib/shopText.ts` — product text localization helpers
- `src/app/sitemap.ts` — dynamic sitemap
- `src/app/robots.ts` — robots.txt
- `src/app/[locale]/metadata.ts` — per-locale metadata
- `src/lib/messages/` — translation message files

**Rules:**
- UA locale = `'ua'`, EN locale = `'en'`
- Default locale is `'ua'`
- Product titles stored as `{ ua: string, en: string }`
- Use `localizeShopProductTitle(locale, product)` for display
- All pages must have unique `<title>` and `<meta description>`

---

## 8. 🤖 AGENT: Telegram Bot Developer

**Scope:** Telegram bot functionality, notifications, and admin alerts.

**Responsibilities:**
- Order notifications to admin Telegram
- Customer notification flows
- Bot polling and webhook modes
- Grammy.js framework management

**Key Files:**
- `src/lib/bot/` — bot modules
- `src/lib/telegram.ts` — Telegram API helpers
- `src/lib/telegram-auth.ts` — Telegram login widget auth
- `src/lib/telegramNotifications.ts` — notification dispatchers
- `src/app/api/telegram/` — webhook endpoint
- `scripts/telegram-bot-polling.js` — dev polling mode

**Rules:**
- Use Grammy.js for bot framework
- Notifications are fire-and-forget (don't fail orders on Telegram errors)
- Admin chat ID from env: `TELEGRAM_ADMIN_CHAT_ID`
- Format messages with Markdown/HTML parse mode

---

## 9. 🗄️ AGENT: Database & Schema Engineer

**Scope:** Prisma schema, migrations, database queries, and data integrity.

**Responsibilities:**
- Schema design and evolution
- Writing and running migrations
- Complex queries and performance optimization
- Seed scripts
- Data integrity checks

**Key Files:**
- `prisma/schema.prisma` — the single source of truth
- `prisma/migrations/` — migration history
- `src/lib/prisma.ts` — Prisma client singleton
- `seed.js` — database seeding

**Rules:**
- Always use `prisma migrate dev --name descriptive-name`
- Never modify production DB directly; use migrations
- Use `upsert` for idempotent operations
- Include `@updatedAt` on all models
- Foreign keys with `onDelete: Cascade` where appropriate

---

## 10. 🎭 AGENT: 3D & Animation Specialist

**Scope:** Three.js, React Three Fiber, GSAP animations, Lenis smooth scroll.

**Responsibilities:**
- 3D landing page experience
- Brand showcases and product viewers
- Scroll-driven animations
- Performance optimization for 3D scenes

**Key Files:**
- `src/app/[locale]/page.tsx` — main landing with 3D
- `src/lib/gsapAnimations.ts` — GSAP scroll triggers
- Components using `@react-three/fiber`, `@react-three/drei`
- `src/lib/performance.ts` — FPS monitoring

**Rules:**
- Lazy-load all 3D components with `dynamic(() => import(...), { ssr: false })`
- Use `will-change: transform` sparingly
- Target 60fps on mid-range devices
- Provide non-3D fallback for mobile

---

## 11. 📧 AGENT: Email & Communications

**Scope:** Transactional emails, email templates, Resend integration.

**Responsibilities:**
- Order confirmation emails
- Password reset flows
- B2B account approval notifications
- Email template design (React Email)

**Key Files:**
- `src/components/emails/OrderConfirmationEmail.tsx`
- Resend API integration in Hutko callback and checkout flows
- `src/lib/shopCheckout.ts` — triggers email on order creation

**Rules:**
- Use `@react-email/components` for templates
- Render to HTML string with `render()` from `@react-email/render`
- Sender address from `process.env.EMAIL_FROM`
- Always wrap email sending in try/catch (never fail an order because of email)

---

## 12. 🔐 AGENT: Auth & Security

**Scope:** Authentication, authorization, session management, customer accounts.

**Responsibilities:**
- NextAuth.js configuration
- Shop customer login/registration
- B2B customer approval workflow
- Admin role-based access
- API route protection

**Key Files:**
- `src/lib/authOptions.ts` — NextAuth config
- `src/lib/adminAuth.ts` — admin middleware
- `src/lib/adminRbac.ts` — role permissions
- `src/lib/shopCustomerSession.ts` — shop customer session
- `src/lib/shopCustomers.ts` — customer CRUD
- `src/lib/hashPassword.ts` — bcrypt hashing
- `src/app/api/auth/` — NextAuth API routes
- `src/app/api/shop/account/` — customer account API

**Rules:**
- Admin auth is separate from customer auth
- B2B customers require manual approval (`B2B_APPROVED` group)
- Hash passwords with bcrypt, never store plain text
- Use `getServerSession()` for server-side auth checks

---

## Quick Reference Table

| Domain | Agent | Trigger Keywords |
|--------|-------|-----------------|
| UI/UX shop pages | Storefront Designer | design, layout, CSS, animation, hero, grid, card |
| Prices, UAH, EUR | Pricing Engineer | price, currency, UAH, EUR, convert, rates, B2B |
| Cart, checkout | Cart Engineer | cart, checkout, order, payment, Hutko, Stripe |
| Products, collections | Catalog Manager | product, collection, category, import, CSV, bundle |
| Turn14 wholesale | Turn14 Specialist | Turn14, sync, markup, wholesale, fitment |
| Admin panel | Admin Developer | admin, dashboard, CRM, settings, inventory |
| SEO, translations | SEO Engineer | SEO, meta, translate, sitemap, locale, i18n |
| Telegram bot | Telegram Developer | bot, Telegram, notification, alert |
| Database, Prisma | Schema Engineer | schema, migration, Prisma, database, query |
| 3D, animations | 3D Specialist | Three.js, 3D, GSAP, animation, scroll |
| Emails | Email Agent | email, template, Resend, confirmation |
| Auth, security | Auth Agent | login, auth, session, password, B2B approval |
