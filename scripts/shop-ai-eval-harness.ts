import type { ShopAiAssistantResponse, ShopAiResponseMode } from "../src/lib/shopAiAssistantTypes";
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../src/lib/shopAiV2FeatureFlags";

export const SHOP_AI_RELEASE_GATE_MIN_CASES = 500;
export const SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY = 30;

export const SHOP_AI_EVAL_LANGUAGES = ["ua", "en", "ru", "mixed", "translit"] as const;
export const SHOP_AI_EVAL_RESPONSE_MODES = ["results", "clarification", "no_match"] as const;
export const SHOP_AI_HARD_NEGATIVE_DIMENSIONS = [
  "brand",
  "category",
  "vehicle",
  "model",
  "chassis",
  "year",
  "engine",
  "market",
  "opfGpf",
  "productKind",
  "product",
  "variant",
  "semantic",
] as const;

export type ShopAiEvalLanguage = (typeof SHOP_AI_EVAL_LANGUAGES)[number];
export type ShopAiHardNegativeDimension = (typeof SHOP_AI_HARD_NEGATIVE_DIMENSIONS)[number];

export type ShopAiEvalMetadata = {
  language: ShopAiEvalLanguage;
  reviewer?: string;
  reviewedAt?: string;
  reviewEvidenceId?: string;
  tags?: string[];
  hardNegative?: {
    dimensions: ShopAiHardNegativeDimension[];
    note?: string;
  };
};

export type ShopAiEvalExpectation = {
  mode?: ShopAiResponseMode;
  make?: string;
  model?: string;
  chassis?: string;
  year?: number;
  category?: string;
  powerGainHp?: number;
  needsClarification?: boolean;
  opfGpf?: "with" | "without";
  productKind?: "system" | "downpipe" | "link_pipe" | "tips" | "any";
  forbidChassis?: string[];
  expectedProductIds?: string[];
  forbiddenProductIds?: string[];
  expectedVariantIds?: string[];
  forbiddenVariantIds?: string[];
};

export type ShopAiEvalCase = {
  id: string;
  locale: "ua" | "en";
  message: string;
  metadata?: ShopAiEvalMetadata;
  expect: ShopAiEvalExpectation;
};

export type ShopAiReleaseGateConfig = {
  enabledCategories: string[];
};

export type ShopAiReleaseGateReport = {
  passed: boolean;
  errors: string[];
  totalCases: number;
  enabledCategories: string[];
  countsByCategory: Record<string, number>;
  countsByLanguage: Record<string, number>;
  hardNegativeCases: number;
  unlabeledLanguageCases: number;
  unreviewedCases: number;
  invalidExpectationContractCases: number;
  duplicateQueryCases: number;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateNonEmptyStringArray(
  value: unknown,
  path: string,
  errors: string[]
): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty string array`);
    return null;
  }
  const strings = value.map((item) => (typeof item === "string" ? item.trim() : ""));
  if (strings.some((item) => !item)) {
    errors.push(`${path} must contain only non-empty strings`);
    return null;
  }
  if (new Set(strings).size !== strings.length) {
    errors.push(`${path} must not contain duplicates`);
  }
  return strings;
}

function validateOptionalStringArray(
  source: Record<string, unknown>,
  field: string,
  path: string,
  errors: string[]
) {
  if (source[field] === undefined) return null;
  return validateNonEmptyStringArray(source[field], `${path}.${field}`, errors);
}

function validateNoOverlap(
  expected: string[] | null,
  forbidden: string[] | null,
  label: string,
  errors: string[]
) {
  if (!expected || !forbidden) return;
  const overlap = expected.filter((id) => forbidden.includes(id));
  if (overlap.length) {
    errors.push(`${label} cannot be both expected and forbidden: ${overlap.join(", ")}`);
  }
}

function isValidReviewTimestamp(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/);
  if (!match) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const expectedIso = match[7] ? value : value.replace(/Z$/, ".000Z");
  return parsed.toISOString() === expectedIso;
}

function validateReviewMetadata(
  value: Record<string, unknown>,
  path: string,
  errors: string[],
  required: boolean
) {
  const fields = ["reviewer", "reviewedAt", "reviewEvidenceId"] as const;
  const hasAnyReviewField = fields.some((field) => value[field] !== undefined);
  if (!required && !hasAnyReviewField) return;

  for (const field of fields) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }
  if (
    typeof value.reviewedAt === "string" &&
    value.reviewedAt.trim() &&
    !isValidReviewTimestamp(value.reviewedAt.trim())
  ) {
    errors.push(`${path}.reviewedAt must be a valid UTC ISO-8601 timestamp`);
  }
}

function validateMetadata(value: unknown, path: string, errors: string[]) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (
    typeof value.language !== "string" ||
    !SHOP_AI_EVAL_LANGUAGES.includes(value.language as ShopAiEvalLanguage)
  ) {
    errors.push(`${path}.language must be one of: ${SHOP_AI_EVAL_LANGUAGES.join(", ")}`);
  }
  validateReviewMetadata(value, path, errors, false);
  if (value.tags !== undefined) {
    validateNonEmptyStringArray(value.tags, `${path}.tags`, errors);
  }
  if (value.hardNegative === undefined) return;
  if (!isRecord(value.hardNegative)) {
    errors.push(`${path}.hardNegative must be an object`);
    return;
  }
  const dimensions = validateNonEmptyStringArray(
    value.hardNegative.dimensions,
    `${path}.hardNegative.dimensions`,
    errors
  );
  if (
    dimensions?.some(
      (dimension) =>
        !SHOP_AI_HARD_NEGATIVE_DIMENSIONS.includes(dimension as ShopAiHardNegativeDimension)
    )
  ) {
    errors.push(
      `${path}.hardNegative.dimensions may only contain: ${SHOP_AI_HARD_NEGATIVE_DIMENSIONS.join(", ")}`
    );
  }
  if (
    value.hardNegative.note !== undefined &&
    (typeof value.hardNegative.note !== "string" || !value.hardNegative.note.trim())
  ) {
    errors.push(`${path}.hardNegative.note must be a non-empty string when provided`);
  }
}

function validateExpectation(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const stringFields = ["make", "model", "chassis", "category"] as const;
  for (const field of stringFields) {
    if (value[field] !== undefined && (typeof value[field] !== "string" || !value[field].trim())) {
      errors.push(`${path}.${field} must be a non-empty string when provided`);
    }
  }
  if (
    value.mode !== undefined &&
    !SHOP_AI_EVAL_RESPONSE_MODES.includes(value.mode as ShopAiResponseMode)
  ) {
    errors.push(`${path}.mode must be one of: ${SHOP_AI_EVAL_RESPONSE_MODES.join(", ")}`);
  }
  for (const field of ["year", "powerGainHp"] as const) {
    if (value[field] !== undefined && !Number.isFinite(value[field])) {
      errors.push(`${path}.${field} must be a finite number when provided`);
    }
  }
  if (value.needsClarification !== undefined && typeof value.needsClarification !== "boolean") {
    errors.push(`${path}.needsClarification must be a boolean when provided`);
  }
  if (value.opfGpf !== undefined && value.opfGpf !== "with" && value.opfGpf !== "without") {
    errors.push(`${path}.opfGpf must be "with" or "without" when provided`);
  }
  if (
    value.productKind !== undefined &&
    !["system", "downpipe", "link_pipe", "tips", "any"].includes(String(value.productKind))
  ) {
    errors.push(`${path}.productKind is not supported`);
  }

  validateOptionalStringArray(value, "forbidChassis", path, errors);
  const expectedProductIds = validateOptionalStringArray(value, "expectedProductIds", path, errors);
  const forbiddenProductIds = validateOptionalStringArray(
    value,
    "forbiddenProductIds",
    path,
    errors
  );
  const expectedVariantIds = validateOptionalStringArray(value, "expectedVariantIds", path, errors);
  const forbiddenVariantIds = validateOptionalStringArray(
    value,
    "forbiddenVariantIds",
    path,
    errors
  );
  validateNoOverlap(expectedProductIds, forbiddenProductIds, `${path} product IDs`, errors);
  validateNoOverlap(expectedVariantIds, forbiddenVariantIds, `${path} variant IDs`, errors);

  const hasExpectedIds = Boolean(expectedProductIds?.length || expectedVariantIds?.length);
  if ((value.mode === "no_match" || value.mode === "clarification") && hasExpectedIds) {
    errors.push(`${path}.mode ${value.mode} cannot declare expected product or variant IDs`);
  }
  if (value.mode === "clarification" && value.needsClarification === false) {
    errors.push(`${path}.mode clarification conflicts with needsClarification=false`);
  }
  if (
    (value.mode === "results" || value.mode === "no_match") &&
    value.needsClarification === true
  ) {
    errors.push(`${path}.mode ${value.mode} conflicts with needsClarification=true`);
  }
}

export function validateShopAiEvalCases(value: unknown): ValidationResult<ShopAiEvalCase[]> {
  if (!Array.isArray(value)) {
    return { ok: false, errors: ["Eval fixture must be an array"] };
  }
  const errors: string[] = [];
  const ids = new Set<string>();

  value.forEach((candidate, index) => {
    const path = `cases[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${path} must be an object`);
      return;
    }
    if (typeof candidate.id !== "string" || !candidate.id.trim()) {
      errors.push(`${path}.id must be a non-empty string`);
    } else if (ids.has(candidate.id)) {
      errors.push(`${path}.id is duplicated: ${candidate.id}`);
    } else {
      ids.add(candidate.id);
    }
    if (candidate.locale !== "ua" && candidate.locale !== "en") {
      errors.push(`${path}.locale must be "ua" or "en"`);
    }
    if (typeof candidate.message !== "string" || !candidate.message.trim()) {
      errors.push(`${path}.message must be a non-empty string`);
    }
    validateMetadata(candidate.metadata, `${path}.metadata`, errors);
    validateExpectation(candidate.expect, `${path}.expect`, errors);
  });

  return errors.length ? { ok: false, errors } : { ok: true, value: value as ShopAiEvalCase[] };
}

export function validateShopAiReleaseGateConfig(
  value: unknown
): ValidationResult<ShopAiReleaseGateConfig> {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["Release gate config must be an object"] };
  }
  const enabledCategories = validateNonEmptyStringArray(
    value.enabledCategories,
    "enabledCategories",
    errors
  );
  const supportedCategories = new Set<string>(SHOP_AI_V2_ROLLOUT_CATEGORIES);
  const unsupportedCategories =
    enabledCategories?.filter((category) => !supportedCategories.has(category)) ?? [];
  if (unsupportedCategories.length) {
    errors.push(
      `enabledCategories contains categories outside the V2 rollout contract: ${unsupportedCategories.join(", ")}`
    );
  }
  return errors.length || !enabledCategories
    ? { ok: false, errors }
    : { ok: true, value: { enabledCategories } };
}

export function evaluateShopAiReleaseGate(
  cases: ShopAiEvalCase[],
  config: ShopAiReleaseGateConfig
): ShopAiReleaseGateReport {
  const countsByCategory = Object.fromEntries(
    config.enabledCategories.map((category) => [
      category,
      cases.filter((testCase) => testCase.expect.category === category).length,
    ])
  );
  const countsByLanguage: Record<string, number> = {};
  let hardNegativeCases = 0;
  let unlabeledLanguageCases = 0;
  const unreviewedCaseIssues: string[] = [];
  const expectationContractIssues: string[] = [];
  const duplicateQueryIssues: string[] = [];
  const normalizedQueries = new Map<string, string>();
  for (const testCase of cases) {
    const language = testCase.metadata?.language ?? "unlabeled";
    countsByLanguage[language] = (countsByLanguage[language] ?? 0) + 1;
    if (!testCase.metadata?.language) unlabeledLanguageCases += 1;
    if (testCase.metadata?.hardNegative) hardNegativeCases += 1;

    const reviewErrors: string[] = [];
    validateReviewMetadata(
      (testCase.metadata ?? {}) as Record<string, unknown>,
      "metadata",
      reviewErrors,
      true
    );
    if (reviewErrors.length) {
      unreviewedCaseIssues.push(`${testCase.id}: ${reviewErrors.join("; ")}`);
    }

    const mode = testCase.expect.mode;
    const hasExpectedIds = Boolean(
      testCase.expect.expectedProductIds?.length || testCase.expect.expectedVariantIds?.length
    );
    const contractErrors: string[] = [];
    if (!mode) {
      contractErrors.push("expect.mode must explicitly be results, no_match, or clarification");
    } else if (mode === "results") {
      if (!hasExpectedIds) {
        contractErrors.push(
          "answerable results cases require expectedProductIds and/or expectedVariantIds"
        );
      }
      if (testCase.expect.needsClarification !== false) {
        contractErrors.push("results cases require needsClarification=false");
      }
    } else if (mode === "no_match") {
      if (hasExpectedIds) {
        contractErrors.push("no_match cases cannot declare expected product or variant IDs");
      }
      if (testCase.expect.needsClarification !== false) {
        contractErrors.push("no_match cases require needsClarification=false");
      }
    } else if (mode === "clarification") {
      if (hasExpectedIds) {
        contractErrors.push("clarification cases cannot declare expected product or variant IDs");
      }
      if (testCase.expect.needsClarification !== true) {
        contractErrors.push("clarification cases require needsClarification=true");
      }
    }
    if (contractErrors.length) {
      expectationContractIssues.push(`${testCase.id}: ${contractErrors.join("; ")}`);
    }

    const normalizedQuery = `${testCase.locale}:${testCase.message
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US")
      .replace(/\s+/g, " ")}`;
    const firstCaseId = normalizedQueries.get(normalizedQuery);
    if (firstCaseId) {
      duplicateQueryIssues.push(`${testCase.id} duplicates ${firstCaseId}`);
    } else {
      normalizedQueries.set(normalizedQuery, testCase.id);
    }
  }

  const errors: string[] = [];
  if (cases.length < SHOP_AI_RELEASE_GATE_MIN_CASES) {
    errors.push(
      `release corpus has ${cases.length} cases; at least ${SHOP_AI_RELEASE_GATE_MIN_CASES} committed, human-reviewed cases are required`
    );
  }
  for (const category of config.enabledCategories) {
    const count = countsByCategory[category] ?? 0;
    if (count < SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY) {
      errors.push(
        `category ${category} has ${count} cases; at least ${SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY} are required`
      );
    }
  }
  if (unlabeledLanguageCases) {
    errors.push(`${unlabeledLanguageCases} release cases are missing metadata.language`);
  }
  if (unreviewedCaseIssues.length) {
    errors.push(
      `${unreviewedCaseIssues.length} release cases are missing valid human-review metadata (metadata.reviewer, metadata.reviewedAt, metadata.reviewEvidenceId); examples: ${unreviewedCaseIssues
        .slice(0, 3)
        .join(" | ")}`
    );
  }
  if (expectationContractIssues.length) {
    errors.push(
      `${expectationContractIssues.length} release cases have invalid expected-result contracts; examples: ${expectationContractIssues
        .slice(0, 3)
        .join(" | ")}`
    );
  }
  if (duplicateQueryIssues.length) {
    errors.push(
      `${duplicateQueryIssues.length} release cases duplicate an already counted normalized query; examples: ${duplicateQueryIssues
        .slice(0, 3)
        .join(" | ")}`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    totalCases: cases.length,
    enabledCategories: [...config.enabledCategories],
    countsByCategory,
    countsByLanguage,
    hardNegativeCases,
    unlabeledLanguageCases,
    unreviewedCases: unreviewedCaseIssues.length,
    invalidExpectationContractCases: expectationContractIssues.length,
    duplicateQueryCases: duplicateQueryIssues.length,
  };
}

function assertEqual(errors: string[], label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertExpectedIds(
  errors: string[],
  label: string,
  actualIds: Set<string>,
  expectedIds: string[] | undefined
) {
  const missing = (expectedIds ?? []).filter((id) => !actualIds.has(id));
  if (missing.length) errors.push(`missing expected ${label}: ${missing.join(", ")}`);
}

function assertForbiddenIds(
  errors: string[],
  label: string,
  actualIds: Set<string>,
  forbiddenIds: string[] | undefined
) {
  const present = (forbiddenIds ?? []).filter((id) => actualIds.has(id));
  if (present.length) errors.push(`returned forbidden ${label}: ${present.join(", ")}`);
}

export function evaluateShopAiResponse(testCase: ShopAiEvalCase, result: ShopAiAssistantResponse) {
  const errors: string[] = [];
  const expected = testCase.expect;
  if (expected.mode !== undefined) {
    assertEqual(errors, "mode", result.mode, expected.mode);
    if (expected.mode !== "results" && result.products.length !== 0) {
      errors.push(`${expected.mode} expected no products, received ${result.products.length}`);
    }
    if (expected.mode !== "results" && result.totalItems !== 0) {
      errors.push(`${expected.mode} expected totalItems=0, received ${result.totalItems}`);
    }
  }
  if (expected.make !== undefined) {
    assertEqual(errors, "make", result.plan.vehicle.make, expected.make);
  }
  if (expected.model !== undefined) {
    assertEqual(errors, "model", result.plan.vehicle.model, expected.model);
  }
  if (expected.chassis !== undefined) {
    assertEqual(errors, "chassis", result.plan.vehicle.chassis, expected.chassis);
  }
  if (expected.year !== undefined) {
    assertEqual(errors, "year", result.plan.vehicle.year, expected.year);
  }
  if (expected.category !== undefined) {
    assertEqual(errors, "category", result.plan.category, expected.category);
  }
  if (expected.powerGainHp !== undefined) {
    assertEqual(errors, "powerGainHp", result.plan.powerGainHp, expected.powerGainHp);
  }
  if (expected.needsClarification !== undefined) {
    assertEqual(
      errors,
      "needsClarification",
      result.plan.needsClarification,
      expected.needsClarification
    );
  }
  if (expected.opfGpf !== undefined) {
    assertEqual(errors, "opfGpf", result.plan.opfGpf, expected.opfGpf);
  }
  if (expected.productKind !== undefined) {
    assertEqual(errors, "productKind", result.plan.productKind, expected.productKind);
    const mismatched = result.products.filter(
      (product) => product.facts?.productKind !== expected.productKind
    );
    if (mismatched.length) {
      errors.push(
        `product kind mismatch: ${mismatched.map((product) => product.partNumber).join(", ")}`
      );
    }
  }
  if (result.managerHref !== `/${testCase.locale}/contact?source=one-ai`) {
    errors.push("managerHref is missing or not localized");
  }
  if (!result.managerContext || result.managerContext.request !== testCase.message) {
    errors.push("managerContext is missing the private request handoff");
  }
  if (expected.opfGpf) {
    const mismatched = result.products.filter(
      (product) => product.facts?.opfGpf !== expected.opfGpf
    );
    if (mismatched.length) {
      errors.push(`OPF mismatch: ${mismatched.map((product) => product.partNumber).join(", ")}`);
    }
  }
  for (const forbidden of expected.forbidChassis ?? []) {
    const badProducts = result.products.filter((product) =>
      (product.fitments ?? []).some((fitment) =>
        fitment.chassisCodes.some((chassis) => chassis.toUpperCase() === forbidden.toUpperCase())
      )
    );
    if (badProducts.length) {
      errors.push(
        `forbidden chassis ${forbidden}: ${badProducts.map((product) => product.partNumber).join(", ")}`
      );
    }
  }

  const productIds = new Set(result.products.map((product) => product.id));
  const variantIds = new Set(
    result.products.flatMap((product) => (product.variantId ? [product.variantId] : []))
  );
  assertExpectedIds(errors, "product IDs", productIds, expected.expectedProductIds);
  assertForbiddenIds(errors, "product IDs", productIds, expected.forbiddenProductIds);
  assertExpectedIds(errors, "variant IDs", variantIds, expected.expectedVariantIds);
  assertForbiddenIds(errors, "variant IDs", variantIds, expected.forbiddenVariantIds);

  return errors;
}
