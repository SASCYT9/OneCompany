# OneCompany project context

Last repository review: 2026-08-14. This is a maintained architecture snapshot,
not a substitute for reading the code that owns a task.

## Product surface

OneCompany is a production automotive and motorcycle commerce platform with:

- a UA/EN marketing site and brand storefronts;
- a PostgreSQL-backed product catalog, variants, fitment, collections, pricing,
  inventory, cart, checkout, orders, returns, shipping, customers, and B2B rules;
- a DB-backed admin/CRM with role-based permissions and audit logs;
- One AI storefront search/recommendation with Knowledge V2, eval gates, telemetry,
  and fail-closed production activation;
- an Operations area for projects, tasks, inbox intake, knowledge, approvals,
  Telegram processing, jobs, and automation controls;
- supplier/CRM/payment/messaging/media integrations.

Production URL: <https://onecompany.global>. Git remote:
`SASCYT9/OneCompany`. Production branch: `master`.

## Verified stack

| Area          | Current repository state                                                   |
| ------------- | -------------------------------------------------------------------------- |
| Runtime       | Node `>=20 <23`, npm                                                       |
| Framework     | Next.js `16.2.x` App Router, React/React DOM `19.2.x`                      |
| Language      | TypeScript `5.9.3`, strict, path alias `@/* -> src/*`                      |
| Styling       | Tailwind CSS `4.3.x`, PostCSS, SCSS modules, Framer Motion/GSAP            |
| Localization  | `next-intl 4.11.x`; routes `ua` and `en`; `ua -> uk` language metadata     |
| Data          | Prisma/`@prisma/client 6.19.x`, PostgreSQL, optional Prisma Accelerate URL |
| Customer auth | NextAuth v4 Credentials, JWT session                                       |
| Admin auth    | Custom HMAC-signed cookie plus current DB user/role resolution             |
| Media         | Tracked `public/` assets and Vercel Blob for runtime uploads               |
| Tests         | Node test runner through `tsx --test`; Playwright in opt-in E2E files      |
| Hosting       | Vercel, region `fra1`; four Vercel cron routes                             |

Do not copy old claims that this repo uses Tailwind 3, React Query, Supabase,
`src/middleware.ts`, or a shared `ADMIN_SECRET` login. Those do not describe
the current code.

## Route and module map

### Public application

- `src/app/layout.tsx`: global metadata, fonts, analytics, theme, structured data.
- `src/app/[locale]/layout.tsx`: next-intl provider, header/footer, currency
  context, hero media, and public shop settings.
- `src/app/[locale]/shop/`: hubs, brand PLPs, collections, cart, checkout,
  customer account, stock, and Turn14.
- `src/app/(strict-http)/[locale]/shop/`: canonical PDP and paginated route
  implementations with explicit static/ISR HTTP behavior.
- `src/proxy.ts`: country block, URL normalization, admin cookie pre-check,
  locale redirects, and next-intl handling.
- `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/navigation.ts`:
  localization and navigation.
- `src/lib/messages/ua.json`, `src/lib/messages/en.json`: shared UI messages.

### Storefront catalog and pricing

- `src/lib/shopCatalogServer.ts`: DB mapping, static/catalog-shard fallback,
  emergency image overrides, brand fetchers, PDP lookup, and in-process caches.
- `src/lib/shopCatalog.ts`: public catalog types and static fallback data.
- `src/lib/storefrontRouteRegistry.ts` and `src/lib/shopStorefrontRouting.ts`:
  canonical brand/PDP paths.
- `src/lib/shopPricingAudience.ts`: B2C/B2B audience, explicit/discounted bands,
  Europe base prices, and quote behavior.
- `src/lib/shopDisplayPrices.ts`, `shopPriceConversion.ts`,
  `shopMoneyFormat.ts`: display/formatting/conversion helpers.
- `src/lib/shopAdminSettings.ts`: shop settings defaults/runtime conversion.
- `src/components/shop/` and `src/app/[locale]/shop/components/`: shared and
  brand-specific storefront UI.

Canonical storefront segments in code are: `racechip`, `do88`, `brabus`,
`girodisc`, `burger`, `ohlins`, `akrapovic`, `ilmberger`, `csf`,
`urban`, `adro`, and `ipe`.

### Admin and CRM

- `src/app/admin/`: unlocalized internal UI.
- `src/app/api/admin/`: admin APIs; product editing is
  `/api/admin/shop/products` and `/api/admin/shop/products/[id]`.
- `src/lib/adminAuth.ts`: signed admin session cookie.
- `src/lib/admin/adminIdentity.ts`: active DB identity and role resolution.
- `src/lib/admin/adminAccess.ts`: request-local access resolution.
- `src/lib/admin/adminPermissions.ts`: permission constants and role templates.
- `src/lib/adminRbac.ts`: role/bootstrap/audit helpers.
- `src/lib/shopAdmin*.ts`: product, collection, category, import, order,
  customer, inventory, media, settings, shipping, and variant domain logic.

The proxy validates only that an admin cookie is structurally valid before routing.
Every protected page/API must still resolve the current active DB user and required
permissions. The signed cookie has a 12-hour TTL, but role removal/deactivation takes
effect on the next DB-backed access check.

### Customer accounts

- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth handler.
- `src/lib/authOptions.ts`: Credentials provider and JWT refresh from current
  `ShopCustomer` data.
- `src/lib/shopCustomerSession.ts`: customer and admin-impersonation resolution.
- `src/lib/shopCustomers.ts`: customer account/password/address operations.

Customer and admin sessions are intentionally separate.

### One AI and knowledge

- Public assistant APIs: `src/app/api/shop/stock/assistant/`.
- Core logic: `src/lib/shopAi*.ts`.
- Knowledge V2: `src/lib/shopKnowledgeV2/`.
- Admin quality UI/API: `src/app/admin/shop/ai-quality/` and
  `src/app/api/admin/shop/ai-quality/`.
- Evals: `tests/shop/evals/` and `scripts/eval-shop-ai.ts`.
- Production activation guard: `src/lib/shopAiV2ReleaseActivationGuard.ts`,
  evaluated from `next.config.ts` so an invalid production rollout fails build.

Prices are resolved at request time and must not be embedded as knowledge text.
Protected release evals require real reviewed product/variant IDs; synthetic padding
is forbidden.

### Operations

- UI: `src/app/admin/operations/` and `src/components/admin/operations/`.
- APIs: `src/app/api/admin/operations/`,
  `src/app/api/operations/telegram-manager/webhook/route.ts`, and
  `src/app/api/cron/operations-jobs/route.ts`.
- Domain: `src/lib/operations/`.
- Feature flags: `OPS_UI_ENABLED`, Telegram/notification/auto-create/job/
  automation flags; production behavior fails closed.
- Release procedure: `docs/operations/production-rollout-runbook.md`.

Ops Telegram credentials and private media storage are separate from the legacy
storefront Telegram bot and public storefront Blob store.

## Persistence matrix

| Data                                                     | Persistent production source                                        | Important behavior                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Catalog, pricing, customers, orders, RBAC, Ops, AI state | PostgreSQL                                                          | Prisma schema/migrations are canonical                 |
| Runtime product/media uploads                            | Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set                     | Product references are stored in PostgreSQL            |
| Ops private attachments                                  | Dedicated private Blob/OIDC or dedicated token                      | Must not reuse public storefront storage               |
| Static brand/product assets                              | Git-tracked `public/`                                               | Immutable cache headers are configured                 |
| Catalog fallback/index                                   | Generated during build under `public/catalog-*`                     | Resilience/client-filter artifacts, not editable state |
| Site content/media/video config                          | Legacy JSON under `data/admin-config` with `public/config` fallback | Runtime filesystem writes are not durable on Vercel    |
| DB-less local cart                                       | In-memory process map                                               | Lost on restart; local verification only               |
| Saved admin views/UI preferences                         | Browser local storage                                               | Per-browser, not shared server state                   |

## Catalog read and update flow

1. Production admin writes a validated Prisma transaction and an audit log.
2. Product APIs call storefront revalidation for UA/EN canonical and legacy paths.
3. Runtime PDP/brand reads prefer PostgreSQL. Prisma Accelerate and in-process caches
   may remain stale briefly.
4. Build-time catalog shards support prerendering and transient PDP fallback.
5. DB-less local mode downloads those public shards and never initializes Prisma.

`SHOP_PRODUCT_IMAGE_OVERRIDES` in `shopCatalogServer.ts` is applied after DB
mapping and therefore wins over admin-managed image fields. Treat it as a narrow,
temporary code exception.

## Pricing model

- Product and variant records can carry EUR, USD, UAH, Europe EUR, B2B, and
  compare-at values.
- Variant `null` prices can mean “inherit the product-level value”; zero and null
  must not be conflated.
- Europe pricing is country-sensitive and separate from default-market compare-at
  logic.
- B2B resolution can use customer+brand, system+brand, customer-global, and
  system-default discounts, plus explicit B2B price fields.
- Currency rates and visibility rules come from `ShopSettings`.

Always trace display, cart, checkout, order snapshot, email, and admin behavior when
changing prices.

## Environment modes

### Safe DB-less storefront

Required shape:

```text
SHOP_LOCAL_CATALOG_SNAPSHOT=1
DATABASE_URL=
DIRECT_URL=
```

Run `npm run catalog:fallback:local`, then `npm run dev`. The downloaded
`public/catalog-fallback/` directory and `.env.local` are ignored by Git.
This mode supports storefront browsing and an in-memory guest cart only.

### Full local development

Use a dedicated dev/test PostgreSQL database, unique local secrets, and only the
integration credentials required by the task. Admin editing requires current
`AdminUser`/`AdminRole` records. Never copy Production credentials into chat or
commit them.

### Build and Production

`npm run build` runs:

1. `scripts/prebuild-shop-snapshot.ts`;
2. `scripts/generate-shop-filter-indexes.ts`;
3. `next build`.

Vercel uses `DIRECT_URL` as the effective build catalog connection through
`scripts/build-site.mjs`, one build CPU to limit DB connection pressure, and fails
the production build if the catalog snapshot or One AI release guard is invalid.

`vercel.json` deploys in `fra1`, runs four crons, and ignores automatic builds
for non-`master` branches. A Preview must therefore be created manually unless
that configuration is changed.

## Integrations and mutation boundaries

- Airtable runtime modules and scheduled stock/CRM syncs read external records and
  write normalized state locally to PostgreSQL.
- Legacy/manual scripts including `scripts/airtable-ai-export.mjs`,
  `scripts/airtable-export.mjs`, and `scripts/turn14-airtable-export.mjs` can
  write to Airtable. They are dangerous opt-in tools, not normal sync paths.
- WhitePay creation APIs, Resend email, Telegram bots, Shopify webhooks/OAuth,
  Blob upload/delete, supplier syncs, and CRM webhooks have external side effects.
- Package scripts use explicit `dry`, `preview`, `--dry-run`, `--commit`,
  and `publish-approved` conventions inconsistently. Read the script before
  execution; do not infer safety from its name alone.

## Verification reality

- CI runs ESLint, TypeScript, SEO contracts, and Prisma validation. Commitlint and
  CodeQL are separate workflows.
- Full shop unit/integration/E2E suites and production build are not all part of
  the normal CI job.
- `npm run typecheck` excludes `scripts/`; script changes need targeted execution
  or a suitable script-specific check.
- ESLint currently exits successfully with a substantial warning backlog. Report
  the warning count; do not call it warning-free.
- Integration persistence tests need `OPS_TEST_DATABASE_URL`.
- Browser/API shop E2E tests can create orders. Use only a disposable environment
  and non-production `SHOP_E2E_BASE_URL`.

## Known architectural debt to preserve in analysis

- Legacy JSON content/media/video editors are not backed by durable production
  storage.
- `scripts/predeploy-check.js` calls `next build` directly, while Vercel and
  `npm run build` first generate catalog snapshot/index artifacts. Its success is not
  full build-parity evidence.
- Customer NextAuth currently has a development fallback signing string in code if
  `NEXTAUTH_SECRET` is absent. Production configuration must provide the secret; a
  future hardening change should fail closed instead of relying only on deployment
  configuration.
- The Operations readiness check currently accepts the general storefront Blob token
  as a storage fallback even though the rollout policy requires a dedicated private
  Operations store. Treat the stricter policy as authoritative until code is aligned.
- The repository contains historical backups, archive files, one-off scripts, and
  duplicate legacy assets; existence does not make them active architecture.
- `.agents/scripts/` and `.agents/scratch/` contain obsolete local AI experiments and
  potentially mutating one-off database scripts. They are not normal agent tooling.
- `scripts/import-ops-knowledge-foundation.ts` is a historical one-time importer: it
  still expects a missing user-guide Markdown file and an optional legacy workspace.
  Do not treat it as runnable current seeding until its sources are deliberately
  replaced and reviewed.
- Some catalog behavior is encoded in large brand-specific helpers and emergency
  overrides, so product fixes must trace DB data, normalized mapping, override layer,
  caching, and rendered UI.
- Production provider/account details cannot be proven from source alone. Verify
  them in the intended Vercel/database dashboard before operational changes.
