# Catalog V2 100k/500k scale gate — 2026-08-31

## Outcome

PASS. The disposable PostgreSQL 17 run generated 100,000 and 500,000 synthetic products,
two localized projection rows per product, one verified compatibility clause per product,
and four correlated constraints per clause. No production or developer catalog tables were
read or mutated: fixtures were connection-local temporary tables dropped with the transaction,
and the runner removed its uniquely named Docker container.

The gate rejects any cold query at or above 500 ms, warm p95 at or above 100 ms, or sequential
scan of a large projection/policy/clause/constraint relation. Every scenario ran once cold and
five times warm with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

## Results

| Products | Projection rows | Scenario            | Cold ms | Warm p95 ms | Large sequential scan |
| -------: | --------------: | ------------------- | ------: | ----------: | --------------------- |
|  100,000 |         200,000 | listing first page  |   0.033 |       0.022 | none                  |
|  100,000 |         200,000 | listing deep keyset |  17.976 |      16.998 | none                  |
|  100,000 |         200,000 | brand page          |   0.049 |       0.028 | none                  |
|  100,000 |         200,000 | trigram text search |   5.054 |       4.767 | none                  |
|  100,000 |         200,000 | brand facet        |   0.030 |       0.030 | none                  |
|  100,000 |         200,000 | make facet         |   0.020 |       0.020 | none                  |
|  100,000 |         200,000 | make-only fitment   |   5.327 |       4.770 | none                  |
|  100,000 |         200,000 | correlated fitment  |  20.725 |      20.708 | none                  |
|  500,000 |       1,000,000 | listing first page  |   0.041 |       0.053 | none                  |
|  500,000 |       1,000,000 | listing deep keyset |  89.643 |      90.017 | none                  |
|  500,000 |       1,000,000 | brand page          |   0.048 |       0.024 | none                  |
|  500,000 |       1,000,000 | trigram text search |  23.093 |      23.396 | none                  |
|  500,000 |       1,000,000 | brand facet        |   0.040 |       0.020 | none                  |
|  500,000 |       1,000,000 | make facet         |   0.020 |       0.020 | none                  |
|  500,000 |       1,000,000 | make-only fitment   |   4.759 |       6.112 | none                  |
|  500,000 |       1,000,000 | correlated fitment  |  26.476 |      24.083 | none                  |

## Query-plan decision

The first candidate-first fitment plan failed at 100k (warm p95 about 229 ms), and a broad
make candidate set failed at 500k (about 144 ms). The accepted plan reads projections in
`stableRank, productId` order, performs product-first indexed compatibility checks, preserves
all selected dimensions inside the same verified clause, and uses `OFFSET 0` to prevent the
planner from decorrelating the bounded existence check into a full policy/clause scan.

Migration `20260831140000_optimize_catalog_projection_fitment_reads` adds the matching
case-insensitive product-first expression index. The indexed SQL path is used only when a
vehicle constraint is present; the existing Prisma projection query remains the path for
unfiltered, brand, and text-only reads.

The first aggregate facet plan scanned the full projection and measured about 288 ms warm at
only 100k products. Migration `20260831150000_optimize_catalog_projection_facets` replaces that
hot path with transactionally maintained brand/make counters keyed by locale, scope, and brand.
Counters are updated in the same serializable projection transaction for create, relabel,
brand/scope move, publish, and archive. Later vehicle facets retain clause correlation and unlock
only after brand/make/model have reduced the candidate set.

## Reproduction

```powershell
npm run shop:catalog:v2:scale:docker
```

The runner requires Docker, starts `pgvector/pgvector:0.8.2-pg17` on an automatically assigned
localhost port, and writes the detailed ignored artifact to
`artifacts/catalog-v2-scale/catalog-v2-scale-gate.json`. A direct database run is also available
through `shop:catalog:v2:scale`, but it rejects any URL that is not localhost and does not contain
`application_name=catalog-scale-gate`.

Fresh migration replay after this change: 41 migrations, 136 public tables, schema diff empty.
