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

Observed fingerprint: `5b0d32adabc86f2021e6b247212915234a54f29693e991f55cd2ec5d3949309a`.
The audit is read-only and performs no database or Production action.
