import assert from "node:assert/strict";
import test from "node:test";

import { matchesDo88VehicleFilter, resolveCompatibleVehiclesForDo88Product } from "../../../src/app/[locale]/shop/do88/do88FitmentData";

const saiCategory = "A3 S3 TT, 2.0 TFSI EA888 (8V 8S)";
const saiTitle = "do88 VAG EA888 SAI Air Filter Kit";

test("duplicate vehicle entries retain both SAI and original platform parts", () => {
  const vehicle = { make: "VW", model: "Golf GTI / R", chassis: "Mk8" };
  assert.equal(matchesDo88VehicleFilter("Vehicle Specific > Audi > " + saiCategory, saiTitle, vehicle), true);
  assert.equal(matchesDo88VehicleFilter("Vehicle Specific > CUPRA", "VAG 2.0 TSI EA888 Gen4 Big Pack", vehicle), true);
  assert.equal(matchesDo88VehicleFilter("Vehicle Specific > CUPRA", "Formentor VZ5 intercooler", vehicle), false);
});

test("make-only discovery includes gated shared parts and unknown filters fail closed", () => {
  const category = "Vehicle Specific > Audi > " + saiCategory;
  assert.equal(matchesDo88VehicleFilter(category, saiTitle, { make: "VW" }), true);
  assert.equal(matchesDo88VehicleFilter(category, "Unrelated coolant hose", { make: "VW", model: "Passat" }), false);
  assert.equal(matchesDo88VehicleFilter(category, saiTitle, { make: "VW", model: "Passat", chassis: "B8 (3G) · 2015+" }), true);
  assert.equal(matchesDo88VehicleFilter(category, saiTitle, { make: "__proto__" }), false);
  assert.equal(matchesDo88VehicleFilter(category, saiTitle, { make: "VW", model: "unknown" }), false);
});

test("LF-190 SAI fitment includes the official EA888 Gen 3 and Gen 4 applications", () => {
  const vehicles = resolveCompatibleVehiclesForDo88Product(saiCategory, saiTitle);
  const pairs = new Set(vehicles.map((vehicle) => vehicle.make + "|" + vehicle.model + "|" + vehicle.chassis));

  assert.ok(pairs.size >= 18, "expected at least 18 distinct supplier applications; got " + pairs.size);
  assert.ok(pairs.has("VW|Passat|B8 (3G) · 2015+"));
  assert.ok(pairs.has("VW|Tiguan II|2021+"));
  assert.ok(pairs.has("Audi|SQ2|2018+"));
  assert.ok(pairs.has("Audi|TT|8S · 2014+"));
  assert.ok(pairs.has("CUPRA|Formentor|5FF · 2020+ · 2.0 TSI EA888 Gen4"));
  assert.ok(pairs.has("CUPRA|Leon|Mk4 · 2020+ · 2.0 TSI EA888 Gen4"));
  assert.ok(pairs.has("Skoda|Superb|Mk3 (B8 / 3V) · 2015+"));
});

test("SAI-only cross-make fitment stays gated from unrelated EA888 products", () => {
  const vehicles = resolveCompatibleVehiclesForDo88Product(saiCategory, "VAG EA888 coolant hose kit");

  assert.equal(vehicles.some((vehicle) => vehicle.model === "Passat"), false);
  assert.equal(vehicles.some((vehicle) => vehicle.model === "Tiguan II"), false);
  assert.equal(vehicles.some((vehicle) => vehicle.model === "Formentor"), false);
});

test("Audi Gen3 category never advertises Gen4 8Y fitment", () => {
  const vehicles = resolveCompatibleVehiclesForDo88Product(saiCategory, "VAG 1.8 2.0 TSI MQB Turbo inlet pipe");
  assert.ok(vehicles.some((vehicle) => vehicle.make === "Audi" && vehicle.model === "A3 / S3" && vehicle.chassis === "8V"));
  assert.equal(vehicles.some((vehicle) => vehicle.make === "Audi" && vehicle.chassis.includes("8Y")), false);
});
