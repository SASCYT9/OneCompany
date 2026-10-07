import assert from "node:assert/strict";
import test from "node:test";
import fixture from "./production-vehicle-models-2026-10.fixture.json";
import {
  canonicalizeVehicleMakes,
  canonicalizeVehicleModels,
  canonicalVehicleMakeLabel,
  isSelectableVehicleModel,
  vehicleMakeAliases,
  vehicleModelAliases,
  vehicleModelKey,
} from "../../../src/lib/shopVehicleTaxonomy";

// Public auto selector on 2026-10-07: 135 make lists, 2,664 model labels.
const modelsByMake = new Map<string, string[]>();
for (const { make, models } of fixture) {
  const canonical = canonicalVehicleMakeLabel(make);
  modelsByMake.set(canonical, [...(modelsByMake.get(canonical) ?? []), ...models]);
}
const selectorModels = (make: string) =>
  canonicalizeVehicleModels(make, modelsByMake.get(make) ?? []);

test("the 2026-10 selector lists stay deterministic and every raw label stays queryable", () => {
  assert.equal(fixture.length, 135);
  assert.equal(
    fixture.reduce((sum, row) => sum + row.models.length, 0),
    2664
  );
  for (const [make, models] of modelsByMake) {
    const canonical = canonicalizeVehicleModels(make, models);
    assert.deepEqual(canonicalizeVehicleModels(make, [...models].reverse()), canonical, make);
    assert.deepEqual(
      canonicalizeVehicleModels(make, canonical),
      canonical,
      `${make} is idempotent`
    );
    for (const raw of models.filter((model) => isSelectableVehicleModel(make, model))) {
      const labels = canonicalizeVehicleModels(make, [raw]);
      assert.ok(labels.length, `${make} ${raw} has a selectable model`);
      for (const label of labels) {
        assert.ok(
          vehicleModelAliases(make, label).some(
            (alias) => vehicleModelKey(alias) === vehicleModelKey(raw)
          ),
          `${make} ${raw} stays queryable via ${label}`
        );
      }
    }
  }
});

test("no selector label is a market qualifier, product title, chassis list or make prefix", () => {
  for (const [make, models] of modelsByMake) {
    const makeWord = make.toLowerCase().split(/[\s(]/)[0]!;
    for (const label of canonicalizeVehicleModels(make, models)) {
      assert.doesNotMatch(label, /\[|\]/, `${make} ${label} carries a market qualifier`);
      assert.doesNotMatch(
        label,
        /\b(?:19|20)\d{2}\b.*\b\w+\b.*\b\w+\b/,
        `${make} ${label} looks like a title`
      );
      assert.doesNotMatch(
        label,
        /\b[EFG]\d{2}\b.*\b[EFG]\d{2}\b/,
        `${make} ${label} is a chassis list`
      );
      // DS model names carry the make (`DS 3`).
      if (make !== "DS") {
        assert.ok(
          !label.toLowerCase().startsWith(`${makeWord} `),
          `${make} ${label} repeats the make`
        );
      }
    }
  }
});

test("BMW offers series and M models instead of supplier fragments", () => {
  assert.deepEqual(selectorModels("BMW"), [
    "1 Series",
    "2 Series",
    "2 Series Active Tourer",
    "2 Series Gran Tourer",
    "3 Series",
    "4 Series",
    "5 Series",
    "6 Gran Turismo",
    "6 Series",
    "7 Series",
    "8 Series",
    "2500",
    "i4",
    "i8",
    "M2",
    "M3",
    "M4",
    "M5",
    "M6",
    "M8",
    "X1",
    "X2",
    "X3",
    "X3 M",
    "X4",
    "X4 M",
    "X5",
    "X5 M",
    "X6",
    "X6 M",
    "X7",
    "XM",
    "Z1",
    "Z3",
    "Z4",
    "Z8",
  ]);
  assert.deepEqual(
    canonicalizeVehicleModels("BMW", ["2025 Bmw G99 M5 Wagon Revozport Dry Carbon Spoiler"]),
    ["M5"]
  );
  assert.deepEqual(canonicalizeVehicleModels("BMW", ["G80 G81 M3 G82 G83 M4"]), ["M3", "M4"]);
  assert.deepEqual(canonicalizeVehicleModels("BMW", ["X5M X6M F95 F96 LCI"]), ["X5 M", "X6 M"]);
  assert.ok(
    vehicleModelAliases("BMW", "M3").some((alias) => vehicleModelKey(alias) === "g80g81m3")
  );
  assert.ok(vehicleModelAliases("BMW", "3 Series").some((alias) => vehicleModelKey(alias) === "3"));
});

test("duplicate makes collapse and keep matching their raw spellings", () => {
  const makes = canonicalizeVehicleMakes(fixture.map((row) => row.make));
  for (const duplicate of [
    "Mercedes",
    "Skoda",
    "ŠKoda",
    "Cupra",
    "Ds Automobiles",
    "Volkswagen (Svw)",
    "Lada (Shiguli)",
    "Audi (Saic)",
  ]) {
    assert.ok(!makes.includes(duplicate), duplicate);
  }
  for (const make of [
    "Mercedes-Benz",
    "Škoda",
    "CUPRA",
    "DS",
    "Volkswagen",
    "Lada",
    "Audi",
    "MG",
    "SsangYong",
  ]) {
    assert.ok(makes.includes(make), make);
  }
  assert.ok(vehicleMakeAliases("Mercedes-Benz").includes("mercedes"));
  assert.ok(vehicleMakeAliases("Volkswagen").includes("volkswagen (svw)"));
  assert.ok(vehicleMakeAliases("Škoda").includes("skoda"));
  assert.ok(selectorModels("Mercedes-Benz").includes("S-Class"));
  assert.ok(!selectorModels("Mercedes-Benz").includes("Class S"));
  assert.deepEqual(selectorModels("MINI"), [
    "Clubman",
    "Cooper",
    "Cooper S",
    "Countryman",
    "JCW GP",
  ]);
});

test("models assigned to the wrong make are not offered", () => {
  for (const model of ["Golf", "Golf GTI", "Golf R"]) {
    assert.ok(!selectorModels("Audi").includes(model), `Audi ${model}`);
    // Their MQB products stay reachable through the Audi models of that platform.
    assert.deepEqual(canonicalizeVehicleModels("Audi", [model]), ["A3", "S3"]);
  }
  for (const model of ["A3", "S3"]) {
    assert.ok(!selectorModels("Volkswagen").includes(model), `Volkswagen ${model}`);
  }
});
