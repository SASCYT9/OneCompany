# Catalog filter contract audit — 2026-09-07

## Scope and status

This is a read-only, source-level audit of the stock catalog flow on branch
`codex/storefront-cost-optimization`: the visible controls and URL state in
`src/app/[locale]/shop/stock/page.tsx`, the legacy/SSR split in
`src/app/api/shop/stock/search/route.ts`, and the premium adapter and projection
query in `src/lib/shopCatalogPremiumProjection.server.ts` and
`src/lib/shopCatalogProjectionQuery.server.ts`.

The source audit used no production, network, or database access. Its first two
fixes are now verified locally: SSR `preOrder` excludes warehouse products, and
OPF/GPF remains in the same compatibility clause for results, counts and vehicle
facets. Root validation passed 32 unit tests, TypeScript, scoped ESLint, and two
serial integration tests on disposable localhost PostgreSQL after replaying all
44 migrations. The vehicle regression passed again after the live make-counter
fix. These checks do not establish all-source production coverage or pricing parity.

## Control and URL inventory

The page initializes state from URL parameters and sends the same parameters on
search. The actual interactive controls are search text, vehicle mode and the
make/model/chassis/year/engine/fuel cascade, category and brand facets, stock,
price bounds, and sort. `productType`, `opfGpf`, `productKind`, and `strict` are
URL-initialized state/chips in this page (with remove/reset behavior); they are
still part of the request contract, but are not independent visible selects in
the inspected flow. `brand` is deliberately reduced to one selected value in
the current UI, although the legacy URL parser accepts multiple comma-separated
values.

## Matrix

| Dimension                             | Legacy reader                                                                                      | Premium SSR projection                                                                                                                                               | Contract finding                                                                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                   | Relevance scoring, SKU handling, and vehicle alias narrowing                                       | `searchText ILIKE` only                                                                                                                                              | Supported, but ranking and vehicle-query semantics diverge. Validate vehicle-text cases before parity promotion.                                                                                                                             |
| `make` / `model` / `chassis` / `year` | Canonical ID bridge plus fitment filtering; strict mode can use same application row               | Native mode retains all constraints; default bridge replaces these constraints with its resolved product IDs                                                         | Native engine/fuel/OPF requests retain the whole vehicle clause. Broad native mode remains opt-in pending coverage.                                                                                                                          |
| `engine`                              | Canonical path; strict application matching                                                        | Projection-native correlated `ENGINE` constraint                                                                                                                     | Supported and intentionally native.                                                                                                                                                                                                          |
| `fuel`                                | Sent only to the shadow query (`route.ts:1270`), with no fuel predicate in the serving legacy path | Projection-native correlated `FUEL` constraint                                                                                                                       | Actual visible fuel select is ignored by the legacy serving reader. Fix this separately; shadow support does not filter customer results.                                                                                                    |
| `opfGpf`                              | Canonical application/strict matching                                                              | Correlated `OPF_GPF` predicate; accepts with/without and rejects unsupported values                                                                                  | Implemented and locally tested, including OPF-only selection, same-product cross-clause negatives, and live make/model facets. Production data coverage remains open.                                                                        |
| `productKind`                         | Inferred taxonomy filter; strict knowledge/application path when enabled                           | No query input or predicate                                                                                                                                          | Ignored in SSR. This is URL/chip state, not a standalone visible select. Gate or implement before release.                                                                                                                                   |
| `productType`                         | Exact normalized product `productType` equality                                                    | No query input or predicate (projection stores `productTypeKey`)                                                                                                     | Ignored in SSR. URL/chip state; gate or implement before release.                                                                                                                                                                            |
| `strict=1`                            | Enables trusted knowledge/application validation and invalid-input handling                        | Not parsed by the premium adapter                                                                                                                                    | URL state semantics are not preserved in SSR. Canonical clause correlation alone does not prove equivalent trust/unknown handling.                                                                                                           |
| `stock=inStock`                       | Warehouse SKU/slug predicate                                                                       | Converts to bounded warehouse product IDs                                                                                                                            | Supported, subject to facet-count correctness.                                                                                                                                                                                               |
| `stock=preOrder`                      | Warehouse predicate complement                                                                     | Excludes warehouse IDs in results, facets and count queries                                                                                                          | Selection fixed and adapter-tested in native and bridge modes. Summary stock counts remain a separate open issue below.                                                                                                                      |
| `brand`                               | Multiple values are OR; display-brand normalization                                                | `firstBrand` only; Urban aliases handled                                                                                                                             | Single-brand UI is supported. Multi-brand URL behavior diverges and is URL-only legacy compatibility.                                                                                                                                        |
| `category`                            | Taxonomy group IDs/labels and keyword-derived classification                                       | Exact projection `categoryKey` or `categoryLabel`                                                                                                                    | Open parity risk: derived groups such as exhaust, brakes, and carbon aero need projection-key/data verification.                                                                                                                             |
| `scope=moto`                          | Filters resolved product scope to moto                                                             | Exact `scopeKey=moto`                                                                                                                                                | Supported where projection scope is normalized.                                                                                                                                                                                              |
| `scope=auto`                          | Filters resolved product scope to auto, including legacy `SHOP` fallback behavior                  | Adapter intentionally maps auto to null for legacy scope coverage; the diagnostic snapshot contains 6,137 rows outside normalized auto/moto, including legacy `SHOP` | Explicit compatibility debt. Mapping auto to exact auto would drop coverage until scope mapping/migration is complete; null can leak moto rows if projection contains them. Snapshot counts do not certify current canonical scope coverage. |
| `currency` / `minPrice` / `maxPrice`  | Effective viewer price after B2B/customer/brand pricing; bounds and sort use that price            | Raw canonical product/variant price in SQL, then viewer pricing is hydrated for cards                                                                                | Highest release blocker: B2B/discounted users can get wrong inclusion and ordering. Europe pricing also needs combined verification.                                                                                                         |
| `sort`                                | Effective viewer prices or localized title                                                         | Raw canonical prices/title; default uses stable projection rank/brand interleave                                                                                     | Price sort diverges for discounted audiences.                                                                                                                                                                                                |
| `page` / `limit`                      | Offset pagination after all filtering/ranking                                                      | Bounded projection query/count with offset                                                                                                                           | Mechanically supported; projection count must remain aligned with filters.                                                                                                                                                                   |

## Open correctness and latency notes

1. **Raw-price filtering and sorting is the release blocker.** The projection
   SQL filters/sorts before `resolveShopProductPricing` applies viewer discounts.
   A B2B or brand-discount customer can therefore see a product omitted by a
   minimum/maximum bound or ordered incorrectly. The bounded next patch is an
   audience-price read model/query path, or an explicit SSR gate for price
   filtering/sorting until such a path exists.
2. **Active URL/chip filters must not be silently ignored.** Add
   `productType`, `productKind`, and strict semantics to the projection contract,
   or explicitly gate unsupported requests. OPF/GPF is now implemented and tested
   locally; that does not resolve the other filters or legacy fuel omission.
3. **Category mapping needs fixture evidence.** Legacy classification derives
   taxonomy groups from broad product text, while projection uses stored key or
   label. Confirm all customer-facing category IDs map to the same projection
   keys before enabling category parity claims.
4. **Facet statistics are not yet equivalent.** The projection adapter derives
   stock counts from the global warehouse ID set and filtered total, and derives
   price bounds from prices on the returned page. Legacy computes filtered
   population statistics. Counts can be wrong under brand/category/vehicle/price
   filters and price sliders can become page-dependent. Recompute from the
   filtered candidate population or provide a bounded facet read model.
5. **Scope requires data cleanup before a strict auto predicate.** The current
   `auto -> null` behavior is an intentional coverage bridge for legacy `SHOP`
   rows, not a correctness proof. Measure and quarantine moto leakage, then
   normalize scope keys/migrate the legacy rows before changing it to exact auto.

## Suggested acceptance checks

- Compare legacy and projection result IDs for auto and moto with no filters,
  then with each vehicle cascade dimension and a multi-brand URL.
- Exercise URL-initialized `productType`, `productKind`, `opfGpf`, and `strict`
  states directly; confirm either exact projection behavior or an explicit
  legacy gate.
- Extend `preOrder` verification to actual filtered stock summary counts.
- Test B2C, B2B, and brand-discount sessions across all three currencies and
  Europe pricing for price bounds and sort.
- Compare category facets and selected-category results for every
  `SHOP_STOCK_CATEGORY_GROUPS` ID, including derived keyword groups.

Production actions performed: none.
