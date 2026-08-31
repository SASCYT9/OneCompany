# Remus Catalog V2 audit — 2026-08-31

- Source: deterministic `brand === Remus` subset of `generic.b6c6a9380c59.json`.
- Parent records: 3,964; exact Remus subset: 3,849.
- Raw Remus leaves preserved: 160,191 / 160,191.
- Verified: 3,797; needs review: 52; universal: 2.
- Correlated applications: 11,948; exact years: 11,264; exact OPF/GPF: 703.
- Fingerprint: `ae19af0dfee6bd38e89b2ae02a394669233b0d10f8bed3bb007e6e379c522628`.

The importer preserves tag order because the legacy feed encodes compatibility groups sequentially. A SEAT model followed by its years and a VW model followed by another year become separate clauses; years are not cross-multiplied across makes/models. Namespaced model tags keep multi-make applications correlated. `fits-trim:*:1` placeholder values are not promoted into chassis taxonomy.

Remus uses product-level policies because the shard contains no variants. Vehicle-specific exhausts keep engine relevant but unknown unless evidence exists. OPF/GPF becomes exact only when explicitly present in the title. Explicit universal rows use universal semantics.

Unit tests: 7/7. TypeScript, bounded dry-run, complete migration replay, and disposable PostgreSQL passed. PostgreSQL covers exact year and OPF/GPF, unknown vehicle engine, universal engine not applicable, universal OPF/GPF any, and quarantine. Commit mode is capped, resumable, non-production-only, and authorization guarded. Production actions performed: none.
