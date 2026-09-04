import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalVehicleMakeLabel,
  canonicalVehicleModelLabel,
  canonicalizeVehicleMakes,
  canonicalizeVehicleChassisCodes,
  canonicalizeVehicleModels,
  splitVehicleChassisCodes,
  vehicleModelKey,
} from "../../../src/lib/shopVehicleTaxonomy";

test("vehicle make aliases collapse without losing their legacy query values", () => {
  assert.equal(canonicalVehicleMakeLabel("Range Rover"), "Land Rover");
  assert.equal(canonicalVehicleMakeLabel("land-rover"), "Land Rover");
  assert.equal(canonicalVehicleMakeLabel("vw"), "Volkswagen");
  assert.deepEqual(
    canonicalizeVehicleMakes(["Land Rover", "Range Rover", "land-rover", "BMW", "bmw"]),
    ["BMW", "Land Rover"]
  );
});

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

test("compound supplier chassis values become exact selectable codes", () => {
  assert.deepEqual(splitVehicleChassisCodes("g90-g99"), ["G90", "G99"]);
  assert.deepEqual(splitVehicleChassisCodes("F90 / G90, G99"), ["F90", "G90", "G99"]);
  assert.deepEqual(canonicalizeVehicleChassisCodes(["g90-g99", "G90", "F90"]), [
    "F90",
    "G90",
    "G99",
  ]);
  assert.deepEqual(splitVehicleChassisCodes("8V Facelift"), ["8V FACELIFT"]);
});
