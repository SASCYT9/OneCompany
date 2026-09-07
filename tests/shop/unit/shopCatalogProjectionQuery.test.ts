import assert from "node:assert/strict";
import { registerHooks } from "./testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import productionModels from "./production-vehicle-models.fixture.json";
import { canonicalizeVehicleModels, vehicleModelKey } from "../../../src/lib/shopVehicleTaxonomy";

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

test("all selectable production models keep supplier aliases in both SQL search paths", async () => {
  const { buildShopCatalogProjectionVehicleQuerySql, buildShopCatalogProjectionOrderedQuerySql } =
    await queryModule;
  for (const { make, models } of productionModels) {
    for (const raw of models) {
      for (const model of canonicalizeVehicleModels(make, [raw])) {
        for (const build of [
          buildShopCatalogProjectionVehicleQuerySql,
          buildShopCatalogProjectionOrderedQuerySql,
        ]) {
          const query = build({ locale: "ua", make, model, order: "price_asc" });
          assert.ok(query);
          assert.ok(
            query.values.includes(vehicleModelKey(raw)),
            `${make} ${raw} remains reachable from ${model}`
          );
          assert.match(query.sql, /compatibility_constraint\."clauseKey" = clause\."clauseKey"/);
        }
      }
    }
  }
});

test("ORM and cascading facets use the same aliases as catalog results", async () => {
  const { buildShopCatalogProjectionWhere, buildShopCatalogProjectionFacetQuerySql } =
    await queryModule;
  const input = {
    locale: "ua" as const,
    brand: "Eventuri",
    make: "Mercedes-Benz",
    model: "AMG G 63",
  };
  const where = JSON.stringify(buildShopCatalogProjectionWhere(input));
  assert.ok(where.includes("G63 AMG"));
  const facets = buildShopCatalogProjectionFacetQuerySql(input);
  assert.ok(facets.values.includes("g63amg"));
  assert.ok(facets.values.includes("mercedes-amg"));
});

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

test("OPF-only query constraints stay clause-correlated in SQL and ORM", async () => {
  const {
    buildShopCatalogProjectionVehicleQuerySql,
    buildShopCatalogProjectionWhere,
    normalizeShopCatalogProjectionQuery,
  } = await queryModule;
  const query = buildShopCatalogProjectionVehicleQuerySql({ locale: "en", opfGpf: " WITH " });
  assert.ok(query);
  assert.equal(query.values.includes("OPF_GPF"), true);
  assert.equal(query.values.includes("with"), true);
  const where = JSON.stringify(buildShopCatalogProjectionWhere({ locale: "en", opfGpf: "with" }));
  assert.match(where, /\"dimension\":\"OPF_GPF\"/);
  assert.match(where, /\"textValue\":\{\"in\":\[\"with\"\]/);
  assert.equal(
    normalizeShopCatalogProjectionQuery({ locale: "en", opfGpf: " WITHOUT " }).opfGpf,
    "without"
  );
  for (const opfGpf of ["unknown", "with;without", "any"]) {
    assert.throws(
      () => normalizeShopCatalogProjectionQuery({ locale: "en", opfGpf }),
      /opfGpf must be with or without/
    );
  }
  assert.throws(
    () => normalizeShopCatalogProjectionQuery({ locale: "en", opfGpf: "x".repeat(321) }),
    /opfGpf exceeds 320 characters/
  );
});

test("selected terminal OPF constrains visible vehicle facet candidates", async () => {
  const { buildShopCatalogProjectionFacetQuerySql } = await queryModule;
  const query = buildShopCatalogProjectionFacetQuerySql({
    locale: "en",
    make: "BMW",
    opfGpf: "with",
  });
  // OPF is intentionally not a new facet output; it must still participate in
  // each visible make/model candidate branch as a same-clause condition.
  assert.equal((query.sql.match(/UNION ALL/g) ?? []).length + 1, 4);
  assert.equal(query.values.filter((value) => value === "OPF_GPF").length >= 4, true);
  assert.equal(query.values.filter((value) => value === "with").length >= 4, true);
  assert.doesNotMatch(query.sql, /ShopCatalogProjectionFacetCount/);
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
  assert.equal(query.values.includes("bmw"), true);
  assert.equal(query.values.includes("intake"), true);
  assert.equal(query.values.includes("m2"), true);
  assert.equal(query.values.includes("N55"), true);
  assert.equal(query.values.includes(2019), true);
});

test("projection text search accepts reordered vehicle tokens and exact variant SKUs", async () => {
  const { buildShopCatalogProjectionVehicleQuerySql, buildShopCatalogProjectionWhere } =
    await queryModule;
  const query = buildShopCatalogProjectionVehicleQuerySql({
    locale: "en",
    text: "G90 BMW M5 S68",
    make: "BMW",
    model: "M5",
    generation: "G90",
    engine: "S68",
  });
  assert.ok(query);
  assert.equal(query.values.includes("%g90%"), true);
  assert.equal(query.values.includes("%bmw%"), true);
  assert.equal(query.values.includes("%m5%"), true);
  assert.equal(query.values.includes("%s68%"), true);
  assert.match(query.sql, /ShopCatalogProjectionSku/);
  assert.doesNotMatch(query.sql, /%G90 BMW M5 S68%/);

  const where = buildShopCatalogProjectionWhere({ locale: "en", text: "G90 BMW M5" });
  const serialized = JSON.stringify(where);
  assert.match(serialized, /"contains":"g90"/);
  assert.match(serialized, /"contains":"bmw"/);
  assert.match(serialized, /"contains":"m5"/);
  assert.doesNotMatch(serialized, /G90 BMW M5/);
});

test("vehicle SQL path stays disabled when no compatibility filter is selected", async () => {
  const { buildShopCatalogProjectionVehicleQuerySql } = await queryModule;
  assert.equal(
    buildShopCatalogProjectionVehicleQuerySql({ locale: "en", brand: "Eventuri" }),
    null
  );
});

test("vehicle storefront order interleaves brands by fresh canonical price", async () => {
  const { buildShopCatalogProjectionOrderedQuerySql } = await queryModule;
  const query = buildShopCatalogProjectionOrderedQuerySql({
    locale: "ua",
    productIds: ["p1", "p2"],
    minPrice: 1000,
    maxPrice: 5000,
    priceCurrency: "EUR",
    useEuropePrice: true,
    order: "brand_interleave",
    orderSeed: "BMW|M3",
    offset: 24,
  });
  assert.ok(query);
  assert.match(query.sql, /row_number\(\) OVER/);
  assert.match(query.sql, /PARTITION BY regexp_replace\(lower\(COALESCE/);
  assert.match(query.sql, /FROM "ShopProduct" brand_product/);
  assert.match(query.sql, /FROM "ShopProduct" canonical_product/);
  assert.match(query.sql, /canonical_product\."priceEurEurope"/);
  assert.match(query.sql, /OFFSET/);
  assert.equal(query.values.includes(1000), true);
  assert.equal(query.values.includes(5000), true);
  assert.equal(query.values.includes("BMW|M3"), true);
  assert.equal(query.values.includes(24), true);
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
  assert.equal(query.values.includes("bmw"), true);
  assert.equal(query.values.includes("m2"), true);
  assert.equal(query.values.includes("G87"), true);
  assert.equal(query.values.includes(2024), true);
  assert.equal(query.values.includes("S58"), true);
});

test("sparse vehicle selection filters product facets without unlocking later vehicle levels", async () => {
  const { buildShopCatalogProjectionFacetQuerySql } = await queryModule;
  const query = buildShopCatalogProjectionFacetQuerySql({
    locale: "en",
    engine: "S58",
    fuel: "petrol",
  });
  // Brand/category describe matching products; initial make counters remain
  // available so a sparse deep link can still be completed.
  assert.equal((query.sql.match(/UNION ALL/g) ?? []).length, 2);
  assert.equal(query.values.includes("S58"), true);
  assert.equal(query.values.includes("petrol"), true);
  assert.doesNotMatch(query.sql.split("UNION ALL").at(-1)!, /ShopCatalogProjectionConstraint/);
});

test("default vehicle and ordered reads both preserve price and product restrictions", async () => {
  const { buildShopCatalogProjectionVehicleQuerySql, buildShopCatalogProjectionOrderedQuerySql } =
    await queryModule;
  for (const build of [
    buildShopCatalogProjectionVehicleQuerySql,
    buildShopCatalogProjectionOrderedQuerySql,
  ]) {
    const sql = build({
      locale: "ua",
      make: "BMW",
      productIds: ["allowed"],
      excludeProductIds: ["excluded"],
      minPrice: 42,
      maxPrice: 500,
      order: "price_asc",
    });
    assert.ok(sql);
    for (const value of ["allowed", "excluded", 42, 500]) assert.ok(sql.values.includes(value));
    assert.match(sql.sql, /NOT IN/);
    assert.match(sql.sql, /projection\."isPublished" = true/);
  }
});

test("progressive facets unlock exactly one level at a time", async () => {
  const { buildShopCatalogProjectionFacetQuerySql } = await queryModule;
  const cases = [
    [{ locale: "ua" as const }, 3],
    [{ locale: "ua" as const, make: "BMW" }, 4],
    [{ locale: "ua" as const, make: "BMW", model: "M5" }, 8],
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
