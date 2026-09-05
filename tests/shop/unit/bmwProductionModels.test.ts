import assert from "node:assert/strict";
import test from "node:test";
import fixture from "./bmw-production-models.fixture.json";
import { canonicalizeVehicleModels, vehicleModelAliases, vehicleModelKey } from "../../../src/lib/shopVehicleTaxonomy";
import { shopVehicleModelsMatch } from "../../../src/lib/shopVehicleConstraints";

test("production BMW model list has no supplier fragments or duplicate trims", () => {
  const expected = [
    "1 Series", "2 Convertible", "2 Coupe", "2 Gran Coupe", "2 Series",
    "2 Series Active Tourer", "2 Series Gran Tourer", "3 Gran Turismo", "3 Series", "3 Touring",
    "4 Convertible", "4 Coupe", "4 Gran Coupe", "4 Series", "5 Series", "5 Touring",
    "6 Convertible", "6 Gran Coupe", "6 Gran Turismo", "6 Series", "7 Series",
    "8 Convertible", "8 Coupe", "8 Gran Coupe", "8 Series", "i3", "i4", "i8",
    "M2", "M3", "M3 Touring", "M4", "M5", "M5 Touring", "M6", "M8",
    "X1", "X2", "X3", "X3 M", "X4", "X4 M", "X5", "X5 M", "X6", "X6 M", "X7", "XM", "Z4",
  ];
  assert.deepEqual(canonicalizeVehicleModels("BMW", fixture.data), expected);
  for (const raw of fixture.data) {
    for (const model of canonicalizeVehicleModels("BMW", [raw])) {
      assert.ok(shopVehicleModelsMatch(raw, model, "BMW"), `${raw} remains searchable via ${model}`);
      assert.ok(vehicleModelAliases("BMW", model).some(alias => vehicleModelKey(alias) === vehicleModelKey(raw)), `${raw} remains in the fitment query for ${model}`);
    }
  }
});

test("combined BMW aliases remain reachable from both models without merging M with standard models", () => {
  assert.deepEqual(canonicalizeVehicleModels("BMW", ["X5M LCI / X6M LCI"]), ["X5 M", "X6 M"]);
  assert.deepEqual(canonicalizeVehicleModels("BMW", ["2-series-active-gran-tourer"]), ["2 Series Active Tourer", "2 Series Gran Tourer"]);
  for (const [raw, wrongModel] of [["x5-m", "X5"], ["X4 M40i", "X4 M"], ["M2 Competition", "2 Series"], ["M3 Touring", "M3"]]) {
    assert.equal(shopVehicleModelsMatch(raw, wrongModel, "BMW"), false);
  }
});
