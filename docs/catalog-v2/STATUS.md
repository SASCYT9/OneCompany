# Catalog V2 — live execution status

Last updated: 2026-08-31  
Working branch: `codex/catalog-v2-foundation`  
Master plan: [MASTER_PLAN.md](./MASTER_PLAN.md)

## Current sprint: P2 persisted projection and shadow reads

| ID        | Work item                                         | Status      | Verification / remaining work                                |
| --------- | ------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| C2-P2-001 | Persist projection batches and resumable rebuild  | Done        | Revision loader and durable restart checkpoint are green     |
| C2-P2-002 | Mutation coordinator and outbox publisher         | In progress | Core admin/imports plus Atomic feed cron green; remaining supplier/brand sync pending |
| C2-P2-003 | Flag-off indexed query and live shadow comparison | In progress | Query adapter is green; live endpoint comparison remains off |

P2 currently processes exactly one bounded page at a time, exposes its next product-ID cursor,
serializes writers per product, and rejects same-version conflicts. Immutable revisions provide
the concrete rebuild source. The leased outbox worker uses `SKIP LOCKED`, rejects lost leases, and
advances each target receipt monotonically. The PostgreSQL integration gate verifies the complete
mutation → revision → outbox → projection → query path.
No production or local storefront traffic has been switched to this adapter.
Current verification: 108/108 focused unit/contract tests, 2/2 disposable PostgreSQL
integration tests, full TypeScript, and full ESLint.

## Completed sprint: P1 canonical foundation and shadow projection

| ID        | Work item                                                        | Status | Verification                                                         |
| --------- | ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| C2-P1-001 | Additive canonical schema, source ledger, fitment, and migration | Done   | Prisma valid; 39 migrations replay cleanly; schema diff is empty     |
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
- [x] All 39 migrations replay from an empty disposable PostgreSQL 17 database.
- [x] Replayed database matches `prisma/schema.prisma` exactly (134 public tables).
- [x] Source records, bindings, revisions, provenance, review issues, and tombstones are explicit.
- [x] Projection batches are bounded to 500 products and use deterministic product-ID cursors.
- [x] Brand, make, model, generation, year, engine, and fuel facets are projected explicitly.
- [x] Publication separates content/search from volatile price and inventory targets.
- [x] Supplier Fitment V1 remains supported; strict V2 contracts and golden cases are covered.
- [x] Integrated P0/P1 verification passes: 96/96 tests, full typecheck, and full ESLint.
- [x] Immutable baseline is unchanged: 15,132 products, 13 stores, fingerprint `009f688342c7e66528d2004de13088dc9fb0ab02def8a8741c5e39c778121d41`.

## Next execution queue

| ID        | Work item                                                                              | Status      | Depends on            | Exit evidence                                                       |
| --------- | -------------------------------------------------------------------------------------- | ----------- | --------------------- | ------------------------------------------------------------------- |
| C2-P0-006 | Immutable baseline fingerprint/loss-ledger dry-run tool                                | Done        | P0 complete           | Counts and hashes cover canonical fields and dependency graph       |
| C2-P0-007 | Migrate or quarantine legacy Brabus/Burger/old DO88/Akrapovič destructive import paths | Done        | Import merge helper   | Scoped active importers have no nested `deleteMany + create`        |
| C2-P0-008 | Make partial Eventuri media migration fail closed per product                          | Done        | Snapshot merge helper | Primary/gallery/variant upload failure prevents product persistence |
| C2-P1-001 | Review additive Catalog V2 schema ADR and forward migration                            | Done        | Baseline contract     | 39 migrations replay; schema diff empty; baseline unchanged         |
| C2-P1-002 | Implement deterministic `ShopCatalogProjection` builder in shadow mode                 | Done        | P1 schema             | Rebuild idempotency, bounded pages, and per-product parity          |
| C2-P1-003 | Define explicit source ownership and retire/tombstone workflow                         | Done        | P1 schema ADR         | Immutable lineage, head advancement, and no-delete guards           |
| C2-P1-004 | Audit remaining Ducati/IPE repair, rebuild, seed, and cleanup scripts                  | Pending     | Import safety         | Every live path is ID-preserving or explicitly quarantined          |
| C2-P1-005 | Add orphan-asset cleanup for failed multi-file Blob uploads                            | Pending     | Media ownership ADR   | Failed product import leaves no unreferenced uploaded files         |
| C2-P2-001 | Persist projection batches and add a resumable rebuild worker                          | Done        | P1 complete           | Cursor, counts, restart replay, and completion are durable          |
| C2-P2-002 | Add mutation coordinator and transactional outbox publisher                            | In progress | P1 complete           | Editor, archive, bulk visibility, inventory, and pricing commit audit + lossless immutable revision + outbox atomically per product, use optimistic version checks, and trigger immediate bounded publication; import writers and failure drill remain |
| C2-P2-003 | Add flag-off indexed query adapter and shadow traffic comparison                       | In progress | P2 projection writer  | Correlated indexed query exists; endpoint comparison remains        |

## Residual risks after P0

- Safe merge deliberately preserves omitted relations. Explicit deletion requires a versioned retire/tombstone contract.
- Import batches are not yet atomic across all products; a later product failure does not roll back earlier successful products.
- A failed Eventuri product cannot mutate catalog data, but files uploaded before another file fails may remain orphaned in Blob.
- `scripts/seed-new-ducati-akrapovic.ts` and excluded IPE repair/rebuild/cleanup utilities still require the P1 safety audit.
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
- No Production migration, backfill, reader switch, deployment, or database write has been performed.
- Multi-writer activation requires a shared lock/advisory-lock protocol for polymorphic binding targets and compatibility clause promotion.
- The 100k/500k synthetic load and `EXPLAIN (ANALYZE, BUFFERS)` gates still need to be run before choosing final indexes or a search service.
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
