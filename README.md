<div align="center">

# OneCompany

**UA/EN automotive and motorcycle commerce platform.**

[![Production](https://img.shields.io/badge/prod-onecompany.global-0ea5e9?style=flat-square&logo=vercel&logoColor=white)](https://onecompany.global)
[![CI](https://img.shields.io/github/actions/workflow/status/SASCYT9/OneCompany/ci.yml?branch=master&label=CI&style=flat-square&logo=github)](https://github.com/SASCYT9/OneCompany/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/SASCYT9/OneCompany/codeql.yml?branch=master&label=CodeQL&style=flat-square&logo=github)](https://github.com/SASCYT9/OneCompany/actions/workflows/codeql.yml)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red?style=flat-square)](./LICENSE)

</div>

OneCompany combines localized brand storefronts, a product/catalog admin, customer
accounts, B2C/B2B and regional pricing, checkout/orders, supplier and messaging
integrations, One AI catalog assistance, and an internal Operations area.

Repository architecture and operating assumptions were revalidated on 2026-08-14.
Start with [`AGENTS.md`](AGENTS.md) for repository safety rules and
[`.agents/PROJECT_CONTEXT.md`](.agents/PROJECT_CONTEXT.md) for the maintained
architecture map.

## Stack

| Area           | Current implementation                                               |
| -------------- | -------------------------------------------------------------------- |
| Runtime        | Node `>=20 <23`, npm                                                 |
| Web            | Next.js `16.2.x` App Router, React `19.2.x`, TypeScript `5.9` strict |
| UI             | Tailwind CSS `4.3.x`, Radix UI, Framer Motion, GSAP, Three.js        |
| Localization   | `next-intl 4`; route locales `ua` and `en`                           |
| Data           | Prisma `6.19.x`, PostgreSQL, optional Prisma Accelerate connection   |
| Authentication | NextAuth v4 for customers; separate signed admin session + DB RBAC   |
| Media          | Git-tracked `public/` assets and Vercel Blob for runtime uploads     |
| Hosting        | Vercel in `fra1`; scheduled Vercel cron routes                       |

Production database vendor/account details cannot be proven from source code alone.
Verify the intended project and environment in Vercel and the database provider
dashboard before operational work.

## Quick start

### Safe storefront-only local mode

This mode needs no database credentials. It downloads the public catalog fallback
from `onecompany.global` into ignored `public/catalog-fallback/`, then uses an
in-memory guest cart.

```bash
git clone https://github.com/SASCYT9/OneCompany.git
cd OneCompany
npm install --legacy-peer-deps
cp .env.example .env.local
# Set SHOP_LOCAL_CATALOG_SNAPSHOT=1 and leave DATABASE_URL/DIRECT_URL empty.
npm run catalog:fallback:local
npm run dev
```

Open <http://localhost:3000/ua>. This mode is for storefront inspection only:
admin editing, customer accounts, persistent checkout/orders, imports, and external
integrations are not production-equivalent. The local cart is lost when the process
restarts.

### Full-stack local development

Use a dedicated development/test PostgreSQL database—never the Production database.
Copy `.env.example` to `.env.local`, configure `DATABASE_URL`, `DIRECT_URL`,
`NEXTAUTH_SECRET`, `ADMIN_SESSION_SECRET`, and only the integration credentials
needed by the task. Then:

```bash
npm install --legacy-peer-deps
npm run prisma:generate
npm run db:migrate
npm run dev
```

The DB-backed admin also needs an active `AdminUser` with appropriate roles and
permissions. Development bypass/bootstrap flags must remain disabled in Production.

See [`.env.example`](.env.example) for the environment inventory. Never commit an
environment file or paste secrets into logs, issues, commits, or chat.

## Architecture at a glance

```text
src/
├── app/
│   ├── [locale]/                 # localized public pages and most shop routes
│   ├── (strict-http)/[locale]/   # canonical PDP and paginated route contracts
│   ├── admin/                    # unlocalized internal admin/Operations UI
│   └── api/                      # admin, shop, cron, webhook, integration APIs
├── components/                   # shared public/admin/shop UI
├── i18n/                         # next-intl routing and request configuration
├── lib/                          # catalog, pricing, auth, admin, Ops, AI, integrations
└── proxy.ts                      # locale, normalization, country and admin pre-check

prisma/                           # schema and forward migrations
scripts/                          # build, import, audit, migration and worker tools
tests/shop/                       # unit, integration, E2E and AI eval suites
public/                           # tracked static assets + generated ignored artifacts
docs/operations/                  # current Operations production runbook
wiki/                             # historical/supporting project notes
```

Shared UI translations live in `src/lib/messages/{ua,en}.json`. Product-localized
copy may also live in paired database fields.

## Persistence and catalog behavior

| Data                                                                  | Production source                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| Products, variants, prices, customers, orders, RBAC, Ops and AI state | PostgreSQL                                            |
| Runtime product/media uploads                                         | Vercel Blob when configured; references in PostgreSQL |
| Static assets                                                         | Git-tracked `public/`                                 |
| Catalog indexes/fallback shards                                       | Generated build/local artifacts; never hand-edit      |
| Legacy site content/media/video config                                | JSON files; runtime writes are not durable on Vercel  |

`src/lib/shopCatalogServer.ts` maps the editable PostgreSQL catalog to storefront
data and owns transient fallback/caching behavior. A narrow
`SHOP_PRODUCT_IMAGE_OVERRIDES` map is applied after DB mapping, so an entry there
wins over an admin image edit.

Product and variant prices can differ by currency, audience, and region. A null
variant price may intentionally inherit its product price; it must not be treated as
zero or “price on request” without tracing the pricing resolver.

## Authentication and admin

There are two independent systems:

- customer accounts: NextAuth Credentials with JWT sessions;
- admin: `onecompany-admin-session`, signed by `ADMIN_SESSION_SECRET`, then resolved
  against current `AdminUser` roles/permissions in PostgreSQL on protected requests.

Admin product reads and writes use `shop.products.read` and
`shop.products.write`. `ADMIN_SECRET` and `ADMIN_API_SECRET` protect specific legacy
or service endpoints; they do not replace admin login or RBAC.

## Useful commands

| Command                          | Purpose and safety                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                    | Start the local development server                                                      |
| `npm run catalog:fallback:local` | Download public catalog shards for DB-less local mode                                   |
| `npm run typecheck`              | Type-check application source                                                           |
| `npm run lint`                   | ESLint; warning backlog exists, zero errors is the gate                                 |
| `npm run test:seo:contracts`     | Safe routing/SEO/catalog-outage contract tests                                          |
| `npm run test:shop:unit`         | Shop unit suite                                                                         |
| `npm run test:ops`               | Operations/RBAC unit subset                                                             |
| `npm run test:shop`              | Unit + integration + E2E; use only with disposable DB and non-production URL            |
| `npm run build`                  | Generate catalog artifacts and run the production build; requires a suitable catalog DB |
| `npm run predeploy-check`        | Release guard; expects a clean production candidate                                     |
| `npm run deploy:prod`            | Production deployment; run only with explicit authorization                             |

Many import, knowledge, media, Airtable, Shopify, payment, Telegram, email, and CRM
commands can mutate local or external state. Read each implementation and confirm
the target before running it; `--commit` and `publish-approved` are explicit writes.

## CI and deployment

- `master` is the production branch.
- Vercel runs `npm run build`, installs with `--legacy-peer-deps`, and deploys in
  `fra1`.
- `vercel.json` currently skips automatic builds for non-`master` branches. Preview
  deployments therefore require a manual action unless that setting changes.
- Normal CI runs ESLint, TypeScript, SEO contracts, and Prisma schema validation.
  Commitlint and CodeQL run separately. Full shop integration/E2E and production
  build are not all part of the normal CI workflow.
- Commit, push, merge, migration, workflow dispatch, Vercel promotion, and deployment
  are separate approvals.

For Operations release steps, use
[`docs/operations/production-rollout-runbook.md`](docs/operations/production-rollout-runbook.md).
The Phase 0 migration document is retained as historical incident context.

## Contributing, security, and license

- Contributor workflow: [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)
- Private vulnerability reporting: [`.github/SECURITY.md`](.github/SECURITY.md)
- Database recovery guidance: [`.github/DATABASE-BACKUPS.md`](.github/DATABASE-BACKUPS.md)

This repository is proprietary. See [`LICENSE`](LICENSE). Public GitHub visibility
does not grant usage rights.
