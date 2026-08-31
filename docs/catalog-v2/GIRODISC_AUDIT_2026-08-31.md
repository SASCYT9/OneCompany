# GiroDisc Catalog V2 audit — 2026-08-31

Immutable input: `public/catalog-fallback/girodisc.013fdb2cc325.json`

Products: 958

Raw leaves/provenance: 47,068 / 47,068

## Result

| Metric | Result |
| ------ | -----: |
| Verified | 705 |
| Needs review | 253 |
| Correlated applications | 861 |
| Exact chassis applications | 438 |
| Parent/vehicle unresolved components | 248 |
| Suspect complex title parses | 3 |

Vehicle make/model/chassis is parsed independently from rotor diameter, piston diameter, axle, and
component-series tokens. Multi-model titles keep chassis correlation. All brake components use
engine/fuel not applicable; no engine identity is fabricated.

Generic hardware and replacement components without an explicit vehicle require a parent product
and remain review-only. Three complex Ferrari titles and two make-only Porsche components also stay
quarantined instead of contaminating vehicle facets.

The bounded resumable CLI is dry-run by default and rejects Production writes. Disposable
PostgreSQL proves correlated W218/W212 clauses, parent-only quarantine, engine not applicable, and
the CSF regression. No Production backfill was executed.

Audit fingerprint: `666098a1d1c8c6cf7ee9f969781a38b423ea5a70d861a558aa10a4d1115c6e56`.
