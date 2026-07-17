export const ONE_AI_QUALITY_ACTIONS = [
  "save_draft",
  "verify_and_reindex",
  "mark_universal",
  "block_strict",
  "needs_source",
  "undo",
] as const;

export type OneAiQualityAction = (typeof ONE_AI_QUALITY_ACTIONS)[number];

export type OneAiQualityApplicationInput = {
  applicationId: string | null;
  variantId: string | null;
  scope: "auto" | "moto";
  vehicleType: "car" | "motorcycle";
  make: string;
  model: string | null;
  generation: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engine: string | null;
  fuel: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  transmission: string | null;
  market: string | null;
  opfGpf: "with" | "without" | "unknown";
  categoryGroup: string | null;
  productKind: string | null;
  material: string | null;
};

export type OneAiQualityEvidenceInput = {
  excerpt: string;
  sourceRef: string | null;
};

export type OneAiQualityMutationInput = {
  action: OneAiQualityAction;
  expectedRevision: number;
  reason: string | null;
  application: OneAiQualityApplicationInput | null;
  evidence: OneAiQualityEvidenceInput | null;
  targetRevisionId: string | null;
  targetRevision: number | null;
};

export type OneAiQualityUndoApplication = Omit<
  OneAiQualityApplicationInput,
  "applicationId" | "vehicleType" | "make"
> & {
  make: string | null;
  isUniversal: boolean;
  verificationStatus: "VERIFIED" | "NEEDS_REVIEW";
};

export type OneAiQualityUndoSnapshot = {
  status: "READY" | "NEEDS_REVIEW" | "BLOCKED";
  qualityFlags: string[];
  strictBlocked: boolean;
  applications: OneAiQualityUndoApplication[];
};

export type OneAiQualityUndoSnapshotParseResult =
  | { ok: true; value: OneAiQualityUndoSnapshot }
  | { ok: false; error: string };

export type OneAiQualityMutationParseResult =
  | { ok: true; value: OneAiQualityMutationInput }
  | { ok: false; error: string };

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/u;
const APPLICATION_ACTIONS = new Set<OneAiQualityAction>(["save_draft", "verify_and_reindex"]);
const UNDO_SNAPSHOT_STRING_FIELDS = [
  "variantId",
  "make",
  "model",
  "generation",
  "chassisCode",
  "engine",
  "fuel",
  "bodyStyle",
  "drivetrain",
  "transmission",
  "market",
  "categoryGroup",
  "productKind",
  "material",
] as const;
const APPLICATION_STRING_FIELDS = [
  "applicationId",
  "variantId",
  "make",
  "model",
  "generation",
  "chassisCode",
  "engine",
  "fuel",
  "bodyStyle",
  "drivetrain",
  "transmission",
  "market",
  "categoryGroup",
  "productKind",
  "material",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanOptionalString(value: unknown, maximum: number) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\s+/gu, " ").trim();
  return cleaned ? cleaned.slice(0, maximum) : null;
}

function cleanRequiredString(value: unknown, maximum: number) {
  return cleanOptionalString(value, maximum) ?? "";
}

function cleanId(value: unknown) {
  const cleaned = cleanOptionalString(value, 100);
  return cleaned && SAFE_ID_PATTERN.test(cleaned) ? cleaned : null;
}

function parseYear(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "number") return Number.NaN;
  return Number.isInteger(value) && value >= 1886 && value <= 2200 ? value : Number.NaN;
}

function parseApplication(
  value: unknown
): { ok: false; error: string } | OneAiQualityApplicationInput {
  if (!isRecord(value)) {
    return { ok: false, error: "application is required for this action" };
  }
  for (const field of APPLICATION_STRING_FIELDS) {
    if (value[field] != null && typeof value[field] !== "string") {
      return { ok: false, error: `application.${field} must be a string` };
    }
  }
  if (
    value.opfGpf != null &&
    value.opfGpf !== "with" &&
    value.opfGpf !== "without" &&
    value.opfGpf !== "unknown"
  ) {
    return {
      ok: false,
      error: "application.opfGpf must be with, without, or unknown",
    };
  }

  const scope = value.scope === "moto" ? "moto" : value.scope === "auto" ? "auto" : null;
  const vehicleType =
    value.vehicleType === "motorcycle" ? "motorcycle" : value.vehicleType === "car" ? "car" : null;
  const make = cleanRequiredString(value.make, 80);
  const yearFrom = parseYear(value.yearFrom);
  const yearTo = parseYear(value.yearTo);
  const applicationId = value.applicationId == null ? null : cleanId(value.applicationId);
  const variantId = value.variantId == null ? null : cleanId(value.variantId);

  if (!scope) return { ok: false, error: "application.scope must be auto or moto" };
  if (!vehicleType) {
    return { ok: false, error: "application.vehicleType must be car or motorcycle" };
  }
  if (!make) return { ok: false, error: "application.make is required" };
  if (Number.isNaN(yearFrom) || Number.isNaN(yearTo)) {
    return { ok: false, error: "application years must be between 1886 and 2200" };
  }
  if (yearFrom !== null && yearTo !== null && yearTo < yearFrom) {
    return { ok: false, error: "application.yearTo cannot be earlier than yearFrom" };
  }
  if (value.applicationId != null && !applicationId) {
    return { ok: false, error: "application.applicationId is invalid" };
  }
  if (value.variantId != null && !variantId) {
    return { ok: false, error: "application.variantId is invalid" };
  }
  if (scope === "moto" && vehicleType !== "motorcycle") {
    return { ok: false, error: "moto scope requires motorcycle vehicleType" };
  }
  if (scope === "auto" && vehicleType !== "car") {
    return { ok: false, error: "auto scope requires car vehicleType" };
  }

  const opfGpf =
    value.opfGpf === "with" || value.opfGpf === "without" || value.opfGpf === "unknown"
      ? value.opfGpf
      : "unknown";

  return {
    applicationId,
    variantId,
    scope,
    vehicleType,
    make,
    model: cleanOptionalString(value.model, 100),
    generation: cleanOptionalString(value.generation, 100),
    chassisCode: cleanOptionalString(value.chassisCode, 60)?.toUpperCase() ?? null,
    yearFrom,
    yearTo,
    engine: cleanOptionalString(value.engine, 100),
    fuel: cleanOptionalString(value.fuel, 60),
    bodyStyle: cleanOptionalString(value.bodyStyle, 80),
    drivetrain: cleanOptionalString(value.drivetrain, 80),
    transmission: cleanOptionalString(value.transmission, 80),
    market: cleanOptionalString(value.market, 80),
    opfGpf,
    categoryGroup: cleanOptionalString(value.categoryGroup, 80),
    productKind: cleanOptionalString(value.productKind, 80),
    material: cleanOptionalString(value.material, 80),
  };
}

function parseEvidence(value: unknown): OneAiQualityEvidenceInput | null {
  if (!isRecord(value)) return null;
  const excerpt = cleanRequiredString(value.excerpt, 2_000);
  if (!excerpt) return null;
  return {
    excerpt,
    sourceRef: cleanOptionalString(value.sourceRef, 300),
  };
}

function parseUndoApplication(
  value: unknown,
  productId: string
): { ok: false; error: string } | OneAiQualityUndoApplication {
  if (!isRecord(value)) {
    return { ok: false, error: "Undo snapshot contains an invalid application" };
  }
  if (value.productId != null && value.productId !== productId) {
    return { ok: false, error: "Undo snapshot application belongs to another product" };
  }
  for (const field of UNDO_SNAPSHOT_STRING_FIELDS) {
    if (value[field] != null && typeof value[field] !== "string") {
      return { ok: false, error: `Undo snapshot application.${field} must be a string` };
    }
  }

  const scope = value.scope === "moto" ? "moto" : value.scope === "auto" ? "auto" : null;
  const isUniversal = value.isUniversal === true || value.vehicleType === "universal";
  const make = cleanOptionalString(value.make, 80);
  const yearFrom = parseYear(value.yearFrom);
  const yearTo = parseYear(value.yearTo);
  const variantId = value.variantId == null ? null : cleanId(value.variantId);
  const rawVerificationStatus = value.verificationStatus ?? value.fitmentStatus;
  const verificationStatus =
    rawVerificationStatus === "VERIFIED" || rawVerificationStatus === "verified"
      ? ("VERIFIED" as const)
      : rawVerificationStatus === "NEEDS_REVIEW" ||
          rawVerificationStatus === "needs_review" ||
          rawVerificationStatus === "INFERRED" ||
          rawVerificationStatus === "inferred" ||
          rawVerificationStatus === "EXTRACTED" ||
          rawVerificationStatus === "extracted"
        ? ("NEEDS_REVIEW" as const)
        : null;

  if (!scope) {
    return { ok: false, error: "Undo snapshot application.scope must be auto or moto" };
  }
  if (!isUniversal && !make) {
    return { ok: false, error: "Undo snapshot vehicle application requires make" };
  }
  if (value.isActive === false) {
    return { ok: false, error: "Undo snapshot cannot restore an inactive application" };
  }
  if (Number.isNaN(yearFrom) || Number.isNaN(yearTo)) {
    return { ok: false, error: "Undo snapshot application years are invalid" };
  }
  if (yearFrom !== null && yearTo !== null && yearTo < yearFrom) {
    return { ok: false, error: "Undo snapshot application year range is invalid" };
  }
  if (value.variantId != null && !variantId) {
    return { ok: false, error: "Undo snapshot application.variantId is invalid" };
  }
  if (!verificationStatus) {
    return {
      ok: false,
      error: "Undo snapshot application verification status is unsupported",
    };
  }
  if (
    value.opfGpf != null &&
    value.opfGpf !== "with" &&
    value.opfGpf !== "without" &&
    value.opfGpf !== "unknown"
  ) {
    return { ok: false, error: "Undo snapshot application.opfGpf is invalid" };
  }

  return {
    variantId,
    scope,
    make: isUniversal ? null : make,
    model: cleanOptionalString(value.model, 100),
    generation: cleanOptionalString(value.generation, 100),
    chassisCode: cleanOptionalString(value.chassisCode, 60)?.toUpperCase() ?? null,
    yearFrom,
    yearTo,
    engine: cleanOptionalString(value.engine, 100),
    fuel: cleanOptionalString(value.fuel, 60),
    bodyStyle: cleanOptionalString(value.bodyStyle, 80),
    drivetrain: cleanOptionalString(value.drivetrain, 80),
    transmission: cleanOptionalString(value.transmission, 80),
    market: cleanOptionalString(value.market, 80),
    opfGpf: value.opfGpf === "with" || value.opfGpf === "without" ? value.opfGpf : "unknown",
    categoryGroup: cleanOptionalString(value.categoryGroup, 80),
    productKind: cleanOptionalString(value.productKind, 80),
    material: cleanOptionalString(value.material, 80),
    isUniversal,
    verificationStatus,
  };
}

export function parseOneAiQualityUndoSnapshot(
  value: unknown,
  productId: string
): OneAiQualityUndoSnapshotParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Target revision has no supported snapshot" };
  }
  if (value.productId != null && value.productId !== productId) {
    return { ok: false, error: "Target revision snapshot belongs to another product" };
  }

  const rawStatus = value.targetStatus ?? value.status;
  const status =
    rawStatus === "READY" || rawStatus === "NEEDS_REVIEW" || rawStatus === "BLOCKED"
      ? rawStatus
      : null;
  if (!status) {
    return { ok: false, error: "Target revision snapshot has an unsupported status" };
  }
  if (value.qualityFlags != null && !Array.isArray(value.qualityFlags)) {
    return { ok: false, error: "Target revision snapshot qualityFlags are invalid" };
  }
  const qualityFlags: string[] = [];
  for (const flag of Array.isArray(value.qualityFlags) ? value.qualityFlags : []) {
    if (typeof flag !== "string") {
      return { ok: false, error: "Target revision snapshot qualityFlags are invalid" };
    }
    const cleaned = cleanOptionalString(flag, 100);
    if (cleaned) qualityFlags.push(cleaned);
  }
  if (!Array.isArray(value.applications)) {
    return { ok: false, error: "Target revision snapshot has no canonical applications" };
  }

  const applications: OneAiQualityUndoApplication[] = [];
  const applicationKeys = new Set<string>();
  for (const application of value.applications) {
    const parsed = parseUndoApplication(application, productId);
    if ("ok" in parsed) return parsed;
    const key = JSON.stringify(parsed);
    if (applicationKeys.has(key)) continue;
    applicationKeys.add(key);
    applications.push(parsed);
  }

  const strictBlocked = status === "BLOCKED" || qualityFlags.includes("blocked_strict:manager");
  if (strictBlocked && applications.length > 0) {
    return {
      ok: false,
      error: "Blocked target revision cannot restore active applications",
    };
  }

  return {
    ok: true,
    value: {
      status: strictBlocked ? "BLOCKED" : status,
      qualityFlags: Array.from(new Set(qualityFlags)).sort(),
      strictBlocked,
      applications,
    },
  };
}

export function parseOneAiQualityMutation(value: unknown): OneAiQualityMutationParseResult {
  if (!isRecord(value)) return { ok: false, error: "Invalid request body" };
  if (
    typeof value.action !== "string" ||
    !ONE_AI_QUALITY_ACTIONS.includes(value.action as OneAiQualityAction)
  ) {
    return { ok: false, error: "Invalid One AI quality action" };
  }

  const action = value.action as OneAiQualityAction;
  const expectedRevision = value.expectedRevision;
  if (
    typeof expectedRevision !== "number" ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1
  ) {
    return { ok: false, error: "expectedRevision must be a positive integer" };
  }
  if (value.reason != null && typeof value.reason !== "string") {
    return { ok: false, error: "reason must be a string" };
  }
  if (value.evidence != null) {
    if (!isRecord(value.evidence)) {
      return { ok: false, error: "evidence must be an object" };
    }
    if (typeof value.evidence.excerpt !== "string") {
      return { ok: false, error: "evidence.excerpt must be a string" };
    }
    if (value.evidence.sourceRef != null && typeof value.evidence.sourceRef !== "string") {
      return { ok: false, error: "evidence.sourceRef must be a string" };
    }
  }

  const reason = cleanOptionalString(value.reason, 500);
  const evidence = parseEvidence(value.evidence);
  const targetRevisionId = value.targetRevisionId == null ? null : cleanId(value.targetRevisionId);
  const targetRevision = value.targetRevision;
  let parsedTargetRevision: number | null = null;

  let application: OneAiQualityApplicationInput | null = null;
  if (APPLICATION_ACTIONS.has(action)) {
    const parsedApplication = parseApplication(value.application);
    if ("ok" in parsedApplication) return parsedApplication;
    application = parsedApplication;
  } else if (value.application != null) {
    return { ok: false, error: `${action} does not accept an application payload` };
  }
  if (action === "undo") {
    if (value.evidence != null) {
      return { ok: false, error: "undo does not accept an evidence payload" };
    }
    if (value.targetRevisionId != null && !targetRevisionId) {
      return { ok: false, error: "targetRevisionId is invalid" };
    }
    if (
      targetRevision != null &&
      (typeof targetRevision !== "number" ||
        !Number.isInteger(targetRevision) ||
        targetRevision < 1)
    ) {
      return { ok: false, error: "targetRevision must be a positive integer" };
    }
    parsedTargetRevision = typeof targetRevision === "number" ? targetRevision : null;
    if ((targetRevisionId === null) === (targetRevision == null)) {
      return {
        ok: false,
        error: "undo requires exactly one targetRevisionId or targetRevision",
      };
    }
  } else if (value.targetRevisionId != null || value.targetRevision != null) {
    return { ok: false, error: `${action} does not accept an undo target` };
  }

  if (action === "verify_and_reindex" && !evidence) {
    return { ok: false, error: "Verified fitment requires evidence.excerpt" };
  }
  if (action === "mark_universal" && !evidence) {
    return { ok: false, error: "Universal fitment requires evidence.excerpt" };
  }
  if ((action === "block_strict" || action === "needs_source") && !reason) {
    return { ok: false, error: `${action} requires a reason` };
  }

  return {
    ok: true,
    value: {
      action,
      expectedRevision,
      reason,
      application,
      evidence,
      targetRevisionId: action === "undo" ? targetRevisionId : null,
      targetRevision: action === "undo" ? parsedTargetRevision : null,
    },
  };
}

export class OneAiQualityRevisionConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly currentRevision: number
  ) {
    super("ONE_AI_QUALITY_REVISION_CONFLICT");
    this.name = "OneAiQualityRevisionConflictError";
  }
}

export function nextOneAiQualityRevision(currentRevision: number, expectedRevision: number) {
  if (
    !Number.isInteger(currentRevision) ||
    currentRevision < 1 ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1
  ) {
    throw new TypeError("Knowledge revisions must be positive integers");
  }
  if (currentRevision !== expectedRevision) {
    throw new OneAiQualityRevisionConflictError(expectedRevision, currentRevision);
  }
  return currentRevision + 1;
}

export function isOneAiQualityRevisionConflict(
  error: unknown
): error is OneAiQualityRevisionConflictError {
  return error instanceof OneAiQualityRevisionConflictError;
}
