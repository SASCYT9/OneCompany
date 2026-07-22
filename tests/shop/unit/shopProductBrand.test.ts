import assert from "node:assert/strict";
import test from "node:test";

import { resolveShopProductBrand } from "../../../src/lib/shopProductBrand";

test("Urban manufacturer wins over compatible vehicle make in product brand", () => {
  assert.equal(
    resolveShopProductBrand({ brand: "Audi", vendor: "Urban Automotive" }),
    "Urban Automotive"
  );
});

test("Urban manufacturer tag normalizes legacy rows", () => {
  assert.equal(
    resolveShopProductBrand({
      brand: "Range Rover",
      tags: ["urban-manufacturer:urban-automotive", "fits-make:range-rover"],
    }),
    "Urban Automotive"
  );
});

test("vehicle-like names remain untouched for non-Urban manufacturers", () => {
  assert.equal(resolveShopProductBrand({ brand: "Audi", vendor: "Audi" }), "Audi");
});
