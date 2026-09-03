import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalVehicleModelLabel,
  canonicalizeVehicleModels,
  vehicleModelKey,
} from "../../../src/lib/shopVehicleTaxonomy";

test("vehicle model aliases share one stable identity", () => {
  assert.equal(vehicleModelKey("RS Q8"), vehicleModelKey("RSQ8"));
  assert.equal(vehicleModelKey("3 Series"), vehicleModelKey("3-series"));
});

test("BMW model aliases collapse to canonical labels", () => {
  assert.deepEqual(canonicalizeVehicleModels("BMW", ["3-series", "3 Series", "Xm", "XM"]), [
    "3 Series",
    "XM",
  ]);
});

test("Audi performance models use canonical spacing", () => {
  assert.equal(canonicalVehicleModelLabel("Audi", "RS Q8"), "RSQ8");
  assert.equal(canonicalVehicleModelLabel("Audi", "RS 3"), "RS3");
  assert.equal(canonicalVehicleModelLabel("Audi", "TT RS"), "TTRS");
});

test("catalog-wide punctuation and casing aliases keep official labels", () => {
  assert.deepEqual(canonicalizeVehicleModels("Mercedes-Benz", ["A Class", "A-Class"]), ["A-Class"]);
  assert.deepEqual(canonicalizeVehicleModels("Honda", ["Civic Type R", "Civic Typer"]), [
    "Civic Type R",
  ]);
  assert.deepEqual(canonicalizeVehicleModels("Nissan", ["Gt-R", "gt-r"]), ["GT-R"]);
  assert.deepEqual(canonicalizeVehicleModels("Toyota", ["GR YARIS", "GR Yaris"]), ["GR Yaris"]);
});

test("Shopify Mercedes casing aliases have one deterministic label", () => {
  assert.deepEqual(
    canonicalizeVehicleModels("Mercedes-Benz", ["C-CLASS T-MODEL", "C-CLASS T-Model"]),
    ["C-Class T-Model"]
  );
});
