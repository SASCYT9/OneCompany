# Catalog V2 production reader activation guard — 2026-08-31

Production `SHOP_CATALOG_V2_READER_MODE=ssr` now fails closed during predeploy unless a signed evidence marker is valid for the exact deployed commit.

The same guard applies to `SHOP_CATALOG_V2_READER_MODE=canary`; partial traffic is production
traffic and cannot bypass evidence requirements.

Required evidence:

- current all-source ownership fingerprint;
- valid persisted source-coverage fingerprint and all 14 logical sources ready;
- projection version lag exactly zero;
- at least 1,000 shadow requests, zero mismatches, error rate at most 0.1%;
- scale-query p95 at most 200 ms;
- commit-to-visible p95 at most 2,000 ms;
- marker lifetime at most 24 hours and not expired;
- HMAC signing secret of at least 32 bytes and a full deployed commit SHA.

Invalid, missing, stale, tampered, or commit-mismatched evidence blocks the build. Reader-off and non-production workflows remain unaffected. Unit tests cover valid activation, weak evidence, tampering, commit mismatch, and flag-off behavior. Production reader activation performed: none.

## Marker creation

Store the collected evidence as JSON matching `ShopCatalogReleaseEvidence`, then run:

```powershell
$env:SHOP_CATALOG_V2_RELEASE_GATE_SECRET = "<secret-from-password-manager>"
npm run shop:catalog:v2:activation:sign -- --evidence .\path\to\release-evidence.json
```

The signer refuses weak secrets and any evidence that the production guard would reject. It emits
only the signed marker; the evidence file and secret must not be committed. Set the emitted value as
`SHOP_CATALOG_V2_RELEASE_GATE_MARKER` for the exact commit named by the evidence, then run
`shop:catalog:v2:activation:check` in the deployment environment.

Rollback is the independent, recoverable operation: set `SHOP_CATALOG_V2_READER_MODE=off` and
redeploy the same known-good commit. The off decision does not require a marker and never mutates or
deletes canonical data. The production decision owner still has to be named before activation.

For a faster percentage rollback while retaining canary mode, set
`SHOP_CATALOG_V2_CANARY_PERCENTAGE=0`. See
[CANARY_ROLLBACK_GATE_2026-09-01.md](./CANARY_ROLLBACK_GATE_2026-09-01.md).

Shadow evidence is no longer reconstructed from ephemeral logs. With compare mode enabled, each
supported legacy request records a commit-bound hourly aggregate after the response, segmented by
locale, brand, and category. Read the last 24 hours without mutating data using:

```powershell
$env:CATALOG_SHADOW_EVIDENCE_ALLOW_DB_READ = "1"
$env:CATALOG_SHADOW_EVIDENCE_DATABASE_URL = "<read-only-database-url>"
npm run shop:catalog:v2:shadow:evidence -- --commit=<full-commit-sha> --hours=24
```

The command exits `2` unless the activation thresholds are satisfied.
### Automatic evidence collection

Run `shop:catalog:v2:release:evidence -- --commit=<full-sha>` with explicit `CATALOG_RELEASE_EVIDENCE_ALLOW_DB_READ=1` and `CATALOG_RELEASE_EVIDENCE_DATABASE_URL`. The collector only accepts JSON performance artifacts below `artifacts/`, requires both artifacts to match the requested commit, verifies every active source record and both locale projections, and reads shadow aggregates for that same commit. It writes an unsigned, short-lived document below `artifacts/catalog-v2-release/`; signing is deliberately separate.
