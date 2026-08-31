# ADRO Catalog V2 audit — 2026-08-31

Immutable input: `public/catalog-fallback/adro.10822e447cf0.json`  
SHA-256 prefix: `10822e447cf0`  
Products: 240

## Lossless source coverage

| Metric | Result |
| ------ | -----: |
| Source records | 240 |
| Raw leaves | 7,970 |
| Provenance entries | 7,970 |
| Records with 100% raw-field coverage | 240 |

Every scalar, repeated value, and empty container remains represented by deterministic source
provenance. Legacy `SHOP` scope is explicitly audited to canonical `auto`; no product field is
discarded to create compatibility.

## Compatibility normalization

| Metric | Result |
| ------ | -----: |
| Verified products | 234 |
| Needs review | 6 |
| Correlated vehicle applications | 303 |
| Multi-application products | 42 |
| Applications with exact generation/chassis | 143 |
| Applications with an explicit start year | 156 |

The mapper recognizes supplier vehicle labels and emits separate applications instead of flattening
multi-model titles into independent make/model sets. Supplier labels are intended to become
source-scoped aliases of shared taxonomy rows. For aero products, engine and fuel are not inferred
from trim labels: persistence will represent them as `NOT_APPLICABLE`.

Six products stay `NEEDS_REVIEW` because one chassis token appears beside several models and the
title does not prove which models inherit it. This includes shared Porsche 718 labels, the mixed
GR86/BRZ/M2 end-plate product, and an X3 M/X3 M40i row. The raw record and all parsed candidate
applications remain available; the mapper does not guess or drop them.

## Reproduction

```powershell
npm run shop:catalog:v2:adro:audit
```

The command reads only the immutable fallback shard and performs no database or Production action.
Observed fingerprint: `c804241458812cf0935b11750dd58d8bbd214310a24e26cd14c330ef3277015b`.
