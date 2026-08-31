# OneCompany Catalog V2 — master execution plan

Status: active implementation plan  
Owner: OneCompany engineering  
Last updated: 2026-08-30  
Companion files: [STATUS.md](./STATUS.md), [agent workflow](../../.agents/workflows/catalog-v2-execution.md)

## 1. Mission

Build one lossless, fast, data-driven catalog that:

- supports 100,000–500,000 products without request-time full-catalog scans;
- keeps every product, variant, translation, price, media item, metafield, attribute,
  fitment fact, evidence record, and source value;
- provides exact brand, make, model, generation/chassis, year, engine, fuel, body,
  drivetrain, transmission, market, and OPF/GPF filtering where those dimensions
  matter;
- supports products where some dimensions are verified as irrelevant;
- makes admin price, inventory, content, media, visibility, and compatibility changes
  visible without a deploy;
- keeps existing localized and brand storefront URLs operational during migration;
- remains reversible until data and query parity are proven.

Catalog V2 is not a second editable catalog. PostgreSQL canonical commerce data stays
the source of truth. V2 adds canonical identities, explicit compatibility semantics,
immutable source provenance, and rebuildable read projections.

## 2. Non-negotiable invariants

1. No destructive migration or production write without explicit owner approval.
2. No `prisma db push`; every schema change needs a forward migration.
3. No product is dropped because a field cannot yet be normalized.
4. Unknown fitment never becomes a verified exact match.
5. Stable product and variant IDs survive partial edits and imports.
6. Omitted arrays in a partial mutation do not mean “delete all”.
7. UA and EN stay in behavioral parity.
8. B2C, B2B, Europe, regional, currency, VAT, compare-at, and quote semantics are
   preserved and continue using the existing pricing domain helpers.
9. Brand-specific extraction is allowed only at ingestion boundaries. Public search
   and filters contain no brand-name branches.
10. No request handler loads every published product into Node.js.
11. Price and inventory changes do not regenerate every PLP/PDP.
12. Legacy readers and generated snapshots remain rollback/resilience paths until
    parity gates pass.

## 3. Confirmed baseline

Measured on 2026-08-30:

| Signal                              |                       Current result |
| ----------------------------------- | -----------------------------------: |
| Production catalog HTML TTFB        |                              ~170 ms |
| First uncached catalog API request  |                             ~10.45 s |
| Immediate CDN HIT                   |                              ~180 ms |
| New page cache key                  |                              ~4.93 s |
| New brand cache key                 |                              ~2.99 s |
| New text query cache key            |                              ~3.16 s |
| Current products                    |                              ~15,132 |
| Current loader page size            |                                  250 |
| Approximate DB pages at 100k / 500k |                          400 / 2,000 |
| Initial route payload before images | ~145 KB HTML + 380 KB JS + 80 KB CSS |
| Knowledge worker capacity           |                    ~80 products/hour |

The current shell is fast, but it contains no product cards. The browser hydrates a
3,765-line client page, waits an additional 600 ms, then calls an API that loads,
indexes, filters, scores, sorts, and facets the complete catalog before slicing 24
items. CDN caching hides repeated URLs but unique query/filter combinations expose
the full origin cost.

Known data-quality and preservation risks:

- legacy snapshot scope includes `auto`, `moto`, and 6,137 `SHOP` records with
  inconsistent normalization;
- engine is accepted as a URL/API value but is not a complete selectable UI facet;
- Knowledge V2 uses a global 95% coverage gate, so a large incomplete import can
  downgrade filtering for already-complete sources;
- nullable compatibility fields conflate wildcard, not applicable, and unknown;
- bulk import helpers replace relations and can change variant IDs;
- price, inventory, bulk status, and several import/sync routes do not publish a
  deterministic storefront invalidation event;
- broad ISR invalidations can re-render from stale process/Accelerate caches.

## 4. Architecture decisions

### AD-01 — PostgreSQL remains canonical

Canonical products, variants, prices, media references, attributes, applications,
translations, customers, and orders remain in PostgreSQL/Prisma. Generated JSON and
search projections are disposable derivatives.

### AD-02 — PostgreSQL read model first

The first production search implementation uses a compact indexed PostgreSQL read
model. An adapter boundary allows Typesense, Meilisearch, OpenSearch, or another
engine later, but a new service is adopted only when the 500k load gate demonstrates
that PostgreSQL cannot meet the agreed SLO or product requirements demand stronger
typo tolerance/relevance tooling.

### AD-03 — exact identities, aliases only at ingestion

Runtime query parameters use canonical IDs or stable canonical keys. Supplier labels
are converted through versioned alias/source mappings. Runtime search must not rely
on case-insensitive equality over arbitrary source strings.

### AD-04 — product/variant-level compatibility clauses

Compatibility is modeled as OR clauses containing AND constraints. Category policy
provides validation defaults; an individual product or variant owns the final
verified rule. Brand identity never determines filter behavior by itself.

### AD-05 — source truth and listing projection are separate

The full domain remains lossless. A compact projection contains only fields needed
to find, sort, facet, and render cards. Projection rows always carry source/product
versions and can be rebuilt deterministically.

### AD-06 — stable shell, dynamic indexed results

Marketing copy and the catalog shell can be statically cached. The first result set
is rendered on the server from the indexed query service. Client components own only
interactive transitions. Arbitrary filter permutations are not ISR pages.

### AD-07 — publication is a versioned state transition

“Saved” means canonical DB commit succeeded. “Published” means every required public
projection has applied the same or newer product version. Admin responses expose an
operation ID, product version, and publication state.

## 5. Target data model

All additions are additive until cutover.

### 5.1 Immutable source ledger

| Entity                      | Purpose                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `CatalogSource`             | Supplier, manual admin, legacy snapshot, or integration identity      |
| `CatalogSourceRecord`       | Immutable raw product payload/revision or Blob reference plus SHA-256 |
| `CatalogFieldProvenance`    | Raw path/value → normalized entity/field, mapper version, confidence  |
| `CatalogNormalizationIssue` | Quarantined/ambiguous/unmapped field with resolution state            |

Every incoming field receives one of `MAPPED`, `QUARANTINED`, or
`IGNORED_WITH_REASON`. Raw source records are never overwritten.

### 5.2 Canonical commerce identities

- `ShopBrand` and `ShopBrandAlias`;
- stable existing `ShopProduct` and `ShopProductVariant` identities;
- localized product content or the existing paired locale fields during transition;
- canonical category tree plus source-category mappings;
- normalized media asset/reference metadata including role, order, locale, region,
  optional variant, dimensions, checksum, and immutable delivery URL;
- `PriceBook` and `PriceEntry` for audience, region group, currency, validity range,
  priority, compare-at, and product/variant target;
- typed attribute definitions and values, extending the existing attribute tables.

### 5.3 Canonical vehicle taxonomy

- `VehicleMake`;
- `VehicleModel`;
- existing/extended `VehicleGeneration` or platform;
- `VehiclePowertrain` / engine;
- `VehicleConfiguration` for generation + engine/fuel + body + drivetrain +
  transmission + market/year validity;
- aliases/source mappings at every level, not generation only.

Legacy labels remain alongside canonical IDs until every source passes parity.

### 5.4 Compatibility clauses

Each product or variant has zero or more application clauses. Multiple clauses are
OR alternatives. Constraints inside one clause are AND conditions.

Each dimension has an explicit state:

| State            | Semantics                          | Strict filter behavior                 |
| ---------------- | ---------------------------------- | -------------------------------------- |
| `EXACT`          | Canonical value/range must match   | Pass only on exact match               |
| `ANY`            | Verified compatible with any value | Pass all values                        |
| `NOT_APPLICABLE` | Dimension does not affect this SKU | Pass without asking user               |
| `UNKNOWN`        | Evidence is insufficient           | Never report as exact; review required |

Rules:

- `EXACT` requires a canonical value or valid range;
- other states cannot silently carry an exact value;
- `UNKNOWN` products remain discoverable but are separated from verified matches;
- strict filters may not relax brand or selected vehicle constraints;
- variant-level clauses override product-level clauses for that variant;
- universal and parent-dependent products are explicit application modes.

Reference examples:

| Product   | Representative constraint profile                                      |
| --------- | ---------------------------------------------------------------------- |
| ADRO aero | make/model/generation/chassis/body exact; engine not applicable        |
| RaceChip  | make/model/generation/year/engine/fuel exact                           |
| Eventuri  | per SKU: generation exact; engine exact only where physically required |

## 6. Target read and request model

### 6.1 Projection

Introduce a rebuildable `ShopCatalogProjection` (final schema approved in P1) with
compact card/search fields:

- product/variant IDs and source version;
- locale/search document version;
- scope, brand, category, type, status, publish, and stock keys;
- normalized SKU and stable rank;
- localized title/card copy/search vector;
- primary versioned media reference and dimensions;
- non-personalized sortable price bands where safe;
- projection version and timestamps.

Exact compatibility remains queryable through indexed canonical application rows.
Generic long-tail filters use indexed typed attributes. Price and availability may
be hydrated from separate volatile projections for the returned IDs.

### 6.2 Query path

```text
validated filters/searchParams
  -> canonical IDs
  -> one bounded indexed candidate query
  -> indexed EXISTS for applications/attributes
  -> stable keyset cursor + LIMIT 25
  -> disjunctive facet queries/rollups in parallel
  -> hydrate 24 cards + runtime price/stock
  -> return schemaVersion + catalogVersion + items + facets + pageInfo
```

Required query properties:

- no offset scan for deep pagination;
- no unbounded `findMany` or product-ID list;
- exact/prefix SKU path distinct from localized text relevance;
- deterministic stable ordering;
- facets represent the current candidate intersection and exclude their own facet
  when counting alternatives;
- make → model → generation → engine options are data-driven;
- query complexity and row counts are observable through `Server-Timing`/traces.

### 6.3 API and RSC boundaries

Planned shadow HTTP contract:

- `GET /api/shop/catalog/v2/search`;
- `GET /api/shop/catalog/v2/suggest`;
- `GET /api/shop/catalog/v2/fitment`.

The Server Component calls the shared query service directly and passes a serializable
initial result to a small client catalog component. Route handlers reuse the same
service for client transitions; the server page does not make an internal HTTP
round-trip.

## 7. Publication and caching model

### 7.1 Unified mutation coordinator

Every editor, price, inventory, bulk, CSV, Airtable, Atomic, and supplier write must
flow through one domain coordinator or a trigger/CDC safety net.

Within a canonical mutation transaction:

1. validate permissions, references, invariants, and optimistic version;
2. preserve stable relation IDs with upsert/diff semantics;
3. update canonical rows;
4. increment `product.version` or the relevant price-book/settings version;
5. write an immutable before/after revision and audit actor;
6. append a `CatalogOutbox` event with change domains;
7. update the minimal synchronous public projection where deterministic and cheap.

Change domains: `CONTENT`, `SEO`, `MEDIA`, `PRICE`, `INVENTORY`, `FITMENT`,
`TAXONOMY`, `VISIBILITY`, `SETTINGS`.

### 7.2 Publisher

- immediate post-commit processing is the normal path;
- the durable DB outbox guarantees recovery;
- cron is a recovery sweep, never the primary visibility mechanism;
- consumers are idempotent by entity version;
- bulk work claims bounded batches and parallel partitions;
- retries and dead letters are visible;
- knowledge enrichment is independent from price/stock publication;
- an external search engine, if later selected, is another versioned consumer.

### 7.3 Granular invalidation

| Change                | Required public action                                            |
| --------------------- | ----------------------------------------------------------------- |
| Content/SEO/media     | Update one projection; exact product tag and old/new PDP path     |
| Price/inventory       | Update volatile projection; no PLP/PDP regeneration               |
| Fitment/taxonomy      | Update one search/application projection and affected facets      |
| Slug/visibility       | Add/remove one projection; exact redirect/tombstone and PDP paths |
| New brand             | Data/config only; no new cache namespace required                 |
| Global FX/region rule | Bump price-book/settings version; no per-product fan-out          |
| Media binary          | New immutable URL; update references; no broad image purge        |

Remove broad `revalidatePath('/', 'layout')`, unbounded paginated path invalidation,
and unused tags after the V2 readers own traffic. Next Data Cache tags and Prisma
Accelerate caches must never be treated as the same invalidation mechanism.

## 8. Frontend target

- Server-render the first 24 cards and primary facets.
- Stream independent slow sections behind meaningful skeletons.
- Keep interactive filter state in a small client island.
- Preserve current results during transitions.
- Use 150–250 ms debounce only for text entry; filter selections apply immediately.
- URL search params are the shareable source of filter state.
- Show only dimensions relevant to the current candidate set.
- Distinguish verified match, universal/not-applicable match, and requires-review.
- Dynamically import One AI, advanced modal filters, animation layers, and non-critical
  cart UI.
- Use approved product media only, through responsive versioned derivatives.
- Keep UA/EN and existing canonical/legacy route behavior under contract tests.

## 9. Workstreams and dependency graph

```text
P0 safety/baseline
  +--> P1 canonical contracts/schema
  |      +--> P2 projection/indexer
  |      |      +--> P3 indexed query APIs
  |      |      |      +--> P4 server storefront
  |      |      +--> P5 publisher/admin status
  |      +--> P6 source normalization/backfill
  +-------------------------------------> P7 shadow/canary/cutover
```

### P0 — safety, local correctness, and baseline

Deliverables:

- this plan, status ledger, and agent workflow;
- fail-safe partial mutation semantics and ID-preserving bulk imports;
- DB-less local unified catalog search/suggest/fitment;
- removal of artificial initial catalog delay;
- pure compatibility contract and golden examples;
- baseline metrics fixture and `Server-Timing` instrumentation plan;
- frozen catalog parity manifest design.

Exit gate:

- local catalog renders products without a DB;
- omitted mutation arrays cannot delete relations;
- compatibility semantics pass golden unit tests;
- current unrelated working-tree changes remain untouched.

### P1 — additive canonical foundation

Deliverables:

- reviewed ADR and Prisma forward migration for source ledger, brand aliases,
  vehicle taxonomy extensions, compatibility states, product versions/revisions,
  outbox, and projection tables;
- DB constraints and indexes;
- backward-compatible import schema v2;
- dry-run baseline fingerprint tool.

Exit gate:

- `prisma validate` and migration replay pass on a disposable database;
- all existing reads/writes remain valid with V2 flags off;
- no source or relation count changes.

### P2 — projection builder and publisher core

Deliverables:

- deterministic one-product projection builder;
- idempotent version-aware upsert;
- bounded bulk rebuild CLI with dry-run default, progress, resume cursor, and checksums;
- outbox consumer, metrics, retry, and dead-letter state;
- price/inventory projection boundary.

Exit gate:

- rebuilding the same product is byte/field equivalent;
- stale events cannot overwrite newer projections;
- single-product publication p95 <2 seconds in the test environment;
- bulk throughput is measured in thousands/hour or better, not 80/hour.

### P3 — indexed Catalog V2 query service

Deliverables:

- bounded search, suggest, fitment, and facet queries;
- canonical ID normalization at API boundary;
- keyset cursor contract;
- indexed text/SKU/application/attribute paths;
- shadow response and parity telemetry;
- 100k and 500k synthetic/read-only load fixtures.

Exit gate:

- DB query p95 <100 ms on target fixture;
- API warm p95 <200 ms and cold p95 <500 ms;
- suggest p95 <150 ms;
- row and query counts remain bounded with catalog size;
- deep pages do not cause offset/full scans.

### P4 — server-rendered unified storefront

Deliverables:

- Server Component catalog page with direct query-service read;
- serializable initial result for client transitions;
- progressive canonical facets including engine/fuel when relevant;
- responsive images and bundle splitting;
- loading/error/empty states and stale-response protection;
- UA/EN and URL-state contract tests.

Exit gate:

- meaningful product HTML before hydration;
- cached HTML TTFB p95 <300 ms;
- LCP p75 <1.8 s and p95 <2.5 s in agreed environment;
- initial incremental JS target <150 KB gzip;
- first card payload <100 KB gzip.

### P5 — unified admin publication

Deliverables:

- mutation coordinator used by editor, pricing, inventory, bulk, CSV, and sync jobs;
- optimistic concurrency and immutable revisions;
- `Saved` versus `Published` admin status;
- operation/version response contract;
- precise cache/projection actions per change domain;
- removal of broad invalidation from migrated paths.

Exit gate:

- admin commit → public visibility p95 <2 s, p99 <5 s;
- price/stock mutations create zero catalog-wide ISR writes;
- projection version lag is observable and returns to zero;
- failed publication cannot be reported as published.

### P6 — lossless normalization and backfill

Suggested source order:

1. RaceChip: exact engine/fuel/configuration case;
2. ADRO: engine-not-applicable aero case;
3. Eventuri: per-SKU mixed engine relevance and multi-model clauses;
4. remaining sources by data quality and business priority.

Deliverables:

- immutable raw source records and field provenance;
- reviewed aliases and normalization issue queue;
- source/category-level activation instead of a global 95% gate;
- legacy `SHOP` scope resolution with explicit audited mapping;
- per-source parity and fitment reports.

Exit gate:

- 100% identity/relation/media/metafield/price/localization coverage;
- every raw field mapped, quarantined, or ignored with reason;
- zero orphan applications;
- zero verified golden-set false positives;
- unknown products remain available but never labeled exact.

### P7 — shadow, canary, cutover, and decommission

Deliverables:

- old/new response comparison for representative and sampled traffic;
- feature flags by source/category/locale and canary percentage;
- rollback reader and documented rollback command/decision owner;
- progressive traffic activation;
- removal of legacy runtime full-catalog loaders only after sustained parity;
- generated snapshots retained only as explicit resilience artifacts.

Exit gate:

- all SLO and parity gates hold for the agreed observation window;
- owner approves production activation;
- rollback has been rehearsed on a non-production environment;
- no hidden brand-specific runtime compatibility branch remains.

## 10. Verification matrix

| Layer         | Required checks                                                                |
| ------------- | ------------------------------------------------------------------------------ |
| Pure domain   | compatibility truth table; UNKNOWN behavior; clause OR/AND semantics           |
| Import safety | partial payload; stable IDs; blockers; idempotent replay; collision behavior   |
| Schema        | Prisma validate; forward migration; clean replay; constraints/indexes          |
| Projection    | deterministic rebuild; version ordering; parity fingerprints                   |
| Query         | exact SKU; text; every facet; cursor; facet counts; query plan                 |
| Fitment       | ADRO/Eventuri/RaceChip golden cases; selected vehicle non-relaxation           |
| Pricing       | UA/EN, currency, Europe, B2C/B2B, inheritance, quote, checkout parity          |
| Publishing    | content, price, stock, media, visibility, fitment, retry/dead letter           |
| Frontend      | SSR HTML, hydration, URL state, loading/error, accessibility, responsive media |
| Scale         | 100k/500k cold/warm, unique queries, deep pagination, concurrent edits         |
| Rollout       | flag off/on, shadow diff, canary, rollback, stale version telemetry            |

Do not run production E2E checkout, mutating imports, migrations, deploys, or external
integration writes as part of verification without explicit approval.

## 11. Observability and SLOs

Required metrics:

- `catalog_query_duration_ms` by operation and cold/warm;
- `catalog_db_duration_ms`, DB query count, and rows examined/returned;
- `catalog_projection_version` and canonical-version lag;
- `admin_commit_to_catalog_visible_ms`;
- outbox age, backlog, retries, dead letters, and consumer throughput;
- shadow item/facet/count/order differences;
- verified/review/unknown fitment result counts;
- ISR writes by route/change domain;
- LCP, TTFB, initial JS, and card payload size.

SLOs:

| Metric                                  |          Target |
| --------------------------------------- | --------------: |
| Indexed DB query p95                    |         <100 ms |
| Search/facets warm p95                  |         <200 ms |
| Search/facets cold p95                  |         <500 ms |
| Suggest p95                             |         <150 ms |
| Cached HTML TTFB p95                    |         <300 ms |
| LCP p75 / p95                           | <1.8 s / <2.5 s |
| Admin commit → visible p95 / p99        |     <2 s / <5 s |
| Golden verified fitment false positives |               0 |
| Data parity at cutover                  |            100% |

## 12. Rollout and rollback policy

- Every new reader/writer is flag-controlled.
- V2 flags default off in Production until explicit activation.
- Shadow reads never alter the user response.
- Canary activation is segmented by source/category/locale, not a single irreversible
  global switch.
- Legacy columns/tables and readers remain untouched through the observation window.
- A failed SLO, parity mismatch, rising unknown-as-exact count, orphan relation, or
  publication lag violation stops rollout automatically or operationally.
- Rollback changes the reader flag; it does not reverse or delete canonical data.
- Destructive cleanup is a separately approved project after sustained success.

## 13. Definition of Catalog V2 done

Catalog V2 is complete only when:

1. 100k and 500k scale tests pass without request-time O(N) behavior.
2. First products are present in server HTML.
3. Brand, make, model, generation, engine, and all applicable filters use canonical
   identities and exact clause semantics.
4. New brands require ingestion mappings/configuration, not runtime storefront code.
5. Admin price, stock, content, media, visibility, and fitment changes meet publish
   SLO without redeploy.
6. Data parity is 100%, raw provenance is retained, and ambiguous values are queued.
7. No migrated mutation path uses broad layout/catalog invalidation.
8. Legacy full-catalog request loaders are no longer in the live path.
9. UA/EN, pricing, cart, checkout, PDP, PLP, and SEO contracts pass.
10. Production activation and later legacy deletion receive separate owner approval.
