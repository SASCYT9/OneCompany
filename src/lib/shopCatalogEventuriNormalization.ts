import { createHash } from "node:crypto";

import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type EventuriSnapshotProduct = {
  id: string;
  slug: string;
  sku: string;
  scope?: string;
  brand?: string;
  title: { ua?: string; en?: string };
  tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};

export type EventuriApplication = {
  make: string;
  model: string;
  generation: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCode: string | null;
};

export type EventuriNormalization = {
  productId: string;
  variantId: string;
  variantSku: string;
  recordKey: string;
  mode: "UNIVERSAL" | "VEHICLE_SPECIFIC" | "PARENT_DEPENDENT" | "NEEDS_REVIEW";
  engineRelevant: boolean;
  applications: EventuriApplication[];
  verification: "VERIFIED" | "NEEDS_REVIEW";
  issues: string[];
};

const makes = new Map(
  ["Audi", "Bentley", "BMW", "Chevrolet", "Honda", "Lamborghini", "Lotus", "Mercedes-Benz", "MINI", "Porsche", "SEAT", "Toyota", "Volkswagen"]
    .map((make) => [make.toLowerCase(), make])
);
const enginePattern = /^(?:B48|B58|N55|S54|S55|S58|S62|S63|S65|S68|LT6|LT7|EA825|EA839T|EA888(?:\.4)?|M139|K20C1)$/i;
const genericEnginePattern = /^(?:V6|V8)$/i;
const chassisPattern = /^(?:(?:E|F|G|W|C|A)\d{2,3}(?:\.\d)?|8[SVY]|B[89]|F3|FK8|FL5|MK\d(?:\.5)?|GR4|991(?:\.[12])?|C8)(?:\s+(?:M[2345]|W465))?$/i;

function isChassisToken(make: string | null, token: string) {
  if (make === "Mercedes-Benz" && /^(?:A35|A45S?|A250|C63S?|G63)$/i.test(token)) return false;
  return chassisPattern.test(token);
}

function makeForModel(model: string, fallback: string) {
  if (/^Z4$/i.test(model)) return "BMW";
  return fallback;
}

function parseYears(value: string) {
  const range = /\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/.exec(value);
  if (range) return { yearFrom: Number(range[1]), yearTo: Number(range[2]) };
  const open = /\b((?:19|20)\d{2})\s*(?:\+|-)(?:\.|\s|$)/.exec(value);
  return open ? { yearFrom: Number(open[1]), yearTo: null } : { yearFrom: null, yearTo: null };
}

function isVehicleIndependentAccessory(product: EventuriSnapshotProduct) {
  const corpus = `${product.slug} ${product.title.en ?? ""}`.toLowerCase();
  return /cleaning-kit|intake-scoop|headlamp.*duct|seat-back|retrofit-kit/.test(corpus) ||
    product.tags.includes("category:brace");
}

export function normalizeEventuriSnapshotProduct(product: EventuriSnapshotProduct): EventuriNormalization {
  const issues: string[] = [];
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0];
  const corpus = `${product.slug} ${product.title.en ?? ""} ${product.title.ua ?? ""} ${product.tags.join(" ")}`;
  const years = parseYears(corpus);
  const makeTags = product.tags.map((tag) => makes.get(tag.toLowerCase())).filter((value): value is string => Boolean(value));
  const uniqueMakes = [...new Set(makeTags)];
  if (uniqueMakes.length > 1) issues.push("make_ambiguous");
  const make = uniqueMakes[0] ?? null;
  const specificEngines = [...new Set(
    [...product.tags, ...[...corpus.matchAll(/\b(?:B48|B58|N55|S54|S55|S58|S62|S63|S65|S68|LT6|LT7|EA825|EA839T|EA888(?:\.4)?|M139|K20C1)\b/gi)].map((match) => match[0])]
      .filter((value) => enginePattern.test(value))
      .map((value) => value.toUpperCase())
  )];
  const independent = isVehicleIndependentAccessory(product);
  const replacementFilter = /replacement-filter/.test(product.slug) || product.tags.includes("replacement-filter");
  const cleaningKit = /air-filter-cleaning-kit/.test(product.slug);
  const engineRelevant = !independent && !replacementFilter;
  if (engineRelevant && specificEngines.length === 0) issues.push("engine_identity_missing");

  const excluded = new Set(["eventuri", "store:main", ...uniqueMakes.map((value) => value.toLowerCase())]);
  const tokens = product.tags.filter((tag) =>
    !excluded.has(tag.toLowerCase()) &&
    !tag.startsWith("category:") &&
    !enginePattern.test(tag) &&
    !genericEnginePattern.test(tag) &&
    tag !== "replacement-filter" &&
    !/^type\s+/i.test(tag)
  );
  const rows: Array<{ make: string; model: string; generations: string[] }> = [];
  for (const token of tokens) {
    const combinedBmw = /^([EFG]\d{2})\s+(M[2345])$/i.exec(token);
    if (make === "BMW" && combinedBmw) {
      rows.push({ make, model: combinedBmw[2]!.toUpperCase(), generations: [combinedBmw[1]!.toUpperCase()] });
      continue;
    }
    if (make === "Mercedes-Benz" && /^G63\s+W465$/i.test(token)) {
      rows.push({ make, model: "G63", generations: ["W465"] });
      continue;
    }
    if (isChassisToken(make, token)) {
      if (rows.length) rows.at(-1)!.generations.push(token.split(/\s+/)[0]!.toUpperCase());
      continue;
    }
    if (make) rows.push({ make: makeForModel(token, make), model: token, generations: [] });
  }
  const allGenerations = [...new Set(rows.flatMap((row) => row.generations))];
  if (allGenerations.length === 1) {
    for (const row of rows) if (row.generations.length === 0) row.generations.push(allGenerations[0]!);
  }
  if (rows.length > 1 && allGenerations.length > 1 && rows.some((row) => row.generations.length === 0)) {
    issues.push("application_generation_correlation_ambiguous");
  }
  if (!make && rows.length) issues.push("make_missing");
  const applications: EventuriApplication[] = [];
  if (make) {
    for (const row of rows) {
      const generations = row.generations.length ? row.generations : [null];
      const engines = engineRelevant && specificEngines.length ? specificEngines : [null];
      for (const generation of generations) {
        for (const engineCode of engines) {
          applications.push({ make: row.make, model: row.model, generation, ...years, engineCode });
        }
      }
    }
  }
  const uniqueApplications = [...new Map(applications.map((application) => [
    `${application.make}|${application.model}|${application.generation ?? "*"}|${application.engineCode ?? "*"}`,
    application,
  ])).values()];

  let mode: EventuriNormalization["mode"];
  if (cleaningKit) mode = "UNIVERSAL";
  else if (replacementFilter) {
    mode = "PARENT_DEPENDENT";
    issues.push("parent_product_identity_missing");
  } else if (uniqueApplications.length) mode = "VEHICLE_SPECIFIC";
  else {
    mode = "NEEDS_REVIEW";
    issues.push("vehicle_application_unresolved");
  }
  const uniqueIssues = [...new Set(issues)].sort();
  return {
    productId: product.id,
    variantId: variant?.id ?? "",
    variantSku: variant?.sku?.trim() ?? "",
    recordKey: `${product.id}:${product.sku}`,
    mode: uniqueIssues.length ? "NEEDS_REVIEW" : mode,
    engineRelevant,
    applications: uniqueApplications,
    verification: uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED",
    issues: uniqueIssues,
  };
}

export function buildEventuriSourceRecordDraft(input: { product: EventuriSnapshotProduct; sourceRevision: string }) {
  const normalization = normalizeEventuriSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`Eventuri variant provenance cannot resolve ${leaf.fieldPath}`);
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return {
      fieldPath: leaf.fieldPath,
      ordinal: leaf.ordinal,
      rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const),
      canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value,
      mappingStatus: "MAPPED" as const,
      mapperVersion: "eventuri-snapshot-v1" as const,
      confidence: 1 as const,
      reason: legacyScope ? "audited LEGACY SHOP scope maps to auto" : null,
      productId: input.product.id,
      variantId: variant?.id ?? null,
    };
  });
  return {
    sourceRecord: {
      recordKey: normalization.recordKey,
      sourceRevision: input.sourceRevision,
      rawPayload: input.product,
      payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"),
      productId: input.product.id,
    },
    provenance,
    normalization,
    issues: normalization.issues.map((issue) => ({
      issueKey: `eventuri:${issue}`,
      code: issue.toUpperCase(),
      rawPath: issue.includes("engine") ? "tags" : "$",
      details: { productId: input.product.id, supplierSku: input.product.sku, mode: normalization.mode },
    })),
  };
}
