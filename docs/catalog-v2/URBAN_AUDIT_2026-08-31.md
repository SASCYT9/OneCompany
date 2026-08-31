# Urban Catalog V2 audit — 2026-08-31

Immutable input: `public/catalog-fallback/urban.f3b694bd29b9.json`

Products: 259

Raw leaves/provenance: 15,252 / 15,252

## Normalization result

| Metric | Result |
| ------ | -----: |
| Verified products | 244 |
| Needs review | 15 |
| Correlated applications | 321 |
| Exact chassis applications | 201 |
| Engine-relevant products | 5 |
| Missing engine identity | 5 |
| Unresolved vehicle application | 12 |

Authoritative `urban-vehicle-brand:*` tags establish make evidence. Title and generation markers
such as `L405`, `L460`, `L494`, `L461`, `L663`, `W465`, `W463A`, and `T6.1` are mapped through a
versioned Urban vocabulary while remaining correlated with their model. Audi platform markers are
also retained for RSQ8, RS6/RS7, RS4, and RS3 applications.

Legacy `fits-model` values frequently contain Urban wheel design names such as `22-wx5`; they are
preserved in the immutable source ledger but never promoted into vehicle taxonomy. Unresolved title
evidence stays `NEEDS_REVIEW` rather than becoming a broad brand match.

Urban exhaust products are engine-relevant. All five lack an engine identity in the snapshot and
therefore use `ENGINE/FUEL=UNKNOWN` with review-only policies. Aero and wheel products use
`ENGINE/FUEL=NOT_APPLICABLE`; no engine compatibility is guessed.

## Persistence

Urban uses the shared bounded source-ledger writer and generic vehicle-policy persistence engine.
Each record retains every raw leaf and provenance entry, writes source-scoped aliases, and persists
all 13 compatibility dimensions. Multi-chassis products become separate correlated OR clauses.

The CLI is resumable, dry-run by default, and requires explicit non-production authorization:

```powershell
npm run shop:catalog:v2:urban:audit
npm run shop:catalog:v2:urban:backfill -- --limit=50
```

Disposable PostgreSQL proves correlated L405/L494 wheel clauses with engine not applicable and a
Bentley Continental GT exhaust that remains review-only with unknown engine. Brabus and Eventuri
regression persistence tests pass in the same clean schema. No Production backfill was executed.

Audit fingerprint: `6a508f18d596acbc4d50748a80b011ca9d79639db1d9fc1572ee67d902f2aeee`.
