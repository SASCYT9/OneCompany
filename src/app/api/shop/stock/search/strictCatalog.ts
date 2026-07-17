import { cleanShopAiProductKind, type ShopAiProductKind } from "@/lib/shopAiProductKind";
import {
  getMissingShopAiHardFacts,
  isShopAiExactMatchEligible,
} from "@/lib/shopAiStrictValidation";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import {
  parseShopStockVehicleScope,
  type ShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";

const STRICT_CATALOG_TRUSTED_SOURCES = new Set(["MANAGER", "MANUAL_OVERRIDE", "SUPPLIER"]);

export type StrictCatalogSearchConstraints = {
  enabled: boolean;
  invalid: boolean;
  category: string | null;
  productKind: ShopAiProductKind | null;
  scope: ShopStockVehicleScope | null;
  make: string | null;
  model: string | null;
  chassis: string | null;
  year: number | null;
  engine: string | null;
  opfGpf: "with" | "without" | null;
  hasKnowledgeConstraints: boolean;
};

export type StrictCatalogKnowledgeRow = {
  productId: string;
  categoryGroup: string | null;
  productKind: string | null;
  qualityFlags: string[] | null;
  knowledgeMakes: string[] | null;
  knowledgeModels: string[] | null;
  knowledgeChassisCodes: string[] | null;
  knowledgeYearRanges: unknown;
  knowledgeEngines: string[] | null;
  knowledgeOpfGpf: string | null;
  applicationId: string | null;
  applicationVariantId: string | null;
  applicationMake: string | null;
  applicationModel: string | null;
  applicationChassis: string | null;
  applicationYearFrom: number | null;
  applicationYearTo: number | null;
  applicationEngine: string | null;
  applicationOpfGpf: string | null;
  applicationUniversal: boolean | null;
  applicationVerificationStatus: string | null;
  applicationSource: string | null;
  hasApplications: boolean;
};

export type StrictCatalogMatch = {
  matchStatus: "exact" | "requires_verification";
  missingFacts: string[];
  matchReason: string;
  matchedApplicationId: string | null;
  variantId: string | null;
};

function cleanStrictCatalogText(value: string | null, maxLength: number) {
  const cleaned = value?.replace(/\s+/g, " ").trim() ?? "";
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function parseStrictCatalogYear(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  const maxYear = new Date().getFullYear() + 2;
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= maxYear ? parsed : null;
}

export function parseStrictCatalogSearchConstraints(
  searchParams: URLSearchParams
): StrictCatalogSearchConstraints {
  const enabled = searchParams.get("strict") === "1";
  const rawProductKind = searchParams.get("productKind");
  const productKind = cleanShopAiProductKind(rawProductKind);
  const rawScope = searchParams.get("scope");
  const scope = parseShopStockVehicleScope(rawScope);
  const rawYear = searchParams.get("year");
  const year = parseStrictCatalogYear(rawYear);
  const rawEngine = searchParams.get("engine");
  const engine = cleanStrictCatalogText(rawEngine, 100);
  const rawOpfGpf = searchParams.get("opfGpf");
  const opfGpf = rawOpfGpf === "with" || rawOpfGpf === "without" ? rawOpfGpf : null;
  const category = cleanStrictCatalogText(searchParams.get("category"), 120);
  const make = cleanStrictCatalogText(searchParams.get("make"), 80);
  const model = cleanStrictCatalogText(searchParams.get("model"), 100);
  const chassis = cleanStrictCatalogText(searchParams.get("chassis"), 60);
  const invalid =
    enabled &&
    ((rawProductKind !== null && rawProductKind.trim() !== "" && !productKind) ||
      (rawScope !== null && rawScope.trim() !== "" && !scope) ||
      (rawYear !== null && rawYear.trim() !== "" && year === null) ||
      (rawEngine !== null && rawEngine.trim() !== "" && !engine) ||
      (rawOpfGpf !== null && rawOpfGpf.trim() !== "" && !opfGpf) ||
      (searchParams.has("category") && searchParams.get("category")?.trim() !== "" && !category) ||
      (searchParams.has("make") && searchParams.get("make")?.trim() !== "" && !make) ||
      (searchParams.has("model") && searchParams.get("model")?.trim() !== "" && !model) ||
      (searchParams.has("chassis") && searchParams.get("chassis")?.trim() !== "" && !chassis));
  const hasKnowledgeConstraints = Boolean(
    category ||
      (productKind && productKind !== "any") ||
      make ||
      model ||
      chassis ||
      year ||
      engine ||
      opfGpf
  );

  return {
    enabled,
    invalid,
    category,
    productKind,
    scope,
    make,
    model,
    chassis,
    year,
    engine,
    opfGpf,
    hasKnowledgeConstraints,
  };
}

function normalizedStrictValue(value: string | null | undefined) {
  return normalizeShopSearchText(value ?? "");
}

function strictValuesEqual(expected: string | null, actual: string | null | undefined) {
  if (!expected || !actual) return true;
  return normalizedStrictValue(expected) === normalizedStrictValue(actual);
}

function knownArrayContradicts(
  requested: string | null,
  applicationValue: string | null,
  knowledgeValues: string[] | null
) {
  if (!requested || applicationValue) return false;
  const known = (knowledgeValues ?? []).map(normalizedStrictValue).filter(Boolean);
  return known.length > 0 && !known.includes(normalizedStrictValue(requested));
}

function normalizedKnowledgeYearRanges(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ from: number; to: number | null }>;
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const source = entry as Record<string, unknown>;
    const from = Number(source.from);
    const rawTo = source.to;
    const to = rawTo === null || rawTo === undefined || rawTo === "" ? null : Number(rawTo);
    if (!Number.isInteger(from) || (to !== null && !Number.isInteger(to))) return [];
    return [{ from, to }];
  });
}

function knowledgeYearContradicts(requestedYear: number | null, row: StrictCatalogKnowledgeRow) {
  if (!requestedYear || row.applicationYearFrom !== null || row.applicationYearTo !== null) {
    return false;
  }
  const ranges = normalizedKnowledgeYearRanges(row.knowledgeYearRanges);
  return (
    ranges.length > 0 &&
    !ranges.some(
      (range) => range.from <= requestedYear && (range.to === null || range.to >= requestedYear)
    )
  );
}

function hasRequestedVehicleConstraints(constraints: StrictCatalogSearchConstraints) {
  return Boolean(
    constraints.make ||
      constraints.model ||
      constraints.chassis ||
      constraints.year ||
      constraints.engine ||
      constraints.opfGpf
  );
}

function applicationConfirmsStrictConstraints(
  row: StrictCatalogKnowledgeRow,
  constraints: StrictCatalogSearchConstraints
) {
  if (row.applicationUniversal) return true;
  if (constraints.make && !row.applicationMake) return false;
  if (constraints.model && !row.applicationModel) return false;
  if (constraints.chassis && !row.applicationChassis) return false;
  if (constraints.year && row.applicationYearFrom === null && row.applicationYearTo === null) {
    return false;
  }
  if (constraints.engine && !row.applicationEngine) return false;
  if (constraints.opfGpf && !row.applicationOpfGpf) return false;
  return true;
}

function addMissingStrictApplicationFacts(
  missingFacts: Set<string>,
  row: StrictCatalogKnowledgeRow,
  constraints: StrictCatalogSearchConstraints
) {
  if (row.applicationUniversal) return;
  if (constraints.make && !row.applicationMake) missingFacts.add("make");
  if (constraints.model && !row.applicationModel) missingFacts.add("model");
  if (constraints.chassis && !row.applicationChassis) missingFacts.add("chassis");
  if (constraints.year && row.applicationYearFrom === null && row.applicationYearTo === null) {
    missingFacts.add("year");
  }
  if (constraints.engine && !row.applicationEngine) missingFacts.add("engine");
  if (constraints.opfGpf && !row.applicationOpfGpf) missingFacts.add("opf_gpf");
}

/**
 * Classifies one canonical knowledge row. Returning null means a known
 * contradiction was found, so the product must never enter a strict result.
 */
export function classifyStrictCatalogKnowledgeRow(
  row: StrictCatalogKnowledgeRow,
  constraints: StrictCatalogSearchConstraints,
  locale: "ua" | "en"
): StrictCatalogMatch | null {
  if (!constraints.enabled || constraints.invalid) return null;
  if (
    constraints.category &&
    normalizedStrictValue(row.categoryGroup) !== normalizedStrictValue(constraints.category)
  ) {
    return null;
  }
  if (
    constraints.productKind &&
    constraints.productKind !== "any" &&
    cleanShopAiProductKind(row.productKind) !== constraints.productKind
  ) {
    return null;
  }

  const vehicleConstrained = hasRequestedVehicleConstraints(constraints);
  if (vehicleConstrained && row.hasApplications && !row.applicationId) {
    return null;
  }
  if (!strictValuesEqual(constraints.make, row.applicationMake)) return null;
  if (!strictValuesEqual(constraints.model, row.applicationModel)) return null;
  if (!strictValuesEqual(constraints.chassis, row.applicationChassis)) return null;
  if (!strictValuesEqual(constraints.engine, row.applicationEngine)) return null;
  if (!strictValuesEqual(constraints.opfGpf, row.applicationOpfGpf)) return null;
  if (
    constraints.year &&
    ((row.applicationYearFrom !== null && row.applicationYearFrom > constraints.year) ||
      (row.applicationYearTo !== null && row.applicationYearTo < constraints.year))
  ) {
    return null;
  }
  if (
    knownArrayContradicts(constraints.make, row.applicationMake, row.knowledgeMakes) ||
    knownArrayContradicts(constraints.model, row.applicationModel, row.knowledgeModels) ||
    knownArrayContradicts(constraints.chassis, row.applicationChassis, row.knowledgeChassisCodes) ||
    knownArrayContradicts(constraints.engine, row.applicationEngine, row.knowledgeEngines) ||
    knowledgeYearContradicts(constraints.year, row)
  ) {
    return null;
  }
  const knownOpfGpf =
    row.knowledgeOpfGpf === "with" || row.knowledgeOpfGpf === "without"
      ? row.knowledgeOpfGpf
      : null;
  if (
    constraints.opfGpf &&
    !row.applicationOpfGpf &&
    knownOpfGpf &&
    knownOpfGpf !== constraints.opfGpf
  ) {
    return null;
  }

  const qualityFlags = row.qualityFlags ?? [];
  const missingFacts = new Set(getMissingShopAiHardFacts(qualityFlags));
  if (vehicleConstrained && !row.applicationId) missingFacts.add("fitment");
  addMissingStrictApplicationFacts(missingFacts, row, constraints);
  const trustedApplication =
    row.applicationVerificationStatus === "VERIFIED" &&
    Boolean(row.applicationSource && STRICT_CATALOG_TRUSTED_SOURCES.has(row.applicationSource));
  if (row.applicationId && !trustedApplication) {
    missingFacts.add("verified_fitment");
  }
  const exact = isShopAiExactMatchEligible({
    exactSkuWithoutVehicle: false,
    merchWithoutVehicle: !vehicleConstrained && constraints.category === "merch",
    hasApplication: Boolean(row.applicationId),
    trustedApplication,
    applicationConfirmsRequestedFacts: applicationConfirmsStrictConstraints(row, constraints),
    qualityFlags,
  });
  const matchStatus = exact ? "exact" : "requires_verification";

  return {
    matchStatus,
    missingFacts: exact ? [] : Array.from(missingFacts),
    matchReason:
      locale === "ua"
        ? exact
          ? "Сумісність підтверджена перевіреним джерелом"
          : "Категорія й тип деталі точні; сумісність потребує перевірки"
        : exact
          ? "Fitment confirmed by verified evidence"
          : "Category and product type match; fitment needs verification",
    matchedApplicationId: row.applicationId,
    variantId: row.applicationId ? row.applicationVariantId : null,
  };
}

export function getStrictCatalogMatchRank(match: StrictCatalogMatch | null | undefined) {
  if (match?.matchStatus === "exact") return 0;
  if (match?.matchStatus === "requires_verification") return 1;
  return 2;
}
