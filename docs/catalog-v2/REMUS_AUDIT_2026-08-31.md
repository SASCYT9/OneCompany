# Remus Catalog V2 audit — 2026-08-31

- Source: deterministic `brand === Remus` subset of `generic.b6c6a9380c59.json`.
- Parent records: 3,964; exact Remus subset: 3,849.
- Raw Remus leaves preserved: 160,191 / 160,191.
- Verified: 3,794; needs review: 55; universal: 2.
- Correlated applications: 8,927; exact years: 8,240; exact OPF/GPF: 703.
- Fingerprint: `34fc65b85b2fcfe2cbd082e2faecaecef5ea03ce9179de87d26a404b6e2ef2b3`.

The importer preserves tag order because the legacy feed encodes compatibility groups sequentially. A SEAT model followed by its years and a VW model followed by another year become separate clauses; years are not cross-multiplied across makes/models. Namespaced model tags keep multi-make applications correlated. `fits-trim:*:1` placeholder values are not promoted into chassis taxonomy.

Remus uses product-level policies because the shard contains no variants. Vehicle-specific exhausts keep engine relevant but unknown unless evidence exists. OPF/GPF becomes exact only when explicitly present in the title. Explicit universal rows use universal semantics.

The full all-source PostgreSQL rehearsal exposed three supplier rows containing corrupt expanded
year tags from `1000` through `2007`. Their raw tags remain losslessly preserved, but the mapper now
rejects the entire year set, emits `invalid_year_evidence`, persists model-level `YEAR=UNKNOWN`, and
keeps the policies in review instead of inventing compatibility or violating the database year
constraint.

Unit tests: 8/8. TypeScript, bounded dry-run, complete migration replay, and disposable PostgreSQL passed. PostgreSQL covers exact year and OPF/GPF, unknown vehicle engine, universal engine not applicable, universal OPF/GPF any, corrupt-year quarantine, and replay idempotency. Commit mode is capped, resumable, non-production-only, and authorization guarded. Production actions performed: none.
