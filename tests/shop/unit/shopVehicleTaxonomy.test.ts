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
  vehicleModelAliases,
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

test("BMW trim-shaped legacy models collapse to their selectable model", () => {
  assert.deepEqual(
    canonicalizeVehicleModels("BMW", ["1 Series M", "M340i/M340d", "M550i", "I4", "Z Series", "Z4"]),
    ["1 Series M Coupé", "3 Series", "5 Series", "i4", "Z4"]
  );
  assert.ok(vehicleModelAliases("BMW", "3 Series").includes("M340i/M340d"));
  assert.ok(vehicleModelAliases("BMW", "Z4").includes("Z Series"));
});

test("Land Rover product-title fragments collapse to real models", () => {
  assert.deepEqual(
    canonicalizeVehicleModels("Land Rover", [
      "Defender Oem Black",
      "Urban Leather Defender",
      "Discovery 5 5",
      "Sport Linear",
    ]),
    ["Defender", "Discovery 5", "Range Rover Sport"]
  );
});

test("combined Volvo supplier fitments expand into real selectable models", () => {
  assert.deepEqual(
    canonicalizeVehicleModels("Volvo", ["C30 C70 S40 V50 P1"]),
    ["C30", "C70", "S40", "V50"]
  );
  assert.ok(vehicleModelAliases("Volvo", "V50").includes("C30 C70 S40 V50 P1"));
});

test("supplier style and engine fragments collapse into their real model", () => {
  assert.deepEqual(
    canonicalizeVehicleModels("Volkswagen", ["Polo 2 0 Tsi Ea888", "Transporter T6 1 Urban"]),
    ["Polo", "Transporter"]
  );
  assert.deepEqual(canonicalizeVehicleModels("Lamborghini", ["Urus Urus", "Urus Se Urban"]), [
    "Urus",
    "Urus SE",
  ]);
  assert.deepEqual(canonicalizeVehicleModels("Mercedes-Benz", ["GLA", "GLA-Class", "Eqc Gloss"]), [
    "EQC",
    "GLA-Class",
  ]);
  assert.deepEqual(canonicalizeVehicleModels("Volvo", ["740 940", "960 S90 V90"]), [
    "740",
    "940",
    "960",
    "S90",
    "V90",
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

test("BMW chassis options stay inside the selected official model", () => {
  assert.deepEqual(
    canonicalizeVehicleChassisCodes(["E30", "E85", "E86", "E89", "F90", "G29"], "BMW", "Z4"),
    ["E85", "E86", "E89", "G29"]
  );
  assert.deepEqual(
    canonicalizeVehicleChassisCodes(["F87N", "F90", "G87", "G90"], "BMW", "M2"),
    ["F87", "G87"]
  );
});
