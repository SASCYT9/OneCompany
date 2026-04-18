# OneCompany Agent Domains

Use this file as a compact routing map, not as a second system prompt.

## Default Read Order
1. `AGENTS.md`
2. `.agents/PROJECT_CONTEXT.md`
3. Relevant files in `src/`, `prisma/`, or `scripts/`
4. Curated skills from `.agents/skills/` only when needed

## Domain Map

### Storefront
- Scope: product pages, collection pages, brand pages, premium UI, responsive behavior
- Main areas: `src/app/[locale]/shop/`, `src/components/`, `src/styles/`

### Commerce
- Scope: pricing, currency formatting, cart, checkout, order flow
- Main areas: `src/lib/shop*`, `src/components/shop/`, `src/app/[locale]/shop/cart/`, `src/app/[locale]/shop/checkout/`

### Catalog And Integrations
- Scope: products, collections, imports, Turn14 sync
- Main areas: `src/lib/shopCatalog*`, `src/lib/turn14*`, `src/app/api/`, `src/app/admin/shop/`

### Admin And CRM
- Scope: internal dashboard, order management, settings, inventory, CRM actions
- Main areas: `src/app/admin/`, `src/lib/shopAdmin*`, `src/lib/admin*`

### SEO And Localization
- Scope: metadata, schema, sitemap, localized content, search-facing content quality
- Main areas: `src/lib/seo*`, `src/lib/shopText.ts`, `src/lib/messages/`, `src/app/sitemap.ts`, `src/app/robots.ts`

### Data Layer
- Scope: Prisma schema, migrations, data integrity
- Main areas: `prisma/`, `src/lib/prisma.ts`

## Guardrails
- Keep project understanding grounded in repo files.
