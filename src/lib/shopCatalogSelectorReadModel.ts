import { createHash } from "node:crypto";

import type {
  ShopCatalogV2CompatibilityClause,
  ShopCatalogV2CompatibilityDimension,
  ShopCatalogV2CompatibilityPolicy,
  ShopCatalogV2CompatibilityValue,
  ShopCatalogV2YearRange,
} from "./shopCatalogV2Compatibility";
import { validateShopCatalogV2CompatibilityPolicy } from "./shopCatalogV2Compatibility";

/** The selector artifact is independent from Prisma, routes, and request state. */
export const SHOP_CATALOG_SELECTOR_READ_MODEL_VERSION = 1 as const;
export const SHOP_CATALOG_SELECTOR_MAX_SLICE = 100 as const;
const YEAR_MIN = 1886;
const YEAR_MAX = 2200;

export type ShopCatalogSelectorScope = "auto" | "moto";

export type ShopCatalogSelectorSourceMetadata = {
  sourceId: string;
  revision: string | number | bigint;
  /** A source may be present while its selector coverage is still partial. */
  coverageComplete: boolean;
};

export type ShopCatalogSelectorVisibilityMetadata = {
  isPublished: boolean;
  status: string;
};

export type ShopCatalogSelectorPolicyInput = {
  policy: ShopCatalogV2CompatibilityPolicy;
  scope: ShopCatalogSelectorScope | null;
  brand: string | null;
  source: ShopCatalogSelectorSourceMetadata | null;
  visibility: ShopCatalogSelectorVisibilityMetadata | null;
};

export type ShopCatalogSelectorCoverageInput = {
  /** Set by the publisher after the bounded source pages have been exhausted. */
  complete: boolean;
  expectedPolicyCount?: number;
  sourceRevisions?: readonly {
    sourceId: string;
    revision: string | number | bigint;
  }[];
};

export type ShopCatalogSelectorApplication = {
  productId: string;
  variantId: string | null;
  clauseId: string;
  scope: ShopCatalogSelectorScope;
  brand: string;
  makes: readonly string[];
  models: readonly string[];
  generations: readonly string[];
  chassis: readonly string[];
  engines: readonly string[];
  years: readonly number[];
};

export type ShopCatalogSelectorOptions = {
  scopes: readonly ShopCatalogSelectorScope[];
  brands: readonly string[];
  makes: readonly string[];
  models: readonly string[];
  generations: readonly string[];
  chassis: readonly string[];
  engines: readonly string[];
  years: readonly number[];
};

export type ShopCatalogSelectorCoverage = {
  policies: { observed: number; eligible: number; published: number; excluded: number };
  products: { observed: number; eligible: number };
  scope: { observed: readonly ShopCatalogSelectorScope[]; unknown: number };
  brand: { observed: readonly string[]; unknown: number };
  visibility: { published: number; excluded: number; unknown: number };
  source: {
    complete: boolean;
    expectedPolicyCount: number | null;
    observedPolicyCount: number;
    revisions: readonly { sourceId: string; revision: string }[];
  };
};

export type ShopCatalogSelectorReadModel = {
  schemaVersion: typeof SHOP_CATALOG_SELECTOR_READ_MODEL_VERSION;
  projectionVersion: string;
  options: ShopCatalogSelectorOptions;
  /** Each application retains its own clause; no cross-clause Cartesian product is implied. */
  applications: readonly ShopCatalogSelectorApplication[];
  coverage: ShopCatalogSelectorCoverage;
  complete: boolean;
  reasons: readonly string[];
  coverageFingerprint: string;
  /** Alias useful to consumers that call the artifact fingerprint simply fingerprint. */
  fingerprint: string;
};

export type ShopCatalogSelectorSliceDimension = keyof ShopCatalogSelectorOptions;

export type ShopCatalogSelectorSlice = {
  dimension: ShopCatalogSelectorSliceDimension;
  values: readonly (string | number)[];
  nextCursor: string | null;
  hasMore: boolean;
  coverageFingerprint: string;
};

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested, seen);
  return Object.freeze(value);
}

function text(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function revision(value: string | number | bigint) {
  try {
    return BigInt(value).toString();
  } catch {
    return String(value).trim();
  }
}

function sortText(values: Iterable<string>) {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const value = text(raw);
    if (!value) continue;
    const key = value.toLocaleLowerCase("en-US");
    const prior = byKey.get(key);
    if (!prior || value.localeCompare(prior, "en") < 0) byKey.set(key, value);
  }
  return [...byKey.values()].sort((left, right) => left.localeCompare(right, "en"));
}

function yearRange(value: ShopCatalogV2CompatibilityValue): value is ShopCatalogV2YearRange {
  return (
    typeof value === "object" &&
    value !== null &&
    "from" in value &&
    "to" in value &&
    (value as ShopCatalogV2YearRange).from !== undefined &&
    (value as ShopCatalogV2YearRange).to !== undefined
  );
}

function constraintValues(
  clause: ShopCatalogV2CompatibilityClause,
  dimension: ShopCatalogV2CompatibilityDimension
) {
  const constraint = clause.constraints.find((item) => item.dimension === dimension);
  if (!constraint || constraint.state !== "EXACT") return [] as ShopCatalogV2CompatibilityValue[];
  return [...constraint.values];
}

function stringsFor(
  clause: ShopCatalogV2CompatibilityClause,
  dimension: Extract<
    ShopCatalogV2CompatibilityDimension,
    "make" | "model" | "generation" | "chassis" | "engine"
  >
) {
  return sortText(
    constraintValues(clause, dimension).flatMap((value) => {
      if (typeof value === "string") return [value];
      if (
        dimension === "engine" &&
        typeof value === "object" &&
        value !== null &&
        "kind" in value &&
        value.kind === "powertrain"
      )
        return [value.code];
      return [];
    })
  );
}

function yearsFor(clause: ShopCatalogV2CompatibilityClause) {
  const years = new Set<number>();
  for (const value of constraintValues(clause, "year")) {
    if (!yearRange(value)) continue;
    const from = value.from ?? YEAR_MIN;
    const to = value.to ?? YEAR_MAX;
    for (let year = Math.max(YEAR_MIN, from); year <= Math.min(YEAR_MAX, to); year += 1)
      years.add(year);
  }
  return [...years].sort((left, right) => right - left);
}

function issue(reasons: string[], message: string) {
  if (!reasons.includes(message)) reasons.push(message);
}

/**
 * Builds a complete selector artifact from already-read canonical policies.
 * This is intended for publication/build jobs. Request handlers should consume
 * the artifact with sliceShopCatalogSelectorOptions and never rebuild it.
 */
export function buildShopCatalogSelectorReadModel(input: {
  projectionVersion: string | number | bigint;
  policies: readonly ShopCatalogSelectorPolicyInput[];
  sourceCoverage?: ShopCatalogSelectorCoverageInput;
}): ShopCatalogSelectorReadModel {
  const projectionVersion = revision(input.projectionVersion);
  const reasons: string[] = [];
  const sourceCoverage = input.sourceCoverage;
  if (!sourceCoverage) issue(reasons, "missing source coverage metadata");
  else if (!sourceCoverage.complete) issue(reasons, "source coverage is incomplete");
  if (
    sourceCoverage?.expectedPolicyCount !== undefined &&
    sourceCoverage.expectedPolicyCount !== input.policies.length
  )
    issue(
      reasons,
      `source coverage policy count mismatch: expected ${sourceCoverage.expectedPolicyCount}, observed ${input.policies.length}`
    );

  const scopes = new Set<ShopCatalogSelectorScope>();
  const brands = new Set<string>();
  const makes = new Set<string>();
  const models = new Set<string>();
  const generations = new Set<string>();
  const chassis = new Set<string>();
  const engines = new Set<string>();
  const years = new Set<number>();
  const applications: ShopCatalogSelectorApplication[] = [];
  const products = new Set<string>();
  const eligibleProducts = new Set<string>();
  const eligiblePolicies = new Set<string>();
  const publishedPolicies = new Set<string>();
  const excludedPolicies = new Set<string>();
  const observedScopes = new Set<ShopCatalogSelectorScope>();
  const observedBrands = new Set<string>();
  const sourceRevisions = new Map<string, string>();
  let unknownScopes = 0;
  let unknownBrands = 0;
  let unknownVisibility = 0;
  let publishedCount = 0;
  let excludedCount = 0;

  for (const entry of input.policies) {
    const policyKey = `${entry.policy.target.productId}:${entry.policy.target.variantId ?? "$product"}`;
    products.add(entry.policy.target.productId);
    const source = entry.source;
    if (!source || !text(source.sourceId) || !text(revision(source.revision))) {
      issue(reasons, `missing source coverage for ${policyKey}`);
    } else if (!source.coverageComplete) {
      issue(
        reasons,
        `source coverage incomplete for ${source.sourceId}@${revision(source.revision)}`
      );
      sourceRevisions.set(
        `${source.sourceId}@${revision(source.revision)}`,
        revision(source.revision)
      );
    } else {
      sourceRevisions.set(
        `${source.sourceId}@${revision(source.revision)}`,
        revision(source.revision)
      );
    }
    const brand = text(entry.brand);
    if (!brand) {
      unknownBrands += 1;
      issue(reasons, `missing brand coverage for ${policyKey}`);
    } else {
      brands.add(brand);
      observedBrands.add(brand);
    }
    if (entry.scope === "auto" || entry.scope === "moto") {
      scopes.add(entry.scope);
      observedScopes.add(entry.scope);
    } else {
      unknownScopes += 1;
      issue(reasons, `missing scope coverage for ${policyKey}`);
    }
    const visibility = entry.visibility;
    if (!visibility || typeof visibility.isPublished !== "boolean" || !text(visibility.status)) {
      unknownVisibility += 1;
      issue(reasons, `missing visibility coverage for ${policyKey}`);
      continue;
    }
    if (visibility.isPublished && visibility.status.trim().toUpperCase() === "ACTIVE") {
      publishedCount += 1;
      publishedPolicies.add(policyKey);
    } else {
      excludedCount += 1;
      excludedPolicies.add(policyKey);
      continue;
    }
    if (!brand || !(entry.scope === "auto" || entry.scope === "moto")) continue;
    const validationErrors = validateShopCatalogV2CompatibilityPolicy(entry.policy);
    if (validationErrors.length) {
      issue(reasons, `invalid policy ${policyKey}: ${validationErrors.join(", ")}`);
      continue;
    }
    if (entry.policy.mode === "NEEDS_REVIEW" || entry.policy.mode === "PARENT_DEPENDENT") {
      issue(reasons, `policy ${policyKey} has unsupported mode ${entry.policy.mode}`);
      continue;
    }
    if (
      Object.entries(entry.policy.dimensionDefaults ?? {}).some(([, state]) => state === "UNKNOWN")
    ) {
      issue(reasons, `policy ${policyKey} has UNKNOWN dimension default`);
      continue;
    }
    let acceptedForPolicy = false;
    for (const clause of entry.policy.clauses) {
      const unknownConstraint = clause.constraints.find(
        (constraint) => constraint.state === "UNKNOWN"
      );
      if (clause.verification === "NEEDS_REVIEW") {
        issue(reasons, `clause ${policyKey}/${clause.id} is NEEDS_REVIEW`);
        continue;
      }
      if (unknownConstraint) {
        issue(
          reasons,
          `clause ${policyKey}/${clause.id} has UNKNOWN ${unknownConstraint.dimension}`
        );
        continue;
      }
      if (clause.verification !== "VERIFIED") {
        issue(reasons, `clause ${policyKey}/${clause.id} is ${clause.verification}`);
        continue;
      }
      const application = {
        productId: entry.policy.target.productId,
        variantId: entry.policy.target.variantId ?? null,
        clauseId: clause.id,
        scope: entry.scope,
        brand,
        makes: stringsFor(clause, "make"),
        models: stringsFor(clause, "model"),
        generations: stringsFor(clause, "generation"),
        chassis: stringsFor(clause, "chassis"),
        engines: stringsFor(clause, "engine"),
        years: yearsFor(clause),
      } satisfies ShopCatalogSelectorApplication;
      if (
        !application.makes.length &&
        !application.models.length &&
        !application.generations.length &&
        !application.chassis.length
      ) {
        issue(reasons, `clause ${policyKey}/${clause.id} has no vehicle options`);
        continue;
      }
      acceptedForPolicy = true;
      eligiblePolicies.add(policyKey);
      eligibleProducts.add(entry.policy.target.productId);
      applications.push(application);
      for (const value of application.makes) makes.add(value);
      for (const value of application.models) models.add(value);
      for (const value of application.generations) generations.add(value);
      for (const value of application.chassis) chassis.add(value);
      for (const value of application.engines) engines.add(value);
      for (const value of application.years) years.add(value);
    }
    if (!acceptedForPolicy) issue(reasons, `policy ${policyKey} has no complete VERIFIED clause`);
  }

  const options: ShopCatalogSelectorOptions = {
    scopes: sortText(scopes) as ShopCatalogSelectorScope[],
    brands: sortText(brands),
    makes: sortText(makes),
    models: sortText(models),
    generations: sortText(generations),
    chassis: sortText(chassis),
    engines: sortText(engines),
    years: [...years].sort((left, right) => right - left),
  };
  applications.sort(
    (left, right) =>
      left.productId.localeCompare(right.productId, "en") ||
      left.variantId?.localeCompare(right.variantId ?? "", "en") ||
      left.clauseId.localeCompare(right.clauseId, "en")
  );
  const coverage: ShopCatalogSelectorCoverage = {
    policies: {
      observed: input.policies.length,
      eligible: eligiblePolicies.size,
      published: publishedPolicies.size,
      excluded: excludedPolicies.size,
    },
    products: { observed: products.size, eligible: eligibleProducts.size },
    scope: {
      observed: sortText(observedScopes) as ShopCatalogSelectorScope[],
      unknown: unknownScopes,
    },
    brand: { observed: sortText(observedBrands), unknown: unknownBrands },
    visibility: { published: publishedCount, excluded: excludedCount, unknown: unknownVisibility },
    source: {
      complete:
        Boolean(sourceCoverage?.complete) &&
        (sourceCoverage?.expectedPolicyCount === undefined ||
          sourceCoverage.expectedPolicyCount === input.policies.length),
      expectedPolicyCount: sourceCoverage?.expectedPolicyCount ?? null,
      observedPolicyCount: input.policies.length,
      revisions: [...sourceRevisions.entries()]
        .map(([key, value]) => ({ sourceId: key.slice(0, key.lastIndexOf("@")), revision: value }))
        .sort(
          (left, right) =>
            left.sourceId.localeCompare(right.sourceId, "en") ||
            left.revision.localeCompare(right.revision, "en")
        ),
    },
  };
  const normalized = {
    schemaVersion: SHOP_CATALOG_SELECTOR_READ_MODEL_VERSION,
    projectionVersion,
    options,
    applications,
    coverage,
  };
  const coverageFingerprint = hash({ ...normalized, reasons: [...reasons].sort() });
  const complete = reasons.length === 0 && coverage.source.complete;
  return freeze({
    ...normalized,
    complete,
    reasons: [...reasons].sort(),
    coverageFingerprint,
    fingerprint: coverageFingerprint,
  });
}

/** Return one bounded keyset-like slice. The cursor is tied to this artifact fingerprint. */
export function sliceShopCatalogSelectorOptions(
  model: ShopCatalogSelectorReadModel,
  input: { dimension: ShopCatalogSelectorSliceDimension; limit?: number; cursor?: string | null }
): ShopCatalogSelectorSlice {
  const limit = input.limit ?? SHOP_CATALOG_SELECTOR_MAX_SLICE;
  if (!Number.isInteger(limit) || limit < 1 || limit > SHOP_CATALOG_SELECTOR_MAX_SLICE)
    throw new RangeError(
      `selector slice limit must be between 1 and ${SHOP_CATALOG_SELECTOR_MAX_SLICE}`
    );
  const values = model.options[input.dimension];
  let offset = 0;
  if (input.cursor) {
    const [fingerprint, rawOffset] = input.cursor.split(":");
    if (fingerprint !== model.coverageFingerprint || !/^\d+$/u.test(rawOffset ?? ""))
      throw new TypeError("selector continuation does not match the read model");
    offset = Number(rawOffset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > values.length)
      throw new TypeError("selector continuation offset is invalid");
  }
  const page = values.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < values.length;
  return {
    dimension: input.dimension,
    values: page,
    hasMore,
    nextCursor: hasMore ? `${model.coverageFingerprint}:${nextOffset}` : null,
    coverageFingerprint: model.coverageFingerprint,
  };
}
