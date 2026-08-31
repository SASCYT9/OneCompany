# ADR-002: Versioned catalog publication pipeline

Status: Accepted as the P1/P2 contract; not activated in Production  
Date: 2026-08-31  
Related: [MASTER_PLAN.md](./MASTER_PLAN.md), [ADR-001-CANONICAL-SCHEMA.md](./ADR-001-CANONICAL-SCHEMA.md)

## Decision summary

Catalog mutations will commit canonical data, an immutable revision, a monotonic entity
version, and a generic catalog outbox event in one PostgreSQL transaction. A
version-aware publisher will update only the affected projections and cache keys.
Admin responses will distinguish `SAVED`, `PUBLISHING`, `PUBLISHED`, and `FAILED`.

This pipeline replaces catalog-wide ISR regeneration as Catalog V2 readers take over.
It does not replace the existing Knowledge V2 outbox, which remains responsible for AI
knowledge indexing.

## Current-state findings

1. The main product editor already writes canonical changes and an admin audit record
   within a Prisma transaction. Storefront revalidation runs after commit, and failures
   are logged without changing the successful mutation response.
2. Product updates revalidate several UA/EN current and legacy paths individually, but
   other writers are inconsistent. Atomic sync still calls
   `revalidatePath("/", "layout")`, which can fan one change across the site.
3. `ShopKnowledgeOutbox` has useful claim/retry/dead-letter mechanics, but its payload,
   triggers, dedupe keys, and worker are coupled to Knowledge V2. Its
   `<product>:SOURCE_CHANGED` key coalesces versions and cannot prove which canonical
   version is publicly visible.
4. There is no general product content/price/inventory publication version, no public
   projection lag contract, and no durable `Saved` versus `Published` state.
5. Current catalog and brand readers combine PostgreSQL, Prisma/in-process caches, ISR,
   and generated fallbacks. Invalidating a Next cache does not invalidate every other
   layer.

## Transaction contract

Every Catalog V2 writer must use one mutation coordinator. Direct legacy writers remain
behind flags until migrated or protected by a database trigger/CDC safety net.

Within one transaction the coordinator must:

1. validate authorization, optimistic version, references, pricing invariants, and
   deletion blockers;
2. preserve stable product, variant, media, option, metafield, application, and source
   identities;
3. write canonical changes;
4. increment the affected entity version exactly once;
5. append an immutable before/after revision and the existing admin audit entry;
6. append a generic catalog outbox event containing the entity version and exact change
   domains;
7. optionally update a minimal deterministic projection in the same transaction only
   when it is cheap and cannot call an external service.

Omitted import fields and relations mean "not owned/not supplied", never deletion.
Deletion requires an explicit versioned retire/tombstone command with actor, source,
reason, and blockers.

## Event contract

Change domains are fixed and composable:

`CONTENT`, `SEO`, `MEDIA`, `PRICE`, `INVENTORY`, `FITMENT`, `TAXONOMY`,
`VISIBILITY`, and `SETTINGS`.

Every event includes:

- immutable event ID and deterministic dedupe key;
- entity type and stable entity ID;
- positive monotonic canonical version;
- normalized, sorted change domains;
- old/new slug keys where applicable;
- actor/source/revision references in the persisted record;
- attempt, availability, lock, processed, failure, and dead-letter state.

Payloads carry identifiers and versions, not a second canonical product copy. Consumers
read the linked immutable revision for the event version from PostgreSQL and apply only
when the event version is newer than their current projection. A consumer may explicitly
coalesce work to a newer immutable revision, but must record that newer version; it must
never read the latest mutable row and label it with an older event version. Equal
versions are idempotent replays; older versions are successful stale skips.

Schema version 1 has one dedupe identity per entity and canonical version:
`SHOP_CATALOG:1:<entityType>:<entityId>:<canonicalVersion>`. Change domains are event
payload, not part of that identity. Reusing the key with different domains or revision
references is corruption and fails closed; it must not overwrite or reset an in-flight
event. Product events must link `(revisionId, productId, canonicalVersion)` to the exact
immutable product revision. `oldSlug` and `newSlug` remain distinct for redirects and
tombstones even though an exact deduplicated `slugKeys` list is also emitted for cache
actions.

The pure executable contract lives in
`src/lib/shopCatalogPublication.ts`. It intentionally uses decimal version strings at
the JSON boundary so JavaScript `bigint` never crosses a Route Handler or RSC boundary.

## Projection boundaries

| Change domain               | Required projection work                               |
| --------------------------- | ------------------------------------------------------ |
| Content, SEO, media         | Product content/card projection and search projection  |
| Fitment, taxonomy           | Search/application projection and affected facets      |
| Visibility                  | Add/remove content and search projection               |
| Price                       | Volatile price projection only                         |
| Inventory                   | Volatile inventory projection only                     |
| Settings/FX/regional policy | Versioned settings/price-book state; no product fanout |

The canonical tables retain every source fact. Projections contain only rebuildable,
public read fields and canonical IDs. Losing or rebuilding a projection must never lose
product information.

## Publisher and recovery

- A post-commit publisher attempt is the normal path and targets the newly created
  outbox event directly.
- A bounded cron worker is a recovery sweep, not the normal visibility mechanism.
- Claims use skip-locked/version-aware semantics, bounded batches, exponential retry,
  and visible dead letters.
- A consumer writes its projection and target receipt's `appliedVersion` atomically.
- The version comparison and conditional projection write happen in the same database
  transaction; a stale worker cannot pass a read-time check and overwrite a newer
  projection later.
- A stale event cannot overwrite a newer projection.
- Search, price, inventory, cache, and optional future external-search consumers use
  the same entity version but maintain independent completion state when needed.
- One durable receipt per entity and projection target stores monotonic `appliedVersion`,
  `processingVersion`, and terminal `failedVersion`. A target advances only after all of
  its work for that version (including every required locale) commits successfully.
- The outbox event becomes `COMPLETED` only when every target required by its normalized
  change domains has applied that version or a newer explicitly coalesced version.

## Cache and Next.js boundary

The shared query service owns reads. Server Components call it directly; client filter
transitions use a GET Route Handler that calls the same service. The server page must
not call its own HTTP API.

Publication returns exact invalidation intents:

- stable product IDs;
- old and new slug keys;
- changed projection targets;
- catalog/settings/price-book version.

Pure price/inventory events carry no PDP slug invalidation keys. A supplied current slug
is not itself an invalidation request, and an actual slug change without a content, SEO,
media, or visibility domain fails closed.

No event may request a broad layout or whole-catalog invalidation. Content/SEO/media
may revalidate exact current and old UA/EN PDP paths. Price and inventory changes do
not regenerate PLP/PDP HTML. Next Data Cache tags, ISR paths, in-process caches, Prisma
Accelerate, and the database projection are separate mechanisms and must be observed
and invalidated explicitly while they coexist.

Cache Components are not required for this phase. The read model and bounded query
must meet their SLOs before another cache layer is added.

## Admin visibility state

Given canonical version `C`, the required target set `R` derived from the current
event's normalized domains, and each target receipt's `appliedVersion` `A(t)`:

- `PUBLISHED`: every `t` in `R` has `A(t) = C`;
- `SAVED`: canonical commit succeeded and at least one required target is behind, with
  no worker or terminal failure recorded for `C`;
- `PUBLISHING`: at least one required target owns `processingVersion = C` and not every
  required target has applied it;
- `FAILED`: at least one required target has terminal `failedVersion = C`;
- impossible/corrupt: any receipt version is newer than the entity canonical version,
  which fails closed and alerts.

Receipt version fields are authoritative. Any stored display status is denormalized and
must be updated in the same transaction as those fields. The product-level
`publishedCatalogVersion` is an aggregate acknowledgement: it advances to `C` only after
all targets required for `C` have caught up; it is not proof that every projection type
was rebuilt for a domain that did not require it.

The admin mutation response must return the operation/event ID, canonical version, last
published version, and state. It must never report `Published` merely because a DB
transaction or `revalidatePath` call succeeded.

## Source ownership and retirement

Raw supplier records are immutable and addressable by source plus supplier object ID
and source version/hash. Normalized fields record provenance and ownership. A source may
update only fields/relations it owns unless an explicit reviewed override exists.

Identity changes follow create-or-link plus explicit retirement:

1. resolve the stable supplier identity;
2. update the existing canonical relation when identity matches;
3. create a new relation when the supplier identity is genuinely new;
4. retire the old relation only through an explicit tombstone after blocker and parity
   checks;
5. retain the raw source record, revision, and audit trail.

## Observability and acceptance

Required measurements:

- canonical and published versions per entity;
- applied/processing/failed version and lag per required projection target;
- commit-to-visible latency;
- outbox age, backlog, attempts, retries, and dead letters;
- projection build duration and consumer throughput;
- exact cache actions by change domain;
- cache/ISR write units by change domain, target, and triggering tag/path, plus rejected
  broad-invalidation attempts;
- stale/idempotent/apply event counts;
- shadow parity differences.

Acceptance gates remain:

- single-product admin commit to public visibility p95 under 2 seconds and p99 under 5
  seconds in the agreed test environment;
- price/inventory mutation creates zero catalog-wide ISR writes;
- stale events cannot overwrite newer projections;
- failed publication is visible and retryable;
- V2 flags off preserve every existing reader and writer.

## Rollout sequence

1. Add nullable/defaulted schema, indexes, and constraints through a reviewed forward
   migration; do not activate triggers or readers.
2. Backfill versions/source ledger/projections in bounded dry-run-first jobs and compare
   the immutable loss ledger.
3. Enable shadow projection writes and parity telemetry per source/category.
4. Migrate admin/supplier writers one by one to the mutation coordinator.
5. Enable immediate publisher, leaving cron recovery active.
6. Canary V2 readers only after query and parity gates pass.
7. Remove broad invalidation and legacy runtime loaders only after sustained production
   observation and separate owner approval.

No migration, backfill, trigger activation, deployment, or Production write is part of
this ADR change.
