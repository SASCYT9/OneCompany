# Catalog V2 publication gate — 2026-08-31

## Outcome

PASS. Thirty isolated product mutations completed the full canonical commit → immutable revision →
outbox claim → projection persistence → all-target receipt chain on disposable PostgreSQL 17.
The gate then read the exact canonical version through the admin publication resolver and required
`PUBLISHED` with zero version lag.

| Measurement | Result | Gate |
| ----------- | -----: | ---: |
| Samples | 30 | 30 |
| Commit-to-visible p95 | 94.521 ms | <2,000 ms |
| Commit-to-visible p99 | 154.133 ms | <5,000 ms |
| Maximum | 154.133 ms | informational |
| Same-version concurrent winners | 1 | exactly 1 |

The latency includes mutation validation, serializable canonical commit, revision/outbox creation,
worker claim, all projection targets, projection rows/facets, receipt completion, and the final
status read. It is a local correctness/SLO gate, not a substitute for a production-region canary.
These measurements are from the post-source-normalization rerun on the current Catalog V2 branch.

## Reproduction

```powershell
npm run shop:catalog:v2:publication:docker
```

The runner creates a uniquely named `pgvector/pgvector:0.8.2-pg17` container, resolves a random
localhost port, replays all 41 migrations, and removes the container in `finally`. The benchmark
rejects any database URL that is not localhost with
`application_name=catalog-publication-gate`. No production database or deployment is touched.
