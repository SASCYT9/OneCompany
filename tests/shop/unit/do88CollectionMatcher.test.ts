import assert from "node:assert/strict";
import test from "node:test";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { getProductsForDo88Collection, isDo88CatalogProduct } from "../../../src/lib/do88CollectionMatcher";

function product(title: string, eur: number, brand = "DO88") {
  return {
    brand, slug: title.toLowerCase().replace(/\W/g, "-"), title: { ua: title, en: title },
    collection: { ua: "", en: "" }, collections: [], tags: ["DO88"],
    price: { eur, usd: 0, uah: 0 }, variants: [],
  } as unknown as ShopProduct;
}

test("complete do88 assortment keeps affordable parts and every supported vehicle make", () => {
  const rows = [product("do88 SAI air filter", 27.3), product("Volvo 740 coolant hose", 85),
    product("Saab 9000 intercooler", 300), product("Audi RS4 B5 pipe", 95),
    product("Mazda MX-5 NC radiator", 450), product("CUPRA Formentor VZ5 intercooler", 700)];
  assert.equal(getProductsForDo88Collection(rows, "all").length, rows.length);
  assert.equal(rows.every(isDo88CatalogProduct), true);
});

test("retailer DO88 tags never admit another manufacturer to the do88 collection", () => {
  const bmc = product("BMC Air Filter", 250, "BMC");
  assert.equal(isDo88CatalogProduct(bmc), false);
  assert.deepEqual(getProductsForDo88Collection([bmc], "all"), []);
});
