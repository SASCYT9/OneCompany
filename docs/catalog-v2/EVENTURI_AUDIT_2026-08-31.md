# Eventuri Catalog V2 audit — 2026-08-31

Immutable input: Eventuri subset of `public/catalog-fallback/generic.b6c6a9380c59.json`  
Generic shard SHA-256 prefix: `b6c6a9380c59`  
Eventuri products: 115

## Lossless coverage

| Metric | Result |
| ------ | -----: |
| Source records | 115 |
| Raw leaves | 5,341 |
| Provenance entries | 5,341 |
| Records with 100% raw-field coverage | 115 |

Eventuri remains a filtered source subset of the immutable generic shard. Record identity includes
product ID and SKU, so repeated supplier SKUs cannot merge vehicle applications. Every raw value and
empty container is retained; legacy `SHOP` scope mapping is explicit provenance.

## Per-SKU policy normalization

| Metric | Result |
| ------ | -----: |
| Verified | 51 |
| Needs review | 64 |
| Verified universal products | 1 |
| Verified vehicle-specific products | 50 |
| Replacement filters awaiting parent identity | 2 |
| Correlated candidate applications retained | 265 |
| Applications with exact engine evidence | 128 |
| Products where engine is not relevant | 10 |

The cleaning kit is genuinely universal. Replacement filters are not labeled universal: their
physical parent intake/housing must be resolved before a `PARENT_DEPENDENT` policy can be activated.
Vehicle-specific intakes, turbo pipes, and engine covers require an explicit canonical engine code;
58 records without that evidence stay `NEEDS_REVIEW`. Braces and reviewed non-engine accessories use
engine-not-applicable semantics. Eight multi-model records retain every candidate application but
remain review-only because flattened legacy tags do not prove chassis correlation.

This conservative result is intentional. Missing engine evidence does not remove the product or its
raw data, but it also cannot become a false exact engine match.

## Reproduction

```powershell
npm run shop:catalog:v2:eventuri:audit
```

Observed fingerprint: `74dd23ad16c724a477b553361b71ac869f1ee85a6eb28d1e74f5632099609ced`.
The audit is read-only and performs no database or Production action.

## Transactional persistence

Eventuri uses the shared bounded, Serializable source-ledger writer. Its source callback persists
source-scoped aliases plus canonical make, model, generation, and powertrain rows, then creates one
versioned variant policy with 13 explicit dimensions per correlated clause.

- the cleaning kit becomes a verified `UNIVERSAL` policy with one explicit clause;
- vehicle-specific products with a reviewed engine code use an exact canonical powertrain and the
  versioned Eventuri petrol-engine vocabulary;
- non-engine accessories use `ENGINE/FUEL=NOT_APPLICABLE`;
- physical products without engine evidence use `ENGINE/FUEL=UNKNOWN` and remain `NEEDS_REVIEW`;
- unresolved replacement-filter parents remain `NEEDS_REVIEW` until a real parent product ID exists.

The resumable CLI is dry-run by default and requires an explicit non-production environment,
dedicated database URL, and write acknowledgement:

```powershell
npm run shop:catalog:v2:eventuri:backfill -- --limit=50
```

Disposable PostgreSQL proves a four-clause M3/M4/S58 policy with exact engine and fuel, a verified
universal maintenance policy, and a missing-engine policy that stays review-only. No Production
backfill was executed.
