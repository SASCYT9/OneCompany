# Catalog V2 production reader activation guard — 2026-08-31

Production `SHOP_CATALOG_V2_READER_MODE=ssr` now fails closed during predeploy unless a signed evidence marker is valid for the exact deployed commit.

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
