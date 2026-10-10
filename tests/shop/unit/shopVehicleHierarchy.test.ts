import assert from "node:assert/strict";
import test from "node:test";

import {
  vehicleChassisKeyVariants,
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

test("BMW M3 and M5 include their Touring", () => {
  assert.ok(vehicleModelScope("BMW", "M5").exact.includes("M5 Touring"));
  assert.ok(vehicleModelScope("BMW", "M3").exact.includes("M3 Touring"));
});

test("BMW M2 F87N is the F87 chassis", () => {
  assert.equal(vehicleChassisMatchLevel("F87N", "F87"), "exact");
  assert.deepEqual(vehicleChassisKeyVariants("F87"), ["f87", "f87n"]);
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

test("MPV, van and crossover spin-offs are not members of their namesake", () => {
  const separate: [string, string, string][] = [
    ["Toyota", "Corolla", "Corolla Verso II"],
    ["Toyota", "Land Cruiser", "Land Cruiser 150"],
    ["Toyota", "Land Cruiser", "Land Cruiser FJ"],
    ["Toyota", "Verso", "Verso-S"],
    ["Nissan", "Almera", "Almera Tino"],
    ["Nissan", "Bluebird", "Bluebird Sylphy"],
    ["Dodge", "Ram 1500", "Ram 1500 Van"],
    ["Ford", "Bronco", "Bronco II"],
    ["Ford", "Taurus", "Taurus X"],
    ["Ford", "Tourneo", "Tourneo Custom 2012"],
    ["Volkswagen", "Golf", "Golf Plus"],
    ["Volkswagen", "Golf", "Golf Sportsvan"],
    ["Volkswagen", "Teramont", "Teramont X"],
  ];
  for (const [make, model, other] of separate) {
    assert.ok(!vehicleModelScope(make, model).exact.includes(other), `${model} ⊅ ${other}`);
  }
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

test("a base model never absorbs a model that has its own family", () => {
  const rangeRover = vehicleModelScope("Land Rover", "Range Rover").exact;
  assert.ok(rangeRover.includes("Range Rover IV"));
  assert.ok(!rangeRover.some((model) => model.startsWith("Range Rover Sport")));
  assert.ok(!vehicleModelScope("Toyota", "Land Cruiser").exact.includes("Land Cruiser Prado 250"));
  const transit = vehicleModelScope("Ford", "Transit").exact;
  assert.ok(!transit.some((model) => /connect|custom|courier/i.test(model)));
  assert.deepEqual(vehicleModelScope("Ford", "Ka+").exact, ["Ka+"]);
});
