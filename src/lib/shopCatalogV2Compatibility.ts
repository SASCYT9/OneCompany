/**
 * Catalog V2 vehicle compatibility contract.
 *
 * A policy belongs to one product or variant. It deliberately contains no
 * brand-specific behavior: source adapters normalize their data at the import
 * boundary, while every runtime consumer evaluates the same constraints.
 *
 * Clauses are OR-ed. Constraints inside a clause are AND-ed. Multiple values
 * inside one EXACT constraint are alternatives for that single dimension.
 */

export const SHOP_CATALOG_V2_COMPATIBILITY_VERSION = 2 as const;

export const SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS = [
  "scope",
  "make",
  "model",
  "generation",
  "chassis",
  "year",
  "engine",
  "fuel",
  "bodyStyle",
  "drivetrain",
  "transmission",
  "market",
  "opfGpf",
] as const;

export type ShopCatalogV2CompatibilityDimension =
  (typeof SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS)[number];

export const SHOP_CATALOG_V2_CONSTRAINT_STATES = [
  "EXACT",
  "ANY",
  "NOT_APPLICABLE",
  "UNKNOWN",
] as const;

export type ShopCatalogV2ConstraintState = (typeof SHOP_CATALOG_V2_CONSTRAINT_STATES)[number];
export type ShopCatalogV2NonExactConstraintState = Exclude<ShopCatalogV2ConstraintState, "EXACT">;

export const SHOP_CATALOG_V2_COMPATIBILITY_MODES = [
  "VEHICLE_SPECIFIC",
  "UNIVERSAL",
  "PARENT_DEPENDENT",
  "NEEDS_REVIEW",
] as const;

export type ShopCatalogV2CompatibilityMode = (typeof SHOP_CATALOG_V2_COMPATIBILITY_MODES)[number];

export type ShopCatalogV2YearRange = {
  from: number | null;
  to: number | null;
};

export type ShopCatalogV2CompatibilityValue = string | number | boolean | ShopCatalogV2YearRange;
export type ShopCatalogV2CompatibilityQueryValue = string | number | boolean;

export type ShopCatalogV2ExactConstraint = {
  dimension: ShopCatalogV2CompatibilityDimension;
  state: "EXACT";
  values: readonly ShopCatalogV2CompatibilityValue[];
};

export type ShopCatalogV2NonExactConstraint = {
  dimension: ShopCatalogV2CompatibilityDimension;
  state: ShopCatalogV2NonExactConstraintState;
};

export type ShopCatalogV2CompatibilityConstraint =
  | ShopCatalogV2ExactConstraint
  | ShopCatalogV2NonExactConstraint;

export type ShopCatalogV2CompatibilityVerification = "VERIFIED" | "INFERRED" | "NEEDS_REVIEW";

export type ShopCatalogV2CompatibilityClause = {
  id: string;
  /** All constraints in one clause must match. */
  constraints: readonly ShopCatalogV2CompatibilityConstraint[];
  verification: ShopCatalogV2CompatibilityVerification;
  sourceRef?: string | null;
};

export type ShopCatalogV2CompatibilityTarget = {
  productId: string;
  variantId?: string | null;
};

export type ShopCatalogV2CompatibilityPolicy = {
  version: typeof SHOP_CATALOG_V2_COMPATIBILITY_VERSION;
  mode: ShopCatalogV2CompatibilityMode;
  target: ShopCatalogV2CompatibilityTarget;
  /** Canonical parent identity; populated only for PARENT_DEPENDENT. */
  parentTarget?: ShopCatalogV2CompatibilityTarget | null;
  /**
   * Dimensions a customer must select before this target can receive an exact
   * compatibility result. This is product/variant policy, never brand policy.
   */
  requiredDimensions: readonly ShopCatalogV2CompatibilityDimension[];
  /** State used when a clause has no explicit value for a dimension. */
  dimensionDefaults?: Partial<
    Record<ShopCatalogV2CompatibilityDimension, ShopCatalogV2NonExactConstraintState>
  >;
  /** Any matching clause is sufficient. */
  clauses: readonly ShopCatalogV2CompatibilityClause[];
};

export type ShopCatalogV2CompatibilityQuery = Partial<
  Record<ShopCatalogV2CompatibilityDimension, ShopCatalogV2CompatibilityQueryValue>
>;

export type ShopCatalogV2StrictMatchStatus =
  | "exact"
  | "requires_input"
  | "requires_verification"
  | "no_match";

export type ShopCatalogV2StrictMatchResult = {
  status: ShopCatalogV2StrictMatchStatus;
  clauseIds: string[];
  missingDimensions: ShopCatalogV2CompatibilityDimension[];
  unknownDimensions: ShopCatalogV2CompatibilityDimension[];
  validationErrors: string[];
};

const DIMENSION_SET = new Set<string>(SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS);
const MODE_SET = new Set<string>(SHOP_CATALOG_V2_COMPATIBILITY_MODES);

function isDimension(value: unknown): value is ShopCatalogV2CompatibilityDimension {
  return typeof value === "string" && DIMENSION_SET.has(value);
}

function isYearRange(value: ShopCatalogV2CompatibilityValue): value is ShopCatalogV2YearRange {
  return typeof value === "object" && value !== null && "from" in value && "to" in value;
}

function validYear(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 1886 && value <= 2200);
}

function validYearRange(value: ShopCatalogV2YearRange) {
  return (
    validYear(value.from) &&
    validYear(value.to) &&
    (value.from !== null || value.to !== null) &&
    (value.from === null || value.to === null || value.to >= value.from)
  );
}

function hasQueryValue(value: ShopCatalogV2CompatibilityQueryValue | null | undefined) {
  return value !== undefined && value !== null && !(typeof value === "string" && !value.trim());
}

function exactValueMatches(
  expected: ShopCatalogV2CompatibilityValue,
  actual: ShopCatalogV2CompatibilityQueryValue
) {
  if (isYearRange(expected)) {
    return (
      typeof actual === "number" &&
      Number.isInteger(actual) &&
      (expected.from === null || actual >= expected.from) &&
      (expected.to === null || actual <= expected.to)
    );
  }
  return expected === actual;
}

export function validateShopCatalogV2CompatibilityPolicy(
  policy: ShopCatalogV2CompatibilityPolicy
): string[] {
  const errors: string[] = [];
  if (policy.version !== SHOP_CATALOG_V2_COMPATIBILITY_VERSION) {
    errors.push(`version must be ${SHOP_CATALOG_V2_COMPATIBILITY_VERSION}`);
  }
  if (!MODE_SET.has(policy.mode)) errors.push(`unknown compatibility mode ${String(policy.mode)}`);
  if (!policy.target.productId.trim()) errors.push("target.productId is required");
  if (policy.target.variantId !== undefined && policy.target.variantId !== null) {
    if (!policy.target.variantId.trim()) errors.push("target.variantId must not be empty");
  }

  const parentTarget = policy.parentTarget ?? null;
  if (policy.mode === "PARENT_DEPENDENT") {
    if (!parentTarget?.productId.trim()) {
      errors.push("parentTarget.productId is required for PARENT_DEPENDENT");
    }
    if (
      parentTarget?.variantId !== undefined &&
      parentTarget.variantId !== null &&
      !parentTarget.variantId.trim()
    ) {
      errors.push("parentTarget.variantId must not be empty");
    }
    if (
      parentTarget?.productId.trim() === policy.target.productId.trim() &&
      (parentTarget?.variantId?.trim() || null) === (policy.target.variantId?.trim() || null)
    ) {
      errors.push("PARENT_DEPENDENT target cannot inherit from itself");
    }
    if (policy.clauses.length) {
      errors.push("PARENT_DEPENDENT policy cannot contain direct compatibility clauses");
    }
  } else if (parentTarget) {
    errors.push("parentTarget is only allowed for PARENT_DEPENDENT");
  }

  if (policy.mode === "VEHICLE_SPECIFIC" && !policy.clauses.length) {
    errors.push("VEHICLE_SPECIFIC policy requires at least one compatibility clause");
  }
  if (policy.mode === "UNIVERSAL" && policy.clauses.length !== 1) {
    errors.push("UNIVERSAL policy requires exactly one explicit compatibility clause");
  }

  const required = new Set<ShopCatalogV2CompatibilityDimension>();
  for (const dimension of policy.requiredDimensions) {
    if (!isDimension(dimension)) {
      errors.push(`unknown required dimension ${String(dimension)}`);
    } else if (required.has(dimension)) {
      errors.push(`duplicate required dimension ${dimension}`);
    } else {
      required.add(dimension);
    }
  }

  const clauseIds = new Set<string>();
  for (const [clauseIndex, clause] of policy.clauses.entries()) {
    const path = `clauses.${clauseIndex}`;
    if (!clause.id.trim()) errors.push(`${path}.id is required`);
    if (clauseIds.has(clause.id)) errors.push(`duplicate clause id ${clause.id}`);
    clauseIds.add(clause.id);

    const dimensions = new Set<ShopCatalogV2CompatibilityDimension>();
    for (const [constraintIndex, constraint] of clause.constraints.entries()) {
      const constraintPath = `${path}.constraints.${constraintIndex}`;
      if (!isDimension(constraint.dimension)) {
        errors.push(`${constraintPath}.dimension is invalid`);
        continue;
      }
      if (dimensions.has(constraint.dimension)) {
        errors.push(`${path} has duplicate ${constraint.dimension} constraints`);
      }
      dimensions.add(constraint.dimension);

      if (constraint.state === "EXACT") {
        if (!constraint.values.length) {
          errors.push(`${constraintPath}.values must not be empty for EXACT`);
        }
        for (const value of constraint.values) {
          if (isYearRange(value) && !validYearRange(value)) {
            errors.push(`${constraintPath} contains an invalid year range`);
          }
        }
      }
    }
  }

  if (policy.mode === "UNIVERSAL" && policy.clauses.length === 1) {
    const clause = policy.clauses[0];
    if (policy.requiredDimensions.length) {
      errors.push("UNIVERSAL policy cannot require vehicle dimensions");
    }
    if (clause.verification !== "VERIFIED") {
      errors.push("UNIVERSAL policy must be explicitly VERIFIED");
    }
    const constraints = new Map(
      clause.constraints.map((constraint) => [constraint.dimension, constraint] as const)
    );
    for (const dimension of SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS) {
      const constraint = constraints.get(dimension);
      if (!constraint) {
        errors.push(`UNIVERSAL policy must explicitly define ${dimension}`);
        continue;
      }
      if (dimension === "scope") {
        const scope = constraint.state === "EXACT" ? constraint.values : [];
        if (
          scope.length !== 1 ||
          typeof scope[0] !== "string" ||
          (scope[0] !== "auto" && scope[0] !== "moto")
        ) {
          errors.push("UNIVERSAL policy scope must be one explicit auto or moto value");
        }
      } else if (constraint.state !== "ANY" && constraint.state !== "NOT_APPLICABLE") {
        errors.push(`UNIVERSAL policy ${dimension} must be ANY or NOT_APPLICABLE`);
      }
    }
  }

  return errors;
}

/**
 * Evaluates exact compatibility without fuzzy aliases or brand fallbacks.
 * Aliases must be resolved to canonical values before calling this function.
 */
export function strictMatchShopCatalogV2Compatibility(
  policy: ShopCatalogV2CompatibilityPolicy,
  query: ShopCatalogV2CompatibilityQuery
): ShopCatalogV2StrictMatchResult {
  const validationErrors = validateShopCatalogV2CompatibilityPolicy(policy);
  if (validationErrors.length) {
    return {
      status: "requires_verification",
      clauseIds: [],
      missingDimensions: [],
      unknownDimensions: [],
      validationErrors,
    };
  }

  if (policy.mode === "NEEDS_REVIEW" || policy.mode === "PARENT_DEPENDENT") {
    return {
      status: "requires_verification",
      clauseIds: policy.clauses.map((clause) => clause.id),
      missingDimensions: [],
      unknownDimensions: [],
      validationErrors: [],
    };
  }

  const missingDimensions = policy.requiredDimensions.filter(
    (dimension) => !hasQueryValue(query[dimension])
  );
  if (missingDimensions.length) {
    return {
      status: "requires_input",
      clauseIds: [],
      missingDimensions: [...missingDimensions],
      unknownDimensions: [],
      validationErrors: [],
    };
  }

  const requested = SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.filter((dimension) =>
    hasQueryValue(query[dimension])
  );
  const exactClauseIds: string[] = [];
  const reviewClauseIds: string[] = [];
  const unknownDimensions = new Set<ShopCatalogV2CompatibilityDimension>();

  for (const clause of policy.clauses) {
    const constraints = new Map(
      clause.constraints.map((constraint) => [constraint.dimension, constraint] as const)
    );
    let contradicts = false;
    const clauseUnknown = new Set<ShopCatalogV2CompatibilityDimension>();

    for (const dimension of requested) {
      const actual = query[dimension]!;
      const constraint =
        constraints.get(dimension) ??
        ({
          dimension,
          state: policy.dimensionDefaults?.[dimension] ?? "UNKNOWN",
        } satisfies ShopCatalogV2NonExactConstraint);

      if (constraint.state === "EXACT") {
        if (!constraint.values.some((value) => exactValueMatches(value, actual))) {
          contradicts = true;
          break;
        }
      } else if (constraint.state === "UNKNOWN") {
        clauseUnknown.add(dimension);
      }
      // ANY and NOT_APPLICABLE are explicit, verified non-restrictions.
    }

    if (contradicts) continue;
    if (clause.verification === "VERIFIED" && clauseUnknown.size === 0) {
      exactClauseIds.push(clause.id);
      continue;
    }

    reviewClauseIds.push(clause.id);
    for (const dimension of clauseUnknown) unknownDimensions.add(dimension);
  }

  if (exactClauseIds.length) {
    return {
      status: "exact",
      clauseIds: exactClauseIds,
      missingDimensions: [],
      unknownDimensions: [],
      validationErrors: [],
    };
  }
  if (reviewClauseIds.length) {
    return {
      status: "requires_verification",
      clauseIds: reviewClauseIds,
      missingDimensions: [],
      unknownDimensions: [...unknownDimensions],
      validationErrors: [],
    };
  }
  return {
    status: "no_match",
    clauseIds: [],
    missingDimensions: [],
    unknownDimensions: [],
    validationErrors: [],
  };
}

export type ShopCatalogV2LegacyApplication = {
  id?: unknown;
  vehicleType?: unknown;
  scope?: unknown;
  make?: unknown;
  model?: unknown;
  models?: unknown;
  generation?: unknown;
  generations?: unknown;
  chassis?: unknown;
  chassisCode?: unknown;
  chassisCodes?: unknown;
  yearFrom?: unknown;
  yearTo?: unknown;
  yearRanges?: unknown;
  engine?: unknown;
  engines?: unknown;
  fuel?: unknown;
  fuels?: unknown;
  bodyStyle?: unknown;
  bodyStyles?: unknown;
  drivetrain?: unknown;
  drivetrains?: unknown;
  transmission?: unknown;
  transmissions?: unknown;
  market?: unknown;
  markets?: unknown;
  opfGpf?: unknown;
};

export type ShopCatalogV2LegacyPolicyInput = {
  target: ShopCatalogV2CompatibilityTarget;
  mode?: ShopCatalogV2CompatibilityMode;
  parentTarget?: ShopCatalogV2CompatibilityTarget | null;
  applications: readonly ShopCatalogV2LegacyApplication[];
  requiredDimensions?: readonly ShopCatalogV2CompatibilityDimension[];
  dimensionDefaults?: Partial<
    Record<ShopCatalogV2CompatibilityDimension, ShopCatalogV2NonExactConstraintState>
  >;
  scope?: unknown;
  verification?: ShopCatalogV2CompatibilityVerification;
  sourceRef?: string | null;
};

export type ShopCatalogV2LegacyQueryInput = {
  vehicleType?: unknown;
  scope?: unknown;
  make?: unknown;
  model?: unknown;
  generation?: unknown;
  chassis?: unknown;
  chassisCode?: unknown;
  year?: unknown;
  engine?: unknown;
  fuel?: unknown;
  bodyStyle?: unknown;
  drivetrain?: unknown;
  transmission?: unknown;
  market?: unknown;
  opfGpf?: unknown;
};

export type ShopCatalogV2LegacyTextNormalizer = (
  value: string,
  dimension: ShopCatalogV2CompatibilityDimension
) => string;

/** Boundary-only normalization for historical labels. It is intentionally not fuzzy. */
export function normalizeShopCatalogV2LegacyText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function legacyStrings(
  values: unknown[],
  dimension: ShopCatalogV2CompatibilityDimension,
  normalizeText: ShopCatalogV2LegacyTextNormalizer
) {
  const normalized = values.flatMap((value) => {
    const items = Array.isArray(value) ? value : [value];
    return items
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map((item) => normalizeText(item, dimension))
      .filter(Boolean);
  });
  return Array.from(new Set(normalized));
}

function legacyYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1886 && parsed <= 2200 ? parsed : null;
}

function legacyYearRanges(application: ShopCatalogV2LegacyApplication) {
  const ranges = (Array.isArray(application.yearRanges) ? application.yearRanges : []).flatMap(
    (value): ShopCatalogV2YearRange[] => {
      if (!value || typeof value !== "object") return [];
      const source = value as { from?: unknown; to?: unknown };
      const from = legacyYear(source.from);
      const to = legacyYear(source.to);
      const range = { from, to };
      return validYearRange(range) ? [range] : [];
    }
  );
  const directRange = {
    from: legacyYear(application.yearFrom),
    to: legacyYear(application.yearTo),
  };
  if (validYearRange(directRange)) ranges.push(directRange);
  return Array.from(new Map(ranges.map((range) => [JSON.stringify(range), range])).values());
}

function legacyScope(
  application: ShopCatalogV2LegacyApplication,
  fallback: unknown,
  normalizeText: ShopCatalogV2LegacyTextNormalizer
) {
  const explicit = String(application.scope ?? fallback ?? "")
    .trim()
    .toLowerCase();
  if (explicit === "auto" || explicit === "moto") return explicit;
  if (application.vehicleType === "car") return normalizeText("auto", "scope");
  if (application.vehicleType === "motorcycle") return normalizeText("moto", "scope");
  return null;
}

function exactOrState(
  dimension: ShopCatalogV2CompatibilityDimension,
  values: readonly ShopCatalogV2CompatibilityValue[],
  defaults: ShopCatalogV2LegacyPolicyInput["dimensionDefaults"]
): ShopCatalogV2CompatibilityConstraint {
  if (values.length) return { dimension, state: "EXACT", values };
  return { dimension, state: defaults?.[dimension] ?? "UNKNOWN" };
}

/**
 * Converts the current nullable/string application shape into explicit V2
 * semantics. Missing legacy facts become UNKNOWN unless the product/variant
 * policy explicitly declares ANY or NOT_APPLICABLE.
 */
export function normalizeLegacyApplicationsToShopCatalogV2Policy(
  input: ShopCatalogV2LegacyPolicyInput,
  normalizeText: ShopCatalogV2LegacyTextNormalizer = (value) =>
    normalizeShopCatalogV2LegacyText(value)
): ShopCatalogV2CompatibilityPolicy {
  const clauses = input.applications.map((application, index) => {
    const values: Record<ShopCatalogV2CompatibilityDimension, ShopCatalogV2CompatibilityValue[]> = {
      scope: [],
      make: legacyStrings([application.make], "make", normalizeText),
      model: legacyStrings([application.model, application.models], "model", normalizeText),
      generation: legacyStrings(
        [application.generation, application.generations],
        "generation",
        normalizeText
      ),
      chassis: legacyStrings(
        [application.chassis, application.chassisCode, application.chassisCodes],
        "chassis",
        normalizeText
      ),
      year: legacyYearRanges(application),
      engine: legacyStrings([application.engine, application.engines], "engine", normalizeText),
      fuel: legacyStrings([application.fuel, application.fuels], "fuel", normalizeText),
      bodyStyle: legacyStrings(
        [application.bodyStyle, application.bodyStyles],
        "bodyStyle",
        normalizeText
      ),
      drivetrain: legacyStrings(
        [application.drivetrain, application.drivetrains],
        "drivetrain",
        normalizeText
      ),
      transmission: legacyStrings(
        [application.transmission, application.transmissions],
        "transmission",
        normalizeText
      ),
      market: legacyStrings([application.market, application.markets], "market", normalizeText),
      opfGpf:
        String(application.opfGpf ?? "").toLowerCase() === "unknown"
          ? []
          : legacyStrings([application.opfGpf], "opfGpf", normalizeText),
    };
    const scope = legacyScope(application, input.scope, normalizeText);
    if (scope) values.scope = [scope];

    return {
      id: String(application.id ?? `application-${index + 1}`).trim() || `application-${index + 1}`,
      constraints: SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension) =>
        exactOrState(dimension, values[dimension], input.dimensionDefaults)
      ),
      verification: input.verification ?? "NEEDS_REVIEW",
      sourceRef: input.sourceRef ?? null,
    } satisfies ShopCatalogV2CompatibilityClause;
  });

  return {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode: input.mode ?? "VEHICLE_SPECIFIC",
    target: {
      productId: input.target.productId.trim(),
      variantId: input.target.variantId?.trim() || null,
    },
    parentTarget: input.parentTarget
      ? {
          productId: input.parentTarget.productId.trim(),
          variantId: input.parentTarget.variantId?.trim() || null,
        }
      : null,
    requiredDimensions: Array.from(new Set(input.requiredDimensions ?? [])),
    dimensionDefaults: input.dimensionDefaults,
    clauses,
  };
}

/** Converts existing URL/API-style vehicle fields into the canonical query map. */
export function normalizeLegacyShopCatalogV2Query(
  input: ShopCatalogV2LegacyQueryInput,
  normalizeText: ShopCatalogV2LegacyTextNormalizer = (value) =>
    normalizeShopCatalogV2LegacyText(value)
): ShopCatalogV2CompatibilityQuery {
  const query: ShopCatalogV2CompatibilityQuery = {};
  const text = (
    dimension: ShopCatalogV2CompatibilityDimension,
    ...values: unknown[]
  ): string | null => legacyStrings(values, dimension, normalizeText)[0] ?? null;
  const scope = legacyScope(
    { vehicleType: input.vehicleType, scope: input.scope },
    input.scope,
    normalizeText
  );
  if (scope) query.scope = scope;

  for (const [dimension, value] of [
    ["make", text("make", input.make)],
    ["model", text("model", input.model)],
    ["generation", text("generation", input.generation)],
    ["chassis", text("chassis", input.chassis, input.chassisCode)],
    ["engine", text("engine", input.engine)],
    ["fuel", text("fuel", input.fuel)],
    ["bodyStyle", text("bodyStyle", input.bodyStyle)],
    ["drivetrain", text("drivetrain", input.drivetrain)],
    ["transmission", text("transmission", input.transmission)],
    ["market", text("market", input.market)],
  ] as const) {
    if (value) query[dimension] = value;
  }

  const opfGpf = text("opfGpf", input.opfGpf);
  if (opfGpf && opfGpf !== "unknown") query.opfGpf = opfGpf;
  const year = legacyYear(input.year);
  if (year !== null) query.year = year;
  return query;
}
