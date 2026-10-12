import assert from "node:assert/strict";
import test from "node:test";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { extractProductFitment } from "../../../src/lib/crossShopFitment";
import { shopFitmentMatchesVehicleConstraints } from "../../../src/lib/shopVehicleConstraints";

function product(title: string, brand = "Test", tags: string[] = []): ShopProduct {
  return {
    slug: "platform-product",
    sku: "PLATFORM-1",
    scope: "auto",
    brand,
    title: { ua: title, en: title },
    category: { ua: "", en: "" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    highlights: [],
    tags,
  };
}

test("a BMW platform label (G8X) is filed on every chassis of that platform", () => {
  const fitment = extractProductFitment(product("Комплект решіток для BMW M3 / M4 G8X"));
  assert.equal(fitment.make, "BMW");
  for (const chassis of ["G80", "G81", "G82", "G83", "G87"]) {
    assert.ok(fitment.chassisCodes.includes(chassis), chassis);
  }
  assert.ok(
    shopFitmentMatchesVehicleConstraints(fitment, { make: "BMW", model: "M3", chassis: "G80" })
  );
});

test("a platform label with no model still reaches the models of that platform", () => {
  const fitment = extractProductFitment(product("Фільтр для S58 G8x Intake для BMW"));
  assert.equal(fitment.make, "BMW");
  assert.deepEqual([...fitment.models].sort(), ["M2", "M3", "M4"]);
  assert.ok(
    shopFitmentMatchesVehicleConstraints(fitment, { make: "BMW", model: "M4", chassis: "G82" })
  );
});

test("G2x covers the 3 and 4 Series generations, not the Z4", () => {
  const fitment = extractProductFitment(product("Fi EXHAUST Valvetronic для BMW 430i G2x"));
  assert.equal(fitment.make, "BMW");
  for (const chassis of ["G20", "G21", "G22", "G23", "G26"]) {
    assert.ok(fitment.chassisCodes.includes(chassis), chassis);
  }
  assert.ok(!fitment.chassisCodes.includes("G29"));
});

test("a platform label means nothing for another make", () => {
  const fitment = extractProductFitment(product("Exhaust for Audi A4 G2X"));
  assert.equal(fitment.make, "Audi");
  assert.ok(!fitment.chassisCodes.some((code) => /^G2\d$/.test(code)));
});
