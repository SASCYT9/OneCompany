import assert from "node:assert/strict";
import test from "node:test";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import {
  extractProductFitment,
  vehicleChassisGenerationAlias,
  vehicleChassisSubcodesOf,
} from "../../../src/lib/crossShopFitment";

function product(title: string, brand = "Test"): ShopProduct {
  return {
    slug: "chassis-test-product",
    sku: "CHASSIS-1",
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
    tags: [],
  };
}

test("a Golf's generation written as a number or numeral becomes the Mk the picker offers", () => {
  const chassisOf = (title: string) => extractProductFitment(product(title)).chassisCodes;
  assert.ok(chassisOf("Axle Back Exhaust for VW Golf 6 1K Sport exhaust").includes("MK6"));
  assert.ok(chassisOf("Sport Exhaust for VW Golf 5 1K Racing").includes("MK5"));
  assert.ok(chassisOf("Exhaust VW Golf VII (5G1, BQ1, BE1, BE2, AU) R").includes("MK7"));
  assert.ok(chassisOf("Cat-Back System for VW Golf 7.5 GTI").includes("MK7.5"));
  assert.ok(chassisOf("Cat-Back System for VW Golf 8 R CD").includes("MK8"));
  assert.ok(chassisOf("Intake for VW Golf GTI Mk7 (MQB)").includes("MK7"));
  // A Polo's `6R` is not a Golf generation.
  assert.deepEqual(chassisOf("Cat-Back System for VW Polo 5 6R Resonated"), []);
});

test("Mercedes generations named in a title are recognised", () => {
  const chassisOf = (title: string) => extractProductFitment(product(title)).chassisCodes;
  assert.ok(chassisOf("Mercedes CLS (C257) CLS 450").includes("C257"));
  assert.ok(chassisOf("Mercedes C-Class Coupe (C204) C63").includes("C204"));
  assert.ok(chassisOf("Mercedes AMG GT Roadster (R190)").includes("R190"));
  assert.ok(chassisOf("Mercedes CLA Shooting Brake (X117) CLA 250").includes("X117"));
  assert.ok(chassisOf("Mercedes V-Class W447 V250").includes("W447"));
});

test("importer type codes of a Golf are its generation, only for Volkswagen", () => {
  assert.equal(vehicleChassisGenerationAlias("Volkswagen", "BQ1"), "MK7");
  assert.equal(vehicleChassisGenerationAlias("VW", "cd1"), "MK8");
  assert.equal(vehicleChassisGenerationAlias("Audi", "BQ1"), null);
  assert.equal(vehicleChassisGenerationAlias("Volkswagen", "AW1"), null);
  assert.ok(vehicleChassisSubcodesOf("Volkswagen", "MK7").includes("5G1"));
  assert.deepEqual(vehicleChassisSubcodesOf("Audi", "MK7"), []);
});
