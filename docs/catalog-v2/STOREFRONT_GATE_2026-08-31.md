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

- Commit `249a538921a641a5ecb051b10ba49f64960ee798` passed the local production-shaped
  runtime gates against disposable PostgreSQL 17 with all 43 migrations and 31 publication-gate
  projections. The production Next server rendered 24 meaningful product cards before hydration;
  the 20-sample warm SSR TTFB p95 was 109.834 ms and the complete first response was 27,338
  gzip bytes. The isolated 10-sample Chromium run measured LCP p75 964 ms, LCP p95 1,140 ms,
  and brand-filter navigation p95 306.879 ms, with no framework overlay, application console
  error, or unexpected failed response.
- The same build passed at 150,526 bytes initial JS gzip, 10,286 bytes catalog-only incremental
  JS gzip, and no legacy stock client module.
- These local production-shaped results prove the implementation gate, but the response was
  explicitly private/no-store because viewer pricing is session-aware. A deployed-region
  observation is still required before describing the TTFB as CDN-cached or approving production
  activation.
- Run commit-to-visible and concurrent mutation/outbox latency drills.
- Canary shadow parity and error-rate monitoring must pass before changing the reader flag.
