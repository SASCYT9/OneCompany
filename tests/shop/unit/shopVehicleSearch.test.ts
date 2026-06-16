import test from "node:test";
import assert from "node:assert/strict";

import {
  expandVehicleAliases,
  parseVehicleSearchQuery,
  scoreVehicleSearchItem,
} from "../../../src/lib/shopVehicleSearch";

test("G8X expands to BMW M cars and G8x chassis aliases", () => {
  const expanded = expandVehicleAliases("G8X");

  assert.equal(expanded.intent, "vehicle");
  assert.deepEqual(expanded.makes, ["BMW"]);
  assert.deepEqual(expanded.models, ["M2", "M3", "M4"]);
  assert.deepEqual(expanded.chassis, ["G80", "G81", "G82", "G83", "G87"]);
  assert.deepEqual(expanded.platforms, ["G8X"]);
});

test("Mercedes G-Wagon aliases map to G-Class and W463/W465 platforms", () => {
  for (const query of ["g wagon", "g-class", "g63"]) {
    const expanded = expandVehicleAliases(query);

    assert.equal(expanded.intent, "vehicle");
    assert.equal(expanded.makes.includes("Mercedes-Benz"), true);
    assert.equal(expanded.models.includes("G-Class"), true);
    assert.equal(expanded.chassis.includes("W463A"), true);
    assert.equal(expanded.chassis.includes("W465"), true);
  }
});

test("RSQ8 and RS Q8 normalize to the same Audi intent", () => {
  const compact = expandVehicleAliases("rsq8");
  const spaced = expandVehicleAliases("rs q8");

  assert.deepEqual(compact.makes, spaced.makes);
  assert.deepEqual(compact.models, spaced.models);
  assert.deepEqual(compact.chassis, spaced.chassis);
  assert.equal(compact.models.includes("RS Q8"), true);
});

test("structured part numbers are classified as SKU intent", () => {
  assert.equal(parseVehicleSearchQuery("S-PO/T/8"), "sku");
  assert.equal(expandVehicleAliases("S-PO/T/8").intent, "sku");
});

test("vehicle scoring ranks model and chassis matches above make-only matches", () => {
  const query = expandVehicleAliases("M3 G80");
  const exact = scoreVehicleSearchItem(
    {
      searchText: "bmw m3 g80 g81 akrapovic exhaust",
      titleText: "akrapovic exhaust for bmw m3 g80 g81",
      skuText: "s bm ti 33h",
      compactSkuText: "sbmti33h",
      fitmentText: "bmw m3 g80 g81",
    },
    query
  );
  const broad = scoreVehicleSearchItem(
    {
      searchText: "bmw universal wheel spacer",
      titleText: "bmw universal wheel spacer",
      skuText: "bmw spacer",
      compactSkuText: "bmwspacer",
      fitmentText: "bmw",
    },
    query
  );

  assert.equal(exact.score > broad.score, true);
  assert.equal(
    exact.reasons.some((reason) => reason.includes("model+chassis")),
    true
  );
});
