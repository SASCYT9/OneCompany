# Catalog V2 all-source backfill gate — 2026-09-01

The disposable PostgreSQL 17 rehearsal applied all 41 migrations present when the run started,
seeded the exact immutable catalog identities, persisted every logical source, checked database
parity, and replayed the complete input. The container used a random localhost port and
`application_name=catalog-all-source-gate`; it was removed automatically. No production database
or deployment was touched.

| Measure | Result |
| --- | ---: |
| Logical sources | 14 |
| Product records | 15,132 |
| Variant identities | 10,944 |
| Raw-field provenance rows | 665,508 |
| Normalization issues | 2,885 |
| Active compatibility policies | 15,132 |
| Review policies | 2,655 |
| Idempotent replay | 15,132 / 15,132 |
| Elapsed | 1,011,390 ms |
| Identity fingerprint | `c4c80911026fd40a20da2f50c26b79ec82472a8fa0e8d9374c9d941a2987cdf7` |

The run exposed and fixed mixed auto/moto alias collisions, case-insensitive RaceChip taxonomy
identity drift, per-row compatibility insertion timeouts, incomplete year/fuel clause identity,
and three corrupt Remus year expansions. Every supplier value remains in immutable raw payload and
field provenance. Invalid year evidence is quarantined and persisted as unknown; it is never
silently discarded or promoted to exact compatibility.

Command: `npm run shop:catalog:v2:all-source:docker`.

Production actions performed: none.
