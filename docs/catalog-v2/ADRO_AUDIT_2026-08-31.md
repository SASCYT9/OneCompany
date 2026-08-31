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

## Transactional persistence

ADRO uses the common Catalog V2 source backfill core rather than a copy of the RaceChip transaction.
The core bounds pages to 50 sorted records, validates product/variant ownership, appends immutable
source and binding revisions, compares complete provenance and issue evidence on replay, and commits
under `Serializable` isolation. A source-specific callback persists taxonomy and compatibility in the
same transaction.

The ADRO callback creates source-scoped make/model/generation aliases and a versioned policy targeting
the exact default variant. Every parsed application becomes a correlated OR clause with 13 explicit
constraints. Engine, fuel, drivetrain, transmission, and OPF/GPF are `NOT_APPLICABLE`; generation,
chassis, and year are exact only when present in source evidence, otherwise `ANY`. Ambiguous products
create only `NEEDS_REVIEW` clauses. A new source revision retires the old policy without deleting it.

The resumable CLI is dry-run by default, requires an explicit non-production environment, dedicated
database URL, and write acknowledgement before commit:

```powershell
npm run shop:catalog:v2:adro:backfill -- --limit=50
```

Disposable PostgreSQL integration proves correlated M3/M4 chassis clauses, all 13 constraints,
source aliases, explicit aero non-applicability, idempotent replay, activation-ready coverage, and
review-only persistence for an ambiguous GR86/BRZ/M2 product. No Production backfill was executed.
