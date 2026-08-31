# Ilmberger Catalog V2 audit — 2026-08-31

- Immutable shard: `ilmberger.9d8ec2e8818d.json`
- Products: 339; source deliberately contains no variants.
- Raw leaves preserved: 12,450 / 12,450.
- Verified: 335; needs review: 4.
- Applications: 364; exact-year applications: 341.
- Fingerprint: `a21b2a83b8d00b81c383a1084a9922e7dcc63a5fc1e16c83b93f4ba042b70d17`.

Ilmberger is mapped to motorcycle scope. BMW and Ducati model evidence is taken from human-readable title/category tags. Per-model years are correlated from the title where multiple motorcycles occur in one product. Engine is not a compatibility dimension for these carbon body components.

The shared writer now supports the schema's existing product-level compatibility target. Ilmberger records bind to `product:<id>` rather than fabricating absent variant identities. Disposable PostgreSQL proves two correlated BMW model/year clauses, `moto` scope, and `NOT_APPLICABLE` engine state.

Unit tests: 5/5. TypeScript, bounded dry-run, complete migration replay, and PostgreSQL persistence passed. Commit mode remains resumable, capped at 50, explicitly non-production, and authorization guarded. Production actions performed: none.
