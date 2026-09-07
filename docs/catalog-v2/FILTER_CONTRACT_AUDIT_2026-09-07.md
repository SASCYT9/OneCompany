# Catalog filter contract audit — 2026-09-07

## Scope and status

Source audit and subsequent local fixes for the stock catalog on branch
`codex/storefront-cost-optimization`: stock UI/URL state, legacy/SSR search route,
premium adapter, canonical vehicle resolver and projection query.

The initial audit used no production access. Follow-up patches now have local
unit and disposable-PostgreSQL evidence for preorder exclusions, correlated OPF
and fuel, viewer-effective pricing, requested-currency sorting and filtered stock
summaries. See [STATUS.md](STATUS.md) for exact final checks. These fixtures do not
certify current production coverage, large-catalog latency or complete reader parity.

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

| Dimension                             | Legacy reader                                                                        | Premium SSR projection                                                                                                                                               | Contract finding                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                   | Relevance scoring, SKU handling, and vehicle alias narrowing                         | `searchText ILIKE` only                                                                                                                                              | Supported, but ranking and vehicle-query semantics diverge. Validate vehicle-text cases before parity promotion.                                                                                                                             |
| `make` / `model` / `chassis` / `year` | Canonical ID bridge plus fitment filtering; strict mode can use same application row | Native mode retains all constraints; default bridge replaces these constraints with its resolved product IDs                                                         | Native engine/fuel/OPF requests retain the whole vehicle clause. Broad native mode remains opt-in pending coverage.                                                                                                                          |
| `engine`                              | Canonical path; strict application matching                                          | Projection-native correlated `ENGINE` constraint                                                                                                                     | Supported and intentionally native.                                                                                                                                                                                                          |
| `fuel`                                | Canonical application/clause fuel predicate; missing canonical evidence fails closed | Correlated `FUEL` constraint                                                                                                                                         | Locally verified with same-product cross-application negatives. DB-less fuel selection returns zero without semantic fallback.                                                                                                               |
| `opfGpf`                              | Canonical application/strict matching                                                | Correlated `OPF_GPF` predicate; accepts with/without and rejects unsupported values                                                                                  | Implemented and locally tested, including OPF-only selection, same-product cross-clause negatives, and live make/model facets. Production data coverage remains open.                                                                        |
| `productKind`                         | Inferred taxonomy filter                                                             | Non-`any` requests explicitly use legacy                                                                                                                             | Silent omission prevented; native normalized product-kind implementation remains open.                                                                                                                                                       |
| `productType`                         | Exact normalized type equality                                                       | Requests explicitly use legacy                                                                                                                                       | Silent omission prevented; native normalized key/index/backfill remains open.                                                                                                                                                                |
| `strict=1`                            | Trusted evidence and coverage rules                                                  | Requests explicitly use legacy                                                                                                                                       | Native equivalent trust/unknown semantics remain open.                                                                                                                                                                                       |
| `stock=inStock`                       | Warehouse SKU/slug predicate                                                         | Converts to bounded warehouse product IDs                                                                                                                            | Supported, subject to facet-count correctness.                                                                                                                                                                                               |
| `stock=preOrder`                      | Warehouse complement                                                                 | Warehouse IDs excluded from results/facets/summary                                                                                                                   | Selection and selected-population stock counts verified locally.                                                                                                                                                                             |
| `brand`                               | Multiple values are OR                                                               | Single brand supported; multiple distinct brands use legacy                                                                                                          | URL behavior is preserved by fallback; native multi-brand semantics remain open.                                                                                                                                                             |
| `category`                            | Taxonomy group IDs/labels and keyword-derived classification                         | Exact projection `categoryKey` or `categoryLabel`                                                                                                                    | Open parity risk: derived groups such as exhaust, brakes, and carbon aero need projection-key/data verification.                                                                                                                             |
| `scope=moto`                          | Filters resolved product scope to moto                                               | Exact `scopeKey=moto`                                                                                                                                                | Supported where projection scope is normalized.                                                                                                                                                                                              |
| `scope=auto`                          | Filters resolved product scope to auto, including legacy `SHOP` fallback behavior    | Adapter intentionally maps auto to null for legacy scope coverage; the diagnostic snapshot contains 6,137 rows outside normalized auto/moto, including legacy `SHOP` | Explicit compatibility debt. Mapping auto to exact auto would drop coverage until scope mapping/migration is complete; null can leak moto rows if projection contains them. Snapshot counts do not certify current canonical scope coverage. |
| `currency` / `minPrice` / `maxPrice`  | Effective viewer amount                                                              | Premium passes one viewer context to SQL and card hydration                                                                                                          | Differential PostgreSQL checks cover B2C/B2B, discounts, Europe, three currencies, default variants and null/zero. Other V2 callers without this context retain their previous price path. Scale evidence remains open.                      |
| `sort`                                | Explicit price sort now uses requested currency; quote-only items last               | Effective viewer price in Premium filters and ordering                                                                                                               | Locally verified. Default ranking and title collation parity remain separate work.                                                                                                                                                           |
| `page` / `limit`                      | Offset pagination after all filtering/ranking                                        | Bounded projection query/count with offset                                                                                                                           | Mechanically supported; projection count must remain aligned with filters.                                                                                                                                                                   |

## Open correctness and latency notes

1. **Effective-price correctness is locally verified; scale remains open.**
   Premium SQL now uses the same audience, region, currency, default variant and
   discount priority as card pricing. Ordered queries share one price evaluation
   between both bounds and sorting. On four fixtures, EXPLAIN reduced canonical
   product subplans from three to one and reads from eight to four. This is not a
   production latency benchmark. Price-bounded facets now share one materialized
   candidate set (six subplans / 18 reads became one / four on the same fixtures).
   Actual-query 1k/10k scale fixtures passed; at 10k the warm facet sample was
   419.83 ms. Representative data, cold/p95 and B2B-map cost still need measurement. Other V2
   callers without the context are outside this patch's pricing parity claim.
2. **Unsupported URL/chip filters now explicitly use legacy.** `productType`,
   non-`any` `productKind`, `strict=1` and multiple brands no longer enter a reader
   that ignores them. Native versions still need the contracts described below.
3. **Category mapping needs fixture evidence.** Legacy classification derives
   taxonomy groups from broad product text, while projection uses stored key or
   label. Confirm all customer-facing category IDs map to the same projection
   keys before enabling category parity claims.
4. **Selected-population stock/price statistics are fixed locally.** One SQL
   aggregate shares the listing predicate, ignores pagination, intersects stock
   IDs and returns effective price bounds in the requested currency. Global
   discovery semantics remain open: Premium still aliases `globalFilterStats`
   to filtered statistics; legacy's global price range uses a broader population.
5. **Scope requires data cleanup before a strict auto predicate.** The current
   `auto -> null` behavior is an intentional coverage bridge for legacy `SHOP`
   rows, not a correctness proof. Measure and quarantine moto leakage, then
   normalize scope keys/migrate the legacy rows before changing it to exact auto.
6. **Canonical selector presence is not completeness.** `getCanonicalFitmentOptions`
   returns early when canonical make/model rows exist. Example: canonical Audi A4
   plus legacy-only Audi Q5 yields only A4, because fallback is never consulted.
   This also affects makes/chassis under partial source coverage. Do not fix this
   by adding an unbounded request scan or restoring polluted legacy tags; validate
   normalized per-source option coverage and publish the complete indexed data.
7. **Engine options now respect the selected year.** The UI sends year and keys its
   detail request by year; canonical details and direct engines require matching
   YEAR evidence in the same clause. Exact ranges and explicit ANY/NOT_APPLICABLE
   pass; UNKNOWN/missing do not. The year dropdown retains the full model/chassis
   range. Real PostgreSQL tests cover early/late engines on one product, a different
   chassis and explicit year states. Invalid nonempty year returns HTTP 400.

## Current source coverage findings

The immutable manifest now contains 17,385 products. The original 14-source gate
supports 15,163; KW Suspensions (1,999) and Fi EXHAUST (223) appear in the generic
shard and have no canonical compatibility persistence adapters in that gate.
Their import writers save normalized-fitment metafields instead of canonical
policies. The extended gate reports unsupported sources and fails overall rather
than silently omitting them. This is an additional concrete dependency of item 6.

The new offline audit compares correlated clauses from normalization to canonical
storage and the real in-memory projection builder; engine identity, verification,
source reference and explicit states are checked separately from record counts.
It does not certify persisted projection publication or actual option endpoints.
Execution details, including the bounded-reader correction after PostgreSQL's
stack-depth failure, are tracked in [STATUS.md](STATUS.md).

FI draft normalization formerly marked review-required/unknown/empty/incomplete
fitment verified. It now retains the source applications but quarantines those
states. Parser/policy regressions pass; all 223 current source draft hashes remain
identical, with no existing DB rewrites. KW still needs its pure source policy
connected to canonical persistence; FI also needs immutable fitment-entry evidence
alongside its Shopify product payload before source replay can be certified.

## Product type, product kind, and strict implementation contract

`productTypeKey` and `productKindKey` are present in the persisted projection,
but the snapshot writer maps them directly from `record.productType` and
`record.productCategory`. Its `optionalText` validation checks emptiness and
length; it does not apply the storefront `normalizeShopSearchText` transform.
Legacy `productType` matching does apply that transform. Consequently, the
smallest safe projection predicate is not currently an indexed exact equality:
`lower(trim(productTypeKey))` would still differ on accents, punctuation, and
internal whitespace and would not use the existing ordinary indexes. First
define a canonical product-type key, backfill/rebuild projections, add an index,
then compare that key exactly. Until then, gate `productType` requests to the
legacy reader.

`productKindKey` is populated from the broad product-category field (often a
category slug). Legacy `inferShopAiProductKind` classifies the whole evidence
corpus (title, category, product type, SKU, tags, and localized terms) into
fine-grained kinds such as `downpipe`, `tips`, `coilover_kit`, and
`intercooler`. Therefore `productKindKey = requestedKind` would silently change
semantics and omit valid products. Product kind needs a versioned canonical
derived field, provenance, and fixtures against the current taxonomy before it
can be queried by projection.

`strict=1` is a fail-closed evidence mode. Legacy requires valid strict input,
ready coverage, active non-blocked knowledge/application rows, and trusted
same-application verification with explicit unknown handling. The premium
entry gate now routes `strict=1` requests to legacy until projection stores the
same evidence, trust/source rules, coverage gate, and version correlation.
Projection text or product-kind matches are not strict evidence.

## Completed source-policy follow-up

The full disposable persistence run retained all 15,163 supported source records
and commerce hashes. Source-to-canonical comparison now respects case-insensitive
taxonomy identity rather than treating supplier display casing as missing fitment.
The actual discrepancy was four unresolved Ilmberger products using `auto`; the
adapter now explicitly carries `moto` at normalization level. Local versioned
promotion retained previous policies, raw hashes and UNKNOWN make/model evidence.
All 14 supported sources then passed whole-clause canonical/projection comparison.
KW (1,999) and Fi EXHAUST (223) remain explicitly unsupported by this gate.

Canonical option queries now group duplicate text/year tuples in PostgreSQL.
The real helper integration captures GROUP BY SQL without LIMIT and verifies year
and chassis correlation. This preserves existing lists but does not fix the
partial canonical/legacy early-return coverage gap or certify public endpoints.

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
