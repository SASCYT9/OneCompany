# Catalog V2 — live execution status

Last updated: 2026-08-31  
Working branch: `codex/catalog-v2-foundation`  
Master plan: [MASTER_PLAN.md](./MASTER_PLAN.md)

## Current sprint: P6 lossless normalization and backfill

| ID        | Work item                                      | Status      | Verification / remaining work                                         |
| --------- | ---------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| C2-P6-001 | Deterministic raw-field coverage contract      | Done        | Every scalar/empty value gets stable path, ordinal, and fingerprint    |
| C2-P6-002 | Per-source coverage/parity report              | Done        | Bounded current-head audit, fail-closed activation CLI, PostgreSQL proof |
| C2-P6-003 | RaceChip normalization/backfill                | Done        | Lossless ledger, taxonomy aliases, versioned 13-dimension policies, PostgreSQL proof |
| C2-P6-004 | ADRO normalization/backfill                    | In progress | Lossless normalization/audit green; transactional persistence next     |
| C2-P6-005 | Eventuri mixed-policy normalization/backfill   | Pending     | After ADRO                                                             |

The P6 field ledger now deterministically flattens arbitrary supplier JSON without dropping empty
arrays/objects or repeated array values. Each leaf must be mapped to a canonical target,
quarantined with an issue, or ignored with an explicit reason; otherwise that source record cannot
be activation-ready. Fingerprints are stable across object key order.
The per-source reader processes at most 500 current revision heads per page and requires immutable
inline payload, a current canonical binding/tombstone, complete valid provenance, no quarantined
fields, and no open issues before activation. The read-only CLI is forbidden in Production,
requires explicit database-read authorization, fingerprints its report, and exits non-zero for an
incomplete source. Disposable PostgreSQL proves an incomplete record becomes ready only after its
missing provenance is supplied.
RaceChip dry-run now covers all 5,181 immutable snapshot products and all 232,536 raw leaves with
one provenance entry per leaf. It exposed 883 non-unique supplier variant SKUs affecting 2,744
vehicle applications, so source identity is product ID plus SKU rather than SKU alone. The strict
configuration mapper verifies 4,347 records and quarantines 834 fuel-ambiguous records for review;
unknown fuel never becomes exact. See [RACECHIP_AUDIT_2026-08-31.md](./RACECHIP_AUDIT_2026-08-31.md).
The RaceChip writer is bounded to 50 sorted records per Serializable transaction, validates complete
product/variant ownership, and atomically persists immutable source evidence, source-scoped taxonomy
aliases, make/model/generation/powertrain/configuration identities, and a versioned variant policy
with all 13 dimensions explicit. Engine exactness references a canonical powertrain rather than raw
text; ambiguous fuel produces `NEEDS_REVIEW` plus `FUEL=UNKNOWN`, never a verified match. Replays can
repair compatibility for a pre-existing ledger record, while source changes retire the old policy and
append the next revision. PostgreSQL proves insert/replay, five aliases, 13 rules and constraints,
canonical engine values, policy retirement/revision 2, unknown-fuel quarantine, coverage, and conflict
rollback. The CLI remains resumable, dry-run by default, and rejects Production commits.
ADRO normalization now covers 240/240 immutable records and 7,970/7,970 raw leaves. It produces 303
correlated vehicle applications across 240 products, verifies 234 products, and retains six
multi-model chassis ambiguities as `NEEDS_REVIEW` without dropping candidate applications. It never
derives an engine from trim text; the upcoming policy writer will persist aero engine/fuel as
`NOT_APPLICABLE`. See [ADRO_AUDIT_2026-08-31.md](./ADRO_AUDIT_2026-08-31.md).

## Completed sprint: P5 unified admin publication

| ID        | Work item                                      | Status      | Verification / remaining work                                                |
| --------- | ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| C2-P5-001 | Version-specific publication status contract   | Done        | Saved/Publishing/Published/Failed resolver and authorized no-store API        |
| C2-P5-002 | Product editor publication visibility          | Done        | Editor polls exact saved version; failed work is never presented as published |
| C2-P5-003 | Commit-to-visible latency and concurrency gate | Done        | 30 samples: p95 416 ms, p99 504 ms; exactly one same-version contention winner |

Publication status is derived from the exact outbox event and every required target receipt for
the requested canonical version. A successful product save remains `SAVED` until workers begin,
then becomes `PUBLISHING`; it reaches `PUBLISHED` only when every target applied that version.
Dead-letter jobs or version-matching failed receipts return `FAILED` with bounded error context.
The admin editor displays target lag and polls only while the version is non-terminal.
The reproducible disposable publication gate measures the complete commit-to-visible chain and
passes the P5 SLO with p95 416.027 ms and p99 503.758 ms. Same-version contention admits exactly
one writer. See [PUBLICATION_GATE_2026-08-31.md](./PUBLICATION_GATE_2026-08-31.md).

## Completed sprint: P3 indexed reads and P4 server-rendered storefront

| ID        | Work item                                      | Status      | Verification / remaining work                                                       |
| --------- | ---------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| C2-P3-001 | Bounded indexed listing and fitment query      | Done        | Keyset query, correlated clauses, shadow parity, and 500k EXPLAIN gate pass         |
| C2-P3-002 | Progressive facet and suggestion query service | Done        | Correlated facets plus bounded product/brand/vehicle suggestions pass the 500k gate |
| C2-P4-001 | Flag-off direct Server Component first page    | Done        | Explicit `ssr` only; default legacy branch makes no V2 read; first 24 cards are SSR |
| C2-P4-002 | Interactive progressive filters and pagination | Done        | GET fallback, client transitions, parent resets, abortable autocomplete, keyset next |

The V2 storefront reader has its own fail-closed `SHOP_CATALOG_V2_READER_MODE` contract and is
not coupled to shadow comparison. Missing, `off`, and invalid values keep the existing stock
catalog authoritative and avoid a projection query. Only explicit `ssr` opts into request-time
rendering and a direct indexed Server Component read. URL parsing already supports bounded
search plus brand/make/model/generation/year/engine/fuel and a complete keyset cursor. Listing and
facets load in parallel. Brand/make counts are updated atomically with every projection change;
their 500k warm p95 is about 0.02 ms. Optional compatibility dimensions unlock after model, so a
brand that does not require generation cannot block year or engine. Bounded suggestions and
client transitions operate over this serializable result.

## Completed sprint: P2 persisted projection and shadow reads

| ID        | Work item                                         | Status | Verification / remaining work                                                |
| --------- | ------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| C2-P2-001 | Persist projection batches and resumable rebuild  | Done   | Revision loader and durable restart checkpoint are green                     |
| C2-P2-002 | Mutation coordinator and outbox publisher         | Done   | Active writers and PostgreSQL retry/dead-letter/lease recovery drill pass    |
| C2-P2-003 | Flag-off indexed query and live shadow comparison | Done   | Compare-only stock endpoint telemetry; legacy response remains authoritative |
| C2-P2-004 | 100k/500k query-plan and scale gate               | Done   | PostgreSQL 17 EXPLAIN gate passes; product-first fitment path is indexed     |

P2 currently processes exactly one bounded page at a time, exposes its next product-ID cursor,
serializes writers per product, and rejects same-version conflicts. Immutable revisions provide
the concrete rebuild source. The leased outbox worker uses `SKIP LOCKED`, rejects lost leases, and
advances each target receipt monotonically. The PostgreSQL integration gate verifies the complete
mutation → revision → outbox → projection → query path.
No production or local storefront traffic has been switched to this adapter.
Latest scale verification: 100k/500k disposable PostgreSQL 17 gates pass all nine query
scenarios with no large sequential scan; 41 migrations replay cleanly to 136 public tables.
Focused contracts and full TypeScript pass.

## Completed sprint: P1 canonical foundation and shadow projection

| ID        | Work item                                                        | Status | Verification                                                         |
| --------- | ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| C2-P1-001 | Additive canonical schema, source ledger, fitment, and migration | Done   | Prisma valid; 40 migrations replay cleanly; schema diff is empty     |
| C2-P1-002 | Deterministic bounded shadow projection and parity               | Done   | Flag defaults off; keyset batches; rebuild/parity tests pass         |
| C2-P1-003 | Versioned publication, source ownership, and retire workflow     | Done   | Immutable revisions, exact outbox domains, monotonic target receipts |

Fitment V2 is included in P1: all 13 dimensions have explicit states, OR clauses remain
correlated, and `UNIVERSAL`, `PARENT_DEPENDENT`, and `NEEDS_REVIEW` cannot silently broaden
vehicle compatibility. No Catalog V2 reader or writer is enabled in production.

## Completed sprint: P0 safety and local correctness

| ID        | Work item                                                                  | Owner                 | Status | Dependencies                       | Verification                                  |
| --------- | -------------------------------------------------------------------------- | --------------------- | ------ | ---------------------------------- | --------------------------------------------- |
| C2-P0-001 | Master plan, workflow, and status ledger                                   | `/root`               | Done   | None                               | Link/format review                            |
| C2-P0-002 | DB-less unified search/suggest/fitment and remove artificial initial delay | `/root/catalog_perf`  | Done   | Existing fallback artifacts        | Unit contracts and local browser pass         |
| C2-P0-003 | Pure compatibility states, clause matcher, and golden cases                | `/root/catalog_model` | Done   | Existing fitment policy/types      | Unit tests and typecheck pass                 |
| C2-P0-004 | ID-preserving/fail-closed bulk partial update semantics                    | `/root/admin_cache`   | Done   | Existing admin PATCH mutation plan | Import regression tests and typecheck pass    |
| C2-P0-005 | Integrated verification and handoff                                        | `/root`               | Done   | 001–004                            | 88 tests, typecheck, lint, local browser pass |
| C2-P0-006 | Immutable baseline fingerprint/loss-ledger dry-run tool                    | `/root/catalog_model` | Done   | Existing snapshot and schema       | 15,132 products fingerprinted; 7 tests pass   |
| C2-P0-007 | Migrate or quarantine destructive legacy importer paths                    | `/root/admin_cache`   | Done   | Import merge helper                | Source guards, 16 focused tests, typecheck    |
| C2-P0-008 | Fail-closed Eventuri media migration per product                           | `/root/catalog_perf`  | Done   | Snapshot merge helper              | 7 focused tests, typecheck, lint              |

Status values: `Pending`, `In progress`, `Blocked`, `Review`, `Done`.

## Protected working-tree state

- `src/app/globals.css` was already modified before Catalog V2 execution began.
- Treat it as an unrelated user change. Do not overwrite, reformat, stage, or revert it.
- No agent is authorized to commit, push, migrate, deploy, or mutate Production.

## P0 completion checklist

- [x] Local `http://127.0.0.1:3000/ua/shop/catalog` renders real products without DB.
- [x] Local search, suggestions, and fitment return successful bounded responses.
- [x] Initial catalog request has no artificial 600 ms delay.
- [x] Omitted arrays in bulk partial updates do not delete relations.
- [x] Variant IDs/applications are preserved or a destructive request fails closed.
- [x] Compatibility contract distinguishes exact/any/not-applicable/unknown.
- [x] ADRO, Eventuri, and RaceChip golden tests pass.
- [x] Relevant tests pass: 88/88 integrated regression and contract tests.
- [x] Full TypeScript check passes.
- [x] Full ESLint `--quiet` reports zero errors; touched legacy search routes still report 18 pre-existing warnings in targeted non-quiet lint.
- [x] Snapshot baseline fingerprints all 15,132 generated products without a DB read or artifact write (`009f688342c7e66528d2004de13088dc9fb0ab02def8a8741c5e39c778121d41`).
- [x] Scoped Brabus, Burger, old DO88, and Akrapovič importers no longer use destructive relation replacement.
- [x] A partial Eventuri upload failure cannot reach the database merge for that product.
- [x] Diff review preserves the pre-existing user change in `src/app/globals.css`.

## P1 completion checklist

- [x] Catalog V2 schema is additive and the new reader remains disabled by default.
- [x] All 40 migrations replay from an empty disposable PostgreSQL 17 database.
- [x] Replayed database matches `prisma/schema.prisma` exactly (135 public tables).
- [x] Source records, bindings, revisions, provenance, review issues, and tombstones are explicit.
- [x] Projection batches are bounded to 500 products and use deterministic product-ID cursors.
- [x] Brand, make, model, generation, year, engine, and fuel facets are projected explicitly.
- [x] Publication separates content/search from volatile price and inventory targets.
- [x] Supplier Fitment V1 remains supported; strict V2 contracts and golden cases are covered.
- [x] Integrated P0/P1 verification passes: 96/96 tests, full typecheck, and full ESLint.
- [x] Immutable baseline is unchanged: 15,132 products, 13 stores, fingerprint `009f688342c7e66528d2004de13088dc9fb0ab02def8a8741c5e39c778121d41`.

## Next execution queue

| ID        | Work item                                                                              | Status | Depends on            | Exit evidence                                                                        |
| --------- | -------------------------------------------------------------------------------------- | ------ | --------------------- | ------------------------------------------------------------------------------------ |
| C2-P0-006 | Immutable baseline fingerprint/loss-ledger dry-run tool                                | Done   | P0 complete           | Counts and hashes cover canonical fields and dependency graph                        |
| C2-P0-007 | Migrate or quarantine legacy Brabus/Burger/old DO88/Akrapovič destructive import paths | Done   | Import merge helper   | Scoped active importers have no nested `deleteMany + create`                         |
| C2-P0-008 | Make partial Eventuri media migration fail closed per product                          | Done   | Snapshot merge helper | Primary/gallery/variant upload failure prevents product persistence                  |
| C2-P1-001 | Review additive Catalog V2 schema ADR and forward migration                            | Done   | Baseline contract     | 40 migrations replay; schema diff empty; baseline unchanged                          |
| C2-P1-002 | Implement deterministic `ShopCatalogProjection` builder in shadow mode                 | Done   | P1 schema             | Rebuild idempotency, bounded pages, and per-product parity                           |
| C2-P1-003 | Define explicit source ownership and retire/tombstone workflow                         | Done   | P1 schema ADR         | Immutable lineage, head advancement, and no-delete guards                            |
| C2-P1-004 | Audit remaining Ducati/IPE repair, rebuild, seed, and cleanup scripts                  | Done   | Import safety         | Every live path is ID-preserving or explicitly quarantined                           |
| C2-P1-005 | Add orphan-asset cleanup for failed multi-file Blob uploads                            | Done   | Media ownership ADR   | Failed product import leaves no unreferenced uploaded files                          |
| C2-P2-001 | Persist projection batches and add a resumable rebuild worker                          | Done   | P1 complete           | Cursor, counts, restart replay, and completion are durable                           |
| C2-P2-002 | Add mutation coordinator and transactional outbox publisher                            | Done   | P1 complete           | Active writers, optimistic revisions, bounded publication, and outage recovery drill |
| C2-P2-003 | Add flag-off indexed query adapter and shadow traffic comparison                       | Done   | P2 projection writer  | Correlated indexed query and compare-only endpoint telemetry                         |

## Residual risks after P0

- Safe merge deliberately preserves omitted relations. Explicit deletion requires a versioned retire/tombstone contract.
- Import batches are not yet atomic across all products; a later product failure does not roll back earlier successful products.
- Eventuri upload cleanup is bounded to assets newly created by the current run; failures deleting an orphan are surfaced in the import report for operational retry.
- Historical destructive repair/rebuild/seed/cleanup utilities are retained for forensic context but fail closed before database access and are not exposed as package commands.
- The current local fallback still pays a multi-second cold snapshot parse/index cost; the shadow read projection is the next performance phase.

## Residual risks after P1

- Atomic persistence, immutable-revision source loading, durable rebuild checkpoints, mutation coordination, and leased outbox processing exist. `/api/cron/shop-catalog` runs a bounded recovery batch every five minutes and rebuilds exclusively from the event's immutable revision. The full editor, soft archive, bulk visibility, inventory, and pricing writers schedule immediate publication after returning. Bulk visibility validates the complete ID set before writing and creates a versioned `VISIBILITY` event per product. Inventory and pricing keep variant values, product summaries, audit, lossless revision, and outbox in the same product-locked transaction. Import adoption plus retry/dead-letter operational drills remain.
- The creation coordinator now atomically creates a new product aggregate at version `1` together with its first immutable revision, receipts, and outbox event. Its disposable PostgreSQL regression is present but the latest local run was blocked because Docker Desktop was not running; the injected CSV adapter is covered separately by mock-transaction regressions.
- Central CSV commit now uses an injected catalog writer: production lazily loads the server-only creation/update coordinators, while dry-run and tests do not load publication runtime. Successful rows cannot be counted as created/updated without returning version, revision, and outbox metadata; partial-column and relation-ID preservation contracts remain green. The commit route schedules immediate bounded publication, with cron recovery. Supplier and brand-specific sync paths remain to migrate.
- Manual product creation now uses the same atomic version-`1` creation coordinator as CSV imports. Admin audit, the lossless snapshot, initial revision, publication receipts, and outbox event commit together, and the response exposes publication metadata before scheduling immediate processing.
- The live authenticated do88 batch route reuses the central catalog writer for both create and ID-preserving update paths, retains supplier fitment parent validation, returns publication metadata per successful product, and schedules immediate bounded processing.
- Authenticated Brabus and Burger live routes now publish through a shared snapshot-merge adapter. Brabus preserves its ambiguity-blocking SKU fallback; Burger remains slug-only because its supplier feed contains duplicate SKU pairs. Both create/update paths return revision/outbox metadata and schedule immediate bounded processing.
- The authenticated Atomic feed cron groups all matched variants by product and commits their inventory, price, product stock summary, lossless revision, and outbox behind one product lock. Missing feed products use atomic version-`1` creation, and the cron runs a bounded publication batch before returning.
- Turn14 single-item import, full-brand sync, and cart lazy hydration now share the central creation/update publication adapter. Product, default-variant pricing/weight, and first-media changes commit in one product-version transaction; all three live callers schedule bounded publication with cron recovery.
- Turn14 shipping/dimensions apply mode now groups variant changes per product and publishes each group behind the product catalog lock. The Perplexity dimensions fallback uses the same writer, audit/revision provenance is mandatory, and the live route schedules bounded publication; dry-run remains read-only.
- AI SEO generation validates and bounds all four generated strings before persistence, then commits SEO fields, admin audit, immutable revision, and outbox behind the product version lock. Successful responses expose catalog metadata and schedule bounded publication.
- Airtable stock cron now validates integer quantities, rejects conflicting duplicate SKU rows before any write, groups matching variants by product, and commits inventory, audit, immutable revision, and outbox under the product lock. It reports unmatched SKUs and schedules bounded publication.
- The Brabus content-tail cleanup is no longer an unauthenticated mutating GET. Read-authorized GET returns a dry-run plan only; write-authorized POST applies each changed product through the catalog coordinator with audit, immutable revision, outbox, and bounded publication.
- Category derivation now deduplicates category seeds before upsert, avoiding repeated writes per product. Changed product assignments publish `TAXONOMY` revisions under optimistic product locks, while the route keeps the response/audit bounded and schedules outbox processing.
- Storefront-tag backfill now applies each changed aggregate under its catalog version and publishes `TAXONOMY` plus `VISIBILITY` revisions. Per-product audit/snapshot/outbox state is atomic, a bounded batch summary is retained, and immediate publication has cron recovery.
- Manual fitment review now commits its normalized metafield, detailed admin audit, lossless snapshot, immutable `FITMENT` revision, and outbox event in one optimistic product transaction, then schedules immediate publication.
- Single-product One AI Quality mutations now atomically combine Knowledge V2 state/revision/outbox changes with the Catalog V2 lossless `FITMENT` revision and outbox under the product lock. The route schedules both targeted knowledge reindexing and catalog publication with independent cron recovery.
- One AI Quality bulk apply now uses the transaction-aware catalog coordinator inside its existing idempotent batch transaction. Product locks are acquired in stable ID order, Knowledge V2 and Catalog V2 events commit all-or-nothing at Serializable isolation, result ordering is preserved, and both outbox families receive immediate processing with cron recovery.
- Catalog V2 coordinator, snapshot loader, projection source, and deterministic projection builder now load in a plain Node server runtime. Explicit PrismaClient adapters preserve the Next singleton wrappers while allowing CLI/worker-owned connection lifecycles; a runtime import regression proves the boundary before legacy CLI migration.
- Urban GP Portal CLI commit mode now uses that explicit-client boundary for ID-preserving updates, version-`1` creations, and per-product archival of missing active products. Backup and blocker gates remain; already archived products no longer receive redundant revisions, and the CLI reports catalog outbox count for cron publication recovery.
- Monthly Atomic GitHub Actions no longer receives direct database credentials or runs the legacy Prisma writer. It invokes the authenticated versioned HTTP cron with retry/timeout controls; the local CLI is now only a bearer-authenticated endpoint client and contains no database mutation code.
- Atomic EU price CLI still performs exact-SKU source matching and dry-run artifacts, but commit mode now defers writes until the complete plan is known, groups variant/default-product price changes per product, and publishes atomic `PRICE` revisions through the explicit-client coordinator. Outbox IDs are recorded in the artifact for cron recovery.
- Ducati/Akrapovič AMS price sync preserves exact/verified-alias matching and its pre-write backup, but each changed product and its owned variants now commit under one optimistic `PRICE` revision. Variant ownership/count is revalidated inside the lock, and resulting outbox IDs are persisted in the report.
- Full Ducati/Akrapovič AMS catalog sync now publishes ID-preserving updates, version-`1` creations, and invalid-component archival through the explicit-client coordinator. Variant membership is revalidated during updates, backups safely serialize bigint catalog versions, and the final report records all catalog outbox IDs.
- Urban reconcile and GP-only commit modes now carry the planned catalog version into each normalization/archive operation. Product fields, normalized metafields, and intentional collection relinking commit with one lossless `CONTENT`/`FITMENT`/`TAXONOMY`/`VISIBILITY` revision per product; backups serialize bigint versions and the completion report exposes outbox IDs.
- Urban Ukrainian editorial curation retains force/only-wheel and dry-run behavior, while commit mode now applies each changed UA content/SEO field set through an optimistic `CONTENT` + `SEO` catalog revision and reports the queued outbox count.
- Runtime media-to-Blob migration now resolves all affected primary images, media rows, and variant images before writing, groups them by owning product, revalidates media/variant ownership inside the lock, and commits one `MEDIA` revision per product. JSON payload rewriting remains separate and outbox counts are reported; orphan cleanup after partial upload failure remains pending.
- Active IPE importer preserves its scoring, translation, dry-run manifests, local-media staging, and ID-preserving snapshot merge. Commit update/create paths now use the explicit-client coordinator across all product domains and persist catalog outbox IDs in the commit summary; per-record failures remain isolated and reported.
- Eventuri `repair-fitment`, `commit-draft`, and `publish-approved` modes now publish through Catalog V2. Fitment+tags, lossless draft update/create, and visibility/inventory activation each use the appropriate product domains and optimistic version; fail-closed all-media migration remains intact and every report records catalog outbox IDs.
- Brabus images-to-Blob commit mode now resolves successful URL mappings into product-owned groups and atomically rewrites primary, media, and variant image references under one `MEDIA` revision. Ownership is revalidated in the transaction, upload concurrency/dry-run behavior is retained, and outbox counts are reported; unreferenced-upload cleanup remains pending.
- Active Atomic English translation package commands now run through the TSX server runner. Commit mode dynamically loads the explicit-client coordinator, applies each translated content/SEO field set under its planned catalog version, and reports catalog outbox IDs; plain-JS syntax and package JSON are validated.
- Seventeen unreferenced destructive Brabus, Burger, Ducati/Akrapovič, IPE, dedupe, and media-trimming utilities now fail closed before Prisma client creation or product deletion. A source contract keeps them quarantined and prevents package-command exposure while preserving their historical transformation logic for later versioned rewrites.
- Eventuri media migration now checks deterministic Blob path ownership before upload, refuses overwrites, and tracks every URL created in the current run. Successful product commits retain their referenced assets; skipped products and database failures remove unretained uploads in `finally`, while pre-existing/shared blobs are never cleanup candidates.
- The live stock-search endpoint now invokes the indexed Catalog V2 query only under the fail-closed `compare` flag and never serves its result. Supported first-page/default-order requests emit bounded structured identity/order/continuation parity telemetry; unsupported legacy-only filters are skipped instead of generating misleading comparisons, and projection failures cannot fail the customer response.
- Monthly Turn14 GitHub Actions no longer receives database or supplier API credentials and cannot execute the legacy direct Prisma writer. It invokes a bearer-authenticated, allowlisted one-brand-per-request endpoint; the endpoint reuses the versioned Turn14 import service and runs bounded outbox publication, while the old CLI fails closed before Prisma initialization.
- The reproducible 100k/500k PostgreSQL scale gate checks first-page listing, 90%-deep keyset pagination, brand, trigram text, make-only fitment, and fully correlated make/model/engine/year fitment. An initially linear candidate-first plan failed the SLO and was replaced by a product-first planner-fenced query plus a case-insensitive expression index; the final 500k warm p95 is 90.02 ms at worst (deep keyset), with correlated fitment at 24.08 ms and no large sequential scans. See [SCALE_GATE_2026-08-31.md](./SCALE_GATE_2026-08-31.md).
- The V2 storefront now keeps result rendering on the server while a small client controller provides progressive URL transitions, complete descendant resets, HTML GET fallback, and debounced abortable suggestions. Suggestions are capped before vehicle lookups and preserve make/model clause correlation. A route-level flag-off rewrite keeps the old stock catalog available at the public URL without importing its client tree into V2; production-build entry JS fell from 191,298 to 148,294 gzip bytes. See [STOREFRONT_GATE_2026-08-31.md](./STOREFRONT_GATE_2026-08-31.md).
- Product administration now has a version-specific publication-status resolver and authorized uncached endpoint. The editor reports `Saved`, `Publishing`, `Published`, or `Publication failed` independently from the mutation response, exposes pending targets/version lag, and stops polling only at a verified terminal state. PostgreSQL integration covers saved, retry, published, and dead-letter transitions.
- The disposable P5 publication gate runs 30 complete canonical commit-to-visible cycles and a same-version contention race. Latest results are p95 416.027 ms, p99 503.758 ms, maximum 503.758 ms, zero final version lag, and exactly one contention winner. No catalog-wide ISR write is part of this V2 projection path.
- P6 per-source coverage reporting is bounded to current immutable revision heads and fails closed on missing payloads, bindings, raw-field provenance, quarantine, or open normalization issues. A guarded read-only CLI produces stable fingerprints and PostgreSQL integration proves the activation transition.
- The RaceChip immutable-shard mapper retains 5,181 vehicle-specific identities and 232,536/232,536 raw-field provenance entries. It detects repeated supplier SKUs instead of merging them, audits legacy scope mapping, creates exact engine configuration keys, verifies 4,347 records, and leaves 834 fuel-ambiguous records in review. Its transactional writer now persists source-scoped aliases and revisioned 13-dimension compatibility policies. No Production database backfill has been run.
- PostgreSQL policy integration now covers real compatibility rows and the optimized vehicle SQL path. This exposed and fixed the persistence boundary mapping from domain dimensions (`make`, `bodyStyle`, `opfGpf`) to Prisma enums (`MAKE`, `BODY_STYLE`, `OPF_GPF`); all 13 dimensions are mapped explicitly before policy and constraint insertion.
- The disposable PostgreSQL outage drill proves transient failure → `RETRY` → successful reclaim, bounded attempts → `DEAD_LETTER`, and expired lease → `LOST_LEASE` → a different worker reclaim. Revisions survive every failure, receipts advance or fail per target without version regression, and terminal jobs retain `processedAt`; the drill exposed and fixed a dead-letter transition that previously violated its own lifecycle constraint.
- No Production migration, backfill, reader switch, deployment, or database write has been performed.
- Multi-writer activation requires a shared lock/advisory-lock protocol for polymorphic binding targets and compatibility clause promotion.
- The 100k/500k PostgreSQL gate passes the current compact projection; production-like concurrency, commit-to-visible latency, and canary traffic still require measurement before reader activation.
- Price-book and global settings version sources need their concrete persistence adapters in P2.
- The current storefront still reads the legacy/local snapshot; therefore P1 alone does not remove its multi-second cold parse.

## Decision log

| Date       | Decision                                                      | Reason                                                                     |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-08-30 | PostgreSQL compact read model is the first search target      | Avoid premature service cost/consistency complexity; verify at 500k first  |
| 2026-08-30 | Compatibility rules are per product/variant, never per brand  | Eventuri/ADRO/RaceChip require different dimensions even within one source |
| 2026-08-30 | Unknown never counts as exact                                 | Prevent dangerous fitment false positives                                  |
| 2026-08-30 | Projection is rebuildable; canonical/source store is lossless | Fast reads must not discard product information                            |
| 2026-08-30 | Cache Components is not a P0 dependency                       | The database/request algorithm must be fixed first                         |

## Handoff template

Every completed item must add or report:

```text
Work item:
Outcome:
Files changed:
Contracts changed:
Tests run and exact result:
Data-loss/compatibility risks:
Known follow-ups:
Production actions performed: none
```
