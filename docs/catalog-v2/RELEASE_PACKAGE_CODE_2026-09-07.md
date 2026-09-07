# Catalog V2 code/config release package

Date: 2026-09-07  
Branch: `codex/storefront-cost-optimization`  
Release commit: `d7bb2166` (SSR, search, media, viewport, artifact reuse, freshness, acceptance, immutable source evidence, and bounded recommendations)

## Included behavior

- Lossless KW/FI canonical policy persistence with explicit review and unknown states.
- Versioned source coverage marker and atomic checkpoint finalization.
- Bounded Catalog V2 listing, fitment, search, and suggestion reads.
- Explicit guarded SSR route for `/shop/catalog`; reader-off still rewrites to the legacy storefront.
- Token-order-insensitive suggestions with exact normalized SKU priority.
- BMW M5 G90 → S68 canonical alias handling.
- Narrow PDP related-product reads, fresh bounded card pricing, and existing cache/privacy guards.
- Reader-off remains the rollback default; `ssr` and canary require the existing signed activation guards.

## Configuration and rollout

No production environment variable or flag was changed. Keep
`SHOP_CATALOG_V2_READER_MODE=off` and
`SHOP_CATALOG_V2_VEHICLE_READER_MODE=off` until the data package, signed evidence,
and owner approval are complete. The build artifact cache remains opt-in and must
receive an authoritative publication key; an absent or invalid key regenerates
the snapshot from the database.

## Rollback

Set the reader mode back to `off` and redeploy the same code package or previous
known-good commit. The legacy reader remains authoritative in that mode. Do not
delete projections, revisions, source records, or coverage history during
rollback. Investigate lag/dead-letter/failed-receipt evidence before retrying.

## Verification evidence

- `npm run typecheck` — pass.
- Node 22.14.0 selected catalog suite — 344/344 catalog tests and 63/63 stock/pricing tests pass.
- `npm run shop:catalog:v2:publication:docker` — final local disposable-DB baseline `b757eefa`, 30 samples, p95 82.926 ms, p99 126.240 ms, one contention winner; all 44 migrations replayed.
- `artifacts/catalog-v2-scale/catalog-v2-scale-gate.json` — exact audit baseline `675d829670f5402e99a1c92f63d77afed99f5a63`, 100k/500k query scale evidence, maximum warm p95 75.541 ms.
- The executable release code is `d7bb2166` plus source-evidence hardening `139f3e08`; source evidence now includes and verifies the immutable payload hash and source revision, provenance duplicates/orphans fail closed, and SSR recommendations use bounded projection candidates. The final documentation/evidence commit is updated after validation.
- The storefront acceptance artifact was regenerated on clean commit `b93a9412`; it covers UA/EN, 390×844 and 1440×1000, 30 browser/runtime samples, and expected selector fail-closed responses.

## Open approval gates

Production-region canary, signed activation evidence, real production source
coverage/backfill, and post-release measurements remain outside this package.
