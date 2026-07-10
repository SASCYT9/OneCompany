import type { ShopProduct } from "@/lib/shopCatalog";
import type { Fitment } from "@/lib/crossShopFitment";
import type { VehicleYearRange } from "@/lib/shopVehicleYears";

export const NORMALIZED_FITMENT_NAMESPACE = "onecompany";
export const NORMALIZED_FITMENT_KEY = "normalized_fitment";
export const NORMALIZED_FITMENT_VERSION = 2;

export function isNormalizedFitmentMetafield(item: {
  namespace: string | null | undefined;
  key: string | null | undefined;
}) {
  return item.namespace === NORMALIZED_FITMENT_NAMESPACE && item.key === NORMALIZED_FITMENT_KEY;
}

export type NormalizedFitmentStatus = "inferred" | "verified" | "universal" | "needs_review";

export type NormalizedVehicleType = "car" | "motorcycle" | "universal" | "unknown";
export type NormalizedFitmentSource = "automatic" | "manual" | "import";

export type VehicleApplication = {
  vehicleType: Exclude<NormalizedVehicleType, "universal" | "unknown">;
  make: string;
  models: string[];
  chassisCodes: string[];
  yearRanges: VehicleYearRange[];
  engines: string[];
  bodyStyles: string[];
  drivetrains: string[];
  markets: string[];
};

export type NormalizedFitment = {
  version: typeof NORMALIZED_FITMENT_VERSION;
  status: NormalizedFitmentStatus;
  vehicleType: NormalizedVehicleType;
  make: string | null;
  models: string[];
  chassisCodes: string[];
  yearRanges: VehicleYearRange[];
  applications: VehicleApplication[];
  confidence: Fitment["confidence"];
  source: NormalizedFitmentSource;
  verifiedAt: string | null;
  verifiedBy: string | null;
  note: string | null;
};

const MOTORCYCLE_MAKES = new Set([
  "Aprilia",
  "Ducati",
  "Harley-Davidson",
  "Husqvarna",
  "Indian",
  "Kawasaki",
  "KTM",
  "Moto Guzzi",
  "MV Agusta",
  "Triumph",
  "Yamaha",
]);

const MOTORCYCLE_SIGNAL =
  /\b(?:motorcycle|motorbike|moto|panigale|diavel|streetfighter|multistrada|superduke|ninja|fireblade|s\s?1000\s?rr|m\s?1000\s?rr|r\s?1250\s?gs|r\s?1300\s?gs)\b/i;
const EXPLICIT_UNIVERSAL_SIGNAL =
  /\b(?:universal|universal fit|fits all|all vehicles|універсальн(?:ий|а|е|і))\b/i;
const MERCH_SIGNAL =
  /\b(?:t-?shirt|hoodie|sweatshirt|cap|hat|beanie|mug|sticker|keychain|lanyard|мерч|футболк|худі|кепк|шапк|чашк|наліпк|брелок)\b/i;

function productEvidenceText(product: ShopProduct) {
  return [
    product.title?.ua,
    product.title?.en,
    product.category?.ua,
    product.category?.en,
    product.productType,
    product.collection?.ua,
    product.collection?.en,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" | ");
}

function inferVehicleType(product: ShopProduct, fitment: Fitment): NormalizedVehicleType {
  if (fitment.make && MOTORCYCLE_MAKES.has(fitment.make)) return "motorcycle";
  if (MOTORCYCLE_SIGNAL.test(productEvidenceText(product))) return "motorcycle";
  if (fitment.make) return "car";
  return "unknown";
}

function isExplicitlyUniversal(product: ShopProduct, fitment: Fitment) {
  if (fitment.make || fitment.models.length || fitment.chassisCodes.length) return false;
  const evidence = productEvidenceText(product);
  return EXPLICIT_UNIVERSAL_SIGNAL.test(evidence) || MERCH_SIGNAL.test(evidence);
}

function cleanStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function cleanYearRanges(values: unknown): VehicleYearRange[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const range = value as { from?: unknown; to?: unknown };
    const from = Number(range.from);
    const to = range.to == null || range.to === "" ? null : Number(range.to);
    if (!Number.isInteger(from) || from < 1886 || from > 2200) return [];
    if (to !== null && (!Number.isInteger(to) || to < from || to > 2200)) return [];
    return [{ from, to }];
  });
}

function cleanVehicleApplication(value: unknown): VehicleApplication | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const make = String(source.make ?? "").trim();
  if (!make) return null;
  return {
    vehicleType: source.vehicleType === "motorcycle" ? "motorcycle" : "car",
    make,
    models: cleanStrings(source.models),
    chassisCodes: cleanStrings(source.chassisCodes).map((item) => item.toUpperCase()),
    yearRanges: cleanYearRanges(source.yearRanges),
    engines: cleanStrings(source.engines),
    bodyStyles: cleanStrings(source.bodyStyles),
    drivetrains: cleanStrings(source.drivetrains),
    markets: cleanStrings(source.markets),
  };
}

function legacyApplication(
  vehicleType: NormalizedVehicleType,
  make: string | null,
  models: string[],
  chassisCodes: string[],
  yearRanges: VehicleYearRange[]
) {
  if (!make) return [];
  return [
    {
      vehicleType: vehicleType === "motorcycle" ? ("motorcycle" as const) : ("car" as const),
      make,
      models,
      chassisCodes,
      yearRanges,
      engines: [],
      bodyStyles: [],
      drivetrains: [],
      markets: [],
    },
  ];
}

export function classifyProductFitment(product: ShopProduct, fitment: Fitment): NormalizedFitment {
  if (isExplicitlyUniversal(product, fitment)) {
    return {
      version: NORMALIZED_FITMENT_VERSION,
      status: "universal",
      vehicleType: "universal",
      make: null,
      models: [],
      chassisCodes: [],
      yearRanges: [],
      applications: [],
      confidence: "high",
      source: "automatic",
      verifiedAt: null,
      verifiedBy: null,
      note: null,
    };
  }

  const status =
    fitment.confidence === "high" || fitment.confidence === "medium" ? "inferred" : "needs_review";

  const vehicleType = inferVehicleType(product, fitment);
  const models = cleanStrings(fitment.models);
  const chassisCodes = cleanStrings(fitment.chassisCodes).map((value) => value.toUpperCase());
  const yearRanges = cleanYearRanges(fitment.yearRanges);
  return {
    version: NORMALIZED_FITMENT_VERSION,
    status,
    vehicleType,
    make: fitment.make,
    models,
    chassisCodes,
    yearRanges,
    applications: legacyApplication(vehicleType, fitment.make, models, chassisCodes, yearRanges),
    confidence: fitment.confidence,
    source: "automatic",
    verifiedAt: null,
    verifiedBy: null,
    note: null,
  };
}

export function parseNormalizedFitment(value: string | null | undefined): NormalizedFitment | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Omit<Partial<NormalizedFitment>, "version"> & {
      version?: number;
    };
    if (parsed.version !== 1 && parsed.version !== NORMALIZED_FITMENT_VERSION) return null;
    if (
      !parsed.status ||
      !["inferred", "verified", "universal", "needs_review"].includes(parsed.status)
    ) {
      return null;
    }
    if (
      !parsed.vehicleType ||
      !["car", "motorcycle", "universal", "unknown"].includes(parsed.vehicleType)
    ) {
      return null;
    }

    const isUniversal = parsed.status === "universal";
    const make = isUniversal ? null : String(parsed.make ?? "").trim() || null;
    const models = isUniversal ? [] : cleanStrings(parsed.models);
    const chassisCodes = isUniversal
      ? []
      : cleanStrings(parsed.chassisCodes).map((item) => item.toUpperCase());
    const yearRanges = isUniversal ? [] : cleanYearRanges(parsed.yearRanges);
    const parsedApplications = isUniversal
      ? []
      : (Array.isArray(parsed.applications) ? parsed.applications : [])
          .map(cleanVehicleApplication)
          .filter((item): item is VehicleApplication => Boolean(item));
    const applications = parsedApplications.length
      ? parsedApplications
      : legacyApplication(parsed.vehicleType, make, models, chassisCodes, yearRanges);
    const primary = applications[0];
    return {
      version: NORMALIZED_FITMENT_VERSION,
      status: parsed.status,
      vehicleType: isUniversal ? "universal" : (primary?.vehicleType ?? parsed.vehicleType),
      make: isUniversal ? null : (primary?.make ?? make),
      models: isUniversal ? [] : (primary?.models ?? models),
      chassisCodes: isUniversal ? [] : (primary?.chassisCodes ?? chassisCodes),
      yearRanges: isUniversal ? [] : (primary?.yearRanges ?? yearRanges),
      applications,
      confidence: ["high", "medium", "low", "unknown"].includes(String(parsed.confidence))
        ? (parsed.confidence as Fitment["confidence"])
        : "unknown",
      source: ["automatic", "manual", "import"].includes(String(parsed.source))
        ? (parsed.source as NormalizedFitmentSource)
        : "manual",
      verifiedAt: parsed.verifiedAt ? String(parsed.verifiedAt) : null,
      verifiedBy: parsed.verifiedBy ? String(parsed.verifiedBy) : null,
      note: parsed.note ? String(parsed.note).trim() || null : null,
    };
  } catch {
    return null;
  }
}

export function mergePersistedFitment(
  automatic: NormalizedFitment,
  persistedValue: string | null | undefined
) {
  return parseNormalizedFitment(persistedValue) ?? automatic;
}

export function resolveSearchFitment(
  automatic: Fitment,
  persistedValue: string | null | undefined
): Fitment {
  return resolveSearchFitments(automatic, persistedValue)[0];
}

export function resolveSearchFitments(
  automatic: Fitment,
  persistedValue: string | null | undefined
): Fitment[] {
  const persisted = parseNormalizedFitment(persistedValue);
  if (!persisted) return [automatic];
  if (persisted.status === "universal" || persisted.status === "needs_review") {
    return [
      {
        make: null,
        models: [],
        chassisCodes: [],
        yearRanges: [],
        confidence: "unknown",
      },
    ];
  }
  const confidence = persisted.status === "verified" ? "high" : persisted.confidence;
  const fitments = persisted.applications.map((application) => ({
    make: application.make,
    models: application.models,
    chassisCodes: application.chassisCodes,
    yearRanges: application.yearRanges,
    confidence,
  }));
  return fitments.length
    ? fitments
    : [
        {
          make: persisted.make,
          models: persisted.models,
          chassisCodes: persisted.chassisCodes,
          yearRanges: persisted.yearRanges,
          confidence,
        },
      ];
}

export function normalizeManualFitment(
  input: unknown,
  actor: string,
  now = new Date()
): { data: NormalizedFitment | null; errors: string[] } {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const status = String(source.status ?? "") as NormalizedFitmentStatus;
  const errors: string[] = [];
  if (!(["verified", "universal", "needs_review"] as string[]).includes(status)) {
    errors.push("Status must be verified, universal, or needs_review");
  }

  const requestedVehicleType = String(source.vehicleType ?? "unknown");
  const vehicleType = (
    ["car", "motorcycle", "universal", "unknown"].includes(requestedVehicleType)
      ? requestedVehicleType
      : "unknown"
  ) as NormalizedVehicleType;
  const make = String(source.make ?? "").trim() || null;
  const requestedApplications = (Array.isArray(source.applications) ? source.applications : [])
    .map(cleanVehicleApplication)
    .filter((item): item is VehicleApplication => Boolean(item));
  const models = cleanStrings(source.models);
  const chassisCodes = cleanStrings(source.chassisCodes).map((item) => item.toUpperCase());
  const yearRanges = cleanYearRanges(source.yearRanges);
  const applications = requestedApplications.length
    ? requestedApplications
    : legacyApplication(vehicleType, make, models, chassisCodes, yearRanges);
  if (status === "verified" && applications.length === 0) {
    errors.push("Verified vehicle fitment requires a make");
  }
  if (status === "verified" && vehicleType === "universal") {
    errors.push("Verified vehicle fitment cannot use universal vehicle type");
  }
  if (errors.length) return { data: null, errors };

  const isUniversal = status === "universal";
  const isConfirmed = status === "verified" || isUniversal;
  const primary = applications[0];
  return {
    data: {
      version: NORMALIZED_FITMENT_VERSION,
      status,
      vehicleType: isUniversal ? "universal" : (primary?.vehicleType ?? vehicleType),
      make: isUniversal ? null : (primary?.make ?? make),
      models: isUniversal ? [] : (primary?.models ?? models),
      chassisCodes: isUniversal ? [] : (primary?.chassisCodes ?? chassisCodes),
      yearRanges: isUniversal ? [] : (primary?.yearRanges ?? yearRanges),
      applications: isUniversal ? [] : applications,
      confidence: isConfirmed ? "high" : "unknown",
      source: "manual",
      verifiedAt: isConfirmed ? now.toISOString() : null,
      verifiedBy: isConfirmed ? actor : null,
      note: String(source.note ?? "").trim() || null,
    },
    errors: [],
  };
}
