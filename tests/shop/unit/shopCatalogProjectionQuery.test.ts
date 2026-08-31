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

test("vehicle filters stay correlated inside one verified clause", async () => {
  const { buildShopCatalogProjectionWhere } = await queryModule;
  const where = buildShopCatalogProjectionWhere({
    locale: "ua",
    brand: "Eventuri",
    make: "BMW",
    model: "M2",
    generation: "F87",
    year: 2019,
    engine: "N55",
    fuel: "petrol",
  });
  const serialized = JSON.stringify(where);
  assert.match(serialized, /catalogProjectionPolicies/);
  assert.match(serialized, /\"verification\":\"VERIFIED\"/);
  assert.match(serialized, /\"dimension\":\"MAKE\"/);
  assert.match(serialized, /\"dimension\":\"ENGINE\"/);
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
