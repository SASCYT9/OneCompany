import assert from "node:assert/strict";
import test from "node:test";

import { buildFallbackShopAiPlan } from "../../../src/lib/shopAiAssistantPlanner";
import { resolveShopAiVehiclePlan } from "../../../src/lib/shopAiVehicleResolver";

const context = { locale: "ua" as const, currency: "EUR" as const, scope: "auto" as const };

test("catalog evidence resolves M3 2018 to F80 before asking the exhaust question", () => {
  const initial = buildFallbackShopAiPlan("вихлоп на m3 2018", context);
  const resolved = resolveShopAiVehiclePlan(initial, context, [
    {
      titleText: "bmw m3 f80 exhaust",
      fitment: {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["F80"],
        yearRanges: [{ from: 2014, to: 2020 }],
      },
    },
    {
      titleText: "bmw m3 g80 exhaust",
      fitment: {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["G80"],
        yearRanges: [{ from: 2021, to: null }],
      },
    },
  ]);

  assert.equal(resolved.vehicle.make, "BMW");
  assert.equal(resolved.vehicle.model, "M3");
  assert.equal(resolved.vehicle.year, 2018);
  assert.equal(resolved.vehicle.chassis, "F80");
  assert.equal(resolved.vehicleResolution?.reason, "catalog-year-resolution");
  assert.equal(resolved.needsClarification, true);
  assert.deepEqual(resolved.requiredDetails, ["opfGpf"]);
  assert.match(resolved.clarification ?? "", /BMW M3 F80, 2018/);
});

test("multiple catalog generations remain ambiguous instead of being guessed", () => {
  const initial = buildFallbackShopAiPlan("вихлоп на BMW M3", context);
  const resolved = resolveShopAiVehiclePlan(initial, context, [
    {
      titleText: "bmw m3 f80 exhaust",
      fitment: {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["F80"],
        yearRanges: [],
      },
    },
    {
      titleText: "bmw m3 g80 exhaust",
      fitment: {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["G80"],
        yearRanges: [],
      },
    },
  ]);

  assert.equal(resolved.vehicle.chassis, null);
  assert.equal(resolved.vehicleResolution?.status, "ambiguous");
  assert.ok(resolved.requiredDetails?.includes("yearOrChassis"));
  assert.match(resolved.clarification ?? "", /рік або код кузова/i);
});
