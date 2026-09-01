import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const queryModule = import("../../../src/lib/shopCatalogProjectionQuery.server");

test("query normalization is bounded and fail-closed", async () => {
  const { normalizeShopCatalogProjectionQuery } = await queryModule;
  assert.equal(normalizeShopCatalogProjectionQuery({ locale: "ua" }).limit, 24);
  assert.throws(() => normalizeShopCatalogProjectionQuery({ locale: "ua", limit: 101 }), /limit/);
  assert.throws(() => normalizeShopCatalogProjectionQuery({ locale: "ua", year: 1800 }), /year/);
  assert.throws(
    () =>
      normalizeShopCatalogProjectionQuery({
        locale: "ua",
        after: { stableRank: "invalid", productId: "p" },
      }),
    /cursor/
  );
});

test("vehicle filters stay correlated inside one clause regardless of review status", async () => {
  const { buildShopCatalogProjectionWhere } = await queryModule;
  const where = buildShopCatalogProjectionWhere({
    locale: "ua",
    brand: "Eventuri",
    category: "intake",
    make: "BMW",
    model: "M2",
    generation: "F87",
    year: 2019,
    engine: "N55",
    fuel: "petrol",
  });
  const serialized = JSON.stringify(where);
  assert.match(serialized, /catalogProjectionPolicies/);
  assert.doesNotMatch(serialized, /\"verification\"/);
  assert.match(serialized, /\"dimension\":\"MAKE\"/);
  assert.match(serialized, /\"dimension\":\"ENGINE\"/);
  assert.match(serialized, /\"categoryKey\"/);
  assert.doesNotMatch(serialized, /UNKNOWN/);
  const clause =
    where.product && "catalogProjectionPolicies" in where.product
      ? where.product.catalogProjectionPolicies
      : null;
  assert.ok(clause);
});

test("keyset cursor uses stable rank and product identity", async () => {
  const { buildShopCatalogProjectionWhere } = await queryModule;
  const where = buildShopCatalogProjectionWhere({
    locale: "en",
    after: { stableRank: "10.25000000", productId: "product-10" },
  });
  assert.deepEqual(where.AND, [
    {
      OR: [
        { stableRank: { gt: "10.25000000" } },
        { stableRank: "10.25000000", productId: { gt: "product-10" } },
      ],
    },
  ]);
});

test("vehicle query is product-first, clause-correlated, and planner-fenced", async () => {
  const { buildShopCatalogProjectionVehicleQuerySql } = await queryModule;
  const query = buildShopCatalogProjectionVehicleQuerySql({
    locale: "ua",
    limit: 24,
    category: "intake",
    make: "BMW",
    model: "M2",
    engine: "N55",
    year: 2019,
  });
  assert.ok(query);
  const sql = query.sql;
  assert.match(sql, /FROM "ShopCatalogProjection" projection/);
  assert.match(sql, /policy\."productId" = projection\."productId"/);
  assert.match(sql, /compatibility_constraint\."targetKey" = clause\."targetKey"/);
  assert.match(sql, /compatibility_constraint\."clauseKey" = clause\."clauseKey"/);
  assert.match(sql, /compatibility_constraint\."sourceVersion" = clause\."sourceVersion"/);
  assert.match(sql, /OFFSET 0/);
  assert.match(sql, /ORDER BY projection\."stableRank" ASC/);
  assert.equal(query.values.includes("BMW"), true);
  assert.equal(query.values.includes("intake"), true);
  assert.equal(query.values.includes("m2"), true);
  assert.equal(query.values.includes("N55"), true);
  assert.equal(query.values.includes(2019), true);
});

test("vehicle SQL path stays disabled when no compatibility filter is selected", async () => {
  const { buildShopCatalogProjectionVehicleQuerySql } = await queryModule;
  assert.equal(
    buildShopCatalogProjectionVehicleQuerySql({ locale: "en", brand: "Eventuri" }),
    null
  );
});

test("progressive facet SQL is bounded, single-round-trip, and clause-correlated", async () => {
  const { buildShopCatalogProjectionFacetQuerySql, SHOP_CATALOG_PROJECTION_FACET_LIMIT } =
    await queryModule;
  const query = buildShopCatalogProjectionFacetQuerySql({
    locale: "ua",
    text: "intake",
    brand: "Eventuri",
    make: "BMW",
    model: "M2",
    generation: "G87",
    year: 2024,
    engine: "S58",
  });
  const sql = query.sql;
  assert.equal((sql.match(/UNION ALL/g) ?? []).length, 7);
  assert.equal((sql.match(/LIMIT/g) ?? []).length, 8);
  assert.match(sql, /'brand'::text/);
  assert.match(sql, /'category'::text/);
  assert.match(sql, /candidate_row\."dimension"/);
  assert.match(sql, /candidate_row\."targetKey" = clause\."targetKey"/);
  assert.match(sql, /candidate_row\."clauseKey" = clause\."clauseKey"/);
  assert.match(sql, /compatibility_constraint\."targetKey" = clause\."targetKey"/);
  assert.match(sql, /compatibility_constraint\."clauseKey" = clause\."clauseKey"/);
  assert.match(sql, /candidate_row\."state" = 'EXACT'/);
  assert.match(sql, /JOIN LATERAL/);
  assert.match(sql, /OFFSET 0/);
  assert.match(sql, /count\(DISTINCT projection\."productId"\)/);
  assert.equal(
    query.values.filter((value) => value === SHOP_CATALOG_PROJECTION_FACET_LIMIT).length,
    8
  );
  assert.equal(query.values.includes("intake"), false);
  assert.equal(
    query.values.some((value) => value === "%intake%"),
    true
  );
  assert.equal(query.values.includes("Eventuri"), true);
  assert.equal(query.values.includes("BMW"), true);
  assert.equal(query.values.includes("m2"), true);
  assert.equal(query.values.includes("G87"), true);
  assert.equal(query.values.includes(2024), true);
  assert.equal(query.values.includes("S58"), true);
});

test("progressive facet SQL never applies a later vehicle field to an earlier facet", async () => {
  const { buildShopCatalogProjectionFacetQuerySql } = await queryModule;
  const query = buildShopCatalogProjectionFacetQuerySql({
    locale: "en",
    engine: "S58",
    fuel: "petrol",
  });
  // A sparse deep link cannot unlock expensive later aggregations. Only the
  // Brand and category are cheap projection facets; vehicle facets remain locked.
  assert.equal((query.sql.match(/UNION ALL/g) ?? []).length, 1);
  assert.equal(query.values.includes("S58"), false);
  assert.equal(query.values.includes("petrol"), false);
});

test("progressive facets unlock exactly one level at a time", async () => {
  const { buildShopCatalogProjectionFacetQuerySql } = await queryModule;
  const cases = [
    [{ locale: "ua" as const }, 2],
    [{ locale: "ua" as const, brand: "Eventuri" }, 3],
    [{ locale: "ua" as const, brand: "Eventuri", make: "BMW" }, 4],
    [{ locale: "ua" as const, brand: "Eventuri", make: "BMW", model: "M2" }, 8],
    [
      {
        locale: "ua" as const,
        brand: "Eventuri",
        make: "BMW",
        model: "M2",
        generation: "G87",
      },
      8,
    ],
  ] as const;
  for (const [input, branchCount] of cases) {
    const sql = buildShopCatalogProjectionFacetQuerySql(input).sql;
    assert.equal((sql.match(/UNION ALL/g) ?? []).length + 1, branchCount);
  }
});
