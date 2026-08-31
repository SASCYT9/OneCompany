# Catalog V2 storefront gate — 2026-08-31

## Outcome

PASS for the P3 suggestion and P4 interaction implementation. No production deployment,
reader switch, migration, or production database write was performed.

- Production build passed against a disposable PostgreSQL 17 database after replaying all
  41 migrations; TypeScript passed and Next generated 589/589 static pages.
- `/[locale]/shop/catalog` remains request-time rendered and
  `/api/shop/catalog/suggest` is present as a dynamic route.
- The results and first 24 product cards remain server rendered. Progressive filters use URL
  state and retain an HTML GET fallback when JavaScript is unavailable.
- Parent changes clear every incompatible descendant. Search suggestions debounce for 180 ms,
  abort stale requests, and cap database work to 10 total / 6 product / 2 brand / 2 vehicle
  results.
- The 500,000-product autocomplete plan passed at 23.573 ms cold and 24.134 ms warm p95 with
  no large sequential scan.

## Bundle isolation

Turbopack initially included the legacy `/shop/stock` client page in the V2 catalog entry even
behind a dynamic import. The flag-off fallback now uses a `beforeFiles` internal rewrite and the
V2 route has no legacy module dependency. The browser URL remains `/shop/catalog` while the
reader flag is off.

| Production manifest measurement | Before | After | Change |
| -------------------------------- | -----: | ----: | -----: |
| Initial entry JS, raw bytes      | 607,021 | 446,777 | -160,244 |
| Initial entry JS, gzip bytes     | 191,298 | 148,294 | -43,004 (-22.5%) |
| Legacy stock module present      | yes | no | isolated |

These figures include shared locale/shop layouts, so they are a conservative route-entry
measurement rather than the incremental filter-controller size.

## Remaining activation gates

- Measure representative TTFB/LCP and browser interaction latency with production-shaped data.
- Run commit-to-visible and concurrent mutation/outbox latency drills.
- Canary shadow parity and error-rate monitoring must pass before changing the reader flag.
