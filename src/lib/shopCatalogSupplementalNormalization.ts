import { createHash } from "node:crypto";

import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export const SHOP_CATALOG_SUPPLEMENTAL_SOURCES = {
  bootmod3: {
    brand: "BootMod3",
    sourceKey: "bootmod3-catalog-snapshot-v1",
    displayName: "BootMod3 immutable catalog snapshot",
    engineRelevant: true,
  },
  "fi-exhaust": {
    brand: "Fi EXHAUST",
    sourceKey: "fi-exhaust-catalog-snapshot-v1",
    displayName: "Fi EXHAUST immutable catalog snapshot",
    engineRelevant: true,
  },
  "g-sport": {
    brand: "G-Sport by GESi",
    sourceKey: "g-sport-catalog-snapshot-v1",
    displayName: "G-Sport immutable catalog snapshot",
    engineRelevant: false,
  },
  "kw-suspensions": {
    brand: "KW Suspensions",
    sourceKey: "kw-suspensions-catalog-snapshot-v1",
    displayName: "KW Suspensions immutable catalog snapshot",
    engineRelevant: true,
  },
} as const;

export type ShopCatalogSupplementalSource = keyof typeof SHOP_CATALOG_SUPPLEMENTAL_SOURCES;

export type SupplementalSnapshotProduct = {
  id: string;
  slug: string;
  sku?: string | null;
  scope?: string;
  brand?: string;
  title: { ua?: string; en?: string };
  tags?: string[];
  variants?: Array<{ id: string; sku?: string | null; isDefault?: boolean }>;
  [key: string]: unknown;
};

export type SupplementalCatalogNormalization = {
  source: ShopCatalogSupplementalSource;
  scope: "auto" | "moto";
  productId: string;
  variantId: null;
  recordKey: string;
  mode: "NEEDS_REVIEW";
  engineRelevant: boolean;
  applications: [];
  verification: "NEEDS_REVIEW";
  issues: string[];
};

function sourceFromBrand(brand: string | null | undefined) {
  const normalized = brand?.trim().toLowerCase();
  const source = Object.entries(SHOP_CATALOG_SUPPLEMENTAL_SOURCES).find(
    ([, descriptor]) => descriptor.brand.toLowerCase() === normalized
  )?.[0] as ShopCatalogSupplementalSource | undefined;
  if (!source)
    throw new TypeError(`Unsupported supplemental catalog brand: ${brand ?? "<missing>"}`);
  return source;
}

export function normalizeSupplementalCatalogSnapshotProduct(
  product: SupplementalSnapshotProduct,
  expectedSource?: ShopCatalogSupplementalSource
): SupplementalCatalogNormalization {
  const source = sourceFromBrand(product.brand);
  if (expectedSource && source !== expectedSource) {
    throw new TypeError(
      `Supplemental source mismatch: expected ${expectedSource}, received ${source}`
    );
  }
  const scope = product.scope?.trim().toLowerCase() === "moto" ? "moto" : "auto";
  const identity = product.sku?.trim() || product.slug.trim();
  if (!product.id.trim() || !identity)
    throw new TypeError("Supplemental product identity is incomplete");
  return {
    source,
    scope,
    productId: product.id,
    variantId: null,
    recordKey: `${product.id}:${identity}`,
    mode: "NEEDS_REVIEW",
    engineRelevant: SHOP_CATALOG_SUPPLEMENTAL_SOURCES[source].engineRelevant,
    applications: [],
    verification: "NEEDS_REVIEW",
    issues: ["compatibility_evidence_requires_review"],
  };
}

export function buildSupplementalCatalogSourceRecordDraft(input: {
  product: SupplementalSnapshotProduct;
  sourceRevision: string;
  expectedSource?: ShopCatalogSupplementalSource;
}) {
  const normalization = normalizeSupplementalCatalogSnapshotProduct(
    input.product,
    input.expectedSource
  );
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants?.[leaf.ordinal] : null;
    if (variantField && !variant) {
      throw new Error(`Supplemental variant provenance cannot resolve ${leaf.fieldPath}`);
    }
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return {
      fieldPath: leaf.fieldPath,
      ordinal: leaf.ordinal,
      rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const),
      canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope
        ? "scope"
        : variantField
          ? leaf.fieldPath.slice("variants.".length)
          : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value,
      mappingStatus: "MAPPED" as const,
      mapperVersion: `supplemental-${normalization.source}-snapshot-v1`,
      confidence: 1,
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
      issueKey: `${normalization.source}:${issue}`,
      code: issue.toUpperCase(),
      rawPath: "$",
      details: {
        productId: input.product.id,
        supplierSku: input.product.sku ?? null,
        source: normalization.source,
        decision: "Preserve the product but require reviewed fitment evidence before activation",
      },
    })),
  };
}

function builder(source: ShopCatalogSupplementalSource) {
  return (input: { product: SupplementalSnapshotProduct; sourceRevision: string }) =>
    buildSupplementalCatalogSourceRecordDraft({ ...input, expectedSource: source });
}

export const buildBootmod3SourceRecordDraft = builder("bootmod3");
export const buildFiExhaustSupplementalSourceRecordDraft = builder("fi-exhaust");
export const buildGSportSourceRecordDraft = builder("g-sport");
export const buildKwSuspensionsSupplementalSourceRecordDraft = builder("kw-suspensions");
