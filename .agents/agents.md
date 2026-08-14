# OneCompany task routing map

Use this after the root `AGENTS.md` and `.agents/PROJECT_CONTEXT.md`. It maps a
task to the smallest set of current files; it is not a second policy document.

## Storefront page or product UI

Start with:

- `src/app/[locale]/shop/`
- `src/app/(strict-http)/[locale]/shop/` for PDP and paginated routes
- `src/app/[locale]/shop/components/`
- `src/components/shop/`

Then trace:

- product source through `src/lib/shopCatalogServer.ts`;
- canonical URL through `src/lib/shopStorefrontRouting.ts`;
- localized copy through `src/lib/messages/` or paired catalog locale fields;
- price rendering through `src/lib/shopPricingAudience.ts` and shop price
  components.

Verify UA and EN plus the relevant mobile/desktop state.

## Product data, photo, price, or variant

Start with:

- `prisma/schema.prisma` models `ShopProduct`, `ShopProductVariant`,
  `ShopProductMedia`, and collection/category relations;
- `src/lib/shopCatalogServer.ts`;
- `src/lib/shopAdminCatalog.ts` and `src/lib/shopAdminCatalogMutations.ts`;
- `src/app/api/admin/shop/products/`;
- `src/app/admin/shop/components/AdminProductEditor.tsx`.

Check in this order:

1. current PostgreSQL row and relation IDs;
2. mapping/normalization;
3. `SHOP_PRODUCT_IMAGE_OVERRIDES` or static fallback exceptions;
4. variant-to-product price inheritance;
5. ISR/cache revalidation;
6. final UA/EN storefront output.

## Admin login, permissions, or editor failure

Start with:

- `src/proxy.ts`;
- `src/lib/adminProxyAuth.ts`;
- `src/lib/adminAuth.ts`;
- `src/lib/admin/adminIdentity.ts`;
- `src/lib/admin/adminAccess.ts`;
- `src/lib/admin/adminPermissions.ts`;
- the page and API route that fail.

Distinguish:

- 401: missing/invalid session identity;
- 403: current DB roles lack permission;
- 400: payload validation;
- 404: stale/missing entity ID;
- 409: relation/deletion/uniqueness conflict;
- 500: DB/schema/runtime/storage failure.

Do not diagnose an authenticated production failure from an unauthenticated probe.

## Cart, checkout, orders, payment, B2B

Start with:

- `src/lib/shopCart.ts`, `shopCheckout.ts`, `shopOrder.ts`;
- `src/lib/shopPricingAudience.ts`, `shopEuVat.ts`,
  `shopEuropePricing.ts`, `shopDiscountEngine.ts`;
- `src/app/api/shop/cart/`, `checkout/`, `orders/`, and
  `whitepay/`;
- related Prisma models and admin order APIs.

Trace amount and currency from product/variant through the cart, checkout
calculation, immutable order pricing snapshot, payment request, email, and admin.
Never exercise checkout against Production during testing.

## Catalog import or supplier sync

Start with the named `scripts/` entry, then:

- its parser/normalizer under `src/lib/`;
- Prisma mutation boundary;
- dry-run/commit distinction;
- storefront route and cache impact;
- source-specific tests.

Treat Airtable export scripts, Shopify, WhitePay, email/Telegram, Blob deletion,
and any `--commit` or publish action as external/production-capable mutations.

## Media and content

- Product/media library: `src/lib/mediaStore.ts`,
  `runtimeBlobStorage.ts`, `shopAdminMedia.ts`, admin media APIs.
- Tracked static assets: `public/`.
- Legacy site content/media/video: `siteContentServer.ts`,
  `siteMediaServer.ts`, `videoConfig.ts`, `data/admin-config/`, and
  `public/config/`.

Remember that legacy JSON writes are not durable on Vercel. A production-safe
editor needs PostgreSQL or Blob-backed persistence.

## One AI

Start with:

- `src/app/api/shop/stock/assistant/`;
- `src/lib/shopAi*.ts`;
- `src/lib/shopKnowledgeV2/`;
- `tests/shop/evals/`;
- `src/lib/shopAiV2ReleaseActivationGuard.ts`.

Keep retrieval grounded in canonical DB records, keep prices out of embeddings,
preserve privacy/rate-limit boundaries, and do not weaken release gates to make
an eval pass.

## Operations

Start with:

- `src/lib/operations/`;
- `src/app/api/admin/operations/`;
- `src/app/admin/operations/`;
- `src/components/admin/operations/`;
- `docs/operations/production-rollout-runbook.md`.

Check feature flags, RBAC, CSRF/idempotency, Telegram separation, job state, and
private attachment storage. Phase 0 documentation is historical.

## Schema or migration

Start with:

- `prisma/schema.prisma`;
- existing ordered migrations;
- `prisma.config.ts`;
- migration replay/backup scripts and production runbook.

Use a disposable database for migration verification. Production backup,
migration, and deploy are separate owner approvals.

## Deployment or environment

Start with:

- `.env.example`;
- `vercel.json`;
- `next.config.ts`;
- `scripts/build-site.mjs`;
- `scripts/predeploy-check.js`;
- `.github/workflows/`.

Confirm the actual target, branch, Vercel project link, environment scope, and
database before any write. Non-`master` automatic Vercel builds are currently
ignored.

## Documentation or repository audit

Check at minimum:

- root `AGENTS.md`, `.agents/PROJECT_CONTEXT.md`, this file;
- `CLAUDE.md`, `.github/copilot-instructions.md`, `README.md`;
- `.env.example`, contribution/backup/runbook docs;
- relative links and paths against the working tree;
- package versions, scripts, routes, schema, and CI before asserting facts.
