import assert from "node:assert/strict";
import test from "node:test";

import {
  SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES,
  extractCategoryAttributes,
  extractCategoryAttributesFromText,
} from "../../../src/lib/shopKnowledgeV2/attributes";
import { knowledgeSourceProduct } from "./shopKnowledgeV2TestFixture";

function values(attributes: ReturnType<typeof extractCategoryAttributesFromText>["attributes"]) {
  return Object.fromEntries(attributes.map((attribute) => [attribute.key, attribute.value]));
}

test("extracts strict exhaust kind, material, valves and explicit Non-OPF", () => {
  const extraction = extractCategoryAttributesFromText(
    "exhaust-1",
    "Titanium valved downpipe for BMW M3 F80 without OPF / GPF. Race use only.",
    "exhaust"
  );
  const result = values(extraction.attributes);

  assert.equal(result.productKind, "downpipe");
  assert.equal(result.material, "titanium");
  assert.equal(result.valves, "valved");
  assert.equal(result.opfGpf, "without");
  assert.equal(result.homologation, "race_only");
  assert.ok(extraction.evidence.every((item) => item.contentHash.length === 64));
});

test("extracts RaceChip family, fuel, engine and explicit gains", () => {
  const extraction = extractCategoryAttributesFromText(
    "chip-1",
    "RaceChip GTS 5 piggyback for BMW S58 petrol. Stock power 510 HP, stock torque 650 Nm. Gain +120 HP and +150 Nm.",
    "chipTuning"
  );
  const result = values(extraction.attributes);

  assert.equal(result.productKind, "tuning_box");
  assert.equal(result.tuningFamily, "piggyback");
  assert.equal(result.fuel, "petrol");
  assert.equal(result.engine, "S58");
  assert.equal(result.stockPowerHp, 510);
  assert.equal(result.stockTorqueNm, 650);
  assert.equal(result.powerGainHp, 120);
  assert.equal(result.torqueGainNm, 150);
});

test("hard-attribute contracts include every compatibility-critical category fact", () => {
  assert.deepEqual(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.exhaust, [
    "productKind",
    "engine",
    "market",
    "opfGpf",
    "material",
    "valves",
    "homologation",
  ]);
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.chipTuning.includes("stockPowerHp"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.chipTuning.includes("stockTorqueNm"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.brakes.includes("diameterMm"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.brakes.includes("setPosition"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.suspension.includes("loweringMaxMm"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.cooling.includes("transmission"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.performance.includes("dimensionsMm"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.carbonAero.includes("packageDependency"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.interior.includes("facelift"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.wheels.includes("loadKg"));
  assert.ok(SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES.motoCarbon.includes("roadUse"));
});

test("extracts deterministic brake, suspension and cooling hard facts", () => {
  const brakes = values(
    extractCategoryAttributesFromText(
      "brakes-1",
      "Front carbon-ceramic brake rotor 410 mm, left and right pair.",
      "brakes"
    ).attributes
  );
  assert.equal(brakes.productKind, "rotor");
  assert.equal(brakes.axle, "front");
  assert.equal(brakes.brakeSystem, "ccb");
  assert.equal(brakes.diameterMm, 410);
  assert.equal(brakes.setPosition, "pair");

  const suspension = values(
    extractCategoryAttributesFromText(
      "suspension-1",
      "Front coilover kit for EDC with lowering 20-40 mm.",
      "suspension"
    ).attributes
  );
  assert.equal(suspension.productKind, "coilover_kit");
  assert.equal(suspension.axle, "front");
  assert.equal(suspension.edcCompatibility, "required");
  assert.equal(suspension.loweringMinMm, 20);
  assert.equal(suspension.loweringMaxMm, 40);

  const cooling = values(
    extractCategoryAttributesFromText(
      "cooling-1",
      "Automatic transmission engine coolant radiator, dimensions 620x410x42 mm.",
      "cooling"
    ).attributes
  );
  assert.equal(cooling.productKind, "radiator");
  assert.equal(cooling.transmission, "automatic");
  assert.equal(cooling.circuit, "engine_coolant");
  assert.equal(cooling.dimensionsMm, "620x410x42");
});

test("extracts body package, moto usage and complete wheel safety facts", () => {
  const carbon = values(
    extractCategoryAttributesFromText(
      "carbon-1",
      "Gloss carbon front splitter for F80 LCI sedan, only with M Sport package.",
      "carbonAero"
    ).attributes
  );
  assert.equal(carbon.productKind, "splitter");
  assert.equal(carbon.position, "front");
  assert.equal(carbon.bodyStyle, "sedan");
  assert.equal(carbon.facelift, "facelift");
  assert.equal(carbon.finish, "gloss");
  assert.equal(carbon.packageDependency, "m_sport");

  const moto = values(
    extractCategoryAttributesFromText(
      "moto-1",
      "Gloss carbon front fairing for road use.",
      "motoCarbon"
    ).attributes
  );
  assert.equal(moto.productKind, "moto_panel");
  assert.equal(moto.position, "front");
  assert.equal(moto.finish, "gloss");
  assert.equal(moto.roadUse, "road");

  const wheels = values(
    extractCategoryAttributesFromText(
      "wheel-safe",
      'Set of 4 front forged wheels 5x120, 20", 9.5Jx20, ET 25, center bore 66.6 mm, load 850 kg',
      "wheels"
    ).attributes
  );
  assert.equal(wheels.productKind, "wheel_set");
  assert.equal(wheels.setPosition, "set_of_4");
  assert.equal(wheels.axle, "front");
  assert.equal(wheels.loadKg, 850);
});

test("keeps variant-only OPF facts out of product-level attributes", () => {
  const extraction = extractCategoryAttributes(knowledgeSourceProduct());
  const result = values(extraction.attributes);

  assert.equal(extraction.categoryGroup, "exhaust");
  assert.equal(result.productKind, "system");
  assert.equal(result.material, "titanium");
  assert.equal(result.opfGpf, undefined);
});

test("extracts wheel dimensions as separate deterministic attributes", () => {
  const extraction = extractCategoryAttributesFromText(
    "wheel-1",
    'Forged wheel 5x120, 20", 9.5Jx20, ET 25, center bore 66.6 mm, load 850 kg',
    "wheels"
  );
  const result = values(extraction.attributes);

  assert.equal(result.pcd, "5x120");
  assert.equal(result.diameterIn, 20);
  assert.equal(result.widthIn, 9.5);
  assert.equal(result.offsetEt, 25);
  assert.equal(result.centerBoreMm, 66.6);
  assert.equal(result.loadKg, 850);
});
