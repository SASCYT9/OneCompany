import { canonicalVehicleModelLabel } from "./shopVehicleTaxonomy";
import type { ShopCatalogV2CompatibilityPolicy } from "./shopCatalogV2Compatibility";
import type { NormalizedFitment } from "./shopFitmentQuality";
import type { ShopifySnapshotProduct } from "./shopifyCatalogSnapshot";

export type KwVehicleApplication = {
  rawVehicleTag: string;
  make: string | null;
  model: string;
  chassisCodes: string[];
  yearFrom: number | null;
  yearTo: number | null;
  engines: string[];
  verification: "VERIFIED" | "INFERRED" | "NEEDS_REVIEW";
};

export type KwProductNormalization = {
  externalProductId: string;
  canonicalBrand: "KW Suspensions";
  categoryKey: string;
  applications: KwVehicleApplication[];
  issues: string[];
};

const MAKE_LABELS: Readonly<Record<string, string>> = {
  BMW: "BMW",
  MINI: "MINI",
  "MERCEDES-BENZ": "Mercedes-Benz",
  VW: "Volkswagen",
};

const CATEGORY_KEYS: Readonly<Record<string, string>> = {
  "Койловерна підвіска": "coilovers",
  "Пружини та спортивна підвіска": "springs-and-sport-suspension",
  "Гідравлічна система підйому підвіски": "hydraulic-lift-system",
  "Ліфт-комплект підвіски": "lift-kit",
  Амортизатор: "damper",
  "Верхня опора підвіски": "top-mount",
};

const BLOCKING_NORMALIZATION_ISSUES = new Set([
  "vehicle_tags_missing",
  "vehicle_make_correlation_ambiguous",
  "category_unmapped",
]);

export function kwNormalizationHasBlockingIssues(normalization: Pick<KwProductNormalization, "issues">) {
  return normalization.issues.some((issue) => BLOCKING_NORMALIZATION_ISSUES.has(issue));
}

function categoryKeyFor(product: ShopifySnapshotProduct) {
  const explicit = CATEGORY_KEYS[product.productType ?? ""];
  if (explicit) return explicit;
  const title = typeof product.title === "string" ? product.title : "";
  if (/\bKW\s+HAS\b|комплект\s+пружин|height[ -]?adjustable\s+spring/iu.test(title)) return "springs-and-sport-suspension";
  return "needs-review";
}

function prefixedTags(product: ShopifySnapshotProduct, prefix: string) {
  const normalizedPrefix = prefix.toLowerCase();
  return (product.tags ?? [])
    .filter((tag) => tag.toLowerCase().startsWith(normalizedPrefix))
    .map((tag) => tag.slice(prefix.length).trim())
    .filter(Boolean);
}

function metafieldStringArray(product: ShopifySnapshotProduct, namespace: string, key: string) {
  const metafield = product.metafields.find((entry) => entry.namespace === namespace && entry.key === key);
  if (typeof metafield?.value !== "string" || !metafield.value.trim()) return [];
  try {
    const parsed = JSON.parse(metafield.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  } catch {
    return [];
  }
}

function sourceMakes(product: ShopifySnapshotProduct) {
  const tags = prefixedTags(product, "brand:");
  return tags.length ? tags : metafieldStringArray(product, "custom", "brand");
}

function sourceVehicles(product: ShopifySnapshotProduct) {
  const tags = prefixedTags(product, "veh:");
  if (tags.length) return tags;
  return metafieldStringArray(product, "custom", "model")
    .flatMap((value) => value.split(/\s+\|\s+/u))
    .map((value) => value.replace(/,/gu, " ").replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

function canonicalMake(raw: string) {
  const upper = raw.trim().toUpperCase();
  return MAKE_LABELS[upper] ?? upper.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

function vehicleEvidenceKey(value: string) {
  return value.toLowerCase().replace(/\b(?:0[1-9]|1[0-2])\/(?:19|20)\d{2}\s*-\s*(?:(?:0[1-9]|1[0-2])\/(?:19|20)\d{2})?\s*$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function parseVehicleTag(rawVehicleTag: string, make: string | null) {
  const date = /\b(?:0[1-9]|1[0-2])\/((?:19|20)\d{2})\s*-\s*(?:(?:0[1-9]|1[0-2])\/((?:19|20)\d{2}))?\s*$/u.exec(rawVehicleTag);
  const yearFrom = date?.[1] ? Number(date[1]) : null;
  const yearTo = date?.[2] ? Number(date[2]) : null;
  const label = (date ? rawVehicleTag.slice(0, date.index) : rawVehicleTag).trim();
  const chassisMatch = /\(([^)]+)\)/u.exec(label);
  const chassisCodes = chassisMatch
    ? [...new Set(chassisMatch[1]!.split(/[\s,;/]+/u).map((value) => value.trim().toUpperCase()).filter(Boolean))]
    : [];
  const rawModel = (chassisMatch ? label.slice(0, chassisMatch.index) : label).trim();
  let model = rawModel;
  if (make === "BMW" && /^[1-8]$/u.test(model)) model = `${model} Series`;
  else if (make) model = canonicalVehicleModelLabel(make, model);
  return { model, chassisCodes, yearFrom, yearTo };
}

function curatedVehicleMakes(model: string, chassisCodes: readonly string[]) {
  const label = model.toUpperCase();
  const chassis = new Set(chassisCodes.map((value) => value.toUpperCase()));
  if (/^LEON(?:\s|$)/u.test(label)) {
    if (["KU1", "KUG", "KU8", "KUD"].some((code) => chassis.has(code))) return ["Cupra"];
    if (["KLG", "KLD"].some((code) => chassis.has(code))) return ["Seat"];
  }
  if (label === "ATECA") return ["Cupra", "Seat"];
  if (label === "124 SPIDER") return ["Abarth", "Fiat"];
  if (label === "PUNTO EVO") return ["Abarth", "Fiat"];
  if (label === "BRZ") return ["Subaru"];
  if (/^(?:GR 86|GT 86)/u.test(label)) return ["Toyota"];
  if (label.startsWith("FR-S")) return ["Scion"];
  if (/^(?:MINI COUNTRYMAN|MINI CLUBMAN)/u.test(label)) return ["MINI"];
  if (/^(?:X2|2 GRAN COUPE|Z4 ROADSTER)/u.test(label)) return ["BMW"];
  if (/^(?:PASSAT|GOLF|POLO|ID\.|TIGUAN|UP(?:\s|$))/u.test(label)) return ["Volkswagen"];
  if (/^(?:SUPERB|KODIAQ|KAROQ|FABIA|ENYAQ)/u.test(label)) return ["Skoda"];
  if (/^(?:TARRACO|IBIZA|ALHAMBRA)/u.test(label)) return ["Seat"];
  if (/^Q4 E-TRON/u.test(label)) return ["Audi"];
  return [];
}

function titleMakeEvidence(product: ShopifySnapshotProduct, rawMakes: readonly string[], rawVehicleTag: string) {
  if (typeof product.title !== "string" || !product.title.trim()) return null;
  const dateIndex = rawVehicleTag.search(/\b(?:0[1-9]|1[0-2])\/(?:19|20)\d{2}/u);
  const label = (dateIndex >= 0 ? rawVehicleTag.slice(0, dateIndex) : rawVehicleTag).trim();
  const model = label.replace(/\s*\([^)]*\).*$/u, "").trim().toUpperCase();
  if (!model) return null;
  const title = product.title.toUpperCase();
  const matches = rawMakes.filter((make) => {
    const sourceLabels = make === "Volkswagen" ? ["VW", "VOLKSWAGEN"] : [make.toUpperCase()];
    return sourceLabels.some((sourceMake) => title.includes(`${sourceMake} ${model}`));
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** Learns make→vehicle correlations only from unambiguous single-make products. */
export function buildKwVehicleMakeEvidence(products: readonly ShopifySnapshotProduct[]) {
  const evidence = new Map<string, Set<string>>();
  for (const product of products) {
    const makes = [...new Set(sourceMakes(product).map(canonicalMake))];
    if (makes.length !== 1) continue;
    for (const vehicle of sourceVehicles(product)) {
      const key = vehicleEvidenceKey(vehicle);
      if (!key) continue;
      const values = evidence.get(key) ?? new Set<string>();
      values.add(makes[0]!);
      evidence.set(key, values);
    }
  }
  return evidence;
}

export function normalizeKwShopifyProduct(
  product: ShopifySnapshotProduct,
  makeEvidence: ReadonlyMap<string, ReadonlySet<string>>
): KwProductNormalization {
  const issues: string[] = [];
  const rawMakes = [...new Set(sourceMakes(product).map(canonicalMake))];
  const vehicleTags = [...new Set(sourceVehicles(product))];
  const engines = [...new Set(prefixedTags(product, "eng:").map((value) => value.replace(/\s+/gu, " ").trim()))];
  const categoryKey = categoryKeyFor(product);
  if (categoryKey === "needs-review") issues.push("category_unmapped");
  if (!vehicleTags.length) issues.push("vehicle_tags_missing");

  const resolvedVehicles = vehicleTags.map((rawVehicleTag) => {
    const candidates = makeEvidence.get(vehicleEvidenceKey(rawVehicleTag)) ?? new Set<string>();
    const withinProduct = [...candidates].filter((make) => rawMakes.includes(make));
    const evidenceMake = withinProduct.length === 1 ? withinProduct[0]! : null;
    const singleMake = rawMakes.length === 1 ? rawMakes[0]! : null;
    const inferredMake = evidenceMake || singleMake ? null : titleMakeEvidence(product, rawMakes, rawVehicleTag);
    const initialMake = evidenceMake ?? singleMake ?? inferredMake;
    const rawParsed = parseVehicleTag(rawVehicleTag, null);
    const curatedMakes = initialMake ? [] : curatedVehicleMakes(rawParsed.model, rawParsed.chassisCodes).filter((make) => !rawMakes.length || rawMakes.includes(make));
    const makes = initialMake ? [initialMake] : curatedMakes;
    if (!makes.length) issues.push("vehicle_make_correlation_ambiguous");
    return { rawVehicleTag, makes, rawParsed, inferred: Boolean(inferredMake) || curatedMakes.length > 0 };
  });
  const applicationCount = resolvedVehicles.reduce((count, vehicle) => count + Math.max(vehicle.makes.length, 1), 0);
  const correlateEngines = applicationCount === 1;
  if (!correlateEngines && engines.length) issues.push("engine_vehicle_correlation_ambiguous");
  const applications = resolvedVehicles.flatMap(({ rawVehicleTag, makes, rawParsed, inferred }) => {
    const resolvedMakes: Array<string | null> = makes.length ? makes : [null];
    return resolvedMakes.map((make) => ({
      rawVehicleTag,
      make,
      ...parseVehicleTag(rawVehicleTag, make),
      engines: correlateEngines ? engines : [],
      verification: !make ? "NEEDS_REVIEW" as const : inferred ? "INFERRED" as const : "VERIFIED" as const,
    }));
  });

  return {
    externalProductId: product.id,
    canonicalBrand: "KW Suspensions",
    categoryKey,
    applications,
    issues: [...new Set(issues)].sort(),
  };
}

export function normalizeKwShopifyCatalog(products: readonly ShopifySnapshotProduct[]) {
  const evidence = buildKwVehicleMakeEvidence(products);
  return products.map((product) => normalizeKwShopifyProduct(product, evidence));
}

export function buildKwCompatibilityPolicy(
  productId: string,
  normalization: KwProductNormalization
): ShopCatalogV2CompatibilityPolicy {
  const clauses = normalization.applications.map((application, index) => {
    const constraints: ShopCatalogV2CompatibilityPolicy["clauses"][number]["constraints"] = [
      { dimension: "scope", state: "EXACT", values: ["auto"] },
      ...(application.make ? [{ dimension: "make", state: "EXACT", values: [application.make] } as const] : [{ dimension: "make", state: "UNKNOWN" } as const]),
      { dimension: "model", state: "EXACT", values: [application.model] },
      ...(application.chassisCodes.length ? [
        { dimension: "generation", state: "EXACT", values: application.chassisCodes },
        { dimension: "chassis", state: "EXACT", values: application.chassisCodes },
      ] as const : [{ dimension: "generation", state: "UNKNOWN" } as const]),
      ...(application.yearFrom !== null || application.yearTo !== null
        ? [{ dimension: "year", state: "EXACT", values: [{ from: application.yearFrom, to: application.yearTo }] } as const]
        : [{ dimension: "year", state: "UNKNOWN" } as const]),
      ...(application.engines.length
        ? [{ dimension: "engine", state: "EXACT", values: application.engines } as const]
        : [{ dimension: "engine", state: "UNKNOWN" } as const]),
    ];
    return {
      id: `kw-${index + 1}`,
      constraints,
      verification: application.verification,
      sourceRef: `shopify:${normalization.externalProductId}:tag:${application.rawVehicleTag}`,
    };
  });
  const needsReview = kwNormalizationHasBlockingIssues(normalization) || clauses.some((clause) => clause.verification === "NEEDS_REVIEW");
  return {
    version: 2,
    mode: clauses.length && !needsReview ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
    target: { productId },
    requiredDimensions: ["make", "model"],
    dimensionDefaults: { engine: "UNKNOWN", fuel: "UNKNOWN" },
    clauses,
  };
}

export function buildKwNormalizedFitment(normalization: KwProductNormalization): NormalizedFitment {
  const applications = normalization.applications.flatMap((application) => application.make ? [{
    vehicleType: "car" as const,
    make: application.make,
    models: [application.model],
    chassisCodes: application.chassisCodes,
    yearRanges: application.yearFrom === null ? [] : [{ from: application.yearFrom, to: application.yearTo }],
    engines: application.engines,
    fuel: null,
    bodyStyles: [],
    drivetrains: [],
    markets: [],
    transmission: null,
    opfGpf: "unknown" as const,
  }] : []);
  const makes = [...new Set(applications.map((application) => application.make))];
  const hasReview = kwNormalizationHasBlockingIssues(normalization) || normalization.applications.some((application) => application.verification === "NEEDS_REVIEW");
  const hasInference = normalization.applications.some((application) => application.verification === "INFERRED");
  return {
    version: 2,
    status: hasReview ? "needs_review" : hasInference ? "inferred" : "verified",
    vehicleType: applications.length ? "car" : "unknown",
    make: makes.length === 1 ? makes[0]! : null,
    models: [...new Set(applications.flatMap((application) => application.models))],
    chassisCodes: [...new Set(applications.flatMap((application) => application.chassisCodes))],
    yearRanges: applications.flatMap((application) => application.yearRanges),
    applications,
    confidence: hasReview ? "unknown" : hasInference ? "medium" : "high",
    source: "import",
    verifiedAt: null,
    verifiedBy: null,
    note: normalization.issues.length ? normalization.issues.join(", ") : null,
    dependency: null,
  };
}
