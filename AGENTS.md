# OneCompany agent instructions

Revalidated from the repository on 2026-08-14. This file is the canonical
repository-level instruction set. When documentation and code disagree,
`package.json`, `prisma/schema.prisma`, `src/`, and deployment configuration win;
fix the stale documentation as part of the task.

## 1. Read order

1. Read this file.
2. Read [`.agents/PROJECT_CONTEXT.md`](.agents/PROJECT_CONTEXT.md) for the current architecture map.
3. Inspect the files that own the requested flow end to end.
4. Use a task-specific file in `.agents/workflows/` only when it matches the task.
5. Treat `wiki/`, `archive/`, `backups/`, `artifacts/`, `reference/`,
   `.agents/scripts/`, `.agents/scratch/`, and old one-off scripts as historical or
   supporting material, never as the current source of truth.

Do not auto-load every file under `.agents/skills/`. Those files are optional local
references and may lag behind the installed framework. Verify every rule against the
current package versions and code.

## 2. Current stack and layout

- Node `>=20 <23`, npm, TypeScript 5.9 in strict mode.
- Next.js 16 App Router, React 19, Tailwind CSS 4, `next-intl` 4.
- Prisma 6 with PostgreSQL. `DATABASE_URL` is the pooled/runtime URL;
  `DIRECT_URL` is the direct migration/build URL.
- Vercel is the production host; runtime media uses Vercel Blob when configured.
- `src/proxy.ts` is the request proxy. There is no `src/middleware.ts`.
- Public localized routes live under `src/app/[locale]/`; canonical product detail
  and paginated HTTP-contract routes also use `src/app/(strict-http)/[locale]/`.
- The unlocalized internal UI is `src/app/admin/`; APIs are under `src/app/api/`.
- Locales are `ua` and `en`. Route locale `ua` maps to language code `uk`.
  Messages live in `src/lib/messages/{ua,en}.json`.

## 3. Environment boundaries

Never assume local, Preview, and Production share a database or secrets.

- Safe local storefront mode is DB-less: `SHOP_LOCAL_CATALOG_SNAPSHOT=1`, no
  `DATABASE_URL`, generated files under ignored `public/catalog-fallback/`, and an
  in-memory local cart. It is for storefront inspection only; admin, accounts,
  checkout persistence, imports, and integrations are not production-equivalent.
- Full-stack local work requires an explicitly chosen development/test PostgreSQL
  database and local secrets. Do not point routine development or tests at Production.
- Production state is external to the Git checkout. Never pull Production env values,
  run a production migration, mutate production data, or deploy unless the user
  explicitly authorizes that exact action and target.
- `vercel env pull` replaces the destination file. Link and verify the intended Vercel
  project/environment first, and prefer an ignored environment-specific file.
- Never print or commit secrets. Any `NEXT_PUBLIC_` variable is browser-visible.
- Development bypasses (`ALLOW_DEV_ADMIN_PASSWORD_FALLBACK`,
  `ENABLE_DEV_AUTH_BYPASS`, `OPS_LOCAL_DEMO_MODE`) must stay disabled in Production.

## 4. Sources of truth

- Schema and relations: `prisma/schema.prisma` plus ordered SQL in
  `prisma/migrations/`.
- Products, variants, collections, prices, customers, orders, admin users/roles, and
  Operations records: PostgreSQL via Prisma.
- Storefront catalog mapping and fallbacks: `src/lib/shopCatalogServer.ts`.
- Canonical storefront paths: `src/lib/storefrontRouteRegistry.ts` and
  `src/lib/shopStorefrontRouting.ts`.
- Pricing audience, B2B, regional Europe pricing, and quote behavior:
  `src/lib/shopPricingAudience.ts` plus `src/lib/shopAdminSettings.ts`.
- Admin authorization: `src/lib/adminAuth.ts` and `src/lib/admin/`.
- Runtime uploaded storefront media: Vercel Blob through
  `src/lib/runtimeBlobStorage.ts`; tracked static assets remain under `public/`.
- UI translations: `src/lib/messages/`; localized catalog copy may also be stored in
  paired `*Ua`/`*En` database fields.
- Generated `data/*.snapshot.json`, `public/catalog-index/`, and
  `public/catalog-fallback/` are build/local artifacts. Do not hand-edit them.

Legacy site content/media/video settings still use `data/admin-config/*.json` with
tracked `public/config/*.json` fallbacks. Filesystem writes are not durable production
storage on Vercel. Do not describe those editors as safely persistent until they are
migrated to PostgreSQL or Blob-backed storage.

## 5. Authentication and admin

There are two separate auth systems:

- Customer accounts use NextAuth Credentials with JWT sessions and
  `NEXTAUTH_SECRET`.
- `/admin` uses the `onecompany-admin-session` signed cookie with
  `ADMIN_SESSION_SECRET`. The cookie proves identity only; active state, roles, and
  permissions are re-read from `AdminUser`/`AdminRole` in PostgreSQL on requests.

Admin product reads require `shop.products.read`; writes require
`shop.products.write`. Reuse `assertAdminRequest`/`assertCurrentAdminAccess` and the
constants in `src/lib/admin/adminPermissions.ts`. Do not replace RBAC with
`ADMIN_SECRET`, `ADMIN_API_SECRET`, or a client-side check; those secrets protect
other legacy/service endpoints.

Product mutations go through `/api/admin/shop/products` and must preserve relation
IDs, validate category/collection references, respect variant deletion blockers,
write an audit record, and revalidate canonical UA/EN storefront paths. The
code-level `SHOP_PRODUCT_IMAGE_OVERRIDES` map in `shopCatalogServer.ts` supersedes DB
images for listed SKUs; an admin image edit cannot override such an entry.

## 6. Commerce and catalog guardrails

- Preserve B2C/B2B separation, explicit per-currency price fields, Europe pricing,
  VAT rules, customer/brand discounts, and quote behavior.
- Use existing pricing and money helpers. Do not calculate display prices, exchange
  rates, VAT, discounts, or compare-at prices ad hoc in components.
- A variant may intentionally omit a price and inherit the product price. Do not turn
  `null` into zero or “price on request” without tracing the product fallback.
- PostgreSQL wins over static catalog fallbacks for matching slugs. Emergency code
  overrides are exceptions and should be documented and narrowly scoped.
- Brand list pages and PDPs use ISR, in-process/Accelerate caches, and on-demand
  revalidation. A successful DB write and visible storefront refresh are separate
  things to verify.
- Build snapshots are resilience artifacts, not an alternate editable catalog.
- Use only real, approved brand/product imagery on the storefront. Do not add stock,
  placeholder, or AI-generated product imagery.
- Keep UA and EN customer-facing behavior in parity. Reuse existing localized
  structures and navigation helpers from `src/i18n/routing.ts`/`src/navigation.ts`.

## 7. Data, integrations, and side effects

- Schema changes require a reviewed forward migration. Never use `prisma db push` or
  manual production SQL as a shortcut.
- Prefer scripts with dry-run/default preview modes. Flags such as `--commit`,
  `publish-approved`, migration deploys, webhooks, payment creation, email/Telegram
  sends, Blob deletion, and GitHub workflow dispatches are real side effects.
- Runtime Airtable flows import/read data into PostgreSQL. Several legacy export
  scripts can write to Airtable; do not run them without explicit owner authorization
  and target confirmation.
- Turn14, supplier, Shopify, WhitePay, Resend, Telegram, Blob, Gemini, Perplexity, and
  CRM operations must be traced through their existing authentication, idempotency,
  and failure-handling paths. Do not probe write endpoints casually.
- Never run browser/API checkout E2E tests against Production: they can create real
  orders and trigger notifications or payment-related flows.

## 8. Editing and verification

- Inspect `git status` first and preserve unrelated user changes.
- Search with `rg`/`rg --files`. Follow the current file's conventions.
- Do not start another dev server when the required port is already serving this repo.
- Prefer Server Components, but follow the existing architecture: this repository
  intentionally uses Route Handlers for many internal and external mutations. Do not
  introduce a new validation/state/UI library when local helpers already exist.
- After code changes, run the narrowest relevant tests, then normally:
  `npm run typecheck`, `npm run lint`, and relevant `tsx --test` suites.
- ESLint currently has a warning backlog; zero errors is the blocking condition unless
  the task explicitly targets warning cleanup. Do not claim “clean lint” when warnings
  remain.
- For DB-less schema validation, provide non-secret stub values for both
  `DATABASE_URL` and `DIRECT_URL`; `prisma validate` does not need a live connection.
- `npm run build` is not a lightweight check: it generates catalog snapshots, needs a
  valid catalog database in Vercel/production mode, and can fail closed.
- `npm run predeploy-check` currently calls `next build` directly and therefore does
  not exercise the catalog snapshot wrapper used by `npm run build`; it is an
  additional guard, not build-parity evidence.
- `npm run test:shop` includes integration/E2E paths. Confirm a disposable database,
  a non-production base URL, and required opt-in flags before running it.
- For documentation changes, check relative links and format only the touched files.

## 9. Git and release safety

- `master` is the production branch. `vercel.json` currently skips automatic builds
  for non-`master` branches, so Preview deployments are manual unless configuration
  changes.
- Do not commit, push, merge, dispatch workflows, migrate, promote, roll back, or deploy
  unless requested. These are separate approvals.
- Never deploy a dirty working tree. The production runbook is
  `docs/operations/production-rollout-runbook.md`; the Phase 0 document is historical
  incident/migration context, not a current command checklist.
- Keep commits focused and use Conventional Commits when a commit is requested.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
