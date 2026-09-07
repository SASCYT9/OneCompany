# Catalog V2 — live execution status

Last updated: 2026-09-07
Working branch: `codex/storefront-cost-optimization` (P6 history below: `codex/catalog-v2-foundation`)
Master plan: [MASTER_PLAN.md](./MASTER_PLAN.md)

Current continuation/handoff: [IMPLEMENTATION_HANDOFF_2026-09-07.md](./IMPLEMENTATION_HANDOFF_2026-09-07.md).
It lists the complete remaining R01–R12 sequence after code commit `7077a0c1`;
this link does not mark any remaining implementation or release gate complete.

## Latest local wave: lossless policy and selector contracts (R01/R03 foundation)

Commits `28173047` and `ee399df3` add pure, dependency-free contracts for canonical policy
imports, publication gating, and the versioned selector read model. Unsupported KW/FI clauses remain
explicitly excluded with their raw evidence, while verified clauses produce
deduplicated, clause-correlated options, coverage metadata, deterministic
fingerprints, and bounded fingerprint-bound slices. Unknown engine values and
review clauses fail closed; omitted non-selector dimensions do not hide valid
vehicle options. The package has 8/8 focused tests, TypeScript, scoped ESLint,
and `git diff --check` passing. The publication gate blocks excluded clauses
before persistence while allowing explicit review state. KW/FI import writers
now persist through this contract; fitment serving remains guarded by published
readiness metadata.

Commit `c6697b89` adds the pure route adapter for makes, models, chassis,
details, and engines. It preserves clause correlation and returns `null` for
incomplete artifacts, so a future route can switch only after persisted
readiness metadata exists. Direct route wiring is intentionally still blocked
until that artifact is published and coverage is proven.

Commit `b63d41ac` centralizes bounded catalog URL parsing for SSR hydration and
history state. Invalid page, year, sort, stock, currency, and vehicle values
fall back deterministically; the focused URL suite passes 2/2.

Commit `43be32e5` centralizes the Catalog V2 storefront query DTO. Page/limit,
keyset cursor, brands, category, scope, stock, prices, currency, sorting,
product filters, facets, OPF/GPF, and vehicle dimensions now have one bounded
parser for records and `URLSearchParams`. The storefront reader suite passes
12/12, with TypeScript and commit hooks passing.

Commit `9aff1a24` narrows PDP related-product reads to the fields required by
three recommendation cards, with request coalescing and a production-safe
brand query; local/build modes retain the existing fallback. It also adds a
cache policy contract that only shares public responses when publication,
source coverage, and canonical/projection versions all align. Cache tests pass
5/5, and the PDP changes pass TypeScript and scoped lint.

Commit `e9c0d371` limits catalog media preloading to the first card for mobile
LCP; subsequent cards use native lazy loading. The image policy suite passes
2/2 with TypeScript and lint.

R02 coverage work is in commits `319ec361` and `0216429f`: a deterministic
source-revision coverage manifest records immutable revision heads and blocks
selector publication for missing, partial, unexpected, duplicate, or tampered
source entries. The focused coverage and selector suite now passes 16/16;
coverage is still a publication input and has not been run against production.

The R10/R05 cost and search pass is included in commit `3a90621d` (with the
deterministic install change in `08835e1c`). Build snapshot generation now
reuses the shared Prisma singleton, while ordinary product/SKU searches skip
vehicle-fitment enrichment and vehicle resolution retains only the fields it
needs. Focused vehicle-search tests (20/20) and TypeScript pass. Full catalog
snapshot generation on every production build remains the largest build-cost
item and needs a separately published artifact/cache design.

The R10 artifact boundary is now implemented in `scripts/lib/catalog-build-artifact.ts`.
`prebuild-shop-snapshot.ts` can restore a fully hashed, versioned catalog fallback and
settings/products snapshot from an opt-in cache under `.next/cache` (or an explicit
`CATALOG_BUILD_CACHE_DIR`), then skip the database-wide read. Reuse requires an explicit
immutable `CATALOG_BUILD_ARTIFACT_KEY`; an absent or mismatched key always falls back to
the database generation path. The cache validates every file, snapshot counts and shard
shape before restore, writes its manifest last, and is included in the Vercel source
package. Focused artifact/build-package/activation tests pass 7/7. The key still needs
to be issued by a future publication pipeline from a real catalog publication digest;
no production cache or environment variable was changed here.

Commit `efe1f086` adds an explicit BMW M5 G90 alias group. `BMW M5 G90` now
stays correlated to `BMW → M5 → G90 → S68`, while a broad `BMW M5` query remains
unrestricted. Vehicle search regression coverage passes 22/22.

R11 local verification under Node `22.14.0` passed TypeScript, the full Next
production build with readers off (590 static pages), SEO 18/18, full ESLint
(0 errors, 550 existing warnings), and `git diff --check`. The selected catalog
suite is 330/341 because 11 harness tests import unavailable `node:module`
`registerHooks`; this is a test-runtime compatibility issue to resolve before
claiming the full acceptance gate. No production action was performed.

Commit `ca15a76c` adds an opt-in, hash-validated catalog build artifact cache.
It restores snapshots only for an explicitly supplied bounded artifact key and
falls back to database regeneration on missing, corrupt, or mismatched data;
the focused artifact suite passes 4/4. The key must come from the authoritative
publication pipeline before enabling it on Vercel, so the default build remains
unchanged until that integration is configured.

Commit `018bb8ec` adds a 30-second browser `max-age` for public fitment
responses, reducing repeated mobile back-navigation scans while retaining the
existing CDN stale policy. Its focused contract suite passes 10/10. Commit
`ab038628` also parallelizes the independent chassis/generation GROUP BY reads
at the final selector level; TypeScript and scoped lint pass.

R03 selector readiness is now implemented in commits `4dd74a8b`, `9847e06e`,
and `f17f0dfd`. The canonical fitment reader checks active state, version and
fingerprint parity, completed rebuild checkpoint, both locales, and bounded
projection aggregates before serving selectors. The check is single-flight and
cached for 15 seconds; incomplete releases return `null` and retain the legacy
fallback. The checkpointed rebuild coordinator now accepts an explicit complete
source manifest and persists its source coverage marker atomically with
finalization; existing callers remain marker-free until they opt in.

Commit `2b266327` narrows the readiness unknown-dimension check to canonical
MAKE gaps. Optional UNKNOWN values such as engine, fuel, or body style remain
absent from selector options without blocking otherwise valid published
fitments; missing make identity still fails closed.

Commit `8bbc5b22` completes the local R01 persistence boundary for KW/FI. Both
writers now validate and persist the full V2 policy in the same transaction,
including review/unknown states and lossless multi-clause evidence; canonical
projection preserves model text when make taxonomy is unresolved. The same
commit adds a monotonic source-coverage marker using existing `ShopCatalogState`
columns, with 4/4 marker tests and 22/22 KW/FI evidence tests passing. The marker
is now available to the release coordinator through checkpoint finalization;
production reader activation still requires a real complete manifest and signed
release evidence.

The checkpointed projection coordinator now exposes an explicit
`sourceCoverage` opt-in on its final empty-page call. When supplied, it marks
the rebuild `COMPLETED` and persists the validated source-coverage marker in
one serializable transaction; marker validation failure rolls back completion.
Existing callers remain marker-free until they provide an immutable complete
source manifest and required source set. The integration path is covered by
the checkpoint contract test and the disposable PostgreSQL projection test;
no production rebuild or marker write was run.

Commit `abfa7c79` defers below-fold ADRO collage images with native lazy loading;
the hero/reel remains eager and the media-loading regression test passes 1/1.
This complements the existing first-card preload limit and does not alter remote
image optimization or CDN behavior.

Commit `4bbf4fec` restores the guarded Catalog V2 SSR route at `/shop/catalog`. Reader-off requests remain internally rewritten to the legacy storefront; explicit `ssr` requests render the projection-backed server page, and canary requests still require the request-bound canary header. Typecheck and the focused catalog/stock suite pass locally. A fresh local build and browser gate pass on the BMW M5 G90 scenario (LCP p75 220 ms, filter p95 574 ms, no application errors). The existing server on port 3000 was left untouched.

The disposable all-source runner was re-run after the local waves and remains
fail-closed: the fixture manifest still marks FI EXHAUST (223) and KW Suspensions
(1,999) unverified, and its historical selector fixture reports source-specific
parity differences. This is evidence that production source promotion is still
required; no fallback or synthetic exact matches were introduced to force PASS.

The R05 stock suggestion path now has a bounded Catalog V2 projection fast path when the
reader explicitly serves `ssr` (or an authorized canary request). It returns the same
brand/vehicle/product suggestion shape, records privacy-safe `catalog_v2_read` telemetry, and
keeps the existing full-fitment implementation only as the reader-off/local fallback. Projection
matching now accepts all normalized query tokens in any order and exact normalized SKUs, which
prevents reordered vehicle and separator-heavy part-number queries from missing valid results.
The focused suggestion contract tests pass 5/5 and scoped ESLint passes. Node 20/22 test modules
now use a compatibility harness (`18bec8bc`) so the selected catalog suite can run on the supported
runtime without relying on the unavailable Node 24 `registerHooks` API. No production flag, database
write, or deployment was performed.

## Latest local wave: preserve KW/FI import evidence (T4)

Starting from `2a207f69`. New FI imports now persist the raw Shopify product and
the separately correlated fitment entry together. KW imports retain the raw
product plus the complete normalization used at ingestion, including unresolved
makes, multiple chassis and inferred correlations. Versioned envelope hashes
cover both commerce source data and compatibility evidence; record keys remain
the stable external product IDs. Existing draft source hashes still describe the
original supplier product, while persisted source-record hashes describe the new
envelope. Both writers verify that the draft's supplier hash/revision and its
normalized-fitment metafield agree with current inputs before opening a transaction.

An identical import replays without duplicate rows. Changed evidence and old
pre-envelope records now fail with an explicit source-revision promotion error
instead of silently claiming idempotency. Binding locks serialize concurrent
imports of the same product. No existing source record or published product is
rewritten by these changes.

Raw variant provenance now resolves ownership using external variant IDs and
per-field occurrences. Nested selected-option arrays and missing optional fields
no longer shift ownership to another variant; FI variant provenance also uses
the variant's canonical ID rather than the product ID. Every source leaf remains
accounted for, including the additional compatibility evidence.

Validation evidence is in `artifacts/storefront-wave7-*`: both import CLIs pass
read-only preparation for 223 FI and 1,999 KW products; the selected catalog/stock/
pricing suite has 363 passing tests. Two real disposable PostgreSQL tests passed after
all 44 migrations and cover
envelope retention, unchanged replay, changed evidence rejection, stale drafts,
nested variant ownership and concurrent identical import. Final check results are
recorded in the corresponding integration, TypeScript and lint logs. TypeScript
passes; full ESLint has zero errors and the same 550 existing warnings. Tests
retain immutable history until the exact disposable container is removed; they
do not disable retention triggers to clean up individual source records.

This closes the evidence-retention prerequisite, not KW/FI canonical policy
publication or public selector completeness. The shared vehicle writer cannot
losslessly represent KW clauses with unknown make but known model, or preserve
all multi-value/per-clause verification semantics. Do not squeeze these records
through that adapter or treat them as supported by the 14-source gate yet.
The public fitment endpoint still has a partial-canonical early-return gap; its
legacy fallback loads the complete catalog and is not an acceptable new merge
strategy. Next: a lossless canonical persistence contract for these clauses and
a complete selector read model with source coverage/version evidence.

Production actions performed: none. Local branch commits only.

## Previous local wave: normalized selector coverage gate (T4)

Starting from `5f140cb9`. Added an offline oracle for all 14 source normalization
shapes and a bounded, 50-target-page canonical coverage audit to the existing
clean-commit all-source Docker gate. It compares whole per-target clauses, including
verification, source reference, explicit states, year bounds, engines, fuel,
transmission and OPF. Missing options, invented cross-clause combinations and
product/variant reassignment fail even when aggregate counts stay unchanged.
The real projection builder is checked independently for retained policy rules,
clause identity and canonical powertrain identity. Bounded mismatch samples are
written to the version-5 all-source report before a failed gate exits nonzero.

The first database run exposed an outdated generic-shard assumption: the current
manifest has 17,385 products, including 1,999 KW and 223 Fi EXHAUST without adapters
in this gate. They are now reported as unsupported and make the overall gate fail.
Both import writers currently save legacy normalized-fitment metafields rather
than canonical compatibility policies; adding them requires source-policy and
publication evidence, not dropping them from the denominator.

On `1a4ef094`, all 15,163 supported-source records persisted and replayed, and the
first three selector sources passed (ADRO 261, Akrapovic 425, Brabus 977). The large
Burger nested Prisma read then exceeded PostgreSQL's stack limit. The audit now
loads each relation in bounded keyset pages instead of expanding a whole target
page into one nested include; the CLI also persists an aborted/failing audit in
its report. The full rerun on `114b918c09206d40f94483a28910c3e6b03db132`
completed all 44 migrations, 15,163 inserts and idempotent replays, 666,469
provenance leaves, and lossless commerce/localization checks without a stack error.

The completed audit separated case-only taxonomy labels (for example `MINI` /
`Mini`) from actual lost fitment. Source-to-canonical comparison now follows the
existing case-insensitive make/model/generation keys; engine identities, years,
scope, states and whole-clause correlation remain strict. Canonical-to-projection
comparison retains exact label and ID checks. After this correction, only four
Ilmberger targets failed: empty review applications used the shared `auto` default.
The adapter now supplies `moto` even with no applications. A PostgreSQL regression
proves that MAKE/MODEL stay UNKNOWN and the policy stays NEEDS_REVIEW.

A restored disposable copy of that complete fixture was used to rehearse four
explicit source-revision promotions (`9d8ec2e8818d:scope-fix-fixture-v2`). All four
old policies and raw payload hashes were retained; new active policies have the
correct scope, and replay inserted zero records. The subsequent read-only audit
passed all 15,163 supported targets across all 14 sources with zero mismatches.
This is a restored-fixture recheck plus a four-target promotion, not a second full
backfill. The overall source gate still fails for 2,222 unsupported KW/Fi records.
Existing production policies need a reviewed, versioned re-normalization;
deploying adapter code alone will not repair an immutable source replay.

The request-time canonical option helper now uses PostgreSQL GROUP BY for text
values and year-range pairs instead of Prisma client-side distinct. Its predicates,
ordering and complete option sets are preserved. The actual helper's PostgreSQL
integration test captures SQL and requires GROUP BY without LIMIT, alongside the
selected-year/chassis and UNKNOWN/ANY/NOT_APPLICABLE behavior checks. No latency or
billing reduction is inferred from these correctness tests.

Validation: 352 selected catalog/stock/pricing unit tests and three real PostgreSQL
integration tests passed; TypeScript passed. Full ESLint passed with zero errors
and 550 existing warnings. The clean code commit for the read-only audit is
recorded in its JSON report. Local Node 24.19.0 is outside the
repository's supported >=20 <23 range; supported-runtime build remains a gate.
Artifacts: `artifacts/storefront-wave6-final-{regressions,db-tests,typecheck,lint}.log`,
`artifacts/catalog-v2-all-source/catalog-v2-all-source-gate.json`,
`selector-existing-fixture-audit.json`, `ilmberger-scope-fixture-promotion.json`.
Fixture dump SHA-256:
`5F9CAEDE01D46F0F877C0A6E7C0581062E914A42BAD3BFEEF07CDA9940334B10`.

Fi's draft builder also marked review/unknown/empty/incomplete fitment as verified.
It now keeps source applications but marks them needs_review/unknown-confidence;
all three established correlated statuses retain verified behavior. A regression
failed on the old status and passes after the fix. Complete draft hashes for all
223 current local FI records remain identical; those records contain no current
review-required or incomplete applications. No existing database rows were changed.

This gate covers normalized evidence -> persisted canonical policies
-> in-memory projection build. Raw-source extraction completeness, persisted
projection publication, storefront option endpoint coverage and production
activation remain separate, open gates. The offline audit does not run in requests;
only the option-query GROUP BY change above affects request-time behavior.
Production actions performed: none.

## Previous local wave: shared facet pricing and year-aware engine choices

Starting from `13f59354`. Root implemented T3 shared facet pricing and integrated
Terra's actual-query scale harness. Luna audited selector completeness and added
year request wiring; root completed canonical reader extraction, direct-engine
year filtering, invalid-year handling and the real database regression.

- Price-bounded effective-price facets now share one narrow materialized candidate
  set. Common locale/status/scope/text/ID/exclusion/price predicates are retained;
  brand/category branches retain their independent discovery behavior and vehicle
  options retain their correlated clause prefixes. Unpriced requests keep the old
  counter/query paths. On four identical fixtures the actual facet EXPLAIN changed
  from six canonical price subplans / 18 reads to one subplan / four reads.
- The actual-reader scale harness passed with 1,000 and 10,000 synthetic products
  (250 / 2,500 default variants). Warm single samples at 10k: ordered 401.40 ms,
  facets 419.83 ms, summary 411.86 ms; separate count 782.39 ms. These are B2B Europe
  UAH price-range reads after setup/reference reads/EXPLAIN, not p95, cold, full
  request, supplier, vehicle-policy or Vercel measurements. Broad-price cost still
  grows with candidates; 100k/500k acceptance and production savings remain open.
- Fitment details now receive the selected year and narrow only engine choices;
  year options remain broad for the selected model/chassis. Direct engines use the
  same rule. ANY/NOT_APPLICABLE year evidence is accepted; UNKNOWN/missing evidence
  does not satisfy a selected year. Invalid nonempty years return HTTP 400.
- Root checked same-product early/late engine clauses, explicit year states,
  other-chassis exclusion, direct engine/details parity, and unchanged year options
  on real PostgreSQL. DB-less local HTTP returns details for valid years and 400
  for invalid years. Local browser loaded BMW/M5/G90/2025 with 33 products and kept
  the year selection; engine evidence is absent in the local snapshot as expected.
- Final checks: 334 selected unit tests, five serial DB integrations and the two
  scale runs passed; TypeScript passed; full ESLint: zero errors / 551 warnings.
  Source contracts now follow the extracted readers, the aggregate count provider,
  and the already-translated admin failure label, retaining their semantic checks.

Artifacts: `artifacts/storefront-wave5-{regressions,final-integration,typecheck,lint}.log`,
`storefront-wave5-facet-plan-{before,after}.log`, `storefront-wave5-scale-{1000,10000}.log`.
All DB work used a fresh disposable localhost PostgreSQL after replaying 44 migrations.
No production credentials, reads, writes, flags or deployments changed. No full build
was run. Current Node 24 is outside the supported package range.

Confirmed next correctness gate: the canonical selector returns as soon as it has
any rows, so mixed coverage can omit legacy-only makes/models/chassis. A canonical
Audi A4 plus a legacy-only Audi Q5 yields only A4. This remains unfixed; merging all
legacy rows at request time would add cost and can restore known polluted fitments.
Complete normalized source projection and option-set coverage must precede cutover.
The concrete offline extension point is `scripts/verify-catalog-v2-all-source-backfill.ts`
(`draftsBySource` after persistence), invoked through the existing clean-commit
`shop:catalog:v2:all-source:docker` runner. Compare normalized source application
tuples with persisted canonical and projected clauses. Current raw-leaf coverage,
ownership and policy-count assertions do not establish selector option completeness;
the tuple gate is implemented in the latest wave above, with execution evidence
tracked there. Selector endpoint completeness remains open.

## Previous local wave: effective prices, stock summaries and fuel

Work items: T3/T4 filter correctness and price query cost; local implementation,
not production acceptance. Root integrated and reviewed Terra/Luna handoffs.

- Premium product filtering, sorting, facets and summaries now share the same
  viewer-effective price context as cards: B2C/B2B, Europe, explicit per-currency
  prices, discounts, conversion and product/default-variant null-versus-zero rules.
  The context is request-private and no new public response fields expose discounts.
- Ordered effective-price SQL reuses one canonical lookup for both bounds and
  ordering. EXPLAIN ANALYZE on four fixture products shows three canonical price
  subplans/eight reads before, one subplan/four reads after, for USD/UAH/EUR cases.
  This establishes removed repeated work, not a production speedup or scale gate.
- One selected-population aggregate replaces the count query and returns stock
  intersections and requested-currency price bounds independent of page/offset.
  Global-versus-filtered discovery statistics still need a separate contract.
- Legacy fuel now uses same-application/same-clause evidence and fails closed when
  unavailable. The extracted canonical resolver preserves the DB-less guard.
  Unsupported type/kind/strict/multiple-brand parameters explicitly use legacy.
  Legacy explicit price sorting now honors the requested currency; quote-only
  products sort last in both directions.

Final validation: 85 selected unit tests passed, four serial PostgreSQL integration
tests passed on the disposable database after the 44-migration replay, TypeScript
passed, and repository ESLint reported zero errors / 551 warnings. The price-query
integration also verifies the actual EXPLAIN plan shares a canonical price lookup.
Logs: `artifacts/storefront-wave4-regressions.log`, `storefront-wave4-final-integration.log`,
`storefront-wave4-typecheck.log`, `storefront-wave4-lint.log`, and the before/after
price-plan logs in the same ignored artifacts directory.

Local HTTP evidence: BMW/M5/G90
returns 47 snapshot products without fuel; adding unsupported snapshot fuel gives
HTTP 200, zero results and no semantic fallback. No production query was performed.
The old single-line source assertion was updated to allow multiline conditions
while retaining the local-mode guard and checking the extracted resolver guard.

Remaining release gates: current all-source canonical coverage/backfills, smart
text/category/scope parity, native type/kind/strict semantics, global facet discovery,
representative effective-price/facet query plans and latency, supported-Node build,
Preview/device matrix, production shadow/freshness/rollback and cost measurements.
Other V2 callers without the new effective context retain their existing price path.
Facet SQL repeated pricing across branches at that checkpoint (fixed above). Local Node 24.19.0 is outside the
declared >=20 <23 range. No production activation, migration, push or deployment.

## Storefront performance and correctness follow-up - 2026-09-07

User authorized local implementation of [PERFORMANCE_EXECUTION_PLAN.md](../../PERFORMANCE_EXECUTION_PLAN.md).
Root integrates/reviews GPT-5.6 Terra and GPT-5.6 Luna work in explicitly owned files.
User authorized local branch commits on 2026-09-07. Push, deployment, production migration and environment pulls remain unauthorized.
Older P6 Done rows below are historical evidence, not proof of current production reader coverage.

Post-checkpoint follow-up (`23106ffc`): native broad vehicle reads are implemented
behind `SHOP_CATALOG_V2_VEHICLE_READER_MODE=projection`, default `legacy`. The premium
adapter keeps make/model/generation/year together and bypasses the legacy resolver
in that mode. This does not certify current all-source coverage or enable Production.
`npm run build` now validates the existing signed release evidence before snapshots,
filter indexes or Next compilation. Native vehicle mode requires full SSR activation;
development NODE_ENV cannot bypass this build check. The marker is an activation
check, not a runtime lease that switches readers when it expires.

Follow-up verification: 29 selected unit tests pass, including the real premium
adapter with mocked data dependencies and the real vehicle planner (auto/moto,
UA/EN, stock/exclusions/price bounds, engine/fuel, and zero legacy resolver calls
in native mode). TypeScript and scoped ESLint pass with zero errors or warnings.
The build-wrapper failure test proves no snapshot/index/Next stage starts when
activation fails. No production build, DB backfill, deployment or measured
production speed/cost improvement is claimed by this opt-in patch.

Additional Luna audit: [filter contract matrix](FILTER_CONTRACT_AUDIT_2026-09-07.md).
The initial audit found release blockers including viewer-effective B2B price filtering/sorting,
product type/kind and strict URL semantics, category/scope normalization, filtered
stock/price statistics, and fuel handling on the legacy serving path. The new
reader remains opt-in; see the latest local wave above for resolved items and limits.

Next local fix wave: premium `preOrder` now excludes warehouse IDs across product,
facet and count inputs. OPF/GPF stays in the same clause, forces native vehicle
resolution, validates with/without, and uses live make facets instead of counters
that lack OPF evidence. Root reviewed and corrected the initial agent facet path.
Validation: 32 unit tests, TypeScript, scoped ESLint, and two serial disposable-DB
integrations passed after a clean 44-migration replay; the vehicle regression was
repeated after the final facet fix. Stock summary counts and the other audit
blockers were open at this checkpoint; the latest local wave supersedes that status.
No production environment or reader flag was changed.

| Package              | Local state                            | Evidence / remaining gate                                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C0                   | Environment isolated                   | Dedicated disposable localhost PostgreSQL; existing migrations replayed. DB-less preview remains separate.                                                                                                                                                                                                                                 |
| T1                   | Snapshot diagnostics implemented       | 17,385 products audited; four real Burger Kia/Hyundai/Genesis products have legacy BMW M5 G90 tags. Counts describe the snapshot, not current production.                                                                                                                                                                                  |
| T2                   | Local implementation verified          | Existing normalizer quarantines contaminated source evidence. Typed powertrain identity now survives actual canonical policy -> AdminSnapshot -> stored immutable revision -> projection replay. Review engine text stays review-only. Additive migration replayed on a fresh disposable DB; production coverage/backfill remains open.    |
| T3 / root            | Query consistency fixes implemented    | All-brand make/model facets; same-clause brand/category filtering; default vehicle SQL now retains IDs, exclusions and price filters. Engine/fuel queries now retain all vehicle fields and skip the legacy scan; broad vehicle selection still uses that scan pending coverage/cutover.                                                   |
| L1                   | Local browser checks passed            | Preserve deep links during partial facet responses; abort/generation guards; immediate suggestion state; localized failed/non-JSON responses separate from valid empty results. Mobile panel retains M5/G90, stays inside viewport and focuses Close.                                                                                      |
| L4                   | Burger image change implemented        | Responsive Shopify main image + 240 px thumbnails, unsigned URLs only, bounded srcset descriptors. One public sample: 240 px 9,523 bytes; 1200 px 107,072 bytes. Not an aggregate page benchmark. Fixed Burger fixed two-column mobile overflow (623 -> 375 px on a 375 px viewport); main image 35 -> 294 px. Gallery switching verified. |
| L5                   | Implemented                            | Shop pages bypass decorative intro overlay; deferred recommendations handle missing observer and disconnect on unmount. Filtered catalogs no longer fetch/render unrelated warehouse hero carousel.                                                                                                                                        |
| T6                   | Audit recorded; implementation pending | Full snapshot/index rebuild per build and five cron schedules identified. Artifact reuse requires a proven catalog/settings version key; no external build/plan setting changed. See local docs/operations/catalog-build-cost-audit-2026-09-07.md.                                                                                         |
| L2/L3/L6/L7/T4/T5/T7 | Remaining acceptance work              | Prior local optimizations preserved; full SSR, smart search/coverage, device matrix, pricing/freshness and representative performance gates are not certified.                                                                                                                                                                             |

Root validation: TypeScript passed; 123 selected unit tests passed; three PostgreSQL integration tests passed on a fresh migration replay, and engine snapshot/vehicle regressions passed again after the mapper changes. Scoped ESLint: zero errors, six existing Burger warnings. Test logs: `artifacts/storefront-wave1-unit-tests.log`. The first parallel DB run collided on shared aggregate rows; repeat validation used serial test execution in a newly created database. This does not certify concurrent publication throughput.

Browser evidence: DB-less local development, UA catalog with BMW/M5/G90 retained, EN Burger PDP and responsive gallery, mobile filter focus and bounds; viewport restored afterwards. No production p95 or real iOS-device measurements are claimed. Current local Node is 24.19.0, outside package's >=20 <23 range; supported-Node production build validation remains open.

Release order remains migration -> regenerate client -> validate/rebuild current source revisions -> coverage/shadow gates -> reader activation. Old production projection rows are not repaired just by changing local code. No build/deploy was run.

Validation is patch-local; dirty-tree release gates are not bypassed. No claim of a 100x site speedup,
production cost reduction, complete engine coverage, or production activation follows from these fixtures.

## Current sprint: P6 lossless normalization and backfill

| ID        | Work item                                     | Status | Verification / remaining work                                                            |
| --------- | --------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| C2-P6-001 | Deterministic raw-field coverage contract     | Done   | Every scalar/empty value gets stable path, ordinal, and fingerprint                      |
| C2-P6-002 | Per-source coverage/parity report             | Done   | Bounded current-head audit, fail-closed activation CLI, PostgreSQL proof                 |
| C2-P6-003 | RaceChip normalization/backfill               | Done   | Lossless ledger, taxonomy aliases, versioned 13-dimension policies, PostgreSQL proof     |
| C2-P6-004 | ADRO normalization/backfill                   | Done   | Shared ledger core, aliases, correlated policies, CLI, PostgreSQL proof                  |
| C2-P6-005 | Eventuri mixed-policy normalization/backfill  | Done   | Mixed universal/exact/review policies, CLI, PostgreSQL proof                             |
| C2-P6-006 | Remaining-source lossless inventory/backfills | Done   | 15,132/15,132 owned identities and 665,508 raw leaves; all 14 logical sources wired      |
| C2-P6-007 | Brabus normalization/backfill                 | Done   | 977 records, conflict quarantine, shared policy engine, PostgreSQL proof                 |
| C2-P6-008 | Urban normalization/backfill                  | Done   | 259 records, wheel-tag quarantine, shared policy engine, PostgreSQL proof                |
| C2-P6-009 | Öhlins normalization/backfill                 | Done   | 489 records, universal split, drivetrain quarantine, PostgreSQL proof                    |
| C2-P6-010 | Akrapovič normalization/backfill              | Done   | 421 records, auto/moto isolation, engine/OPF quarantine, PostgreSQL proof                |
| C2-P6-011 | iPE normalization/backfill                    | Done   | 111 records, variant-first OPF, duplicate-SKU safety, PostgreSQL proof                   |
| C2-P6-012 | CSF normalization/backfill                    | Done   | 297 records, tag quarantine, exact transmission, concurrency proof                       |
| C2-P6-013 | GiroDisc normalization/backfill               | Done   | 958 records, dimension-safe parsing, parent quarantine, PostgreSQL proof                 |
| C2-P6-020 | Full all-source backfill and replay gate      | Done   | 15,132 records, 665,508 provenance leaves, exact parity, 15,132/15,132 idempotent replay |

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
ADRO normalization covers 240/240 immutable records and 7,970/7,970 raw leaves. It produces 303
correlated vehicle applications, verifies 234 products, and retains six multi-model chassis
ambiguities as `NEEDS_REVIEW` without dropping candidate applications. Its writer uses the same
bounded Serializable source-ledger core as RaceChip, then persists source aliases and one OR clause
per correlated application with all 13 dimensions explicit. Engine, fuel, drivetrain, transmission,
and OPF/GPF are `NOT_APPLICABLE` for aero rather than inferred from trim text. PostgreSQL proves four
correlated chassis clauses, exact canonical values, replay idempotency, review-only ambiguous clauses,
and activation coverage. See [ADRO_AUDIT_2026-08-31.md](./ADRO_AUDIT_2026-08-31.md).
Eventuri normalization covers all 115 products and 5,341/5,341 raw leaves. It distinguishes one
verified universal maintenance kit, 50 verified vehicle-specific products, two replacement filters
that require parent resolution, and 64 review-only products. Exact engine evidence is retained in
128 correlated applications; 58 physical intake/cover/pipe records without an explicit engine code
remain review-only rather than being broadened. The shared writer persists canonical powertrains,
source aliases, and all 13 dimensions per clause. PostgreSQL proves verified universal, exact
M3/M4/S58/petrol, and missing-engine review-only policies. See
[EVENTURI_AUDIT_2026-08-31.md](./EVENTURI_AUDIT_2026-08-31.md).
The remaining-source inventory reconciles all 9,596 not-yet-normalized products and 419,661 raw
leaves across 11 source shards. It exposed 4,188 Remus/Ilmberger records without default variants;
the shared ledger writer now supports genuine product-level bindings instead of inventing variant
identity. PostgreSQL proves product-level persistence invokes the compatibility callback and creates
zero synthetic variants. Burger and iPE repeated SKUs are also explicitly tracked. See
[REMAINING_SOURCE_INVENTORY_2026-08-31.md](./REMAINING_SOURCE_INVENTORY_2026-08-31.md).
Brabus normalization accounts for 977/977 records and 49,932/49,932 raw leaves. Title/chassis
evidence produces 978 correlated applications; 729 products verify while 168 conflicting legacy
make tags and 125 engine-relevant products without engine identity remain review-only. Brabus and
Eventuri now share one vehicle-policy persistence engine. PostgreSQL proves exact X167/GLS and
missing-engine PowerXtra behavior. See [BRABUS_AUDIT_2026-08-31.md](./BRABUS_AUDIT_2026-08-31.md).
Urban normalization accounts for 259/259 records and 15,252/15,252 raw leaves. It produces 321
correlated applications and verifies 244 products. Legacy wheel-design `fits-model` values stay in
the ledger without polluting vehicle taxonomy; five engine-relevant exhaust products without engine
identity and 12 unresolved applications remain review-only. PostgreSQL proves correlated L405/L494
wheel clauses and unknown-engine exhaust behavior, with Brabus and Eventuri regression coverage. See
[URBAN_AUDIT_2026-08-31.md](./URBAN_AUDIT_2026-08-31.md).
Öhlins normalization accounts for 489/489 records and 15,159/15,159 raw leaves. It verifies 329
products, including 102 universal parts, and produces 318 correlated vehicle applications. The
existing curated chassis vocabulary is reused; 154 unresolved applications and six drivetrain-
qualified products remain review-only. PostgreSQL proves exact G80/G82/G87, universal, and
drivetrain-quarantine behavior. See [OHLINS_AUDIT_2026-08-31.md](./OHLINS_AUDIT_2026-08-31.md).
Akrapovič normalization accounts for 421/421 records and 15,970/15,970 raw leaves, producing 670
correlated applications with no unresolved vehicle candidate. The generic policy engine is now
scope-aware, keeping 356 automotive and 65 motorcycle products in distinct canonical taxonomies.
Exact engine evidence is absent for 353 exhaust products and 34 mention OPF/GPF restrictions, so
those policies remain review-only rather than being broadened. PostgreSQL proves auto/moto
isolation and prior-source regressions. See
[AKRAPOVIC_AUDIT_2026-08-31.md](./AKRAPOVIC_AUDIT_2026-08-31.md).
iPE normalization accounts for 111/111 records and 6,511/6,511 raw leaves. Product ID plus SKU
protects all 27 records affected by repeated supplier SKUs. Default-variant evidence produces 67
exact OPF/Non-OPF policies; one contradictory OPF record and one non-contiguous year set remain
review-only. All 110 engine-relevant records lack exact engine identity and are quarantined without
discarding their 134 candidate applications. PostgreSQL proves collision-safe records and exact
variant-first OPF constraints. See [IPE_AUDIT_2026-08-31.md](./IPE_AUDIT_2026-08-31.md).
CSF normalization accounts for 297/297 records and 10,763/10,763 raw leaves. Title-derived
correlation avoids known-invalid legacy tag cross-products; 18 tag-only records remain review-only.
Six manual/automatic constraints are now exact through the shared transmission-aware writer. The
290 engine-relevant products without engine identity remain quarantined. Bounded `P2034` retry is
proven by parallel CSF, iPE, and Akrapovič persistence. See
[CSF_AUDIT_2026-08-31.md](./CSF_AUDIT_2026-08-31.md).
GiroDisc normalization accounts for 958/958 records and 47,068/47,068 raw leaves. It verifies 705
products and produces 861 applications without treating rotor/piston dimensions as models. Generic
hardware and replacement parts without a vehicle or parent remain review-only, as do three suspect
complex titles. PostgreSQL proves correlated W218/W212 clauses and parent-only quarantine. See
[GIRODISC_AUDIT_2026-08-31.md](./GIRODISC_AUDIT_2026-08-31.md).

## Completed sprint: P5 unified admin publication

| ID        | Work item                                      | Status | Verification / remaining work                                                                                                              |
| --------- | ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C2-P5-001 | Version-specific publication status contract   | Done   | Saved/Publishing/Published/Failed resolver and authorized no-store API                                                                     |
| C2-P5-002 | Product editor publication visibility          | Done   | Editor polls exact saved version; failed work is never presented as published                                                              |
| C2-P5-003 | Commit-to-visible latency and concurrency gate | Done   | 30 samples: p95 416 ms, p99 504 ms; exactly one same-version contention winner                                                             |
| C2-P5-007 | Global settings and price-book publication     | Done   | Monotonic global cursors, atomic audit/outbox, 42-migration PostgreSQL concurrency gate                                                    |
| C2-P6-021 | Shared canonical promotion lock protocol       | Done   | Page-wide stable advisory locks; two-client PostgreSQL contention regression                                                               |
| C2-P7-001 | Reproducible signed activation marker          | Done   | Guard-validated signer CLI; weak/stale/lagging evidence fails closed                                                                       |
| C2-P7-002 | Segmented deterministic canary and rollback    | Done   | Locale/brand/category/percentage routing; browser-verified 0%/100% and autocomplete                                                        |
| C2-P7-003 | Durable commit-bound shadow evidence           | Done   | Hourly segment aggregates, read-only evidence CLI, 43-migration PostgreSQL concurrency gate                                                |
| C2-P7-004 | Read-only operational readiness telemetry      | Done   | Authenticated no-store report for catalog size, projection lag, outbox age/retries/dead letters, failed receipts, and commit shadow parity |
| C2-P7-005 | Privacy-safe live reader performance telemetry | Done   | Listing/facet/suggestion duration, bounded DB-query count and returned rows; no raw query/filter values                                    |
| C2-P7-006 | Signed progressive rollout ceiling             | Done   | Evidence v2 caps canary percentage and requires separate explicit approval for full SSR                                                    |
| C2-P7-007 | Unbypassable production build guard            | Done   | Next config blocks unsigned/over-scoped V2 before route selection; reader-off rollback remains buildable                                   |
| C2-P7-008 | Signed observation window and decision owner   | Done   | Canary requires 24h, full SSR 72h, and every activation names its responsible owner                                                        |
| C2-P7-009 | Canonical regional/B2B card-price parity       | Done   | Fresh bounded page hydration; shared pricing engine; no projection price rendering                                                         |
| C2-P5-008 | Targeted PDP freshness after price/inventory   | Done   | Exact-slug reads bypass external TTL; changed product aliases revalidate without listing invalidation                                      |
| C2-P5-009 | Viewer-specific brand pricing context          | Done   | Own-session no-store endpoint; B2B-only system/customer maps; client requests deduplicated                                                 |

Publication status is derived from the exact outbox event and every required target receipt for
the requested canonical version. A successful product save remains `SAVED` until workers begin,
then becomes `PUBLISHING`; it reaches `PUBLISHED` only when every target applied that version.
Dead-letter jobs or version-matching failed receipts return `FAILED` with bounded error context.
The admin editor displays target lag and polls only while the version is non-terminal.
The reproducible disposable publication gate measures the complete commit-to-visible chain and
passes the P5 SLO with p95 416.027 ms and p99 503.758 ms. Same-version contention admits exactly
one writer. See [PUBLICATION_GATE_2026-08-31.md](./PUBLICATION_GATE_2026-08-31.md).
The current 42-migration rerun passes at p95 81.713 ms and p99 123.739 ms. Settings and
price-book changes now commit their canonical row, audit entry, monotonic global cursor, exact
target receipts, and outbox events atomically. Two concurrent settings mutations produce versions
2 and 3 after bounded serialization retry. Global events never rebuild product projections or fan
out to product ISR. See [GLOBAL_PUBLICATION_GATE_2026-09-01.md](./GLOBAL_PUBLICATION_GATE_2026-09-01.md).

## Completed sprint: P3 indexed reads and P4 server-rendered storefront

| ID        | Work item                                      | Status | Verification / remaining work                                                        |
| --------- | ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| C2-P3-001 | Bounded indexed listing and fitment query      | Done   | Keyset query, correlated clauses, shadow parity, and 500k EXPLAIN gate pass          |
| C2-P3-002 | Progressive facet and suggestion query service | Done   | Correlated facets plus bounded product/brand/vehicle suggestions pass the 500k gate  |
| C2-P4-001 | Flag-off direct Server Component first page    | Done   | Explicit `ssr` only; default legacy branch makes no V2 read; first 24 cards are SSR  |
| C2-P4-002 | Interactive progressive filters and pagination | Done   | GET fallback, client transitions, parent resets, abortable autocomplete, keyset next |

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
- [x] All 43 current migrations replay from an empty disposable PostgreSQL 17 database.
- [x] Replayed database matches `prisma/schema.prisma`, including monotonic global publication cursors.
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
| C2-P6-014 | Normalize and persist lossless do88 compatibility                                      | Done   | P6 source framework   | 1,230 records; universal/vehicle/review semantics and PostgreSQL gate                |
| C2-P6-015 | Normalize and persist lossless Burger compatibility                                    | Done   | P6 source framework   | Duplicate-SKU-safe identity; correlated chassis/engine and pollution quarantine      |
| C2-P6-016 | Normalize and persist lossless Ilmberger motorcycle compatibility                      | Done   | P6 source framework   | Product-level moto policies; correlated per-model years and PostgreSQL gate          |
| C2-P6-017 | Normalize and persist the lossless Remus generic-shard subset                          | Done   | P6 source framework   | Ordered make/model/year groups, OPF/GPF semantics, and PostgreSQL gate               |
| C2-P6-018 | Add fail-closed all-source ownership and growth gate                                   | Done   | All source adapters   | Exact manifest partition, unique IDs, entrypoints, raw-leaf inventory                |
| C2-P6-019 | Add commit-bound production reader activation guard                                    | Done   | Ownership/perf/parity | Signed fresh evidence required before `SHOP_CATALOG_V2_READER_MODE=ssr`              |
| C2-P5-006 | Remove cross-instance staleness from regional shop settings                            | Done   | Admin settings PATCH  | Every live request observes current pricing/tax/currency/shipping DB state           |

## Residual risks after P0

- Safe merge deliberately preserves omitted relations. Explicit deletion requires a versioned retire/tombstone contract.
- Import batches are not yet atomic across all products; a later product failure does not roll back earlier successful products.
- Eventuri upload cleanup is bounded to assets newly created by the current run; failures deleting an orphan are surfaced in the import report for operational retry.
- Historical destructive repair/rebuild/seed/cleanup utilities are retained for forensic context but fail closed before database access and are not exposed as package commands.
- The current local fallback still pays a multi-second cold snapshot parse/index cost; the shadow read projection is the next performance phase.

## Residual risks after P1

- Atomic persistence, immutable-revision source loading, durable rebuild checkpoints, mutation coordination, and leased outbox processing exist. `/api/cron/shop-catalog` runs a bounded recovery batch every five minutes and rebuilds exclusively from the event's immutable revision. The full editor, soft archive, bulk visibility, inventory, and pricing writers schedule immediate publication after returning. Bulk visibility validates the complete ID set before writing and creates a versioned `VISIBILITY` event per product. Inventory and pricing keep variant values, product summaries, audit, lossless revision, and outbox in the same product-locked transaction. Import adoption plus retry/dead-letter operational drills remain.
- The creation coordinator now atomically creates a new product aggregate at version `1` together with its first immutable revision, receipts, and outbox event. Its disposable PostgreSQL regression and the injected CSV adapter's mock-transaction regressions remain part of the verification suite.
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
- Runtime media-to-Blob migration now resolves all affected primary images, media rows, and variant images before writing, groups them by owning product, revalidates media/variant ownership inside the lock, and commits one `MEDIA` revision per product. JSON payload rewriting remains separate and outbox counts are reported. Its `finally` cleanup rereads authoritative DB and JSON references and removes only unretained URLs uploaded by the current run.
- Active IPE importer preserves its scoring, translation, dry-run manifests, local-media staging, and ID-preserving snapshot merge. Commit update/create paths now use the explicit-client coordinator across all product domains and persist catalog outbox IDs in the commit summary; per-record failures remain isolated and reported.
- Eventuri `repair-fitment`, `commit-draft`, and `publish-approved` modes now publish through Catalog V2. Fitment+tags, lossless draft update/create, and visibility/inventory activation each use the appropriate product domains and optimistic version; fail-closed all-media migration remains intact and every report records catalog outbox IDs.
- Brabus images-to-Blob commit mode now resolves successful URL mappings into product-owned groups and atomically rewrites primary, media, and variant image references under one `MEDIA` revision. Ownership is revalidated in the transaction, upload concurrency/dry-run behavior is retained, and outbox counts are reported. Partial upload or DB failure triggers authoritative-reference cleanup for current-run uploads only.
- Active Atomic English translation package commands now run through the TSX server runner. Commit mode dynamically loads the explicit-client coordinator, applies each translated content/SEO field set under its planned catalog version, and reports catalog outbox IDs; plain-JS syntax and package JSON are validated.
- Seventeen unreferenced destructive Brabus, Burger, Ducati/Akrapovič, IPE, dedupe, and media-trimming utilities now fail closed before Prisma client creation or product deletion. A source contract keeps them quarantined and prevents package-command exposure while preserving their historical transformation logic for later versioned rewrites.
- Eventuri media migration now checks deterministic Blob path ownership before upload, refuses overwrites, and tracks every URL created in the current run. Successful product commits retain their referenced assets; skipped products and database failures remove unretained uploads in `finally`, while pre-existing/shared blobs are never cleanup candidates.
- The live stock-search endpoint now invokes the indexed Catalog V2 query only under the fail-closed `compare` flag and never serves its result. Supported first-page/default-order requests emit bounded structured identity/order/continuation parity telemetry; unsupported legacy-only filters are skipped instead of generating misleading comparisons, and projection failures cannot fail the customer response.
- Monthly Turn14 GitHub Actions no longer receives database or supplier API credentials and cannot execute the legacy direct Prisma writer. It invokes a bearer-authenticated, allowlisted one-brand-per-request endpoint; the endpoint reuses the versioned Turn14 import service and runs bounded outbox publication, while the old CLI fails closed before Prisma initialization.
- The reproducible 100k/500k PostgreSQL scale gate checks first-page listing, 90%-deep keyset pagination, brand, trigram text, make-only fitment, and fully correlated make/model/engine/year fitment. An initially linear candidate-first plan failed the SLO and was replaced by a product-first planner-fenced query plus a case-insensitive expression index; the final 500k warm p95 is 90.02 ms at worst (deep keyset), with correlated fitment at 24.08 ms and no large sequential scans. See [SCALE_GATE_2026-08-31.md](./SCALE_GATE_2026-08-31.md).
- The V2 storefront now keeps result rendering on the server while a small client controller provides progressive URL transitions, complete descendant resets, HTML GET fallback, and debounced abortable suggestions. Suggestions are capped before vehicle lookups and preserve make/model clause correlation. A route-level flag-off rewrite keeps the old stock catalog available at the public URL without importing its client tree into V2; production-build entry JS fell from 191,298 to 148,294 gzip bytes. See [STOREFRONT_GATE_2026-08-31.md](./STOREFRONT_GATE_2026-08-31.md).
- Product administration now has a version-specific publication-status resolver and authorized uncached endpoint. The editor reports `Saved`, `Publishing`, `Published`, or `Publication failed` independently from the mutation response, exposes pending targets/version lag, and stops polling only at a verified terminal state. PostgreSQL integration covers saved, retry, published, and dead-letter transitions.
- The disposable P5 publication gate runs 30 complete canonical commit-to-visible cycles and a same-version contention race. Latest post-normalization results are p95 94.521 ms, p99 154.133 ms, maximum 154.133 ms, zero final version lag, and exactly one contention winner. No catalog-wide ISR write is part of this V2 projection path.
- P6 per-source coverage reporting is bounded to current immutable revision heads and fails closed on missing payloads, bindings, raw-field provenance, quarantine, or open normalization issues. A guarded read-only CLI produces stable fingerprints and PostgreSQL integration proves the activation transition.
- The RaceChip immutable-shard mapper retains 5,181 vehicle-specific identities and 232,536/232,536 raw-field provenance entries. It detects repeated supplier SKUs instead of merging them, audits legacy scope mapping, creates exact engine configuration keys, verifies 4,347 records, and leaves 834 fuel-ambiguous records in review. Its transactional writer now persists source-scoped aliases and revisioned 13-dimension compatibility policies. No Production database backfill has been run.
- The do88 immutable-shard mapper retains 1,230 product identities and 50,859/50,859 raw-field provenance entries. It verifies 718 universal and 433 vehicle-specific records, persists 145 exact chassis applications, and quarantines 79 unresolved records including polluted `fits-make:clamp-kits` tags. Disposable PostgreSQL covers exact, universal, and review policy modes. No Production database backfill has been run. See [DO88_AUDIT_2026-08-31.md](./DO88_AUDIT_2026-08-31.md).
- The Burger immutable-shard mapper retains all 666 product/slug identities and 35,506/35,506 raw-field provenance entries without merging 11 duplicated SKU values. It verifies 406 vehicle-specific and 81 universal records while quarantining 179 ambiguous products, including known BMW fitment pollution on other makes. PostgreSQL proves correlated model, chassis, and powertrain persistence. No Production database backfill has been run. See [BURGER_AUDIT_2026-08-31.md](./BURGER_AUDIT_2026-08-31.md).
- The Ilmberger mapper retains all 339 product identities and 12,450/12,450 raw-field provenance entries, verifies 335 records, and leaves four model-unresolved records in review. It uses product-level `moto` policies because the immutable shard contains no variants, correlates model-specific years, and marks engine not applicable. No Production database backfill has been run. See [ILMBERGER_AUDIT_2026-08-31.md](./ILMBERGER_AUDIT_2026-08-31.md).
- The Remus mapper deterministically selects all 3,849 Remus records from the generic shard and retains 160,191/160,191 raw-field provenance entries. It verifies 3,794 records and leaves 55 in review, including three corrupt supplier year expansions that are preserved raw but persisted as unknown rather than broadened. Product-level policies preserve ordered make/model/year groups and explicit OPF/GPF semantics. No Production database backfill has been run. See [REMUS_AUDIT_2026-08-31.md](./REMUS_AUDIT_2026-08-31.md).
- The all-source ownership gate proves that all 15,132 manifest records have one logical owner, one globally unique product ID, and an installed normalization/audit/backfill path. It inventories 665,508 raw leaves and partitions `generic` exactly into Eventuri and Remus with no residue. See [ALL_SOURCE_OWNERSHIP_GATE_2026-08-31.md](./ALL_SOURCE_OWNERSHIP_GATE_2026-08-31.md).
- Production Catalog V2 reader activation is now commit-bound and fail-closed. A signed, fresh marker must prove the current ownership fingerprint, complete persisted source coverage, zero projection lag, at least 1,000 mismatch-free shadow requests, bounded error rate, and both scale and publication latency SLOs. See [READER_ACTIVATION_GUARD_2026-08-31.md](./READER_ACTIVATION_GUARD_2026-08-31.md).
- Live shop settings no longer reuse a 60-second process-local record that `revalidateTag` could not clear across serverless instances. Currency rates, regional pricing, tax regions, and shipping changes are read from the current database row on every subsequent request; concurrent reads remain promise-collapsed, and build/local snapshot behavior is unchanged.
- PostgreSQL policy integration now covers real compatibility rows and the optimized vehicle SQL path. This exposed and fixed the persistence boundary mapping from domain dimensions (`make`, `bodyStyle`, `opfGpf`) to Prisma enums (`MAKE`, `BODY_STYLE`, `OPF_GPF`); all 13 dimensions are mapped explicitly before policy and constraint insertion.
- The disposable PostgreSQL outage drill proves transient failure → `RETRY` → successful reclaim, bounded attempts → `DEAD_LETTER`, and expired lease → `LOST_LEASE` → a different worker reclaim. Revisions survive every failure, receipts advance or fail per target without version regression, and terminal jobs retain `processedAt`; the drill exposed and fixed a dead-letter transition that previously violated its own lifecycle constraint.
- No Production migration, backfill, reader switch, deployment, or database write has been performed.
- Polymorphic binding-head and compatibility-policy promotion now acquire page-wide, stably ordered PostgreSQL transaction advisory locks. A two-client disposable PostgreSQL regression proves one insert plus one idempotent replay under contention.
- Category is now a first-class indexed V2 query, URL-state, facet, and shadow-comparison field;
  canary category segments cannot activate a reader that ignores their category constraint.
- Shadow comparisons persist commit-bound hourly locale/brand/category aggregates after the
  customer response. The read-only evidence command fails its gate below 1,000 samples, above zero
  mismatches, or above 0.1% errors; concurrent PostgreSQL increments retain exact totals.
- The current-branch 100k/500k PostgreSQL gate passes the compact projection: worst warm p95 is 91.760 ms for 90%-deep keyset pagination, correlated fitment is 24.950 ms, and autocomplete is 28.200 ms. Production-region canary traffic remains required by the signed reader activation guard.
- Price-book and global settings use concrete monotonic version sources and targeted publication; the historical hardcoded currency writer fails closed.
- Reader-off remains the safe default and still serves the legacy/local snapshot. Signed `canary`
  and `ssr` modes use the indexed server projection; production activation evidence and owner
  approval remain intentionally outstanding.

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

## Commit-bound release evidence (2026-09-01)

- Scale and commit-to-visible publication artifacts now include the exact 40-character Git commit and their Docker runners refuse a dirty worktree.
- `shop:catalog:v2:release:evidence` assembles one short-lived activation document from all 14 source-coverage audits, current UA/EN projections, commit-specific shadow telemetry, and the two matching performance artifacts.
- Collection is read-only and fail-closed; signing remains a separate secret-bearing step. No production read, write, deployment, or reader switch is performed automatically.
- `/api/admin/shop/catalog-v2-readiness` exposes current cutover/rollback evidence without mutating
  state. It fails readiness for fewer than 10,000 published products, backlog, dead letters, failed
  receipts, missing UA/EN projections, or non-zero version lag; deployment-specific shadow totals
  are included when a full commit SHA is available.
- V2 listing, facet, and suggestion reads emit one bounded structured `catalog_v2_read` event with
  duration, outcome, locale, active filter dimension names, returned-row count, and the maximum DB
  query count. Raw search text, SKU/filter values, exception messages, and customer identifiers are
  excluded. Suggestion responses additionally expose standards-compatible `Server-Timing`.

### P7-009 — Canonical card-price parity

- Catalog V2 discovery remains projection-backed, then performs one fresh bounded canonical read for only the visible product IDs.
- Cards now use the shared regional/B2B pricing engine, including Europe bands, explicit B2B prices, compare-at semantics, system/customer brand discounts, customer discounts, live currency selection, and current settings.
- Projection min-price fields are no longer rendered as authoritative storefront prices, so admin price edits do not wait for an index refresh.
- The bounded canonical pricing phase emits the same privacy-safe duration, row-count, filter-dimension, and DB-query-bound telemetry as other V2 reads.
- Its single product query selects only price/brand columns and one default variant (hard cap: 100 IDs); it does not hydrate media, collections, options, metafields, or the rest of the storefront graph.
- A clean-commit production-build gate now measures the catalog route directly from the Next client manifest. It enforces the 150 KiB gzip initial-JS budget, reports catalog-only incremental JS and CSS separately, rejects escaped manifest paths, and fails if the legacy stock page returns to the V2 client graph. On commit `cbfbcba82e76dcfd415c244dcbb1cd52c6d2dc69` (Next BUILD_ID `Rnv07pv7PZsR8QyLaHTxv`) it passed at 150,526 bytes initial JS gzip and 10,286 bytes catalog-only incremental JS gzip; the legacy stock module was absent. The ignored JSON artifact remains tied to both Git SHA and Next BUILD_ID; TTFB, LCP, and first-card response payload still require a representative runtime/browser gate before P4 is complete.
- Cart reads/writes, checkout quotes, public product APIs, stock search, AI hydration, PDP, and V2 cards now share the same four-tier brand-aware pricing context; checkout no longer falls back to a customer-global discount when a brand override exists.
- Catalog V2 SSR now obtains that context through the same server helper as cart and checkout. Guest and B2C listing requests issue zero brand-discount queries; only an approved B2B session loads the system and own-customer brand maps.
- P4 now has clean-commit build, HTTP runtime, and Chromium gates. Commit `249a538921a641a5ecb051b10ba49f64960ee798` passed locally with 24 SSR cards, TTFB p95 109.834 ms, complete HTML 27,338 bytes gzip, LCP p75/p95 964/1,140 ms, filter navigation p95 306.879 ms, initial JS 150,526 bytes gzip, and no application browser errors. This is production-shaped disposable evidence, not a production-region cache claim: the session-aware response is currently `private, no-store`.
- The monthly GitHub Actions Airtable stock CLI and authenticated cron route now share one product-scoped inventory writer. Both validate conflicting SKU quantities, lock/version each owning product, preserve immutable snapshots, emit INVENTORY outbox work, and run publication recovery; the CLI no longer performs direct variant `updateMany` writes.
- Catalog products are retention-protected in the admin API. `DELETE` only archives through a VISIBILITY revision; the former `mode=hard` path was removed so products, relations, revisions, and provenance cannot be physically erased from the editor workflow.
- The obsolete exported price/inventory helpers that could mutate Prisma outside the catalog lock were removed. Only transaction-scoped helpers remain, and their active routes must enter them through the product mutation coordinator.
- P5 mutation coverage was re-verified on commit `33dab22334eb16f08da13b2e3c1026035f50f6a0`: the full 1,095-test shop unit suite passed, all 43 migrations replayed, and the disposable publication/concurrency gate passed with p95 958.849 ms, p99 1,271.075 ms, exactly one optimistic-concurrency winner, and monotonic global versions `2,3`. The measurement intentionally ran beside the full suite, so it includes local CPU contention while remaining below the 2 s/5 s gate.
- P6 all-source persistence now proves lossless commerce snapshots, not only ownership and raw-leaf counts. The disposable PostgreSQL gate reconstructs the canonical baseline from every persisted inline payload and requires an identical full hash for all 15,132 records, complete UA/EN titles, and preserved media, metafields, collections, options, applications, and price values before an exhaustive idempotent replay. The run exposed and fixed the former 30-second transaction expiry on large compatibility pages; serializable work now has a bounded 120-second budget and narrowly retries conflicts or expired transactions. The complete 1,096-test shop suite and TypeScript check pass. No Production backfill was run; replay performance remains the next optimization target.
- Immutable source replay now has a safe compatibility fast-path: it still compares payload identity, canonical ownership, every provenance signature, and every normalization issue, then skips taxonomy/policy persistence because initial evidence and compatibility commit atomically. Disposable PostgreSQL proves insert + replay and concurrent promotion, while fresh replay of all 43 migrations now matches `schema.prisma`; the shadow-aggregate unique index is explicitly mapped to PostgreSQL's existing truncated physical name.
- Commit `aba39237782ec2e686f316b297ca0a2f36eab4a9` passed the complete 14-source persistence gate at 74,200 initial records/hour and 802,605 idempotent replay records/hour. All 15,132 payload hashes, 665,508 provenance leaves, UA/EN titles, and active policies matched. The artifact also exposed that immutable storefront shards encode media and fitment through legacy snapshot fields rather than canonical database relation names; separate canonical relation-promotion evidence is still required. See [ALL_SOURCE_PERSISTENCE_GATE_2026-09-01.md](./ALL_SOURCE_PERSISTENCE_GATE_2026-09-01.md).
- Source-ledger backfill is now explicitly non-destructive for existing commerce data. A disposable PostgreSQL regression snapshots a product containing localized content, price, legacy gallery, media, option, metafield, and collection relations, then requires an identical full canonical hash and relation counts after both first persistence and immutable replay.
- Resilience fallback shards are not permitted to become a lossy canonical-import shortcut. The shared source writer requires every target product and variant to exist first and a PostgreSQL rollback regression proves a missing product leaves neither a source row nor a source record. New products must enter through the versioned full-commerce import coordinator before provenance/compatibility promotion.
- The new-brand canonical creation path is covered end to end in disposable PostgreSQL. One versioned import atomically creates UA/EN content, product and variant prices, inventory, two variants, an option, two media rows, a metafield, and a collection membership, then records catalog version `1`, an immutable revision, outbox work, and publication receipts. This is the required first stage before a supplier source record can promote provenance and compatibility.
- Canary storefront reads now fail open to the legacy resilience catalog while explicit full `ssr` remains fail-closed. The fallback preserves bounded URL filters and emits only a privacy-safe error type. A local non-production rehearsal forced V2 database initialization failure, observed structured listing/facet errors plus `catalog_v2_canary_fallback`, and still returned a 200 legacy response with no Prisma error in customer HTML; switching reader mode to `off` also returned 200 without any V2 query.
- Commit `3275aa11f6e206f052957f7124ced2b8f10aafca` passed the final local release audit with reader mode `off`: Operations prepare readiness, inactive One AI and Catalog V2 production activation guards, Prisma generation, the complete Next.js production build including TypeScript and all 589 static pages, and the commit-bound storefront bundle gate. Catalog initial JavaScript is 150,584 bytes gzip against the 153,600-byte limit, catalog-only incremental JavaScript is 10,286 bytes gzip, and the legacy stock client module is absent. Commit `7af34ed2` then removed the predeploy wrapper's dependency on global `npm`/`npx`; the unchanged wrapper passed end to end using repository-local TSX, Prisma, and Next CLIs, including a second clean production build of all 589 pages. No production deployment, migration, backfill, write, or reader activation was performed.
- Non-production rollback has been rehearsed against a real reader dependency failure. A canary-mode local server with no usable database failed closed in V2; restarting the same commit with reader `off` restored HTTP 200 and a hydrated legacy/resilience catalog with 25 main links, 66 images, and zero browser page errors. See [ROLLBACK_REHEARSAL_2026-09-01.md](./ROLLBACK_REHEARSAL_2026-09-01.md).
- Runtime and Brabus Blob migrations now close their partial-upload leak. Both track only URLs created in the current execution, reread authoritative product/media/variant references after all success or failure paths, include runtime JSON/HTML references where applicable, and delete only the unreferenced remainder in `finally`; pre-existing and shared blobs are never cleanup candidates. Cleanup attempts every orphan even when an earlier provider deletion fails, then exits non-zero with the exact failed URLs.
- Atomic feed publication no longer invalidates the root App Router layout after every sync. Existing-product price/inventory changes revalidate only that product's UA/EN PDP aliases; newly created products additionally invalidate only their resolved brand listing and segment product tags.
- Legacy custom-storefront routing, listing surface, pagination behavior, aliases, and slug prefixes now come from one declarative registry. The separate iPE runtime compatibility branch and duplicated revalidation maps are removed; brands without an explicit legacy storefront continue through the general catalog without new route code.
- A repository-wide source contract now discovers every route/script using a Catalog V2 product or global coordinator and rejects root-layout, shop-layout, and whole-catalog path invalidation. It exposed and removed the remaining shop-settings layout fan-out; settings freshness now uses its versioned global publication plus the exact `shop-settings` data tag.

Commit `eb9463ae` adds bounded Shopify CDN responsive variants (320–2400px) for product media, avoiding Vercel image transformations on Shopify-hosted assets while preserving lazy/priority behavior. Image source tests pass 5/5.

Commit `ed116c29` makes projection text search token-aware and order-independent across SQL and ORM paths. Structured SKUs receive exact normalized matching, including version-scoped variant SKUs; BMW M5 G90/S68 regression coverage passes. The selected Catalog V2/stock/pricing suite now passes 408/408.

The full shop unit command was rerun after the catalog changes. Three remaining failures are pre-existing admin redesign structural contracts (commits `951e30a5` and `19b0b586`), outside R01–R12 and unchanged by this work: order detail header markers, product editor tab markers, and overview/system shared primitive markers. Catalog-focused tests remain 408/408; these admin contracts need a separate UI decision rather than compatibility shims.

The storefront browser gate now accepts bounded viewport dimensions so mobile evidence can be reproduced without changing the application. The same BMW M5 G90 scenario passed at 390×844: LCP p75 136 ms, LCP p95 344 ms, filter p95 619.792 ms, with no application errors or unexpected failed responses.

Commit `bcc87f84` closes the unsafe projection selector fallback: when `ssr` or an authorized canary request lacks a complete versioned selector artifact, the fitment endpoint returns bounded `503 SELECTOR_NOT_READY` with `Retry-After` instead of loading the full catalog. Reader-off preserves the legacy fallback until the all-source artifact is published.

Commit `014bfeda` includes filter indexes in the content-addressed build artifact. A keyed, complete artifact restores all eight indexes atomically; missing, stale, wrong-key, malformed, or tampered bundles regenerate from the database and are never served partially. The authoritative build pipeline still needs to provide the immutable artifact key.
