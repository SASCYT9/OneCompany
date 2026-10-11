import assert from "node:assert/strict";
import test from "node:test";
import {
  affectsRacechipGroups,
  buildRacechipSiblingRevalidationPaths,
  buildShopStorefrontRevalidationPlan,
} from "../../../src/lib/shopStorefrontRevalidationPlan";

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

const racechip = (slug: string, make: string, model: string, extra: string[] = []) => ({
  slug,
  brand: "RaceChip",
  tags: [`car_make:${make}`, `car_model:${model}`, ...extra],
});

const catalog = [
  racechip("rc-a4-177hp", "Audi", "A4"),
  racechip("rc-a4-190hp", "Audi", "A4"),
  racechip("rc-a4-150hp", "Audi", "A4"),
  racechip("rc-a6-204hp", "Audi", "A6"),
  { slug: "ohlins-a4", brand: "Ohlins", tags: ["car_make:Audi", "car_model:A4"] },
];

test("a RaceChip mutation revalidates every other PDP of its model group", () => {
  const paths = buildRacechipSiblingRevalidationPaths(
    [racechip("rc-a4-177hp", "Audi", "A4")],
    catalog
  );

  assert.deepEqual(
    [...paths].sort(),
    [
      "/en/shop/racechip/products/rc-a4-150hp",
      "/en/shop/racechip/products/rc-a4-177hp",
      "/en/shop/racechip/products/rc-a4-190hp",
      "/en/shop/rc-a4-150hp",
      "/en/shop/rc-a4-177hp",
      "/en/shop/rc-a4-190hp",
      "/ua/shop/racechip/products/rc-a4-150hp",
      "/ua/shop/racechip/products/rc-a4-177hp",
      "/ua/shop/racechip/products/rc-a4-190hp",
      "/ua/shop/rc-a4-150hp",
      "/ua/shop/rc-a4-177hp",
      "/ua/shop/rc-a4-190hp",
    ].sort()
  );
  // Other models and other brands are untouched.
  assert.ok(paths.every((path) => !path.includes("rc-a6") && !path.includes("ohlins")));
});

test("paths already in the revalidation plan are not issued twice", () => {
  const mutated = racechip("rc-a4-177hp", "Audi", "A4");
  const plan = buildShopStorefrontRevalidationPlan([mutated]);
  const planned = new Set(plan.paths.map(({ path }) => path));
  const paths = buildRacechipSiblingRevalidationPaths([mutated], catalog, planned);

  assert.ok(paths.length > 0);
  assert.ok(paths.every((path) => !planned.has(path)));
  assert.ok(!paths.includes("/ua/shop/racechip/products/rc-a4-177hp"));
  assert.ok(paths.includes("/ua/shop/racechip/products/rc-a4-190hp"));
});

test("the group a product moved away from is revalidated through its previous tags", () => {
  const previous = racechip("rc-a4-177hp", "Audi", "A4");
  const moved = racechip("rc-a4-177hp", "Audi", "A6");
  const paths = buildRacechipSiblingRevalidationPaths([moved, previous], catalog);

  assert.ok(paths.includes("/ua/shop/racechip/products/rc-a6-204hp"));
  assert.ok(paths.includes("/ua/shop/racechip/products/rc-a4-190hp"));
});

test("non-RaceChip or ungroupable products never trigger sibling revalidation", () => {
  assert.equal(affectsRacechipGroups([{ slug: "part", brand: "Ohlins" }]), false);
  assert.equal(
    affectsRacechipGroups([{ slug: "rc-x", brand: "RaceChip", tags: ["car_make:Audi"] }]),
    false
  );
  assert.deepEqual(
    buildRacechipSiblingRevalidationPaths([{ slug: "part", brand: "Ohlins" }], catalog),
    []
  );
  assert.equal(affectsRacechipGroups([racechip("rc-a4-177hp", "Audi", "A4")]), true);
});
