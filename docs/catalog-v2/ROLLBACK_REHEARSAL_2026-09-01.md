# Catalog V2 non-production rollback rehearsal — 2026-09-01

Commit: `8b65668b2af7e14f0713a9d1716844e0e8d17f88`

The local development environment intentionally had no usable `DATABASE_URL`. Starting the same
commit in `canary` mode routed the request into Catalog V2 and produced a fail-closed Prisma
initialization error. The server was stopped, restarted with
`SHOP_CATALOG_V2_READER_MODE=off` and `SHOP_CATALOG_V2_CANARY_PERCENTAGE=0`, and the same catalog
URL was requested again.

Rollback result:

- HTTP status: `200`;
- Catalog V2 marker: absent;
- response size: 153,526 bytes;
- Prisma error in returned HTML: absent;
- headless Chromium after hydration: 25 main-content links and 66 images;
- browser page errors: zero.

This rehearses the operational recovery mechanism under a real reader dependency failure: switch
the reader off and serve the retained resilience/legacy path. It does not claim a successful V2
canary, production-region performance, or production observation-window evidence.

No Production environment, deployment, database, or external integration was changed.
