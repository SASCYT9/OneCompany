# Catalog V2 all-source persistence gate — 2026-09-01

Commit: `aba39237782ec2e686f316b297ca0a2f36eab4a9`

The commit-bound disposable PostgreSQL 17 gate completed all 14 logical sources and replayed all
15,132 immutable records. It retained 665,508 raw-field provenance entries, 10,944 variant
identities, 2,885 normalization issues, 2,655 review-only policies, and 15,132 active compatibility
policies. Every persisted inline raw payload reconstructed to the same full canonical hash as its
input and all 15,132 products retained UA and EN titles.

## Throughput

| Phase | Time | Throughput |
| --- | ---: | ---: |
| Initial lossless persistence | 734,168 ms | 74,200 records/hour |
| Immutable idempotent replay | 67,873 ms | 802,605 records/hour |
| Complete gate | 808,192 ms | — |

The replay fast-path still compares payload identity, canonical ownership, every provenance
signature, and every normalization issue. It skips compatibility/taxonomy persistence only after
those immutable signatures match, because evidence and compatibility are committed atomically on
the initial insert.

## Important boundary

The immutable fallback shards use storefront snapshot fields such as `image` and `gallery`; they
do not contain the database relation names `media`, `metafields`, `options`, or
`vehicleApplications`. Therefore the generic database-baseline counters report zero for those
relation names. This is not raw-data loss—the full-payload hash and raw-field ledger cover those
fields—but it is not sufficient evidence of canonical relation promotion either. A separate
PostgreSQL regression seeds UA/EN content, price, gallery, media, option, metafield, and collection
relations before source persistence and proves that their complete baseline hash and counts remain
identical after insert and replay. Canonical promotion coverage for new empty databases must still
be measured separately before production activation.

No Production database, deployment, reader flag, or external integration was changed.
