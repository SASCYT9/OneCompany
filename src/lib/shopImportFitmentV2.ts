import {
  SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS,
  SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
  SHOP_CATALOG_V2_CONSTRAINT_STATES,
  type ShopCatalogV2CompatibilityConstraint,
  type ShopCatalogV2CompatibilityDimension,
  type ShopCatalogV2CompatibilityMode,
  type ShopCatalogV2CompatibilityPolicy,
  type ShopCatalogV2CompatibilityTarget,
  type ShopCatalogV2CompatibilityVerification,
  type ShopCatalogV2YearRange,
} from "@/lib/shopCatalogV2Compatibility";
import type { NormalizedFitment, VehicleApplication } from "@/lib/shopFitmentQuality";
import type {
  SupplierFitmentApplication,
  SupplierFitmentMode,
  SupplierFitmentV1Contract,
} from "@/lib/shopImportFitment";

export const SUPPLIER_FITMENT_V2_VERSION = 2 as const;
export const SUPPLIER_FITMENT_DIMENSIONS = SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS;
export const SUPPLIER_FITMENT_CONSTRAINT_STATES = SHOP_CATALOG_V2_CONSTRAINT_STATES;

export type SupplierFitmentDimension = ShopCatalogV2CompatibilityDimension;
export type SupplierFitmentConstraintState = (typeof SUPPLIER_FITMENT_CONSTRAINT_STATES)[number];
export type SupplierFitmentNonExactState = Exclude<SupplierFitmentConstraintState, "EXACT">;
export type SupplierFitmentVerification = ShopCatalogV2CompatibilityVerification;
type SupplierFitmentTextDimension = Exclude<SupplierFitmentDimension, "year">;

export type SupplierFitmentV2Source = {
  supplier: string;
  sourceRef: string;
  sourceUpdatedAt: string | null;
  sourceKey: string;
  sourceRecordKey: string;
  sourceRevision: string | null;
  payloadHash: string | null;
  mapperVersion: string;
};

export type SupplierFitmentV2ClauseProvenance = {
  sourceRef: string;
  sourceRecordKey: string;
  rawPaths: string[];
  evidenceRefs: string[];
};

export type SupplierFitmentV2ExactConstraint =
  | {
      dimension: SupplierFitmentTextDimension;
      state: "EXACT";
      values: string[];
    }
  | {
      dimension: "year";
      state: "EXACT";
      values: ShopCatalogV2YearRange[];
    };

export type SupplierFitmentV2NonExactConstraint = {
  dimension: SupplierFitmentDimension;
  state: SupplierFitmentNonExactState;
};

export type SupplierFitmentV2Constraint =
  | SupplierFitmentV2ExactConstraint
  | SupplierFitmentV2NonExactConstraint;

export type SupplierFitmentV2Clause = {
  id: string;
  /** Constraints in one clause are AND-ed. */
  constraints: SupplierFitmentV2Constraint[];
  verification: SupplierFitmentVerification;
  provenance: SupplierFitmentV2ClauseProvenance;
};

export type SupplierFitmentV2Policy = {
  requiredDimensions: SupplierFitmentDimension[];
  /** Clauses are OR-ed. */
  clauses: SupplierFitmentV2Clause[];
};

export type SupplierFitmentV2Contract = {
  version: typeof SUPPLIER_FITMENT_V2_VERSION;
  mode: SupplierFitmentMode;
  scope: "auto" | "moto";
  policy: SupplierFitmentV2Policy;
  parentSku: string | null;
  source: SupplierFitmentV2Source;
  note: string | null;
};

export type SupplierFitmentV2ValidationError = {
  code:
    | "INVALID_OBJECT"
    | "UNKNOWN_FIELD"
    | "INVALID_VERSION"
    | "INVALID_MODE"
    | "INVALID_SCOPE"
    | "MISSING_SOURCE"
    | "INVALID_SOURCE_DATE"
    | "INVALID_PROVENANCE"
    | "MISSING_APPLICATION"
    | "SCOPE_MISMATCH"
    | "INVALID_YEAR_RANGE"
    | "UNEXPECTED_APPLICATION"
    | "MISSING_PARENT_SKU"
    | "INVALID_POLICY"
    | "INVALID_CLAUSE"
    | "DUPLICATE_CLAUSE"
    | "INVALID_CONSTRAINT"
    | "MISSING_CONSTRAINT"
    | "DUPLICATE_CONSTRAINT";
  path: string;
  message: string;
};

type ValidationResult = {
  data: SupplierFitmentV2Contract | null;
  errors: SupplierFitmentV2ValidationError[];
};

const DIMENSION_SET = new Set<string>(SUPPLIER_FITMENT_DIMENSIONS);
const STATE_SET = new Set<string>(SUPPLIER_FITMENT_CONSTRAINT_STATES);
const VERIFICATION_SET = new Set<string>(["VERIFIED", "INFERRED", "NEEDS_REVIEW"]);
const MODE_SET = new Set<string>([
  "vehicle_specific",
  "universal",
  "parent_dependent",
  "needs_review",
]);
const CATALOG_MODE_BY_SUPPLIER_MODE: Record<SupplierFitmentMode, ShopCatalogV2CompatibilityMode> = {
  vehicle_specific: "VEHICLE_SPECIFIC",
  universal: "UNIVERSAL",
  parent_dependent: "PARENT_DEPENDENT",
  needs_review: "NEEDS_REVIEW",
};

function text(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: SupplierFitmentV2ValidationError[]
) {
  const allowedFields = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      errors.push({
        code: "UNKNOWN_FIELD",
        path: path ? `${path}.${key}` : key,
        message: `Unknown fitment field ${key}`,
      });
    }
  }
}

function normalizeStringArray(
  value: unknown,
  path: string,
  code: SupplierFitmentV2ValidationError["code"],
  errors: SupplierFitmentV2ValidationError[],
  requireOne: boolean
) {
  if (!Array.isArray(value)) {
    errors.push({ code, path, message: `${path} must be an array` });
    return [];
  }
  const normalized = value.map(text).filter((item): item is string => Boolean(item));
  if (normalized.length !== value.length || (requireOne && normalized.length === 0)) {
    errors.push({ code, path, message: `${path} must contain non-empty strings` });
  }
  return Array.from(new Set(normalized));
}

function normalizeSource(
  value: unknown,
  errors: SupplierFitmentV2ValidationError[]
): SupplierFitmentV2Source | null {
  if (!isRecord(value)) {
    errors.push({ code: "MISSING_SOURCE", path: "source", message: "source must be an object" });
    return null;
  }
  rejectUnknownFields(
    value,
    [
      "supplier",
      "sourceRef",
      "sourceUpdatedAt",
      "sourceKey",
      "sourceRecordKey",
      "sourceRevision",
      "payloadHash",
      "mapperVersion",
    ],
    "source",
    errors
  );
  const supplier = text(value.supplier);
  const sourceRef = text(value.sourceRef);
  const sourceKey = text(value.sourceKey);
  const sourceRecordKey = text(value.sourceRecordKey);
  const mapperVersion = text(value.mapperVersion);
  if (!supplier || !sourceRef || !sourceKey || !sourceRecordKey || !mapperVersion) {
    errors.push({
      code: "MISSING_SOURCE",
      path: "source",
      message: "V2 requires supplier, sourceRef, sourceKey, sourceRecordKey, and mapperVersion",
    });
  }
  const sourceUpdatedAt = text(value.sourceUpdatedAt);
  if (sourceUpdatedAt && Number.isNaN(Date.parse(sourceUpdatedAt))) {
    errors.push({
      code: "INVALID_SOURCE_DATE",
      path: "source.sourceUpdatedAt",
      message: "sourceUpdatedAt must be an ISO date-time",
    });
  }
  const payloadHash = text(value.payloadHash)?.toLowerCase() ?? null;
  if (payloadHash && !/^[0-9a-f]{64}$/.test(payloadHash)) {
    errors.push({
      code: "INVALID_PROVENANCE",
      path: "source.payloadHash",
      message: "payloadHash must be a lowercase SHA-256 hex digest",
    });
  }
  if (!supplier || !sourceRef || !sourceKey || !sourceRecordKey || !mapperVersion) return null;
  return {
    supplier,
    sourceRef,
    sourceUpdatedAt,
    sourceKey,
    sourceRecordKey,
    sourceRevision: text(value.sourceRevision),
    payloadHash,
    mapperVersion,
  };
}

function normalizeProvenance(
  value: unknown,
  clauseIndex: number,
  errors: SupplierFitmentV2ValidationError[]
): SupplierFitmentV2ClauseProvenance | null {
  const path = `policy.clauses.${clauseIndex}.provenance`;
  if (!isRecord(value)) {
    errors.push({ code: "INVALID_PROVENANCE", path, message: "Clause provenance is required" });
    return null;
  }
  rejectUnknownFields(
    value,
    ["sourceRef", "sourceRecordKey", "rawPaths", "evidenceRefs"],
    path,
    errors
  );
  const sourceRef = text(value.sourceRef);
  const sourceRecordKey = text(value.sourceRecordKey);
  const rawPaths = normalizeStringArray(
    value.rawPaths,
    `${path}.rawPaths`,
    "INVALID_PROVENANCE",
    errors,
    true
  );
  const evidenceRefs = normalizeStringArray(
    value.evidenceRefs,
    `${path}.evidenceRefs`,
    "INVALID_PROVENANCE",
    errors,
    false
  );
  if (!sourceRef || !sourceRecordKey) {
    errors.push({
      code: "INVALID_PROVENANCE",
      path,
      message: "sourceRef and sourceRecordKey are required",
    });
    return null;
  }
  return { sourceRef, sourceRecordKey, rawPaths, evidenceRefs };
}

function validYear(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 1886 && value <= 2200)
  );
}

function normalizeYearRange(
  value: unknown,
  path: string,
  errors: SupplierFitmentV2ValidationError[]
): ShopCatalogV2YearRange | null {
  if (!isRecord(value)) {
    errors.push({ code: "INVALID_YEAR_RANGE", path, message: "Year value must be { from, to }" });
    return null;
  }
  rejectUnknownFields(value, ["from", "to"], path, errors);
  const from = value.from === undefined ? null : value.from;
  const to = value.to === undefined ? null : value.to;
  if (
    !validYear(from) ||
    !validYear(to) ||
    (from === null && to === null) ||
    (from !== null && to !== null && to < from)
  ) {
    errors.push({
      code: "INVALID_YEAR_RANGE",
      path,
      message: "Year range needs at least one bound between 1886 and 2200",
    });
    return null;
  }
  return { from, to };
}

function normalizeConstraint(
  value: unknown,
  clauseIndex: number,
  constraintIndex: number,
  errors: SupplierFitmentV2ValidationError[]
): SupplierFitmentV2Constraint | null {
  const path = `policy.clauses.${clauseIndex}.constraints.${constraintIndex}`;
  if (!isRecord(value)) {
    errors.push({ code: "INVALID_CONSTRAINT", path, message: "Constraint must be an object" });
    return null;
  }
  const dimension = value.dimension;
  const state = value.state;
  if (typeof dimension !== "string" || !DIMENSION_SET.has(dimension)) {
    errors.push({
      code: "INVALID_CONSTRAINT",
      path: `${path}.dimension`,
      message: `Unknown compatibility dimension ${String(dimension)}`,
    });
    return null;
  }
  if (typeof state !== "string" || !STATE_SET.has(state)) {
    errors.push({
      code: "INVALID_CONSTRAINT",
      path: `${path}.state`,
      message: "State must be EXACT, ANY, NOT_APPLICABLE, or UNKNOWN",
    });
    return null;
  }
  if (state !== "EXACT") {
    rejectUnknownFields(value, ["dimension", "state"], path, errors);
    return {
      dimension: dimension as SupplierFitmentDimension,
      state: state as SupplierFitmentNonExactState,
    };
  }
  rejectUnknownFields(value, ["dimension", "state", "values"], path, errors);
  if (!Array.isArray(value.values) || value.values.length === 0) {
    errors.push({
      code: "INVALID_CONSTRAINT",
      path: `${path}.values`,
      message: "EXACT requires at least one value",
    });
    return null;
  }
  if (dimension === "year") {
    const values: ShopCatalogV2YearRange[] = [];
    for (const [valueIndex, rawValue] of value.values.entries()) {
      const normalized = normalizeYearRange(rawValue, `${path}.values.${valueIndex}`, errors);
      if (normalized) values.push(normalized);
    }
    const uniqueValues = Array.from(
      new Map(values.map((item) => [JSON.stringify(item), item])).values()
    );
    return uniqueValues.length ? { dimension: "year", state: "EXACT", values: uniqueValues } : null;
  }
  const values: string[] = [];
  for (const [valueIndex, rawValue] of value.values.entries()) {
    const normalized = typeof rawValue === "string" ? text(rawValue) : null;
    if (!normalized) {
      errors.push({
        code: "INVALID_CONSTRAINT",
        path: `${path}.values.${valueIndex}`,
        message: `${dimension} EXACT values must be non-empty strings`,
      });
    } else {
      values.push(normalized);
    }
  }
  const uniqueValues = Array.from(new Set(values));
  return uniqueValues.length
    ? {
        dimension: dimension as SupplierFitmentTextDimension,
        state: "EXACT",
        values: uniqueValues,
      }
    : null;
}

function normalizeClause(
  value: unknown,
  index: number,
  errors: SupplierFitmentV2ValidationError[]
): SupplierFitmentV2Clause | null {
  const path = `policy.clauses.${index}`;
  if (!isRecord(value)) {
    errors.push({ code: "INVALID_CLAUSE", path, message: "Clause must be an object" });
    return null;
  }
  rejectUnknownFields(value, ["id", "constraints", "verification", "provenance"], path, errors);
  const id = text(value.id);
  const verification = text(value.verification);
  if (!id)
    errors.push({ code: "INVALID_CLAUSE", path: `${path}.id`, message: "Clause id is required" });
  if (!verification || !VERIFICATION_SET.has(verification)) {
    errors.push({
      code: "INVALID_CLAUSE",
      path: `${path}.verification`,
      message: "verification must be VERIFIED, INFERRED, or NEEDS_REVIEW",
    });
  }
  if (!Array.isArray(value.constraints)) {
    errors.push({
      code: "INVALID_CLAUSE",
      path: `${path}.constraints`,
      message: "constraints must be an array",
    });
  }
  const constraints = (Array.isArray(value.constraints) ? value.constraints : [])
    .map((constraint, constraintIndex) =>
      normalizeConstraint(constraint, index, constraintIndex, errors)
    )
    .filter((constraint): constraint is SupplierFitmentV2Constraint => Boolean(constraint));
  const seen = new Set<SupplierFitmentDimension>();
  for (const [constraintIndex, constraint] of constraints.entries()) {
    if (seen.has(constraint.dimension)) {
      errors.push({
        code: "DUPLICATE_CONSTRAINT",
        path: `${path}.constraints.${constraintIndex}`,
        message: `Clause contains duplicate ${constraint.dimension} constraint`,
      });
    }
    seen.add(constraint.dimension);
  }
  for (const dimension of SUPPLIER_FITMENT_DIMENSIONS) {
    if (!seen.has(dimension)) {
      errors.push({
        code: "MISSING_CONSTRAINT",
        path: `${path}.constraints`,
        message: `Clause must explicitly define ${dimension}`,
      });
    }
  }
  const provenance = normalizeProvenance(value.provenance, index, errors);
  if (!id || !verification || !VERIFICATION_SET.has(verification) || !provenance) return null;
  return {
    id,
    constraints,
    verification: verification as SupplierFitmentVerification,
    provenance,
  };
}

export function normalizeSupplierFitmentV2Contract(input: unknown): ValidationResult {
  const errors: SupplierFitmentV2ValidationError[] = [];
  if (!isRecord(input)) {
    return {
      data: null,
      errors: [{ code: "INVALID_OBJECT", path: "fitment", message: "fitment must be an object" }],
    };
  }
  rejectUnknownFields(
    input,
    ["version", "mode", "scope", "policy", "parentSku", "source", "note"],
    "",
    errors
  );
  if (Number(input.version) !== SUPPLIER_FITMENT_V2_VERSION) {
    errors.push({ code: "INVALID_VERSION", path: "version", message: "fitment.version must be 2" });
  }
  const modeValue = String(input.mode ?? "");
  const mode = MODE_SET.has(modeValue) ? (modeValue as SupplierFitmentMode) : null;
  if (!mode) errors.push({ code: "INVALID_MODE", path: "mode", message: "Unknown fitment mode" });
  const scope = input.scope === "auto" || input.scope === "moto" ? input.scope : null;
  if (!scope)
    errors.push({ code: "INVALID_SCOPE", path: "scope", message: "scope must be auto or moto" });
  const source = normalizeSource(input.source, errors);
  const parentSku = text(input.parentSku);

  const policyInput = isRecord(input.policy) ? input.policy : null;
  if (!policyInput) {
    errors.push({ code: "INVALID_POLICY", path: "policy", message: "policy must be an object" });
  } else {
    rejectUnknownFields(policyInput, ["requiredDimensions", "clauses"], "policy", errors);
  }
  const requiredDimensions: SupplierFitmentDimension[] = [];
  if (!policyInput || !Array.isArray(policyInput.requiredDimensions)) {
    errors.push({
      code: "INVALID_POLICY",
      path: "policy.requiredDimensions",
      message: "requiredDimensions must be an array",
    });
  } else {
    const seen = new Set<SupplierFitmentDimension>();
    for (const [index, rawDimension] of policyInput.requiredDimensions.entries()) {
      if (typeof rawDimension !== "string" || !DIMENSION_SET.has(rawDimension)) {
        errors.push({
          code: "INVALID_POLICY",
          path: `policy.requiredDimensions.${index}`,
          message: `Unknown compatibility dimension ${String(rawDimension)}`,
        });
        continue;
      }
      const dimension = rawDimension as SupplierFitmentDimension;
      if (seen.has(dimension)) {
        errors.push({
          code: "INVALID_POLICY",
          path: `policy.requiredDimensions.${index}`,
          message: `Duplicate required dimension ${dimension}`,
        });
        continue;
      }
      seen.add(dimension);
      requiredDimensions.push(dimension);
    }
  }
  if (!policyInput || !Array.isArray(policyInput.clauses)) {
    errors.push({
      code: "INVALID_POLICY",
      path: "policy.clauses",
      message: "clauses must be an array",
    });
  }
  const clauses = (policyInput && Array.isArray(policyInput.clauses) ? policyInput.clauses : [])
    .map((clause, index) => normalizeClause(clause, index, errors))
    .filter((clause): clause is SupplierFitmentV2Clause => Boolean(clause));
  const clauseIds = new Set<string>();
  for (const [index, clause] of clauses.entries()) {
    if (clauseIds.has(clause.id)) {
      errors.push({
        code: "DUPLICATE_CLAUSE",
        path: `policy.clauses.${index}.id`,
        message: `Duplicate clause id ${clause.id}`,
      });
    }
    clauseIds.add(clause.id);
  }

  if (mode === "vehicle_specific" && clauses.length === 0) {
    errors.push({
      code: "MISSING_APPLICATION",
      path: "policy.clauses",
      message: "vehicle_specific fitment requires at least one clause",
    });
  }
  if (mode === "universal" && clauses.length !== 1) {
    errors.push({
      code: "INVALID_POLICY",
      path: "policy.clauses",
      message: "universal fitment requires exactly one explicit clause",
    });
  }
  if (mode === "universal" && clauses.length === 1) {
    const clause = clauses[0];
    if (requiredDimensions.length) {
      errors.push({
        code: "INVALID_POLICY",
        path: "policy.requiredDimensions",
        message: "universal fitment cannot require vehicle dimensions",
      });
    }
    if (clause.verification !== "VERIFIED") {
      errors.push({
        code: "INVALID_POLICY",
        path: "policy.clauses.0.verification",
        message: "universal fitment must be explicitly VERIFIED",
      });
    }
    for (const constraint of clause.constraints) {
      if (
        constraint.dimension !== "scope" &&
        constraint.state !== "ANY" &&
        constraint.state !== "NOT_APPLICABLE"
      ) {
        errors.push({
          code: "INVALID_POLICY",
          path: `policy.clauses.0.constraints.${constraint.dimension}`,
          message: `universal ${constraint.dimension} must be ANY or NOT_APPLICABLE`,
        });
      }
    }
  }
  if (mode === "parent_dependent" && clauses.length > 0) {
    errors.push({
      code: "UNEXPECTED_APPLICATION",
      path: "policy.clauses",
      message: "parent_dependent fitment cannot contain direct clauses",
    });
  }
  if (mode === "parent_dependent" && !parentSku) {
    errors.push({
      code: "MISSING_PARENT_SKU",
      path: "parentSku",
      message: "parent_dependent fitment requires parentSku",
    });
  }
  if (scope) {
    for (const [index, clause] of clauses.entries()) {
      const constraint = clause.constraints.find((item) => item.dimension === "scope");
      if (
        !constraint ||
        constraint.state !== "EXACT" ||
        constraint.values.length !== 1 ||
        constraint.values[0] !== scope
      ) {
        errors.push({
          code: "SCOPE_MISMATCH",
          path: `policy.clauses.${index}.constraints`,
          message: `Every direct clause must contain EXACT scope ${scope}`,
        });
      }
    }
  }
  if (
    errors.length ||
    !mode ||
    !scope ||
    !source ||
    Number(input.version) !== SUPPLIER_FITMENT_V2_VERSION
  ) {
    return { data: null, errors };
  }
  return {
    data: {
      version: SUPPLIER_FITMENT_V2_VERSION,
      mode,
      scope,
      policy: { requiredDimensions, clauses },
      parentSku: mode === "parent_dependent" ? parentSku : null,
      source,
      note: text(input.note),
    },
    errors: [],
  };
}

function exactText(
  dimension: SupplierFitmentTextDimension,
  value: string | null | undefined
): SupplierFitmentV2Constraint {
  return value ? { dimension, state: "EXACT", values: [value] } : { dimension, state: "UNKNOWN" };
}

function v1Constraints(
  application: SupplierFitmentApplication,
  scope: "auto" | "moto"
): SupplierFitmentV2Constraint[] {
  return [
    { dimension: "scope", state: "EXACT", values: [scope] },
    exactText("make", application.make),
    exactText("model", application.model),
    { dimension: "generation", state: "UNKNOWN" },
    exactText("chassis", application.chassisCode),
    application.yearFrom !== null || application.yearTo !== null
      ? {
          dimension: "year",
          state: "EXACT",
          values: [{ from: application.yearFrom, to: application.yearTo }],
        }
      : { dimension: "year", state: "UNKNOWN" },
    exactText("engine", application.engine),
    exactText("fuel", application.fuel),
    exactText("bodyStyle", application.bodyStyle),
    exactText("drivetrain", application.drivetrain),
    exactText("transmission", application.transmission),
    exactText("market", application.market),
    application.opfGpf === "unknown"
      ? { dimension: "opfGpf", state: "UNKNOWN" }
      : { dimension: "opfGpf", state: "EXACT", values: [application.opfGpf] },
  ];
}

function universalConstraints(scope: "auto" | "moto"): SupplierFitmentV2Constraint[] {
  return SUPPLIER_FITMENT_DIMENSIONS.map((dimension) =>
    dimension === "scope"
      ? { dimension, state: "EXACT", values: [scope] }
      : { dimension, state: "ANY" }
  );
}

function defaultSourceKey(supplier: string) {
  return (
    supplier
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "legacy-supplier"
  );
}

/**
 * Pure V1 -> V2 adapter. Missing/null V1 facts become UNKNOWN; only the
 * explicit universal mode becomes ANY. Atomic V1 applications stay separate
 * OR clauses, so no Cartesian make/model/chassis/engine pairs are invented.
 */
export function upgradeSupplierFitmentContractToV2(
  contract: SupplierFitmentV1Contract | SupplierFitmentV2Contract
): SupplierFitmentV2Contract {
  if (contract.version === SUPPLIER_FITMENT_V2_VERSION) return contract;
  const sourceRecordKey = contract.source.sourceRef;
  const provenance = (rawPaths: string[]): SupplierFitmentV2ClauseProvenance => ({
    sourceRef: contract.source.sourceRef,
    sourceRecordKey,
    rawPaths,
    evidenceRefs: [],
  });
  const clauses: SupplierFitmentV2Clause[] =
    contract.mode === "universal"
      ? [
          {
            id: "legacy-universal",
            constraints: universalConstraints(contract.scope),
            verification: "VERIFIED",
            provenance: provenance(["mode", "scope"]),
          },
        ]
      : contract.mode === "parent_dependent"
        ? []
        : contract.applications.map((application, index) => ({
            id: `legacy-${String(index + 1).padStart(4, "0")}`,
            constraints: v1Constraints(application, contract.scope),
            verification: "NEEDS_REVIEW",
            provenance: provenance([`applications.${index}`]),
          }));
  return {
    version: SUPPLIER_FITMENT_V2_VERSION,
    mode: contract.mode,
    scope: contract.scope,
    policy: { requiredDimensions: [], clauses },
    parentSku: contract.parentSku,
    source: {
      ...contract.source,
      sourceKey: defaultSourceKey(contract.source.supplier),
      sourceRecordKey,
      sourceRevision: null,
      payloadHash: null,
      mapperVersion: "supplier-fitment-v1-adapter/2",
    },
    note: contract.note,
  };
}

/**
 * Builds the common strict matcher policy without flattening clause
 * correlations. Parent-dependent input remains unresolved until its supplier
 * SKU has been mapped to an explicit canonical product/variant target.
 */
export function supplierFitmentV2ToShopCatalogV2Policy(
  contract: SupplierFitmentV2Contract,
  target: ShopCatalogV2CompatibilityTarget,
  resolvedParentTarget?: ShopCatalogV2CompatibilityTarget | null
): ShopCatalogV2CompatibilityPolicy | null {
  if (contract.mode === "parent_dependent" && !resolvedParentTarget?.productId.trim()) return null;
  if (contract.mode === "vehicle_specific" && contract.policy.clauses.length === 0) return null;
  const mode = CATALOG_MODE_BY_SUPPLIER_MODE[contract.mode];
  return {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode,
    target: {
      productId: target.productId.trim(),
      variantId: target.variantId?.trim() || null,
    },
    parentTarget:
      contract.mode === "parent_dependent" && resolvedParentTarget
        ? {
            productId: resolvedParentTarget.productId.trim(),
            variantId: resolvedParentTarget.variantId?.trim() || null,
          }
        : null,
    requiredDimensions: [...contract.policy.requiredDimensions],
    clauses: contract.policy.clauses.map((clause) => ({
      id: clause.id,
      constraints: clause.constraints.map(
        (constraint): ShopCatalogV2CompatibilityConstraint =>
          constraint.state === "EXACT"
            ? { ...constraint, values: [...constraint.values] }
            : { ...constraint }
      ),
      verification: clause.verification,
      sourceRef: clause.provenance.sourceRef,
    })),
  };
}

function exactStrings(clause: SupplierFitmentV2Clause, dimension: SupplierFitmentDimension) {
  const constraint = clause.constraints.find((item) => item.dimension === dimension);
  return constraint?.state === "EXACT"
    ? constraint.values.filter((item): item is string => typeof item === "string")
    : [];
}

function exactYears(clause: SupplierFitmentV2Clause): ShopCatalogV2YearRange[] {
  const constraint = clause.constraints.find((item) => item.dimension === "year");
  return constraint?.state === "EXACT"
    ? constraint.values.filter(
        (item): item is ShopCatalogV2YearRange => typeof item === "object" && item !== null
      )
    : [];
}

function clauseToVehicleApplication(
  clause: SupplierFitmentV2Clause,
  scope: "auto" | "moto"
): VehicleApplication | null {
  const make = exactStrings(clause, "make")[0];
  if (!make) return null;
  const opfGpf = exactStrings(clause, "opfGpf")[0];
  return {
    vehicleType: scope === "moto" ? "motorcycle" : "car",
    make,
    models: exactStrings(clause, "model"),
    chassisCodes: exactStrings(clause, "chassis"),
    yearRanges: exactYears(clause).flatMap((range) =>
      range.from === null ? [] : [{ from: range.from, to: range.to }]
    ),
    engines: exactStrings(clause, "engine"),
    fuel: exactStrings(clause, "fuel")[0] ?? null,
    bodyStyles: exactStrings(clause, "bodyStyle"),
    drivetrains: exactStrings(clause, "drivetrain"),
    markets: exactStrings(clause, "market"),
    transmission: exactStrings(clause, "transmission")[0] ?? null,
    opfGpf: opfGpf === "with" || opfGpf === "without" ? opfGpf : "unknown",
  };
}

/** Conservative legacy projection: only fully verified/non-UNKNOWN V2 is marked verified. */
export function supplierFitmentV2ToNormalizedFitment(
  contract: SupplierFitmentV2Contract
): NormalizedFitment {
  const universal = contract.mode === "universal";
  const applications =
    contract.mode === "vehicle_specific"
      ? contract.policy.clauses.flatMap((clause) => {
          const application = clauseToVehicleApplication(clause, contract.scope);
          return application ? [application] : [];
        })
      : [];
  const verified =
    contract.mode === "vehicle_specific" &&
    contract.policy.clauses.length > 0 &&
    applications.length === contract.policy.clauses.length &&
    contract.policy.clauses.every(
      (clause) =>
        clause.verification === "VERIFIED" &&
        clause.constraints.every((constraint) => constraint.state !== "UNKNOWN")
    );
  const primary = applications[0];
  return {
    version: 2,
    status: universal ? "universal" : verified ? "verified" : "needs_review",
    vehicleType: universal
      ? "universal"
      : contract.scope === "moto"
        ? "motorcycle"
        : contract.mode === "vehicle_specific"
          ? "car"
          : "unknown",
    make: primary?.make ?? null,
    models: primary?.models ?? [],
    chassisCodes: primary?.chassisCodes ?? [],
    yearRanges: primary?.yearRanges ?? [],
    applications,
    confidence: universal || verified ? "high" : "unknown",
    source: "import",
    verifiedAt: null,
    verifiedBy: null,
    note:
      contract.mode === "parent_dependent"
        ? `Compatibility inherited from parent SKU ${contract.parentSku}`
        : contract.note,
    dependency:
      contract.mode === "parent_dependent"
        ? { type: "parent_product", parentSku: contract.parentSku }
        : null,
  };
}
