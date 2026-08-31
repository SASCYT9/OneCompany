# Catalog V2 all-source ownership gate — 2026-08-31

The immutable fallback manifest contains 13 physical shards and 15,132 records. The logical source inventory contains 14 owners because `generic` is partitioned into 115 Eventuri and 3,849 Remus records.

- Owned records: 15,132 / 15,132
- Unique product IDs: 15,132 / 15,132
- Raw leaves inventoried: 665,508
- Unowned generic records: 0
- Duplicate product identities across shards: 0
- Logical sources with mapper, audit CLI, backfill CLI, and package commands: 14 / 14
- Fingerprint: `54f4760626c096253476c9c3948a2ef439430f3cbcf08164e2a0e2f9ff38fbe9`

The gate fails closed when the manifest source set changes, a generic record has an unknown brand owner, a product identity repeats, a shard count/hash changes, or any logical source lacks its normalization/audit/backfill entrypoint. This prevents future catalog growth from silently bypassing lossless ingestion.

Production actions performed: none.
