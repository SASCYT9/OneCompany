import type {
  ShopCatalogV2CompatibilityClause,
  ShopCatalogV2CompatibilityConstraint,
  ShopCatalogV2CompatibilityMode,
  ShopCatalogV2CompatibilityPolicy,
  ShopCatalogV2CompatibilityVerification,
} from "./shopCatalogV2Compatibility";

export type CoverageApplication = Readonly<{
  scope?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  engineCode?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  opfGpf?: string | null;
}>;

/** Structural offline view of every immutable source draft normalization. */
export type CoverageNormalization = Readonly<{
  productId: string;
  variantId?: string | null;
  recordKey: string;
  verification: ShopCatalogV2CompatibilityVerification;
  mode?: "UNIVERSAL" | "VEHICLE_SPECIFIC" | "PARENT_DEPENDENT" | "NEEDS_REVIEW";
  applications?: readonly CoverageApplication[];
  engineRelevant?: boolean;
  transmissionRelevant?: boolean;
  opfGpfRelevant?: boolean;
  /** RaceChip’s single application is intentionally not synthesized into applications[]. */
  make?: string;
  model?: string;
  generation?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  engineDescriptor?: string;
  fuel?: string | null;
}>;

const SOURCES = new Set([
  "adro",
  "akrapovic",
  "brabus",
  "burger",
  "csf",
  "do88",
  "eventuri",
  "girodisc",
  "ilmberger",
  "ipe",
  "ohlins",
  "racechip",
  "remus",
  "urban",
]);

function sourceKey(source: string) {
  const key = source.trim().toLowerCase();
  if (!SOURCES.has(key)) throw new TypeError(`Unknown catalog normalization source: ${source}`);
  return key;
}

function exact(
  dimension: ShopCatalogV2CompatibilityConstraint["dimension"],
  values: readonly (string | { from: number | null; to: number | null })[]
): ShopCatalogV2CompatibilityConstraint {
  return { dimension, state: "EXACT", values };
}

function state(
  dimension: ShopCatalogV2CompatibilityConstraint["dimension"],
  value: "ANY" | "NOT_APPLICABLE" | "UNKNOWN"
): ShopCatalogV2CompatibilityConstraint {
  return { dimension, state: value };
}

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function expectedMode(
  source: string,
  normalization: CoverageNormalization
): ShopCatalogV2CompatibilityMode {
  if (normalization.verification !== "VERIFIED") return "NEEDS_REVIEW";
  if (source === "eventuri" && normalization.mode === "PARENT_DEPENDENT") return "NEEDS_REVIEW";
  return normalization.mode === "UNIVERSAL" ? "UNIVERSAL" : "VEHICLE_SPECIFIC";
}

function sourceScope(source: string, application: CoverageApplication | null) {
  if (source === "ilmberger") return "moto";
  return nonEmpty(application?.scope) ?? "auto";
}

function applicationClause(input: {
  source: string;
  normalization: CoverageNormalization;
  application: CoverageApplication;
  position: number;
}): ShopCatalogV2CompatibilityClause {
  const { source, normalization, application, position } = input;
  const generation = nonEmpty(application.generation);
  const engine = nonEmpty(application.engineCode);
  const fuel = nonEmpty(application.fuel);
  const transmission = nonEmpty(application.transmission);
  const opfGpf = nonEmpty(application.opfGpf);
  const hasYear = application.yearFrom != null || application.yearTo != null;
  return {
    id: `${source}:${position + 1}`,
    verification: normalization.verification,
    sourceRef: normalization.recordKey,
    constraints: [
      exact("scope", [sourceScope(source, application)]),
      nonEmpty(application.make)
        ? exact("make", [nonEmpty(application.make)!])
        : state("make", "UNKNOWN"),
      nonEmpty(application.model)
        ? exact("model", [nonEmpty(application.model)!])
        : state("model", "UNKNOWN"),
      generation ? exact("generation", [generation]) : state("generation", "ANY"),
      source === "racechip"
        ? state("chassis", "NOT_APPLICABLE")
        : generation
          ? exact("chassis", [generation])
          : state("chassis", "ANY"),
      hasYear
        ? exact("year", [{ from: application.yearFrom ?? null, to: application.yearTo ?? null }])
        : state("year", "ANY"),
      engine
        ? exact("engine", [engine])
        : state("engine", normalization.engineRelevant ? "UNKNOWN" : "NOT_APPLICABLE"),
      fuel
        ? exact("fuel", [fuel])
        : state("fuel", normalization.engineRelevant ? "UNKNOWN" : "NOT_APPLICABLE"),
      state("bodyStyle", source === "racechip" ? "NOT_APPLICABLE" : "ANY"),
      state("drivetrain", "NOT_APPLICABLE"),
      transmission
        ? exact("transmission", [transmission])
        : state("transmission", normalization.transmissionRelevant ? "UNKNOWN" : "NOT_APPLICABLE"),
      state("market", source === "racechip" ? "NOT_APPLICABLE" : "ANY"),
      opfGpf
        ? exact("opfGpf", [opfGpf])
        : state("opfGpf", normalization.opfGpfRelevant ? "UNKNOWN" : "NOT_APPLICABLE"),
    ],
  };
}

function unresolvedClause(
  source: string,
  normalization: CoverageNormalization,
  mode: ShopCatalogV2CompatibilityMode
) {
  const universal = mode === "UNIVERSAL";
  return {
    id: `${source}:unresolved`,
    verification: normalization.verification,
    sourceRef: normalization.recordKey,
    constraints: [
      exact("scope", [sourceScope(source, null)]),
      ...(
        [
          "make",
          "model",
          "generation",
          "chassis",
          "year",
          "bodyStyle",
          "drivetrain",
          "market",
        ] as const
      ).map((dimension) => state(dimension, universal ? "ANY" : "UNKNOWN")),
      state("engine", normalization.engineRelevant && !universal ? "UNKNOWN" : "NOT_APPLICABLE"),
      state("fuel", normalization.engineRelevant && !universal ? "UNKNOWN" : "NOT_APPLICABLE"),
      state("transmission", universal ? "ANY" : "UNKNOWN"),
      state("opfGpf", universal ? "ANY" : "UNKNOWN"),
    ],
  } satisfies ShopCatalogV2CompatibilityClause;
}

/**
 * Offline expected-policy oracle for source-backfill parity. It preserves draft
 * evidence (including raw engine text) so a persistence adapter that drops it
 * is reported rather than hidden. RaceChip is its only single-application shape.
 */
export function buildNormalizationCoveragePolicy(
  source: string,
  normalization: CoverageNormalization
): ShopCatalogV2CompatibilityPolicy {
  const normalizedSource = sourceKey(source);
  // RaceChip has no boolean flag because its single source shape always owns a
  // resolved engine descriptor; retain that invariant in the offline oracle.
  const effectiveNormalization =
    normalizedSource === "racechip" ? { ...normalization, engineRelevant: true } : normalization;
  const mode = expectedMode(normalizedSource, effectiveNormalization);
  const applications =
    normalizedSource === "racechip"
      ? [
          {
            make: effectiveNormalization.make,
            model: effectiveNormalization.model,
            generation: effectiveNormalization.generation,
            yearFrom: effectiveNormalization.yearFrom,
            yearTo: effectiveNormalization.yearTo,
            engineCode: effectiveNormalization.engineDescriptor,
            fuel: effectiveNormalization.fuel,
          },
        ]
      : (effectiveNormalization.applications ?? []);
  const clauses = applications.length
    ? applications.map((application, position) =>
        applicationClause({
          source: normalizedSource,
          normalization: effectiveNormalization,
          application,
          position,
        })
      )
    : normalizedSource === "adro"
      ? []
      : [unresolvedClause(normalizedSource, effectiveNormalization, mode)];
  return {
    version: 2,
    mode,
    target: {
      productId: normalization.productId,
      ...(normalization.variantId ? { variantId: normalization.variantId } : {}),
    },
    requiredDimensions:
      mode === "VEHICLE_SPECIFIC"
        ? [
            "scope",
            "make",
            "model",
            ...(normalizedSource === "racechip"
              ? ["year" as const, "engine" as const, "fuel" as const]
              : []),
            ...(effectiveNormalization.engineRelevant && normalizedSource !== "racechip"
              ? ["engine" as const]
              : []),
            ...(effectiveNormalization.transmissionRelevant ? ["transmission" as const] : []),
            ...(effectiveNormalization.opfGpfRelevant ? ["opfGpf" as const] : []),
          ]
        : [],
    dimensionDefaults: {
      engine: effectiveNormalization.engineRelevant ? "UNKNOWN" : "NOT_APPLICABLE",
      fuel: effectiveNormalization.engineRelevant ? "UNKNOWN" : "NOT_APPLICABLE",
      transmission: effectiveNormalization.transmissionRelevant ? "UNKNOWN" : "NOT_APPLICABLE",
      opfGpf: effectiveNormalization.opfGpfRelevant ? "UNKNOWN" : "NOT_APPLICABLE",
    },
    clauses,
  };
}
