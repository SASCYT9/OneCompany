# Catalog V2 remaining-source inventory — 2026-08-31

The immutable fallback manifest contains 15,132 products. RaceChip (5,181), ADRO (240), and
Eventuri (115) account for 5,536 completed P6 normalizations. This inventory reconciles every one of
the remaining 9,596 records without a database read.

| Source | Records | Raw leaves | Structured fit tags | Product-level targets | Repeated SKU records |
| ------ | ------: | ---------: | ------------------: | --------------------: | -------------------: |
| Akrapovic | 421 | 15,970 | 411 | 0 | 0 |
| Brabus | 977 | 49,932 | 977 | 0 | 0 |
| Burger Motorsports | 666 | 35,506 | 255 | 0 | 27 |
| CSF | 297 | 10,763 | 249 | 0 | 0 |
| do88 | 1,230 | 50,859 | 515 | 0 | 0 |
| Remus (`generic` shard excluding Eventuri) | 3,849 | 160,191 | 3,797 | 3,849 | 0 |
| GiroDisc | 958 | 47,068 | 585 | 0 | 0 |
| Ilmberger Carbon | 339 | 12,450 | 270 | 339 | 0 |
| iPE | 111 | 6,511 | 111 | 0 | 27 |
| Öhlins | 489 | 15,159 | 488 | 0 | 0 |
| Urban Automotive | 259 | 15,252 | 259 | 0 | 0 |

Total remaining raw leaves: 419,661. The inventory fingerprint is
`a44f879aaf6cbe0f27efc6a789cd15c3e5fc29a921ec5d9e8287c9e969117c09`.

## Architectural finding

Remus and Ilmberger snapshot records have no default variant. Creating synthetic variants would
change identity and violate the no-loss requirement. The shared Catalog V2 ledger writer now accepts
both true `PRODUCT` and `VARIANT` bindings, stores nullable `variantId`, selects the matching binding
entity type, and invokes the same source-specific compatibility callback. Disposable PostgreSQL
proves a product-level source record creates no synthetic `ShopProductVariant`.

Burger and iPE repeat supplier SKUs. Their future source record keys must therefore include immutable
product identity, as RaceChip already does; SKU alone is not a valid canonical identity.

## Sequencing

The next batch order is driven by explicit source evidence rather than brand size:

1. Brabus, Urban, Öhlins, then Akrapovic: nearly complete structured fit tags and stable variants.
2. iPE: complete fit tags, with repeated-SKU collision handling.
3. CSF, GiroDisc, do88, Burger: mixed structured/unstructured rows, with unresolved rows quarantined.
4. Remus and Ilmberger: product-level policy targets, now supported by the common writer.

Each source still requires a source-specific interpretation of when engine, body, drivetrain, and
other dimensions are exact, any, not applicable, or unknown. The inventory does not promote legacy
tags directly into verified policies.

## Reproduction

```powershell
npm run shop:catalog:v2:remaining:audit
```

The command reads immutable shards only. No Production write or backfill was performed.
