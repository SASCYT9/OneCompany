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
