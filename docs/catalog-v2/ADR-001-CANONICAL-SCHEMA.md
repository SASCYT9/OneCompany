# ADR-001: Catalog V2 canonical schema foundation

- Status: Proposed; implemented as a flag-off, additive schema and unapplied forward migration
- Date: 2026-08-31
- Owners: Catalog V2 workstream
- Decision scope: canonical identity, provenance, taxonomy, compatibility, revisions, publication cursors, and PostgreSQL read projection

## Context

The current catalog preserves valuable product data, but its identity and fitment semantics grew around separate brand importers. `ShopProduct.brand` is free text, vehicle applications are Knowledge-owned derived rows, and nullable fitment strings currently conflate “any”, “not applicable”, and “unknown”. In particular, the legacy `ShopVehicleApplication.variantId` uses `ON DELETE SET NULL`, which can turn variant-specific compatibility into product-wide compatibility after a deletion.

Catalog V2 must support hundreds of thousands of products and arbitrary future brands without per-brand filter branches. It must retain every current product scalar, locale, stable ID/SKU, media ordering/source, price, collection, tag, option, metafield, application, evidence, and knowledge record during migration. Admin changes must later publish without redeploying the site.

The migration in this ADR therefore creates a shadow foundation only. It neither copies nor updates a legacy row, activates a reader, enqueues an event, nor changes the current pricing source of truth.

## Decision

### 1. Existing product and variant IDs remain canonical

`ShopProduct.id` and `ShopProductVariant.id` remain the stable commerce identities. Catalog V2 adds only:

- nullable `ShopProduct.brandId` while preserving the legacy `brand` text;
- aggregate `catalogVersion` and `publishedCatalogVersion`, both starting at zero;
- `@@unique([id, productId])` on variants so every V2 row carrying both IDs can use a composite ownership foreign key.

The aggregate product version orders changes to all product-owned children. Independent variant clocks would create incomparable revisions and are rejected.

`publishedCatalogVersion` is a compatibility/convenience field, not proof that all consumers have caught up. Per-target receipts are authoritative.

### 2. Raw source evidence and mapping decisions are separate

The source layer is:

```text
ShopCatalogSource
  └─ ShopCatalogSourceRecord (immutable raw payload/blob reference)
       ├─ ShopCatalogFieldProvenance (immutable field mapping evidence)
       ├─ ShopCatalogNormalizationIssue (reviewable quarantine)
       └─ ShopCatalogSourceBinding revision(s)
            └─ ShopCatalogSourceBindingHead (current reviewed revision)
```

Each source record has `(sourceId, recordKey, sourceRevision)`, a SHA-256 payload hash, and exactly one of inline `rawPayload` or external `blobRef`. A supersession link may reference only the same `(sourceId, recordKey)` lineage. Database constraints permit one root and one successor per record, require a new revision to extend the current tail, and reject self-links and recursive cycles. A binding's composite `(sourceRecordId, sourceId)` foreign key prevents source A from claiming source B's raw evidence. Source records, bindings, field provenance, and product revisions are append-only at the database boundary.

A binding is not a permanent one-shot mapping. Corrections append the next `bindingVersion`, link `supersedesId`, and use action `MAP` or `TOMBSTONE`. Every correction/tombstone requires a non-empty decision reason, reviewer identity, and review timestamp. Typed product/variant foreign keys and polymorphic target guards prove that every `MAP` points to an existing canonical entity of the declared kind and prevent a bound canonical identity from later being changed or deleted. In the same transaction, the mutable head advances to the latest revision. The head’s composite foreign key proves that its source/entity/external identity equals the referenced immutable binding, while a deferred trigger makes a committed newer revision with a stale head impossible. Heads cannot be deleted; retirement appends a tombstone and advances the same head. This preserves both the bad historical decision and its reviewed correction.

Product/variant bindings and provenance use `(variantId, productId) → ShopProductVariant(id, productId)`. Raw evidence uses `RESTRICT` or `SET NULL` only where the raw record survives; it is never cascade-deleted.

### 3. Brand and vehicle identities are canonical; aliases are ingestion-only

`ShopBrand` provides stable brand keys while legacy brand strings remain untouched. Brand aliases are source-scoped.

Vehicle taxonomy becomes:

```text
VehicleMake
  └─ VehicleModel
       └─ VehicleGeneration (existing row, nullable canonical make/model links)
            └─ VehicleConfiguration
                 └─ optional VehiclePowertrain
```

Legacy `VehicleGeneration.make` and `.model` text are preserved. A composite model foreign key guarantees `generation.model.makeId = generation.makeId`; `modelId` cannot exist without `makeId`. A trigger also rejects a configuration whose known powertrain make differs from its generation make.

`VehicleTaxonomyAlias` is context-aware. Its lookup identity includes source, entity type, scope, parent make/model context, normalized alias, and a deterministic `aliasKey`; configuration aliases also carry generation context. A partial expression unique index permits only one active alias in one exact context while still allowing legal repeated labels such as `mk1` or `sport` in different contexts. Database checks and a consistency trigger reject a context that disagrees with the canonical target. Missing or conflicting context is quarantined rather than resolved by “first match”; the ingestion resolver and its ambiguity tests are an activation gate.

Aliases are resolved before runtime matching. Storefront filters use canonical IDs/keys only.

### 4. Compatibility has explicit truth states and no brand branches

The canonical graph is:

```text
Policy (one product or one variant revision)
  ├─ DimensionRule (required + non-EXACT default)
  └─ Clause(s), OR
       └─ Constraint(s), AND
            └─ Value(s), alternatives within one EXACT dimension
```

Dimensions mirror the pure TypeScript contract exactly:

`scope`, `make`, `model`, `generation`, `chassis`, `year`, `engine`, `fuel`, `bodyStyle`, `drivetrain`, `transmission`, `market`, `opfGpf`.

Every constraint has one state:

- `EXACT`: one or more typed alternatives are required;
- `ANY`: the dimension is intentionally unrestricted;
- `NOT_APPLICABLE`: the dimension has no meaning for this product;
- `UNKNOWN`: evidence is insufficient and must never produce an exact result.

Clauses are OR alternatives. Constraints inside a clause are AND requirements. Multiple values inside one `EXACT` constraint are alternatives for that one dimension. Verification is `VERIFIED`, `INFERRED`, or `NEEDS_REVIEW`.

Database invariants enforce:

- one active policy revision per `targetKey`;
- target and parent product/variant ownership through composite foreign keys;
- canonical policies use `RESTRICT`, never `SET NULL`, so deletion cannot broaden compatibility;
- defaults cannot be `EXACT`;
- non-`EXACT` constraints cannot own values;
- an `EXACT` constraint cannot commit without at least one value (deferred constraint trigger);
- value dimension/state must equal its parent constraint;
- typed value shape must match its dimension: make/model/generation IDs, year number/range, powertrain for resolved engine, and constrained scalar/boolean shapes elsewhere;
- an unresolved engine text value is permitted only under a `NEEDS_REVIEW` clause;
- neither canonical nor projection clauses containing unresolved engine text can later be promoted beyond `NEEDS_REVIEW`;
- a `NEEDS_REVIEW` policy cannot contain a verified clause, including after a mode update;
- an exact product or variant cannot directly depend on itself;
- years are integral and bounded to 1886–2200.

Variant policy overrides product policy when present. `PARENT_DEPENDENT` is an explicit policy link, not a brand-specific callback. The bounded projection preserves the policy mode and parent product/variant identity, and composite policy→clause→constraint foreign keys prevent orphan or mixed-version filter rows. Multi-node parent cycles require recursive validation in the mutation coordinator and remain an activation blocker; the database check only rejects direct self-parenting.

Examples:

- Eventuri for an M2: exact scope/make/model/generation; engine may be `NOT_APPLICABLE` when the product genuinely fits every engine in that generation.
- ADRO aero where engine is irrelevant: vehicle identity constraints plus engine `NOT_APPLICABLE`, not `NULL` and not `UNKNOWN`.
- RaceChip: required make/model/generation/year/engine (and fuel/transmission where supplied), with exact canonical powertrain values. Unresolved engine text remains `NEEDS_REVIEW` and cannot become verified exact.

### 5. Publication is version-pinned and recoverable

A mutation coordinator, implemented in a later workstream, must commit in one transaction:

1. the canonical change and incremented `ShopProduct.catalogVersion`;
2. an immutable `ShopCatalogProductRevision` snapshot and hash;
3. one deduplicated `ShopCatalogOutbox` event.

A PRODUCT outbox event must carry `revisionId`, `productId`, and `canonicalVersion`. Its composite foreign key targets exactly `revision(id, productId, version)`, and a deferred normalized-set guard requires event `changeDomains` to equal that revision's domains, so a worker and aggregate cannot route the same version differently. Event identity, linked revision, domains, and payload are immutable after insert. A worker therefore rebuilds from the immutable event revision rather than mutable current product state. A unique `(entityType, entityId, canonicalVersion)` identity makes duplicate logical events impossible even if a caller supplies a different dedupe key. PRICE_BOOK and SETTINGS events may omit a product revision until those canonical models are introduced.

Outbox lifecycle checks require:

- `PROCESSING` iff a complete, unexpired-at-write lease triple exists;
- `PENDING`/`RETRY` have no lease and no processed timestamp;
- `COMPLETED`/`DEAD_LETTER` have no lease and do have a processed timestamp;
- bounded attempts and a durable lease owner.

`ShopCatalogPublicationReceipt` stores one non-deletable cursor per `(entityType, entityId, target)` for `CONTENT`, `SEARCH`, `PRICE`, `INVENTORY`, and `SETTINGS`; delete-and-reinsert cannot bypass monotonicity. Both product clocks are non-negative and database-monotonic, and `publishedCatalogVersion` can never exceed `catalogVersion`; intentional forward leaps remain available for controlled backfill. `appliedVersion` is monotonic by database trigger and a positive product cursor is pinned to the exact immutable revision. Applied, processing, and failed product versions cannot exceed `ShopProduct.catalogVersion`. A product is fully published only when every target derived from that revision's change domains has reached the canonical version; a content-only revision does not wait for unrelated price, inventory, or settings work. Stored status is operational; version cursors are authoritative.

### 6. PostgreSQL projection is the bounded storefront read model

`ShopCatalogProjection` has one row per `(productId, locale)` and mirrors the pure `ShopCatalogProjectionRecord` contract. Decimal API versions are stored as `BIGINT`; API/RSC boundaries serialize them as decimal strings.

The projection persists:

- source/catalog/projection versions, with `projectionVersion = catalogVersion`;
- `sourceContentHash`, `canonicalRelationHash`, `compatibilityHash`, and final `contentHash` for loss/parity gates;
- stable slug/scope/status/stock/rank, normalized SKU, brand/category keys and localized labels;
- localized card/search text and flattened primary media metadata;
- nullable non-personalized minimum price bands only.

Variant SKUs, policy headers, clauses, and flattened typed constraints use child projection tables instead of unbounded JSON arrays. Composite variant ownership remains enforced. A database trigger rejects a lower `projectionVersion` and treats an equal version with a different `contentHash` as corruption, so a stale worker cannot overwrite newer content even if an adapter omits its conditional write. Hot indexes support keyset pagination, canonical filter equality, exact SKU, trigram search, and PostgreSQL full-text search. The pure builder keeps nested domain values; a persistence adapter performs the deterministic flattening.

Price bands do not replace current regional/B2B pricing. Canonical PriceBook normalization is deferred until all price precedence and regional-correction rules are audited.

## Supplier/import contract versioning

The existing strict supplier fitment V1 remains valid and authored V1 importers keep `version: 1`. V2 is a separate schema/runtime contract, not an in-place semantic rewrite. Its additive metadata covers:

- the same 13 dimensions and four explicit states;
- stable clause keys and verification;
- required dimensions and non-exact defaults;
- canonical make/model/generation/powertrain/configuration mapping hints;
- source key, record key/revision, payload hash, mapper version, and field-level provenance.

Each imported application remains an atomic clause so make/model/year/engine correlation is never flattened into independent arrays. A pure V1→V2 adapter preserves all raw V1 fields, emits no invented canonical ID, and marks unresolved mappings for review. Source adapters may normalize aliases; runtime product filtering may not branch on supplier or brand.

The source ledger remains authoritative even when an import mapping is later corrected: append a binding revision or tombstone and move the head; never overwrite the raw payload.

## Additive migration proof

Migration `20260831120000_add_catalog_v2_canonical_foundation` is intentionally DDL-only.

It contains:

- new enums, empty tables, constraints, indexes, functions, and triggers;
- nullable brand and canonical taxonomy links;
- `BIGINT NOT NULL DEFAULT 0` aggregate version columns;
- a logically redundant unique `(variant.id, variant.productId)` index needed by composite ownership foreign keys.

It contains no `INSERT`, legacy `UPDATE`, `DELETE`, `TRUNCATE`, destructive `DROP`, data copy, backfill, publication event, or feature-flag activation. Existing model fields and rows remain present. No Prisma migration or client generation was run while authoring this ADR.

Operational caveat: even a logically safe index on the populated variant table can briefly lock writes. Before production, test the live-like upgrade duration. If it exceeds the deployment budget, create that index concurrently in a separately reviewed non-transactional operation and attach the constraint afterward.

## Rollout and no-loss gates

1. Capture and archive the immutable Catalog V2 baseline fingerprint/loss ledger.
2. Replay all migrations on a clean database and apply this migration to a live-like clone.
3. Prove pre/post legacy product, variant, media, price, relation, knowledge, cart/order dependency counts, stable IDs, and hashes are identical.
4. Backfill source records, bindings, taxonomy, and compatibility in resumable dry-run batches. Quarantine ambiguity; never guess.
5. Build shadow projections in bounded batches and compare source/relation/content hashes.
6. Run legacy and V2 reads in shadow, compare ordered IDs, facets, prices, stock, and compatibility outcomes.
7. Canary by explicit flag only after zero unexplained loss and query-plan gates pass. Rollback switches readers back; it does not delete V2 evidence.

## Scale and query constraints

- No request-path scan may be proportional to the full catalog.
- Product listing uses stable keyset order `(stableRank, productId)` and indexed equality facets.
- Projection rebuilds batch by product cursor; outbox claiming uses `(status, availableAt, id)` and leases.
- Alias resolution is source/context indexed and happens at ingestion.
- Source payloads and immutable revisions may be partitioned or externally blob-backed later without changing canonical product IDs.
- Performance gates must include 100k and 500k product fixtures with `EXPLAIN (ANALYZE, BUFFERS)` budgets before V2 activation.

## Rejected alternatives

- Reusing `ShopVehicleApplication`: it is derived Knowledge state, lacks explicit truth states, and can broaden compatibility on variant deletion.
- One generic JSON fitment column: it cannot enforce target ownership, exact/non-exact value rules, or bounded canonical indexes.
- Global alias uniqueness: legitimate labels repeat under different makes/models and would either fail import or silently mis-map.
- SKU as canonical identity: current SKUs are nullable and not globally unique.
- ISR/whole-catalog invalidation as publication: cost and latency grow with catalog size, while admin writes need targeted versioned publication.
- Brand-specific runtime filters: every new supplier would reintroduce incompatible semantics and unbounded maintenance.

## Follow-up work and blockers before activation

- Implement and test the transactional mutation coordinator, immutable-revision outbox worker, and projection persistence adapter.
- Serialize source-binding target checks against canonical target identity changes, and serialize compatibility value writes against clause/policy verification promotion; the current cross-table triggers fail closed for ordinary writes but concurrent MVCC races require coordinator row/advisory locks plus DB integration tests.
- Execute clean replay and live-like upgrade tests; static contract tests do not replace PostgreSQL negative tests.
- Add DB integration tests for ownership mismatch, taxonomy context, alias ambiguity, binding correction/tombstone, policy target deletion, multi-node parent cycles, exact value shape, receipt regression, lease lifecycle, and stale event replay.
- Implement audited, resumable source/taxonomy/compatibility backfills and parity reports.
- Define canonical PriceBook and settings revisions only after current regional/B2B precedence is fully inventoried.
- Extend locale constraints through a reviewed migration before adding storefront locales beyond `ua` and `en`.

Catalog V2 remains flag-off until every item above required by the master plan has an owner, an executable gate, and an observed passing result.
