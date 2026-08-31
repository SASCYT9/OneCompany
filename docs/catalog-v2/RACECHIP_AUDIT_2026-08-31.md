# Catalog V2 RaceChip normalization audit — 2026-08-31

## Immutable input

- shard: `racechip.3079742dc2d7.json`;
- products: 5,181;
- product IDs: 5,181 unique;
- variant IDs: 5,181 unique;
- source record identity: `productId + supplier SKU`, 5,181 unique.

The supplier SKU alone is not an application identity: 883 variant SKUs repeat across 2,744
vehicle-specific products. Using SKU as a source key would merge different vehicles and lose
fitment. The mapper therefore retains the canonical product/variant IDs in source identity while
keeping the original SKU as immutable evidence.

## Lossless field coverage

| Metric | Result |
| ------ | -----: |
| Source records | 5,181 |
| Raw leaves | 232,536 |
| Provenance entries | 232,536 |
| Records with 100% raw-field coverage | 5,181 |
| Legacy `SHOP` scope mappings audited to `auto` | 5,179 |
| Already canonical `auto` scope records | 2 |

Empty arrays and repeated tag/variant values are retained. Every leaf has a product or variant
target. The legacy `SHOP` value is not silently discarded; its normalized `auto` value and reason
are explicit provenance.

## Compatibility normalization

| Result | Products |
| ------ | -------: |
| `VERIFIED` make/model/year/engine/fuel configuration | 4,347 |
| `NEEDS_REVIEW` (fuel not proven by supplier descriptor) | 834 |
| Year known | 5,181 |
| Generation known | 4,572 |
| Diesel | 3,154 |
| Petrol | 1,039 |
| Hybrid | 154 |

Unknown fuel is never guessed and never labeled exact. The mapper uses a versioned, tested
RaceChip engine vocabulary and preserves the complete raw engine descriptor in every
configuration key. Generation remains optional where the source does not provide `fits-trim`.

## Reproduction

```powershell
npm run shop:catalog:v2:racechip:audit
```

This command reads only the immutable local fallback shard. Optional JSON output is restricted to
`artifacts/catalog-v2-racechip/`. No database or production action is performed.

## Transactional backfill

The bounded writer accepts at most 50 source drafts in deterministic record-key order. A page is a
Serializable transaction that validates every product/variant owner before inserting anything,
then commits the immutable source record, binding revision/head, every provenance leaf, and every
normalization issue together. Replays compare payload identity plus complete mapping/issue
signatures; conflicting content under the same source revision fails closed.

New source revisions append through `supersedes` and never update/delete ledger rows. Advancing an
existing binding requires an explicit reviewer identity. The CLI is dry-run by default and uses an
`after` cursor; commit is restricted to an explicitly named non-production environment with a
dedicated database URL and write acknowledgement.

```powershell
npm run shop:catalog:v2:racechip:backfill -- --limit=50
```

Disposable PostgreSQL integration proves initial insert, idempotent replay, append-only source and
binding revision 2, current-head advancement, 100% coverage, and immutable replay rejection. No
Production backfill has been executed.

The same Serializable transaction now upserts source-scoped aliases and canonical make, model,
optional generation, powertrain, and configuration rows. It creates one variant policy revision with
all 13 compatibility dimensions represented. A verified engine is an exact canonical powertrain
reference; raw engine text cannot satisfy the verified constraint. Missing/ambiguous fuel persists as
`FUEL=UNKNOWN`, and both policy and clause remain `NEEDS_REVIEW`. A new source revision retires the
old active policy and appends the next revision without deleting history. Integration coverage also
proves that an idempotent replay can safely finish compatibility for a ledger record written before
this phase.
