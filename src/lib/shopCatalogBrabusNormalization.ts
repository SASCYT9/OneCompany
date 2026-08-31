import { createHash } from "node:crypto";

import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type BrabusSnapshotProduct = {
  id: string;
  slug: string;
  sku: string;
  scope?: string;
  title: { ua?: string; en?: string };
  tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};

export type BrabusApplication = {
  make: string;
  model: string;
  generation: string | null;
};

export type BrabusNormalization = {
  productId: string;
  variantId: string;
  variantSku: string;
  recordKey: string;
  applications: BrabusApplication[];
  engineRelevant: boolean;
  verification: "VERIFIED" | "NEEDS_REVIEW";
  issues: string[];
};

const chassisToModel: Record<string, string> = {
  W463: "G-Class", W463A: "G-Class", W465: "G-Class",
  W222: "S-Class", W223: "S-Class", V222: "S-Class", V223: "S-Class",
  X222: "S-Class", X223: "S-Class", Z223: "S-Class", C217: "S-Class", A217: "S-Class",
  V297: "EQS", X297: "EQS", X296: "EQS SUV",
  R230: "SL-Class", R231: "SL-Class", R232: "SL-Class",
  X290: "AMG GT", C190: "AMG GT", R190: "AMG GT", C192: "AMG GT",
  W177: "A-Class", V177: "A-Class",
  W205: "C-Class", S205: "C-Class", A205: "C-Class", C205: "C-Class",
  W206: "C-Class", S206: "C-Class", A206: "C-Class", C206: "C-Class",
  C257: "CLS-Class", X257: "CLS-Class",
  W213: "E-Class", S213: "E-Class", A238: "E-Class", C238: "E-Class",
  W214: "E-Class", S214: "E-Class", N293: "EQC",
  X247: "GLB", X253: "GLC", C253: "GLC", X254: "GLC", C254: "GLC",
  V167: "GLE", C167: "GLE", C292: "GLE", X166: "GLS", X167: "GLS",
  W447: "V-Class", V447: "V-Class", W470: "X-Class",
};

const makePatterns: Array<[string, RegExp]> = [
  ["Rolls-Royce", /\bRolls\s*[–—-]?\s*Royce\b/i],
  ["Range Rover", /\bRange\s+Rover\b/i],
  ["Mercedes-Benz", /\b(?:Mercedes(?:-Benz)?|Maybach|AMG)\b/i],
  ["Lamborghini", /\bLamborghini\b/i],
  ["Bentley", /\bBentley\b/i],
  ["Porsche", /\bPorsche\b/i],
  ["Smart", /\bsmart\b/i],
];

function nonMercedesModel(make: string, text: string) {
  const patterns: Record<string, Array<[string, RegExp]>> = {
    "Rolls-Royce": [["Ghost", /\bGhost\b/i], ["Cullinan", /\bCullinan\b/i]],
    Bentley: [["Continental GTC", /\bContinental\s+GTC\b/i], ["Continental GT", /\bContinental\s+GT\b/i]],
    Lamborghini: [["Urus", /\bUrus\b/i]],
    Porsche: [["911 Turbo", /\b911\s+Turbo\b/i], ["Taycan", /\bTaycan\b/i], ["911", /\b911\b/i]],
    "Range Rover": [["Range Rover Sport", /\bRange\s+Rover\s+Sport\b/i], ["Range Rover", /\bRange\s+Rover\b/i]],
    Smart: [["#1", /(?:Smart\s*)?#1\b/i], ["#3", /(?:Smart\s*)?#3\b/i]],
  };
  return patterns[make]?.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function canonicalLegacyMake(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mercedes" || normalized === "mercedes-benz") return "Mercedes-Benz";
  if (normalized === "rolls-royce") return "Rolls-Royce";
  if (normalized === "range-rover") return "Range Rover";
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function normalizeBrabusSnapshotProduct(product: BrabusSnapshotProduct): BrabusNormalization {
  const issues: string[] = [];
  const titleText = `${product.title.en ?? ""} ${product.title.ua ?? ""}`;
  const makes = [...new Set(makePatterns.filter(([, pattern]) => pattern.test(titleText)).map(([make]) => make))];
  // Maybach and AMG are Mercedes sub-brands; their appearance beside another explicit make is often
  // a product-name reference, so only non-Mercedes collisions are ambiguous.
  const nonMercedesMakes = makes.filter((make) => make !== "Mercedes-Benz");
  const make = nonMercedesMakes[0] ?? (makes.includes("Mercedes-Benz") ? "Mercedes-Benz" : null);
  if (nonMercedesMakes.length > 1) issues.push("authoritative_make_ambiguous");
  if (!make) issues.push("authoritative_make_missing");

  const chassis = [...new Set(
    [...titleText.matchAll(/[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/g)]
      .map((match) => match[1]!.replace(/\s+/g, "").toUpperCase())
  )];
  const applications: BrabusApplication[] = [];
  if (make === "Mercedes-Benz") {
    for (const generation of chassis) {
      const model = chassisToModel[generation];
      if (model) applications.push({ make, model, generation });
      else issues.push("chassis_model_unresolved");
    }
    if (!chassis.length) {
      const fitModels = [...new Set(product.tags
        .filter((tag) => tag.startsWith("fits-model:mercedes-benz:"))
        .map((tag) => tag.split(":").slice(2).join(":"))
        .filter(Boolean))];
      if (fitModels.length === 1) applications.push({ make, model: fitModels[0]!, generation: null });
      else issues.push("vehicle_application_unresolved");
    }
  } else if (make) {
    const model = nonMercedesModel(make, titleText);
    if (model) applications.push({ make, model, generation: null });
    else issues.push("vehicle_application_unresolved");
  }

  const legacyMakes = [...new Set(product.tags
    .filter((tag) => tag.startsWith("fits-make:"))
    .map((tag) => canonicalLegacyMake(tag.slice("fits-make:".length))))];
  if (make && legacyMakes.length && !legacyMakes.includes(make)) issues.push("legacy_fit_make_conflict");
  const engineRelevant = /\b(?:PowerXtra|performance\s+upgrade|turbo|engine|exhaust|downpipe|catalyst)\b/i.test(titleText);
  if (engineRelevant) issues.push("engine_identity_missing");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0];
  const uniqueApplications = [...new Map(applications.map((application) => [
    `${application.make}|${application.model}|${application.generation ?? "*"}`,
    application,
  ])).values()];
  const uniqueIssues = [...new Set(issues)].sort();
  return {
    productId: product.id,
    variantId: variant?.id ?? "",
    variantSku: variant?.sku?.trim() ?? "",
    recordKey: `${product.id}:${product.sku}`,
    applications: uniqueApplications,
    engineRelevant,
    verification: uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED",
    issues: uniqueIssues,
  };
}

export function buildBrabusSourceRecordDraft(input: { product: BrabusSnapshotProduct; sourceRevision: string }) {
  const normalization = normalizeBrabusSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`Brabus variant provenance cannot resolve ${leaf.fieldPath}`);
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
      mapperVersion: "brabus-snapshot-v1" as const,
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
      issueKey: `brabus:${issue}`,
      code: issue.toUpperCase(),
      rawPath: issue.startsWith("legacy_") ? "tags" : issue.startsWith("engine_") ? "title" : "$",
      details: { productId: input.product.id, supplierSku: input.product.sku },
    })),
  };
}
