# Shop notes

> Historical/supporting notes only. For current architecture, read
> `../../AGENTS.md` and `../../.agents/PROJECT_CONTEXT.md`, then inspect the owning
> code.

The active shop spans:

- localized pages under `src/app/[locale]/shop/`;
- canonical PDP/paginated contracts under `src/app/(strict-http)/[locale]/shop/`;
- PostgreSQL models and forward migrations under `prisma/`;
- catalog mapping, fallback, and caching in `src/lib/shopCatalogServer.ts`;
- route registries in `src/lib/storefrontRouteRegistry.ts` and
  `src/lib/shopStorefrontRouting.ts`;
- pricing resolution in `src/lib/shopPricingAudience.ts` and related helpers;
- DB-backed product editing under `src/app/admin/shop/` and
  `src/app/api/admin/shop/`.

Generated catalog snapshots and indexes are not editable catalog sources. Legacy
`data/admin-config` JSON editors also do not provide durable Vercel persistence.

## Use this section for

- dated architecture decisions and the reasoning behind them;
- cross-brand catalog, fitment, filter, pricing, or routing research;
- historical incidents whose context does not belong in source comments.

Do not store secrets, current operational credentials, customer/order data, or
step-by-step production mutations here.

## Related

- [[../Index|Index]]
- [[../Brands/README|Brands]]
