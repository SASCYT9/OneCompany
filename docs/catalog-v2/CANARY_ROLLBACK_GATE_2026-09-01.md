# Catalog V2 canary and rollback gate — 2026-09-01

## Contract

- `SHOP_CATALOG_V2_READER_MODE=off`: build-time rewrite sends all catalog traffic to legacy.
- `SHOP_CATALOG_V2_READER_MODE=canary`: request-time deterministic allocation.
- `SHOP_CATALOG_V2_READER_MODE=ssr`: full V2 reader.
- Production `canary` and `ssr` both require the commit-bound signed release marker.
- `SHOP_CATALOG_V2_CANARY_PERCENTAGE=0` is an immediate non-destructive rollback.
- Optional comma-separated `SHOP_CATALOG_V2_CANARY_LOCALES`,
  `SHOP_CATALOG_V2_CANARY_BRANDS`, and `SHOP_CATALOG_V2_CANARY_CATEGORIES`
  narrow eligibility. A configured segment never matches a missing query value.

Allocation uses a stable 30-day HTTP-only rollout ID and a deterministic 0–99 bucket. Legacy
requests are internally rewritten, preserving the public catalog URL. Selected requests receive a
private request header; the catalog page and suggestion endpoint fail closed without that header.

## Verification

Verified locally against Next.js 16.3.3 and a disposable PostgreSQL 17 database with all 42
migrations:

- targeted contracts: 17/17 pass;
- full unit suite: 1,059/1,059 pass;
- TypeScript: pass;
- reader-off production build: 589/589 static pages generated; proxy compiled;
- zero-percent browser run: legacy catalog rendered meaningful content at
  `/ua/shop/catalog`, no framework overlay, no console errors;
- 100-percent browser run: V2 SSR rendered 31 publication-gate projections, no framework overlay,
  no console errors;
- selected-session autocomplete: HTTP 200 in 108 ms and an interactive suggestion list rendered;
- disposable publication seed: 30 commit-to-visible samples, p95 85.585 ms, p99 133.550 ms;
- rollback selector regression proves every sampled ID returns legacy at zero percent.
- unsigned production canary guard exits non-zero; production reader-off rollback exits zero.
- category is applied by the indexed reader, SSR form/URL state, facets, pagination, and shadow
  adapter before it can be used as a canary segment;
- all 43 migrations replay on disposable PostgreSQL and concurrent shadow aggregate writes retain
  exact sample/mismatch/error totals.

No Production environment variable, database, deployment, or reader was changed.
