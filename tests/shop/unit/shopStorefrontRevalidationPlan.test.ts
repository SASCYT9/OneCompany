import assert from "node:assert/strict";
import test from "node:test";
import { buildShopStorefrontRevalidationPlan } from "../../../src/lib/shopStorefrontRevalidationPlan";

test("batch keeps each UA/EN product alias and deduplicates shared listings/tags", () => {
  const products = Array.from({ length: 100 }, (_, index) => ({
    slug: `part-${index}`,
    brand: "Ohlins",
  }));
  const batch = buildShopStorefrontRevalidationPlan(products);
  const individual = products.map((product) => buildShopStorefrontRevalidationPlan([product]));
  assert.deepEqual(
    new Set(batch.paths.map((path) => JSON.stringify(path))),
    new Set(individual.flatMap((plan) => plan.paths.map((path) => JSON.stringify(path))))
  );
  assert.deepEqual(new Set(batch.tags), new Set(individual.flatMap((plan) => plan.tags)));
  assert.ok(
    batch.paths.some(
      ({ path, type }) => path === "/ua/shop/ohlins/catalog/page/[page]" && type === "page"
    )
  );
  assert.ok(batch.paths.some(({ path }) => path === "/en/shop/ohlins/products/part-99"));
  assert.equal(batch.tags.length, 2);
  assert.ok(batch.paths.length < individual.reduce((sum, plan) => sum + plan.paths.length, 0));
});

test("price-only batches do not invalidate listings or global tags", () => {
  const plan = buildShopStorefrontRevalidationPlan([{ slug: "part", brand: "Ohlins" }], true);
  assert.deepEqual(plan.tags, []);
  assert.deepEqual(
    plan.paths.map(({ path }) => path),
    [
      "/ua/shop/ohlins/products/part",
      "/ua/shop/part",
      "/en/shop/ohlins/products/part",
      "/en/shop/part",
    ]
  );
});

test("empty batches do nothing and generic products do not create phantom brand listings", () => {
  assert.deepEqual(buildShopStorefrontRevalidationPlan([]), { paths: [], tags: [] });
  const plan = buildShopStorefrontRevalidationPlan([{ slug: "part", brand: "Custom" }]);
  assert.equal(plan.paths.length, 2);
  assert.deepEqual(plan.tags, ["shop-products"]);
});
