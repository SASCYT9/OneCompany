import type { NormalizedFitment, VehicleApplication } from "@/lib/shopFitmentQuality";

export const SUPPLIER_FITMENT_NAMESPACE = "onecompany";
export const SUPPLIER_FITMENT_KEY = "supplier_fitment";
export const SUPPLIER_FITMENT_VERSION = 1;

export type SupplierFitmentMode =
  | "vehicle_specific"
  | "universal"
  | "parent_dependent"
  | "needs_review";

export type SupplierFitmentApplication = {
  vehicleType: "car" | "motorcycle";
  make: string;
  model: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engine: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  transmission: string | null;
  market: string | null;
  opfGpf: "with" | "without" | "unknown";
};

export type SupplierFitmentContract = {
  version: typeof SUPPLIER_FITMENT_VERSION;
  mode: SupplierFitmentMode;
  scope: "auto" | "moto";
  applications: SupplierFitmentApplication[];
  parentSku: string | null;
  source: {
    supplier: string;
    sourceRef: string;
    sourceUpdatedAt: string | null;
  };
  note: string | null;
};

export type SupplierFitmentValidationError = {
  code:
    | "INVALID_OBJECT"
    | "UNKNOWN_FIELD"
    | "INVALID_VERSION"
    | "INVALID_MODE"
    | "INVALID_SCOPE"
    | "MISSING_SOURCE"
    | "INVALID_SOURCE_DATE"
    | "MISSING_APPLICATION"
    | "INVALID_APPLICATION"
    | "SCOPE_MISMATCH"
    | "INVALID_YEAR_RANGE"
    | "DUPLICATE_APPLICATION"
    | "UNEXPECTED_APPLICATION"
    | "MISSING_PARENT_SKU";
  path: string;
  message: string;
};

function text(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function year(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: SupplierFitmentValidationError[]
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

function normalizeApplication(
  value: unknown,
  index: number,
  errors: SupplierFitmentValidationError[]
): SupplierFitmentApplication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push({
      code: "INVALID_APPLICATION",
      path: `applications.${index}`,
      message: "Application must be an object",
    });
    return null;
  }
  const row = value as Record<string, unknown>;
  rejectUnknownFields(
    row,
    [
      "vehicleType",
      "make",
      "model",
      "chassisCode",
      "yearFrom",
      "yearTo",
      "engine",
      "bodyStyle",
      "drivetrain",
      "transmission",
      "market",
      "opfGpf",
    ],
    `applications.${index}`,
    errors
  );
  const vehicleType =
    row.vehicleType === "motorcycle" ? "motorcycle" : row.vehicleType === "car" ? "car" : null;
  const make = text(row.make);
  const model = text(row.model);
  const chassisCode = text(row.chassisCode)?.toUpperCase() ?? null;
  const yearFrom = year(row.yearFrom);
  const yearTo = year(row.yearTo);
  if (!vehicleType || !make || (!model && !chassisCode)) {
    errors.push({
      code: "INVALID_APPLICATION",
      path: `applications.${index}`,
      message: "Application requires car/motorcycle vehicleType, make, and model or chassisCode",
    });
  }
  if (
    Number.isNaN(yearFrom) ||
    Number.isNaN(yearTo) ||
    (yearFrom !== null && (yearFrom < 1886 || yearFrom > 2200)) ||
    (yearTo !== null && (yearTo < 1886 || yearTo > 2200)) ||
    (yearFrom !== null && yearTo !== null && yearTo < yearFrom)
  ) {
    errors.push({
      code: "INVALID_YEAR_RANGE",
      path: `applications.${index}`,
      message: "yearFrom/yearTo must form a valid range between 1886 and 2200",
    });
  }
  const opfGpf = row.opfGpf ?? "unknown";
  if (!(opfGpf === "with" || opfGpf === "without" || opfGpf === "unknown")) {
    errors.push({
      code: "INVALID_APPLICATION",
      path: `applications.${index}.opfGpf`,
      message: "opfGpf must be with, without, or unknown",
    });
  }
  if (
    !vehicleType ||
    !make ||
    (!model && !chassisCode) ||
    Number.isNaN(yearFrom) ||
    Number.isNaN(yearTo) ||
    !(opfGpf === "with" || opfGpf === "without" || opfGpf === "unknown")
  ) {
    return null;
  }
  return {
    vehicleType,
    make,
    model,
    chassisCode,
    yearFrom,
    yearTo,
    engine: text(row.engine),
    bodyStyle: text(row.bodyStyle),
    drivetrain: text(row.drivetrain),
    transmission: text(row.transmission),
    market: text(row.market),
    opfGpf,
  };
}

function applicationIdentity(application: SupplierFitmentApplication): string {
  return JSON.stringify(application);
}

export function normalizeSupplierFitmentContract(input: unknown): {
  data: SupplierFitmentContract | null;
  errors: SupplierFitmentValidationError[];
} {
  const errors: SupplierFitmentValidationError[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      data: null,
      errors: [{ code: "INVALID_OBJECT", path: "fitment", message: "fitment must be an object" }],
    };
  }
  const source = input as Record<string, unknown>;
  rejectUnknownFields(
    source,
    ["version", "mode", "scope", "applications", "parentSku", "source", "note"],
    "",
    errors
  );
  if (Number(source.version) !== SUPPLIER_FITMENT_VERSION) {
    errors.push({ code: "INVALID_VERSION", path: "version", message: "fitment.version must be 1" });
  }
  const mode = String(source.mode ?? "") as SupplierFitmentMode;
  if (
    !(["vehicle_specific", "universal", "parent_dependent", "needs_review"] as string[]).includes(
      mode
    )
  ) {
    errors.push({ code: "INVALID_MODE", path: "mode", message: "Unknown fitment mode" });
  }
  const scope = source.scope === "moto" ? "moto" : source.scope === "auto" ? "auto" : null;
  if (!scope)
    errors.push({ code: "INVALID_SCOPE", path: "scope", message: "scope must be auto or moto" });

  const sourceInput =
    source.source && typeof source.source === "object" && !Array.isArray(source.source)
      ? (source.source as Record<string, unknown>)
      : {};
  rejectUnknownFields(sourceInput, ["supplier", "sourceRef", "sourceUpdatedAt"], "source", errors);
  const supplier = text(sourceInput.supplier);
  const sourceRef = text(sourceInput.sourceRef);
  if (!supplier || !sourceRef) {
    errors.push({
      code: "MISSING_SOURCE",
      path: "source",
      message: "supplier and sourceRef are required provenance",
    });
  }
  const sourceUpdatedAt = text(sourceInput.sourceUpdatedAt);
  if (sourceUpdatedAt && Number.isNaN(Date.parse(sourceUpdatedAt))) {
    errors.push({
      code: "INVALID_SOURCE_DATE",
      path: "source.sourceUpdatedAt",
      message: "sourceUpdatedAt must be an ISO date-time",
    });
  }

  const applications = (Array.isArray(source.applications) ? source.applications : [])
    .map((application, index) => normalizeApplication(application, index, errors))
    .filter((application): application is SupplierFitmentApplication => Boolean(application));
  const parentSku = text(source.parentSku);

  if (mode === "vehicle_specific" && applications.length === 0) {
    errors.push({
      code: "MISSING_APPLICATION",
      path: "applications",
      message: "vehicle_specific fitment requires at least one application",
    });
  }
  if ((mode === "universal" || mode === "parent_dependent") && applications.length > 0) {
    errors.push({
      code: "UNEXPECTED_APPLICATION",
      path: "applications",
      message: `${mode} fitment cannot contain direct vehicle applications`,
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
    for (const [index, application] of applications.entries()) {
      const expectedType = scope === "moto" ? "motorcycle" : "car";
      if (application.vehicleType !== expectedType) {
        errors.push({
          code: "SCOPE_MISMATCH",
          path: `applications.${index}.vehicleType`,
          message: `${scope} scope requires ${expectedType} applications`,
        });
      }
    }
  }
  const identities = new Set<string>();
  for (const [index, application] of applications.entries()) {
    const identity = applicationIdentity(application);
    if (identities.has(identity)) {
      errors.push({
        code: "DUPLICATE_APPLICATION",
        path: `applications.${index}`,
        message: "Duplicate vehicle application",
      });
    }
    identities.add(identity);
  }

  if (errors.length || !scope || !supplier || !sourceRef) return { data: null, errors };
  return {
    data: {
      version: SUPPLIER_FITMENT_VERSION,
      mode,
      scope,
      applications,
      parentSku: mode === "parent_dependent" ? parentSku : null,
      source: {
        supplier,
        sourceRef,
        sourceUpdatedAt,
      },
      note: text(source.note),
    },
    errors: [],
  };
}

export function parseSupplierFitmentContract(value: string | null | undefined) {
  if (!value) return null;
  try {
    return normalizeSupplierFitmentContract(JSON.parse(value)).data;
  } catch {
    return null;
  }
}

function asVehicleApplication(application: SupplierFitmentApplication): VehicleApplication {
  return {
    vehicleType: application.vehicleType,
    make: application.make,
    models: application.model ? [application.model] : [],
    chassisCodes: application.chassisCode ? [application.chassisCode] : [],
    yearRanges:
      application.yearFrom === null ? [] : [{ from: application.yearFrom, to: application.yearTo }],
    engines: application.engine ? [application.engine] : [],
    bodyStyles: application.bodyStyle ? [application.bodyStyle] : [],
    drivetrains: application.drivetrain ? [application.drivetrain] : [],
    markets: application.market ? [application.market] : [],
    transmission: application.transmission,
    opfGpf: application.opfGpf,
  };
}

export function supplierContractToNormalizedFitment(
  contract: SupplierFitmentContract
): NormalizedFitment {
  const universal = contract.mode === "universal";
  const applications =
    contract.mode === "vehicle_specific" ? contract.applications.map(asVehicleApplication) : [];
  const primary = applications[0];
  return {
    version: 2,
    status: universal
      ? "universal"
      : contract.mode === "vehicle_specific"
        ? "inferred"
        : "needs_review",
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
    confidence: universal || contract.mode === "vehicle_specific" ? "high" : "unknown",
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

export function isSupplierFitmentMetafield(item: {
  namespace: string | null | undefined;
  key: string | null | undefined;
}) {
  return item.namespace === SUPPLIER_FITMENT_NAMESPACE && item.key === SUPPLIER_FITMENT_KEY;
}

export function validateSupplierFitmentParentReference(
  contract: SupplierFitmentContract,
  knownSkus: Iterable<string>
): SupplierFitmentValidationError[] {
  if (contract.mode !== "parent_dependent" || !contract.parentSku) return [];
  const normalizedKnownSkus = new Set(
    Array.from(knownSkus, (sku) =>
      String(sku ?? "")
        .trim()
        .toUpperCase()
    ).filter(Boolean)
  );
  if (normalizedKnownSkus.has(contract.parentSku.trim().toUpperCase())) return [];
  return [
    {
      code: "MISSING_PARENT_SKU",
      path: "parentSku",
      message: `Parent SKU ${contract.parentSku} does not exist in the catalog or current batch`,
    },
  ];
}
