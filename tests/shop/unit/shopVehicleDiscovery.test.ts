import test from "node:test";
import assert from "node:assert/strict";
import { extractProductFitment } from "../../../src/lib/crossShopFitment";
import { vehicleModelAliases, canonicalVehicleModelLabel } from "../../../src/lib/shopVehicleTaxonomy";
import { shopVehicleModelsMatch } from "../../../src/lib/shopVehicleConstraints";
import type { ShopProduct } from "../../../src/lib/shopCatalog";

test("Defender family discovers supported bodies without treating 90 and 110 as the same model", () => {
  assert.ok(shopVehicleModelsMatch("Defender 90", "Defender", "Land Rover"));
  assert.ok(shopVehicleModelsMatch("Defender 110", "Defender", "Land Rover"));
  assert.equal(shopVehicleModelsMatch("Defender 110", "Defender 90", "Land Rover"), false);
  assert.equal(canonicalVehicleModelLabel("Land Rover", "Defender 110"), "Defender 110");
});

test("compact BMW title is a candidate for spaced X5 M model searches", () => {
  assert.ok(vehicleModelAliases("BMW", "X5 M").includes("X5M"));
  assert.equal(shopVehicleModelsMatch("X5 M", "X5M", "BMW"), true);
});

test("Urban title supplies explicit Defender bodies despite an obsolete generated model tag", () => {
  const product = { brand: "Urban Automotive", vendor: "Urban Automotive", sku: "URB-DEC-26009343-V1", slug: "urb-dec-26009343-v1", title: { en: "Urban Decal and Lettering Pack for Defender 90/110", ua: "Декалі Urban для Defender 90/110" }, tags: ["fits-make:land-rover", "fits-model:land-rover:urban-decal-and"], collection: { en: "", ua: "" } } as ShopProduct;
  const fitment = extractProductFitment(product);
  assert.equal(fitment.make, "Land Rover");
  assert.ok(fitment.models.includes("Defender 90"));
  assert.ok(fitment.models.includes("Defender 110"));
  assert.ok(!fitment.models.includes("Defender 130"));
});
