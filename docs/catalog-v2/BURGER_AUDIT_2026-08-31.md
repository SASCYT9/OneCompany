# Burger Catalog V2 audit — 2026-08-31

## Immutable input and identity

- Shard: `burger.596b3eacf0c3.json`
- Products: 666
- Raw leaves preserved: 35,506 / 35,506
- Duplicate SKU values: 11
- Record identity: immutable product ID plus slug; SKU is retained as data but never used to merge records.
- Fingerprint: `283ec89f8d18d82b5801c05db4a2b191346a132ed048154acbdd1499a4e16ba9`

## Compatibility result

- Verified: 487
- Vehicle-specific: 406
- Universal: 81
- Needs review: 179
- Applications: 3,705
- Exact chassis applications: 3,136
- Exact engine applications: 3,036
- Multi-make correlation unresolved: 44
- Vehicle make/model unresolved: 135

BMW applications use correlated `fits-model` and `fits-trim` evidence plus explicit engine tags. The source contains known cross-brand pollution, including BMW G70/7-Series tags on Kia/Hyundai products; multi-make products are quarantined rather than expanded into unsafe make/model cross-products. Universal accessories remain universal.

## Gates

- Unit tests: 5/5 passed.
- TypeScript: passed.
- Bounded dry-run: passed.
- Disposable PostgreSQL with complete migration replay: correlated BMW model/chassis/B58 powertrain passed; polluted multi-make policy remained `NEEDS_REVIEW`.
- Commit CLI is resumable and limited to 50 records per page.
- Production writes require explicit non-production environment, isolated URL, and authorization flag; production environment is hard-blocked.
- Production actions performed: none.
