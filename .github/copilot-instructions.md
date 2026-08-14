# GitHub Copilot instructions for OneCompany

`AGENTS.md` is the canonical repository instruction set. Read
`.agents/PROJECT_CONTEXT.md` for the maintained architecture map and verify claims
against the current code.

## Stack and routes

- Node `>=20 <23`, Next.js 16 App Router, React 19, TypeScript 5.9 strict,
  Tailwind CSS 4, `next-intl` 4, Prisma 6/PostgreSQL.
- Locales are `ua` and `en`; shared messages live in
  `src/lib/messages/{ua,en}.json` and localized navigation uses
  `src/i18n/routing.ts`/`src/navigation.ts`.
- `src/proxy.ts` owns request/locale normalization. There is no
  `src/middleware.ts`.
- Public pages are under `src/app/[locale]/`; canonical PDP/paginated routes also
  use `src/app/(strict-http)/[locale]/`. Admin is unlocalized under
  `src/app/admin/`; APIs are under `src/app/api/`.

## Data and authentication

- PostgreSQL is authoritative for products, variants, prices, customers, orders,
  RBAC, Operations, and One AI state. Prisma schema plus migrations define the
  intended structure.
- Customer accounts use NextAuth Credentials/JWT. Admin uses a separate signed
  cookie plus current `AdminUser`/role/permission reads from PostgreSQL.
- Reuse admin access helpers and the narrow permission constants. `ADMIN_SECRET`
  and `ADMIN_API_SECRET` protect legacy/service endpoints; they are not admin RBAC.
- Product admin writes must validate relations, preserve IDs, respect variant
  deletion blockers, use a transaction, audit, and revalidate UA/EN storefront
  paths.

## Catalog, pricing, and media

- Trace products through `src/lib/shopCatalogServer.ts`. Generated catalog snapshots
  and indexes are fallback/build artifacts, not editable data.
- `SHOP_PRODUCT_IMAGE_OVERRIDES` supersedes DB images for listed SKUs.
- Use the existing B2C/B2B/Europe/VAT/currency helpers. A null variant price may
  inherit its product price; do not convert null to zero or quote mode casually.
- Runtime uploads use Vercel Blob when configured; tracked assets live in `public/`.
  Legacy JSON content/media/video editors are not durably persistent on Vercel.

## Implementation and safety

- Prefer Server Components, but follow existing Route Handler mutation boundaries;
  do not introduce a library merely because generic guidance recommends it.
- Preserve UA/EN storefront parity and use only real approved product imagery.
- Local, Preview, and Production may have different databases and secrets. Never
  run checkout E2E, imports, migrations, webhook/payment/message writes, or other
  production-capable actions against Production as a test.
- Start verification with relevant unit tests, `npm run typecheck`, and
  `npm run lint`. Lint has a warning backlog; zero errors is the blocking condition.
- `npm run test:shop` includes integration/E2E. `npm run build` generates catalog
  artifacts and needs a suitable catalog database.
- Preserve unrelated dirty-worktree changes. Do not commit, push, merge, dispatch,
  migrate, or deploy unless explicitly requested.
