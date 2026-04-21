# OneCompany Project Context

## Product
- Premium automotive ecommerce and CRM platform.
- Main domains: storefront, admin, catalog, orders, B2B accounts, Turn14 sync, SEO.

## Stack
- Next.js 14 App Router
- React + Tailwind CSS + Framer Motion
- Prisma ORM
- PostgreSQL
- Zustand and React Query where client state is justified

## Architecture Defaults
- Server Components first.
- Client Components only for interactive UI.
- Route Handlers for integrations, webhooks, cron-style endpoints, and external callers.
- Server Actions for typed internal mutations where the existing architecture uses them.

## Business Constraints
- UA and EN localization are mandatory.
- Real brand assets only.
- Customer pricing must use the shop currency helpers.
- B2B workflows, approvals, and pricing must remain explicit.

## Integrations
- Turn14 is a critical catalog/supplier integration.
- WhitePay is the live payment direction reflected in current architecture.
- External APIs should not be treated casually; preserve local DB as the operational source when existing flows already do that.

## Key Repo Areas
- `src/app/[locale]/shop/`: storefront pages and premium commerce UI
- `src/app/admin/`: admin panel and internal tools
- `src/lib/`: business logic, pricing, integrations, helpers
- `prisma/`: schema and migrations
- `.agents/skills/`: curated project-relevant skills only
