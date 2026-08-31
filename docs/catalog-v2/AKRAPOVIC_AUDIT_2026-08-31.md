# Akrapovič Catalog V2 audit — 2026-08-31

Immutable input: `public/catalog-fallback/akrapovic.c959c3f25377.json`

Products: 421 (356 auto, 65 moto)

Raw leaves/provenance: 15,970 / 15,970

## Result

| Metric | Result |
| ------ | -----: |
| Verified | 66 |
| Needs review | 355 |
| Universal | 8 |
| Vehicle-specific | 58 |
| Correlated applications | 670 |
| Exact chassis applications | 477 |
| Engine-relevant without engine identity | 353 |
| OPF/GPF constraint not yet modeled exactly | 34 |
| Unresolved vehicle applications | 0 |

Existing title parsers were extended for missing BMW, Porsche, Audi, Mercedes-AMG, Lamborghini,
McLaren, Renault, Abarth, and Ducati models. Multi-model titles retain model/chassis correlation;
all 421 records now resolve their intended universal or vehicle candidate policy.

The shared persistence engine is now scope-aware. `auto:bmw` and `moto:bmw` are distinct canonical
makes, and every policy clause has exact `SCOPE`. This prevents 65 motorcycle products from
polluting automotive filters while preserving a single standard schema.

Exhaust products without exact engine identity and titles with OPF/GPF restrictions remain
review-only. Their candidate applications and every raw value remain in the immutable ledger; the
missing dimensions are not silently broadened.

The backfill is bounded to 50 records, resumable, dry-run by default, and rejects Production writes.
Disposable PostgreSQL proves isolated auto/moto BMW taxonomy, exact scope constraints, review-only
unknown engines, and Eventuri/Öhlins regressions. No Production backfill was executed.

Audit fingerprint: `1401259d28e9e10263ab712e6bb3f1c38714b7a3fc8e5df179bef9c1d2f67568`.
