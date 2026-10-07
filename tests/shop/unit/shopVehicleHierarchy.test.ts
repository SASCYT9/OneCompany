import assert from "node:assert/strict";
import test from "node:test";

import {
  vehicleChassisKey,
  vehicleChassisMatchLevel,
  vehicleChassisSelfAndAncestors,
  vehicleModelFamilyBase,
  vehicleModelScope,
} from "../../../src/lib/shopVehicleHierarchy";

test("chassis keys ignore case, spaces and dashes", () => {
  assert.equal(vehicleChassisKey("W 463A"), vehicleChassisKey("w-463a"));
  assert.equal(vehicleChassisKey("992.1"), "992.1");
});

test("chassis lineage separates facelifts without mixing siblings", () => {
  assert.equal(vehicleChassisMatchLevel("992.1", "992.1"), "exact");
  assert.equal(vehicleChassisMatchLevel("992.1", "992"), "descendant");
  assert.equal(vehicleChassisMatchLevel("992", "992.1"), "ancestor");
  assert.equal(vehicleChassisMatchLevel("992.2", "992.1"), null);
  assert.equal(vehicleChassisMatchLevel("991", "992"), null);
  assert.equal(vehicleChassisMatchLevel("G20 LCI", "G20"), "descendant");
  assert.equal(vehicleChassisMatchLevel("G20", "G20 LCI"), "ancestor");
  assert.equal(vehicleChassisMatchLevel("MK7.5", "MK7"), "descendant");
  assert.equal(vehicleChassisMatchLevel("W 463A", "W463A"), "exact");
  assert.equal(vehicleChassisMatchLevel("", "992"), null);
});

test("picker options expose the parent generation of a facelift", () => {
  assert.deepEqual(vehicleChassisSelfAndAncestors("992.1"), ["992.1", "992"]);
  assert.deepEqual(vehicleChassisSelfAndAncestors("G80"), ["G80"]);
});

test("a base model includes its trims, a trim includes its sub-trims", () => {
  const base = vehicleModelScope("Porsche", "911");
  for (const trim of ["911", "911 Carrera", "911 GT3 RS", "911 Turbo S", "911 Targa"]) {
    assert.ok(base.exact.includes(trim), trim);
  }
  const carrera = vehicleModelScope("Porsche", "911 Carrera");
  assert.ok(carrera.exact.includes("911 Carrera S"));
  assert.ok(carrera.exact.includes("911 Carrera GTS"));
  assert.ok(!carrera.exact.includes("911 GT3"));
  assert.ok(!carrera.exact.includes("911"));
  assert.ok(carrera.broad.includes("911"));
});

test("distinct models are not folded into their namesake", () => {
  const rangeRover = vehicleModelScope("Land Rover", "Range Rover").exact;
  assert.ok(rangeRover.includes("Range Rover IV"));
  assert.ok(!rangeRover.includes("Range Rover Evoque"));
  assert.ok(!rangeRover.includes("Range Rover Sport"));
  assert.ok(!vehicleModelScope("BMW", "X5").exact.includes("X5 M"));
  assert.deepEqual(vehicleModelScope("Toyota", "Supra").exact, ["Supra"]);
});

test("Mercedes AMG trims belong to their class", () => {
  assert.ok(vehicleModelScope("Mercedes-Benz", "G-Class").exact.includes("AMG G 63"));
  assert.equal(vehicleModelFamilyBase("Porsche", "911 GT3 RS"), "911");
  assert.equal(vehicleModelFamilyBase("Porsche", "Taycan"), null);
});
