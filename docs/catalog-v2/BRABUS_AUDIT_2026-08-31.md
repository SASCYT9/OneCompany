# Brabus Catalog V2 audit — 2026-08-31

Immutable input: `public/catalog-fallback/brabus.1156c4d93c61.json`  
Products: 977  
Raw leaves/provenance: 49,932 / 49,932

## Normalization result

| Metric | Result |
| ------ | -----: |
| Verified products | 729 |
| Needs review | 248 |
| Correlated applications | 978 |
| Exact chassis applications | 791 |
| Engine-relevant products without engine identity | 125 |
| Legacy make conflicts | 168 |
| Missing authoritative make | 5 |
| Unresolved vehicle application | 1 |

Title chassis markers such as `X 167`, `W 465`, and `C 217` are mapped through a versioned Brabus
chassis vocabulary. A chassis and its model stay in one correlated application. Legacy `fits-make`
tags are supporting evidence only: 168 records claim Mercedes-Benz while their title identifies
Rolls-Royce, Bentley, Lamborghini, Porsche, or Range Rover. Those records retain the title-derived
candidate application but remain `NEEDS_REVIEW`; the conflicting raw tag is never discarded.

PowerXtra, turbo, engine, exhaust, downpipe, and catalyst products are engine-relevant. When the
snapshot does not provide an engine identity they use `ENGINE/FUEL=UNKNOWN`, not a broad verified
match. Non-engine accessories use `ENGINE/FUEL=NOT_APPLICABLE`.

## Persistence

Brabus and Eventuri now share the generic vehicle-policy persistence engine for canonical taxonomy,
source aliases, policy revisions, and all 13 dimensions. The source-specific adapter supplies Brabus
interpretation without forking the database transaction or fitment schema.

The bounded CLI is resumable, dry-run by default, and requires explicit non-production authorization:

```powershell
npm run shop:catalog:v2:brabus:audit
npm run shop:catalog:v2:brabus:backfill -- --limit=50
```

Disposable PostgreSQL proves an exact Mercedes X167/GLS clause with chassis value and engine not
applicable, plus a PowerXtra clause that remains review-only with unknown engine. Eventuri's exact,
universal, and review semantics also pass after the shared-engine refactor. No Production backfill
was executed.

Audit fingerprint: `ff3194e23deac01017790dbcabbce232d98244b2812a6d13b83ecf1d38757852`.
