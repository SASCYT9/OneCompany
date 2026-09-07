import assert from "node:assert/strict";
import test from "node:test";

import { parseShopStockUrlState } from "../../../src/lib/shopStockUrlState";

test("catalog URL parsing is canonical and bounded for hydration", () => {
  const state = parseShopStockUrlState(
    new URLSearchParams(
      "view=list&page=3&q= BMW%20M5 &brand=KW,BMW&brand=bmw&stock=inStock&sort=price_desc&category= suspension &productType=" +
        "x".repeat(140) +
        "&year=2025&engine= S58 &fuel=petrol&opfGpf=with&productKind=coilover_kit&strict=1&minPrice=10&maxPrice=20&currency=eur&scope=moto&make=BMW&model=M5&chassis=G90"
    ),
    2026
  );

  assert.deepEqual(state, {
    view: "list",
    page: 3,
    query: " BMW M5 ",
    brands: ["KW"],
    stock: "inStock",
    sort: "price_desc",
    category: "suspension",
    productType: "x".repeat(120),
    year: 2025,
    engine: "S58",
    fuel: "petrol",
    opfGpf: "with",
    productKind: "coilover_kit",
    strict: true,
    minPrice: "10",
    maxPrice: "20",
    currency: "EUR",
    vehicleMode: "moto",
    make: "BMW",
    model: "M5",
    chassis: "G90",
  });
});

test("invalid URL values fail closed to defaults", () => {
  const state = parseShopStockUrlState(
    new URLSearchParams("page=-4&stock=bad&sort=bad&view=bad&year=2028&opfGpf=bad&currency=gbp"),
    2025
  );

  assert.equal(state.page, 1);
  assert.equal(state.stock, "all");
  assert.equal(state.sort, "default");
  assert.equal(state.view, "grid");
  assert.equal(state.year, null);
  assert.equal(state.opfGpf, null);
  assert.equal(state.currency, null);
  assert.equal(state.vehicleMode, "auto");
});
