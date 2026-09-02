import { canonicalVehicleModelLabel } from "./shopVehicleTaxonomy";
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
  const categoryKey = CATEGORY_KEYS[product.productType ?? ""] ?? "needs-review";
  if (categoryKey === "needs-review") issues.push("category_unmapped");
  if (!vehicleTags.length) issues.push("vehicle_tags_missing");

  const correlateEngines = vehicleTags.length === 1;
  if (!correlateEngines && engines.length) issues.push("engine_vehicle_correlation_ambiguous");
  const applications = vehicleTags.map((rawVehicleTag) => {
    const candidates = makeEvidence.get(vehicleEvidenceKey(rawVehicleTag)) ?? new Set<string>();
    const withinProduct = [...candidates].filter((make) => rawMakes.includes(make));
    const evidenceMake = withinProduct.length === 1 ? withinProduct[0]! : null;
    const singleMake = rawMakes.length === 1 ? rawMakes[0]! : null;
    const inferredMake = evidenceMake || singleMake ? null : titleMakeEvidence(product, rawMakes, rawVehicleTag);
    const make = evidenceMake ?? singleMake ?? inferredMake;
    if (!make) issues.push("vehicle_make_correlation_ambiguous");
    const parsed = parseVehicleTag(rawVehicleTag, make);
    return {
      rawVehicleTag,
      make,
      ...parsed,
      engines: correlateEngines ? engines : [],
      verification: !make || (!correlateEngines && engines.length > 0)
        ? "NEEDS_REVIEW" as const
        : inferredMake
          ? "INFERRED" as const
          : "VERIFIED" as const,
    };
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
