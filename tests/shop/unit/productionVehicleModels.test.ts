import assert from "node:assert/strict";
import test from "node:test";
import fixture from "./production-vehicle-models.fixture.json";
import { canonicalizeVehicleModels, isSelectableVehicleModel, vehicleModelAliases, vehicleModelKey } from "../../../src/lib/shopVehicleTaxonomy";
import { shopVehicleModelsMatch } from "../../../src/lib/shopVehicleConstraints";

test("all 70 production make/scope lists remain deterministic and searchable", () => {
  assert.equal(fixture.length, 70);
  assert.equal(fixture.reduce((sum, row) => sum + row.models.length, 0), 1025);
  for (const { make, models } of fixture) {
    const canonical = canonicalizeVehicleModels(make, models);
    assert.deepEqual(canonicalizeVehicleModels(make, [...models].reverse()), canonical, make);
    assert.deepEqual(canonicalizeVehicleModels(make, canonical), canonical, `${make} is idempotent`);
    assert.equal(new Set(canonical.map(vehicleModelKey)).size, canonical.length);
    for (const raw of models.filter(model => isSelectableVehicleModel(make, model))) {
      const labels = canonicalizeVehicleModels(make, [raw]);
      assert.ok(labels.length, `${make} ${raw} has a selectable model`);
      for (const label of labels) {
        assert.ok(shopVehicleModelsMatch(raw, label, make), `${make} ${raw} matches ${label}`);
        assert.ok(vehicleModelAliases(make, label).some(alias => vehicleModelKey(alias) === vehicleModelKey(raw)), `${make} ${raw} stays queryable via ${label}`);
      }
    }
  }
});

test("supplier duplicates and generations collapse without merging body styles or performance models", () => {
  assert.deepEqual(canonicalizeVehicleModels("Ford", ["focus", "FOCUS III", "FOCUS IV", "FOCUS III Saloon"]), ["Focus", "Focus Saloon"]);
  assert.deepEqual(canonicalizeVehicleModels("Mercedes-Benz", ["G63 AMG", "G63", "AMG G 63", "G 500"]), ["AMG G 63", "G 500"]);
  assert.deepEqual(canonicalizeVehicleModels("Ducati", ["Panigale V4 Carbon", "Panigale V4 V4s", "Panigale V4 R"]), ["Panigale V4", "Panigale V4 R", "Panigale V4 S"]);
  assert.deepEqual(canonicalizeVehicleModels("Porsche", ["911 Turbo / Turbo S"]), ["911 Turbo", "911 Turbo S"]);
  assert.deepEqual(canonicalizeVehicleModels("Land Rover", ["range-rover", "range-rover-sport"]), ["Range Rover", "Range Rover Sport"]);
  assert.deepEqual(canonicalizeVehicleModels("Volkswagen", ["ID.3", "golf", "GOLF VIII", "Golf R"]), ["Golf", "Golf R", "ID.3"]);
});

test("wrong-make and incomplete imported labels are not offered as fitment choices", () => {
  for (const [make, raw] of [["Audi", "ATECA"], ["Audi", "ENYAQ iV Coupe"], ["Toyota", "BRZ"], ["Subaru", "GR86"], ["Scion", "BRZ"], ["Volkswagen", "Born"], ["SEAT", "GOLF VII Estate"], ["Mazda", "cx"], ["Mazda", "bt"], ["Honda", "fr"], ["Honda", "hr"], ["Hyundai", "h"], ["Toyota", "rav"], ["Saab", "9"]]) {
    assert.deepEqual(canonicalizeVehicleModels(make, [raw]), [], `${make} ${raw}`);
  }
  assert.deepEqual(canonicalizeVehicleModels("Subaru", ["BRZ"]), ["BRZ"]);
  assert.deepEqual(canonicalizeVehicleModels("Cupra", ["Born"]), ["Born"]);
});
