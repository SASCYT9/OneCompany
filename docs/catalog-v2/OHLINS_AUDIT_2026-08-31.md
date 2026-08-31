# Öhlins Catalog V2 audit — 2026-08-31

Immutable input: `public/catalog-fallback/ohlins.57e307f182a6.json`

Products: 489

Raw leaves/provenance: 15,159 / 15,159

## Result

| Metric | Result |
| ------ | -----: |
| Verified | 329 |
| Needs review | 160 |
| Universal | 102 |
| Vehicle-specific | 227 |
| Correlated applications | 318 |
| Exact chassis applications | 188 |
| Unresolved vehicle applications | 154 |
| Unmodeled drivetrain constraints | 6 |

Normalization reuses the existing curated Öhlins chassis-to-model vocabulary instead of creating a
second taxonomy. Universal springs and hardware produce universal policies without fabricated
vehicle clauses. Suspension dimensions do not depend on engine, so engine and fuel are explicitly
not applicable.

Products whose title does not reliably resolve a model remain review-only. RWD, AWD, xDrive, and
similar restrictions are also quarantined until drivetrain can be represented exactly; they are
never silently broadened. Every raw value remains available in the immutable ledger.

The bounded CLI is resumable, dry-run by default, and rejects Production writes. Disposable
PostgreSQL proves exact G80/G82/G87 clauses, universal persistence, review-only drivetrain behavior,
and the Urban regression. No Production backfill was executed.

Audit fingerprint: `719305df1efdf352cd3edec7b0a0588699f70c8f0ad9573f3cacf0ee3bc6189d`.
