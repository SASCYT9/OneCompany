import type { ShopAiAssistantResponse, ShopAiResponseMode } from "../src/lib/shopAiAssistantTypes";
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../src/lib/shopAiV2FeatureFlags";
import { validateGroundedShopAiOutput } from "../src/lib/shopAiOutputValidator";
import { redactShopAiText } from "../src/lib/shopAiPrivacy";

export const SHOP_AI_RELEASE_GATE_MIN_CASES = 500;
export const SHOP_AI_RELEASE_GATE_MIN_CASES_PER_CATEGORY = 30;
export const SHOP_AI_RELEASE_GATE_MIN_HARD_NEGATIVE_CASES = 100;
export const SHOP_AI_RELEASE_GATE_MIN_EXACT_SKU_CASES = 1;

export const SHOP_AI_RELEASE_REVIEW_POLICIES = ["human", "catalog_grounded_machine"] as const;
export const SHOP_AI_MACHINE_REVIEW_ELIGIBILITY = [
  "deterministic",
  "source_grounded_reviewable",
] as const;
export const SHOP_AI_MACHINE_REVIEW_ORACLES = [
  "catalog_relevance",
  "clarification",
  "exact_sku",
  "mutated_sku_no_match",
] as const;

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
export type ShopAiReleaseReviewPolicy = (typeof SHOP_AI_RELEASE_REVIEW_POLICIES)[number];
export type ShopAiMachineReviewEligibility = (typeof SHOP_AI_MACHINE_REVIEW_ELIGIBILITY)[number];
export type ShopAiMachineReviewOracle = (typeof SHOP_AI_MACHINE_REVIEW_ORACLES)[number];

export type ShopAiEvalMetadata = {
  language: ShopAiEvalLanguage;
  reviewer?: string;
  reviewedAt?: string;
  reviewEvidenceId?: string;
  reviewMethod?: ShopAiReleaseReviewPolicy;
  reviewAutomationEligibility?: ShopAiMachineReviewEligibility;
  reviewOracle?: ShopAiMachineReviewOracle;
  reviewSourceEvidenceId?: string;
  reviewSourceCategory?: string;
  reviewSourceProductId?: string;
  reviewSourceVariantId?: string;
  fitmentClaimAllowed?: false;
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
  reviewPolicy?: ShopAiReleaseReviewPolicy;
};

export type ShopAiReleaseGateReport = {
  passed: boolean;
  errors: string[];
  reviewPolicy: ShopAiReleaseReviewPolicy;
  totalCases: number;
  enabledCategories: string[];
  countsByCategory: Record<string, number>;
  countsByLanguage: Record<string, number>;
  hardNegativeCases: number;
  exactSkuCases: number;
  missingLanguages: ShopAiEvalLanguage[];
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
  required: boolean,
  reviewPolicy: ShopAiReleaseReviewPolicy | null = null
) {
  const commonFields = ["reviewer", "reviewedAt", "reviewEvidenceId"] as const;
  const machineFields = [
    "reviewMethod",
    "reviewAutomationEligibility",
    "reviewOracle",
    "reviewSourceEvidenceId",
    "reviewSourceCategory",
    "reviewSourceProductId",
    "fitmentClaimAllowed",
  ] as const;
  const hasAnyReviewField = [...commonFields, ...machineFields].some(
    (field) => value[field] !== undefined
  );
  if (!required && !hasAnyReviewField) return;

  const requiredStringFields = [
    ...commonFields,
    ...(reviewPolicy === "catalog_grounded_machine"
      ? machineFields.filter((field) => field !== "fitmentClaimAllowed")
      : []),
  ];
  for (const field of requiredStringFields) {
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
  if (
    reviewPolicy === "human" &&
    value.reviewMethod !== undefined &&
    value.reviewMethod !== "human"
  ) {
    errors.push(`${path}.reviewMethod must be human for the human review policy`);
  }
  if (reviewPolicy === "catalog_grounded_machine") {
    if (value.reviewMethod !== "catalog_grounded_machine") {
      errors.push(
        `${path}.reviewMethod must be catalog_grounded_machine for the machine review policy`
      );
    }
    if (value.fitmentClaimAllowed !== false) {
      errors.push(`${path}.fitmentClaimAllowed must be false for machine-reviewed cases`);
    }
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
  if (
    value.reviewMethod !== undefined &&
    !SHOP_AI_RELEASE_REVIEW_POLICIES.includes(value.reviewMethod as ShopAiReleaseReviewPolicy)
  ) {
    errors.push(
      `${path}.reviewMethod must be one of: ${SHOP_AI_RELEASE_REVIEW_POLICIES.join(", ")}`
    );
  }
  if (
    value.reviewAutomationEligibility !== undefined &&
    !SHOP_AI_MACHINE_REVIEW_ELIGIBILITY.includes(
      value.reviewAutomationEligibility as ShopAiMachineReviewEligibility
    )
  ) {
    errors.push(
      `${path}.reviewAutomationEligibility must be one of: ${SHOP_AI_MACHINE_REVIEW_ELIGIBILITY.join(", ")}`
    );
  }
  if (
    value.reviewOracle !== undefined &&
    !SHOP_AI_MACHINE_REVIEW_ORACLES.includes(value.reviewOracle as ShopAiMachineReviewOracle)
  ) {
    errors.push(
      `${path}.reviewOracle must be one of: ${SHOP_AI_MACHINE_REVIEW_ORACLES.join(", ")}`
    );
  }
  for (const field of [
    "reviewSourceEvidenceId",
    "reviewSourceCategory",
    "reviewSourceProductId",
    "reviewSourceVariantId",
  ] as const) {
    if (value[field] !== undefined && (typeof value[field] !== "string" || !value[field].trim())) {
      errors.push(`${path}.${field} must be a non-empty string when provided`);
    }
  }
  if (value.fitmentClaimAllowed !== undefined && value.fitmentClaimAllowed !== false) {
    errors.push(`${path}.fitmentClaimAllowed may only be false`);
  }
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
  const reviewPolicy = value.reviewPolicy ?? "human";
  if (
    typeof reviewPolicy !== "string" ||
    !SHOP_AI_RELEASE_REVIEW_POLICIES.includes(reviewPolicy as ShopAiReleaseReviewPolicy)
  ) {
    errors.push(`reviewPolicy must be one of: ${SHOP_AI_RELEASE_REVIEW_POLICIES.join(", ")}`);
  }
  return errors.length || !enabledCategories
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
          enabledCategories,
          reviewPolicy: reviewPolicy as ShopAiReleaseReviewPolicy,
        },
      };
}

function validateMachineReviewContract(
  testCase: ShopAiEvalCase,
  enabledCategories: ReadonlySet<string>
) {
  const errors: string[] = [];
  const metadata = testCase.metadata;
  if (!metadata) return ["metadata is required for machine review"];
  const eligibility = metadata.reviewAutomationEligibility;
  const oracle = metadata.reviewOracle;
  const sourceProductId = metadata.reviewSourceProductId;
  const sourceVariantId = metadata.reviewSourceVariantId;
  const sourceCategory = metadata.reviewSourceCategory;

  if (!sourceCategory || !enabledCategories.has(sourceCategory)) {
    errors.push("reviewSourceCategory must be one of the enabled release categories");
  }
  const fitmentExpectationFields = [
    "make",
    "model",
    "chassis",
    "year",
    "opfGpf",
    "forbidChassis",
  ] as const;
  const assertedFitmentFields = fitmentExpectationFields.filter(
    (field) => testCase.expect[field] !== undefined
  );
  if (assertedFitmentFields.length) {
    errors.push(`machine review cannot assert fitment fields: ${assertedFitmentFields.join(", ")}`);
  }

  if (oracle === "catalog_relevance") {
    if (eligibility !== "source_grounded_reviewable") {
      errors.push("catalog_relevance requires source_grounded_reviewable eligibility");
    }
    if (testCase.expect.mode !== "results") {
      errors.push("catalog_relevance requires results mode");
    }
    if (
      !sourceProductId ||
      testCase.expect.expectedProductIds?.length !== 1 ||
      testCase.expect.expectedProductIds[0] !== sourceProductId
    ) {
      errors.push("catalog_relevance expectedProductIds must equal the source product identity");
    }
    if (!testCase.metadata?.tags?.includes("catalog-relevance")) {
      errors.push("catalog_relevance requires the catalog-relevance tag");
    }
  } else if (oracle === "clarification") {
    if (eligibility !== "deterministic") {
      errors.push("clarification requires deterministic eligibility");
    }
    if (testCase.expect.mode !== "clarification" || testCase.expect.needsClarification !== true) {
      errors.push("clarification oracle requires an explicit clarification contract");
    }
  } else if (oracle === "exact_sku") {
    if (eligibility !== "deterministic") {
      errors.push("exact_sku requires deterministic eligibility");
    }
    if (
      testCase.expect.mode !== "results" ||
      !testCase.metadata?.tags?.includes("exact-sku") ||
      !sourceProductId ||
      !testCase.expect.expectedProductIds?.includes(sourceProductId)
    ) {
      errors.push("exact_sku must resolve the source product as an identity result");
    }
    if (sourceVariantId && !testCase.expect.expectedVariantIds?.includes(sourceVariantId)) {
      errors.push("exact_sku must resolve the source variant when one is present");
    }
  } else if (oracle === "mutated_sku_no_match") {
    if (eligibility !== "deterministic") {
      errors.push("mutated_sku_no_match requires deterministic eligibility");
    }
    if (
      testCase.expect.mode !== "no_match" ||
      !metadata.hardNegative ||
      !sourceProductId ||
      !testCase.expect.forbiddenProductIds?.includes(sourceProductId)
    ) {
      errors.push("mutated_sku_no_match must forbid its source product as a hard negative");
    }
    if (sourceVariantId && !testCase.expect.forbiddenVariantIds?.includes(sourceVariantId)) {
      errors.push("mutated_sku_no_match must forbid its source variant when one is present");
    }
  } else {
    errors.push("reviewOracle is required for machine review");
  }

  return errors;
}

export function evaluateShopAiReleaseGate(
  cases: ShopAiEvalCase[],
  config: ShopAiReleaseGateConfig
): ShopAiReleaseGateReport {
  const reviewPolicy = config.reviewPolicy ?? "human";
  const enabledCategorySet = new Set(config.enabledCategories);
  const countsByCategory = Object.fromEntries(
    config.enabledCategories.map((category) => [
      category,
      cases.filter((testCase) =>
        reviewPolicy === "catalog_grounded_machine"
          ? testCase.metadata?.reviewSourceCategory === category
          : testCase.expect.category === category
      ).length,
    ])
  );
  const countsByLanguage: Record<string, number> = {};
  let hardNegativeCases = 0;
  let exactSkuCases = 0;
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
    if (testCase.metadata?.tags?.includes("exact-sku")) exactSkuCases += 1;

    const reviewErrors: string[] = [];
    validateReviewMetadata(
      (testCase.metadata ?? {}) as Record<string, unknown>,
      "metadata",
      reviewErrors,
      true,
      reviewPolicy
    );
    if (reviewPolicy === "catalog_grounded_machine") {
      reviewErrors.push(...validateMachineReviewContract(testCase, enabledCategorySet));
    }
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
    const reviewLabel =
      reviewPolicy === "human" ? "human-reviewed" : "catalog-grounded machine-reviewed";
    errors.push(
      `release corpus has ${cases.length} cases; at least ${SHOP_AI_RELEASE_GATE_MIN_CASES} committed, ${reviewLabel} cases are required`
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
  const missingLanguages = SHOP_AI_EVAL_LANGUAGES.filter((language) => !countsByLanguage[language]);
  if (missingLanguages.length) {
    errors.push(
      `release corpus must cover UA, EN, RU, mixed and translit; missing: ${missingLanguages.join(", ")}`
    );
  }
  if (hardNegativeCases < SHOP_AI_RELEASE_GATE_MIN_HARD_NEGATIVE_CASES) {
    errors.push(
      `release corpus has ${hardNegativeCases} hard-negative cases; at least ${SHOP_AI_RELEASE_GATE_MIN_HARD_NEGATIVE_CASES} are required`
    );
  }
  if (exactSkuCases < SHOP_AI_RELEASE_GATE_MIN_EXACT_SKU_CASES) {
    errors.push("release corpus must include at least one reviewed exact-SKU identity case");
  }
  if (unreviewedCaseIssues.length) {
    const examples = unreviewedCaseIssues.slice(0, 3).join(" | ");
    errors.push(
      reviewPolicy === "human"
        ? `${unreviewedCaseIssues.length} release cases are missing valid human-review metadata (metadata.reviewer, metadata.reviewedAt, metadata.reviewEvidenceId); examples: ${examples}`
        : `${unreviewedCaseIssues.length} release cases do not satisfy the catalog-grounded machine review policy; examples: ${examples}`
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
    reviewPolicy,
    totalCases: cases.length,
    enabledCategories: [...config.enabledCategories],
    countsByCategory,
    countsByLanguage,
    hardNegativeCases,
    exactSkuCases,
    missingLanguages,
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
  if (result.products.length > 6) {
    errors.push(`response returned ${result.products.length} cards; maximum is 6`);
  }
  if (result.totalItems < result.products.length) {
    errors.push(
      `totalItems=${result.totalItems} is smaller than the ${result.products.length} shown cards`
    );
  }
  if (
    !validateGroundedShopAiOutput(result.message, result.products, {
      currency: "EUR",
    })
  ) {
    errors.push("assistant message contains an ungrounded product or compatibility claim");
  }

  let encounteredReviewable = false;
  for (const product of result.products) {
    if (product.matchStatus === "requires_verification") encounteredReviewable = true;
    if (product.matchStatus === "exact" && encounteredReviewable) {
      errors.push("exact cards must be ordered before requires_verification cards");
      break;
    }
  }
  for (const product of result.products) {
    if (
      product.matchStatus === "exact" &&
      product.matchBasis !== "identity" &&
      (product.missingFacts?.length ?? 0) > 0
    ) {
      errors.push(`exact product ${product.id} contains missing fitment facts`);
    }
    if (product.matchStatus === "requires_verification" && product.compatibility === "confirmed") {
      errors.push(`reviewable product ${product.id} claims confirmed compatibility`);
    }
    if (product.matchBasis === "identity" && product.compatibility === "confirmed") {
      errors.push(`identity-only product ${product.id} claims confirmed fitment`);
    }
  }
  if (result.counts) {
    const shownExact = result.products.filter((product) => product.matchStatus === "exact").length;
    const shownReviewable = result.products.filter(
      (product) => product.matchStatus === "requires_verification"
    ).length;
    if (result.counts.exact !== shownExact) {
      errors.push(`counts.exact=${result.counts.exact}, but ${shownExact} exact cards are shown`);
    }
    if (result.counts.requiresVerification !== shownReviewable) {
      errors.push(
        `counts.requiresVerification=${result.counts.requiresVerification}, but ${shownReviewable} reviewable cards are shown`
      );
    }
  }
  if (testCase.metadata?.tags?.includes("exact-sku")) {
    const identityMatches = result.products.filter(
      (product) => product.matchStatus === "exact" && product.matchBasis === "identity"
    );
    if (identityMatches.length !== 1) {
      errors.push(
        `exact-SKU case must return exactly one exact identity match; received ${identityMatches.length}`
      );
    }
  }
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
  const expectedManagerRequest = redactShopAiText(testCase.message, 800).text;
  if (!result.managerContext || result.managerContext.request !== expectedManagerRequest) {
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
