import assert from "node:assert/strict";
import test from "node:test";

import type { ShopAiContext, ShopAiPlan } from "../../../src/lib/shopAiAssistantTypes";
import {
  buildShopAiStrictCanonicalConstraints,
  classifyShopAiStrictCanonicalRow,
  type ShopAiStrictCanonicalRow,
} from "../../../src/lib/shopAiStrictCanonical";

const context: ShopAiContext = {
  locale: "en",
  currency: "EUR",
  scope: "auto",
};

const plan: ShopAiPlan = {
  intent: "recommend",
  vehicle: {
    type: "car",
    make: "BMW",
    model: "M3",
    chassis: "F80",
    year: 2018,
    engine: "S55",
  },
  category: "exhaust",
  searchQuery: "BMW M3 F80 exhaust",
  minPrice: null,
  maxPrice: null,
  opfGpf: "with",
  productKind: "system",
  needsClarification: false,
  clarification: null,
};

function row(overrides: Partial<ShopAiStrictCanonicalRow> = {}): ShopAiStrictCanonicalRow {
  return {
    productId: "product-1",
    categoryGroup: "exhaust",
    productKind: "system",
    qualityFlags: [],
    knowledgeMakes: ["BMW"],
    knowledgeModels: ["M3"],
    knowledgeChassisCodes: ["F80"],
    knowledgeYearRanges: [{ from: 2014, to: 2020 }],
    knowledgeEngines: ["S55"],
    knowledgeOpfGpf: "with",
    applicationId: null,
    applicationVariantId: null,
    applicationMake: null,
    applicationModel: null,
    applicationChassis: null,
    applicationYearFrom: null,
    applicationYearTo: null,
    applicationEngine: null,
    applicationOpfGpf: null,
    applicationUniversal: null,
    applicationVerificationStatus: null,
    applicationSource: null,
    hasApplications: false,
    ...overrides,
  };
}

test("assistant strict constraints preserve canonical hard filters", () => {
  const constraints = buildShopAiStrictCanonicalConstraints(plan, context);

  assert.equal(constraints.category, "exhaust");
  assert.equal(constraints.productKind, "system");
  assert.equal(constraints.scope, "auto");
  assert.equal(constraints.chassis, "F80");
  assert.equal(constraints.engine, "S55");
  assert.equal(constraints.opfGpf, "with");
  assert.equal(constraints.hasKnowledgeConstraints, true);
});

test("assistant strict canonical gate rejects a product-level OPF contradiction", () => {
  const result = classifyShopAiStrictCanonicalRow(
    row({ knowledgeOpfGpf: "without" }),
    plan,
    context
  );

  assert.equal(result, null);
});

test("assistant strict canonical gate keeps unknown fitment reviewable without a conflict", () => {
  const result = classifyShopAiStrictCanonicalRow(
    row({
      knowledgeMakes: [],
      knowledgeModels: [],
      knowledgeChassisCodes: [],
      knowledgeYearRanges: [],
      knowledgeEngines: [],
      knowledgeOpfGpf: null,
    }),
    plan,
    context
  );

  assert.equal(result?.matchStatus, "requires_verification");
  assert.ok(result?.missingFacts.includes("fitment"));
});

test("assistant strict canonical gate rejects a known engine conflict before hydration", () => {
  const result = classifyShopAiStrictCanonicalRow(
    row({
      knowledgeEngines: ["B58"],
      knowledgeOpfGpf: null,
    }),
    { ...plan, opfGpf: null },
    context
  );

  assert.equal(result, null);
});
