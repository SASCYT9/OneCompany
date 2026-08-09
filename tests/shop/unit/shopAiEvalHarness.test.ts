import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { ShopAiAssistantResponse } from "../../../src/lib/shopAiAssistantTypes";
import { redactShopAiText } from "../../../src/lib/shopAiPrivacy";
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../../../src/lib/shopAiV2FeatureFlags";
import {
  evaluateShopAiReleaseGate,
  evaluateShopAiResponse,
  SHOP_AI_RELEASE_GATE_MIN_CASES,
  SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY,
  SHOP_AI_RELEASE_GATE_MIN_HARD_NEGATIVE_CASES,
  SHOP_AI_RELEASE_GATE_MIN_EXACT_SKU_CASES,
  type ShopAiEvalCase,
  validateShopAiEvalCases,
  validateShopAiReleaseGateConfig,
} from "../../../scripts/shop-ai-eval-harness";

function evalCase(
  id: string,
  category = "exhaust",
  language: "ua" | "en" | "ru" | "mixed" | "translit" = "ua"
): ShopAiEvalCase {
  return {
    id,
    locale: language === "en" ? "en" : "ua",
    message: `Reviewed query ${id}`,
    metadata: { language },
    expect: { category },
  };
}

function reviewedReleaseCase(
  id: string,
  category = "exhaust",
  language: "ua" | "en" | "ru" | "mixed" | "translit" = "ua"
): ShopAiEvalCase {
  const testCase = evalCase(id, category, language);
  return {
    ...testCase,
    metadata: {
      ...testCase.metadata!,
      reviewer: "one-ai-catalog-reviewer",
      reviewedAt: "2026-07-17T08:00:00Z",
      reviewEvidenceId: `ONEAI-EVAL:${id}`,
      hardNegative: { dimensions: ["semantic"] },
    },
    expect: {
      ...testCase.expect,
      mode: "results",
      needsClarification: false,
      expectedProductIds: [`product-${id}`],
    },
  };
}

function responseWithProducts(
  testCase: ShopAiEvalCase,
  products: Array<{ id: string; variantId: string | null }>
) {
  return {
    message: "Reviewed result",
    mode: testCase.expect.mode ?? "results",
    products: products.map((product) => ({
      ...product,
      name: product.id,
      brand: "Test",
      partNumber: product.id,
      description: "",
      thumbnail: null,
      inStock: true,
      price: null,
      slug: product.id,
      turn14Id: "",
    })),
    totalItems: products.length,
    plan: {
      intent: "find",
      vehicle: { type: "car" },
      category: testCase.expect.category ?? null,
      budget: { max: null, currency: null },
      powerGainHp: null,
      needsClarification: false,
      clarification: null,
    },
    followUps: [],
    searchHref: null,
    managerHref: `/${testCase.locale}/contact?source=one-ai`,
    managerContext: { request: testCase.message },
    degraded: false,
  } as unknown as ShopAiAssistantResponse;
}

test("default golden fixture remains valid and explicitly labels language metadata", () => {
  const fixturePath = path.join(process.cwd(), "tests", "shop", "evals", "stock-ai-cases.json");
  const validated = validateShopAiEvalCases(
    JSON.parse(fs.readFileSync(fixturePath, "utf8")) as unknown
  );
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.value.length, 8);
  assert.equal(
    validated.value.every((item) => Boolean(item.metadata?.language)),
    true
  );

  const releaseReport = evaluateShopAiReleaseGate(validated.value, {
    enabledCategories: ["exhaust"],
  });
  assert.equal(releaseReport.passed, false);
  assert.equal(releaseReport.unreviewedCases, 8);
  assert.equal(releaseReport.invalidExpectationContractCases, 8);
  assert.match(releaseReport.errors.join("\n"), /human-review metadata/);
  assert.match(releaseReport.errors.join("\n"), /expected-result contracts/);
});

test("fixture validation supports reviewed product, variant and hard-negative metadata", () => {
  const validated = validateShopAiEvalCases([
    {
      id: "reviewed-fitment",
      locale: "ua",
      message: "Вихлоп на BMW M3 F80",
      metadata: {
        language: "ua",
        reviewer: "one-ai-catalog-reviewer",
        reviewedAt: "2026-07-17T08:00:00Z",
        reviewEvidenceId: "ONEAI-EVAL:reviewed-fitment",
        tags: ["fitment"],
        hardNegative: {
          dimensions: ["chassis", "variant"],
          note: "Reject the G80 and OPF variant.",
        },
      },
      expect: {
        mode: "results",
        needsClarification: false,
        category: "exhaust",
        expectedProductIds: ["product-f80"],
        forbiddenProductIds: ["product-g80"],
        expectedVariantIds: ["variant-non-opf"],
        forbiddenVariantIds: ["variant-opf"],
      },
    },
  ]);
  assert.equal(validated.ok, true);
});

test("fixture validation rejects ambiguous ID contracts and invalid metadata", () => {
  const validated = validateShopAiEvalCases([
    {
      id: "invalid-case",
      locale: "ua",
      message: "query",
      metadata: {
        language: "de",
        reviewer: "one-ai-catalog-reviewer",
        reviewedAt: "2026-02-30T08:00:00Z",
        hardNegative: { dimensions: ["colour"] },
      },
      expect: {
        expectedProductIds: ["same-id"],
        forbiddenProductIds: ["same-id"],
      },
    },
  ]);
  assert.equal(validated.ok, false);
  if (validated.ok) return;
  assert.match(validated.errors.join("\n"), /metadata\.language/);
  assert.match(validated.errors.join("\n"), /metadata\.reviewedAt/);
  assert.match(validated.errors.join("\n"), /metadata\.reviewEvidenceId/);
  assert.match(validated.errors.join("\n"), /hardNegative\.dimensions/);
  assert.match(validated.errors.join("\n"), /both expected and forbidden/);
});

test("response evaluation requires every expected product and variant and rejects forbidden IDs", () => {
  const testCase: ShopAiEvalCase = {
    ...evalCase("identity-contract"),
    expect: {
      expectedProductIds: ["product-required", "product-missing"],
      forbiddenProductIds: ["product-forbidden"],
      expectedVariantIds: ["variant-required", "variant-missing"],
      forbiddenVariantIds: ["variant-forbidden"],
    },
  };
  const errors = evaluateShopAiResponse(
    testCase,
    responseWithProducts(testCase, [
      { id: "product-required", variantId: "variant-required" },
      { id: "product-forbidden", variantId: "variant-forbidden" },
    ])
  );
  assert.deepEqual(errors, [
    "missing expected product IDs: product-missing",
    "returned forbidden product IDs: product-forbidden",
    "missing expected variant IDs: variant-missing",
    "returned forbidden variant IDs: variant-forbidden",
  ]);
});

test("response identity assertions pass for a reviewed exact result set", () => {
  const testCase: ShopAiEvalCase = {
    ...evalCase("identity-pass"),
    expect: {
      expectedProductIds: ["product-required"],
      forbiddenProductIds: ["product-wrong"],
      expectedVariantIds: ["variant-required"],
      forbiddenVariantIds: ["variant-wrong"],
    },
  };
  const errors = evaluateShopAiResponse(
    testCase,
    responseWithProducts(testCase, [{ id: "product-required", variantId: "variant-required" }])
  );
  assert.deepEqual(errors, []);
});

test("response evaluation accepts the privacy-redacted manager handoff request", () => {
  const testCase: ShopAiEvalCase = {
    ...evalCase("redacted-manager-context"),
    message: "OHLINS kit for 2001-2007, phone +380501234567",
  };
  const response = responseWithProducts(testCase, []);
  response.managerContext = {
    request: redactShopAiText(testCase.message, 800).text,
  } as ShopAiAssistantResponse["managerContext"];

  assert.deepEqual(evaluateShopAiResponse(testCase, response), []);
});

test("response evaluation rejects unsafe tiering and ungrounded product claims", () => {
  const testCase: ShopAiEvalCase = {
    ...evalCase("unsafe-response"),
    expect: { category: "exhaust", mode: "results", needsClarification: false },
  };
  const response = responseWithProducts(testCase, [
    { id: "reviewable-product", variantId: null },
    { id: "exact-product", variantId: null },
  ]);
  response.message = "The recommended SKU is INVENTED-SKU-999.";
  response.counts = { exact: 2, requiresVerification: 0 };
  response.products[0] = {
    ...response.products[0],
    matchStatus: "requires_verification",
    compatibility: "confirmed",
    missingFacts: ["engine"],
  };
  response.products[1] = {
    ...response.products[1],
    matchStatus: "exact",
    matchBasis: "fitment",
    compatibility: "confirmed",
    missingFacts: ["year"],
  };

  const errors = evaluateShopAiResponse(testCase, response);
  assert.match(errors.join("\n"), /ungrounded/);
  assert.match(errors.join("\n"), /ordered before/);
  assert.match(errors.join("\n"), /missing fitment facts/);
  assert.match(errors.join("\n"), /claims confirmed compatibility/);
  assert.match(errors.join("\n"), /counts\.exact/);
});

test("exact-SKU eval requires one identity match without a fitment claim", () => {
  const testCase: ShopAiEvalCase = {
    ...evalCase("exact-sku-response"),
    metadata: { language: "en", tags: ["exact-sku"] },
    expect: {
      category: "exhaust",
      mode: "results",
      needsClarification: false,
      expectedProductIds: ["sku-product"],
    },
  };
  const response = responseWithProducts(testCase, [{ id: "sku-product", variantId: null }]);
  response.message = "Exact SKU sku-product identified; vehicle fitment has not been evaluated.";
  response.products[0] = {
    ...response.products[0],
    matchStatus: "exact",
    matchBasis: "identity",
    compatibility: undefined,
    missingFacts: [],
  };

  assert.deepEqual(evaluateShopAiResponse(testCase, response), []);
});

test("release gate passes only when the real corpus meets total and per-category floors", () => {
  const categories = ["exhaust", "brakes"];
  const cases = Array.from({ length: SHOP_AI_RELEASE_GATE_MIN_CASES }, (_, index) =>
    reviewedReleaseCase(
      `case-${index}`,
      categories[index % categories.length],
      (["ua", "en", "ru", "mixed", "translit"] as const)[index % 5]
    )
  );
  cases[0] = {
    ...cases[0],
    metadata: { ...cases[0].metadata!, tags: ["exact-sku"] },
  };
  const report = evaluateShopAiReleaseGate(cases, { enabledCategories: categories });
  assert.equal(report.passed, true);
  assert.equal(report.totalCases, SHOP_AI_RELEASE_GATE_MIN_CASES);
  assert.equal(
    report.countsByCategory.exhaust >= SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY,
    true
  );
  assert.equal(report.countsByCategory.brakes >= SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY, true);
  assert.deepEqual(report.countsByLanguage, {
    ua: 100,
    en: 100,
    ru: 100,
    mixed: 100,
    translit: 100,
  });
  assert.equal(report.hardNegativeCases >= SHOP_AI_RELEASE_GATE_MIN_HARD_NEGATIVE_CASES, true);
  assert.equal(report.exactSkuCases >= SHOP_AI_RELEASE_GATE_MIN_EXACT_SKU_CASES, true);
});

test("release gate reports corpus, category and language-metadata deficits without padding", () => {
  const cases = [
    ...Array.from({ length: 470 }, (_, index) => reviewedReleaseCase(`exhaust-${index}`)),
    ...Array.from({ length: 29 }, (_, index) => reviewedReleaseCase(`brakes-${index}`, "brakes")),
  ];
  cases[0] = { ...cases[0], metadata: undefined };
  const report = evaluateShopAiReleaseGate(cases, {
    enabledCategories: ["exhaust", "brakes"],
  });
  assert.equal(report.passed, false);
  assert.equal(report.totalCases, 499);
  assert.equal(report.countsByCategory.brakes, 29);
  assert.equal(report.unlabeledLanguageCases, 1);
  assert.match(report.errors.join("\n"), /at least 500/);
  assert.match(report.errors.join("\n"), /category brakes has 29/);
  assert.match(report.errors.join("\n"), /missing metadata\.language/);
});

test("release gate requires human review and explicit answer contracts", () => {
  const cases = Array.from({ length: SHOP_AI_RELEASE_GATE_MIN_CASES }, (_, index) =>
    reviewedReleaseCase(
      `case-${index}`,
      "exhaust",
      (["ua", "en", "ru", "mixed", "translit"] as const)[index % 5]
    )
  );
  cases[2] = {
    ...cases[2],
    metadata: { ...cases[2].metadata!, tags: ["exact-sku"] },
  };
  cases[0] = {
    ...cases[0],
    metadata: {
      language: "ua",
      reviewer: "one-ai-catalog-reviewer",
      reviewedAt: "2026-07-17T08:00:00Z",
    },
  };
  cases[1] = {
    ...cases[1],
    expect: {
      category: "exhaust",
      mode: "results",
      needsClarification: false,
    },
  };
  cases[2] = {
    ...cases[2],
    expect: {
      category: "exhaust",
      mode: "clarification",
      needsClarification: false,
    },
  };

  const report = evaluateShopAiReleaseGate(cases, { enabledCategories: ["exhaust"] });
  assert.equal(report.passed, false);
  assert.equal(report.unreviewedCases, 1);
  assert.equal(report.invalidExpectationContractCases, 2);
  assert.match(report.errors.join("\n"), /metadata\.reviewEvidenceId/);
  assert.match(report.errors.join("\n"), /require expectedProductIds/);
  assert.match(report.errors.join("\n"), /clarification cases require needsClarification=true/);
});

test("release gate accepts explicit no-match and clarification contracts", () => {
  const cases = Array.from({ length: SHOP_AI_RELEASE_GATE_MIN_CASES }, (_, index) =>
    reviewedReleaseCase(
      `case-${index}`,
      "exhaust",
      (["ua", "en", "ru", "mixed", "translit"] as const)[index % 5]
    )
  );
  cases[0] = {
    ...cases[0],
    expect: {
      category: "exhaust",
      mode: "no_match",
      needsClarification: false,
    },
  };
  cases[1] = {
    ...cases[1],
    expect: {
      category: "exhaust",
      mode: "clarification",
      needsClarification: true,
    },
  };
  cases[2] = {
    ...cases[2],
    metadata: { ...cases[2].metadata!, tags: ["exact-sku"] },
  };

  const report = evaluateShopAiReleaseGate(cases, { enabledCategories: ["exhaust"] });
  assert.equal(report.passed, true);
  assert.equal(report.unreviewedCases, 0);
  assert.equal(report.invalidExpectationContractCases, 0);
});

test("response evaluation enforces explicit no-match mode and empty result set", () => {
  const testCase: ShopAiEvalCase = {
    ...evalCase("no-match-response"),
    expect: {
      category: "exhaust",
      mode: "no_match",
      needsClarification: false,
    },
  };
  const response = responseWithProducts(testCase, [
    { id: "unexpected-product", variantId: "unexpected-variant" },
  ]);
  response.mode = "results";

  const errors = evaluateShopAiResponse(testCase, response);
  assert.match(errors.join("\n"), /mode: expected no_match, received results/);
  assert.match(errors.join("\n"), /no_match expected no products, received 1/);
  assert.match(errors.join("\n"), /no_match expected totalItems=0, received 1/);
});

test("release category manifest matches the V2 rollout categories and excludes other", () => {
  const fixturePath = path.join(
    process.cwd(),
    "tests",
    "shop",
    "evals",
    "stock-ai-release-gate.json"
  );
  const manifest = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    enabledCategories: string[];
  };
  assert.equal(manifest.enabledCategories.includes("other"), false);
  assert.deepEqual(manifest.enabledCategories, [...SHOP_AI_V2_ROLLOUT_CATEGORIES]);
});

test("release config rejects Other and unknown categories instead of widening runtime rollout", () => {
  const validated = validateShopAiReleaseGateConfig({
    enabledCategories: ["exhaust", "other", "unknown"],
  });
  assert.equal(validated.ok, false);
  if (validated.ok) return;
  assert.match(validated.errors.join("\n"), /outside the V2 rollout contract: other, unknown/);
});

test("release gate rejects duplicate normalized queries instead of counting padded copies", () => {
  const first = reviewedReleaseCase("first", "exhaust", "ua");
  const duplicate = {
    ...reviewedReleaseCase("duplicate", "exhaust", "ua"),
    message: `  ${first.message.toUpperCase()}  `,
  };
  const report = evaluateShopAiReleaseGate([first, duplicate], {
    enabledCategories: ["exhaust"],
  });
  assert.equal(report.duplicateQueryCases, 1);
  assert.match(report.errors.join("\n"), /duplicate an already counted normalized query/);
});
