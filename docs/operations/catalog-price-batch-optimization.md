# Catalog price batching

Price initialization writes at most ten products in one transaction. It checks
the pinned database/plan, source prices, SKUs, variant membership and catalog
versions before changes, then preserves complete immutable revisions and durable
outbox/receipts. Atomic local checkpoints allow a checked resume.

Large canonical revision payloads use a `onecompany-canonical-brotli-json-v1`
envelope inside the existing opaque `snapshot.canonical` field. No field or
relation is dropped. The revision `contentHash` remains the SHA-256 of the exact
original canonical JSON; compressed bytes have a separate checksum. The reader
also supports gzip envelopes. Small payloads
retain the legacy raw JSON shape. Read or restore either format with
`decodeShopCatalogRevisionCanonical(canonical, revision.contentHash)`. Publication
validates the envelope and uses the existing compact projection source, without
inflating the archival payload. Existing projection-only readers continue to use
the same snapshot schema and projection source. Source transactions retain the
120-second overall bound and use a 60-second idle guard because materializing a
large lossless archive legitimately takes longer than a small price update.

PRICE publication compares both locale hashes and every SKU field against the
new immutable source reconstructed at the stored version. It advances matching
projection/child versions without deleting rows. Missing or changed projections
use the normal complete rebuild. Sorted product row locks, previous projection
version/hash checks, the final lease check and atomic receipt completion protect
concurrent batches. This path uses ReadCommitted so unrelated products do not
conflict on predicate locks; source-price writes retain Serializable isolation.

Retries cover only rolled-back P2034 and raw SQL 40001/40P01 conflicts. Connection
losses and permanent errors stop or enter the normal durable outbox retry path;
they are never treated as successful publication. After initialization, independently
verify all source bands, durable publication and public storefront currencies.
