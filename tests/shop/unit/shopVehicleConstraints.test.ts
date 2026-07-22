import assert from "node:assert/strict";
import test from "node:test";

import {
  shopFitmentMatchesVehicleConstraints,
  shopVehicleChassisMatches,
  shopVehicleMakesMatch,
  shopVehicleYearAllows,
} from "../../../src/lib/shopVehicleConstraints";

test("Mercedes-Benz and Mercedes-AMG share the same vehicle make family", () => {
  assert.equal(shopVehicleMakesMatch("Mercedes-Benz", "Mercedes-AMG"), true);
  assert.equal(shopVehicleMakesMatch("BMW", "Mercedes-AMG"), false);
});

test("selected chassis does not accept platform siblings or generic generations", () => {
  assert.equal(shopVehicleChassisMatches("MK7", "MK7"), true);
  assert.equal(shopVehicleChassisMatches("MK8", "MK7"), false);
  assert.equal(shopVehicleChassisMatches("8V", "8Y"), false);
  assert.equal(shopVehicleChassisMatches("991", "991.2"), false);
  assert.equal(shopVehicleChassisMatches("991.1", "991.2"), false);
});

test("known year conflicts are rejected while missing evidence remains reviewable", () => {
  assert.equal(shopVehicleYearAllows({ yearRanges: [{ from: 2014, to: 2017 }] }, 2019), false);
  assert.equal(shopVehicleYearAllows({ yearRanges: [{ from: 2014, to: 2020 }] }, 2019), true);
  assert.equal(shopVehicleYearAllows({ yearRanges: [] }, 2019), true);
});

test("all requested vehicle fields must match one fitment record", () => {
  assert.equal(
    shopFitmentMatchesVehicleConstraints(
      {
        make: "Porsche",
        models: ["911 Turbo"],
        chassisCodes: ["991.1"],
        yearRanges: [{ from: 2013, to: 2015 }],
        confidence: "high",
      },
      { make: "Porsche", model: "911 Turbo", chassis: "991.2", year: 2018 }
    ),
    false
  );
});
