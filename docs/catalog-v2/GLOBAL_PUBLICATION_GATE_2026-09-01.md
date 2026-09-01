# Catalog V2 global publication gate — 2026-09-01

The disposable PostgreSQL 17 gate replayed all 42 migrations and verified product plus global
publication from canonical commit through durable receipts. No production database or deployment
was touched.

| Measure | Result |
| --- | ---: |
| Product commit-to-visible samples | 30 |
| Product p95 | 81.713 ms |
| Product p99 / maximum | 123.739 ms |
| Same-product contention winners | 1 |
| Global events in atomic settings mutation | 2 |
| Global target receipts | 3 |
| Concurrent settings versions | 2, 3 |

`ShopCatalogGlobalVersion` is a non-deletable monotonic cursor restricted to `SETTINGS` and
`PRICE_BOOK`. The coordinator locks cursors in stable order, commits the settings mutation and
audit in the same Serializable transaction as receipts/outbox, and retries both Prisma `P2034`
and raw PostgreSQL `40001` serialization representations. Global publication acknowledges the
already-committed canonical live state without product projection rebuild or catalog-wide ISR.

All live `ShopSettings` API writers use this coordinator and schedule immediate bounded outbox
processing with cron recovery. The unreferenced hardcoded currency-rate script now fails closed
before Prisma client construction.

Command: `npm run shop:catalog:v2:publication:docker`.

Production actions performed: none.
