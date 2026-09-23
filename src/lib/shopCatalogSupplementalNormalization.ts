import { createHash } from "node:crypto";

import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";
import { normalizeSupplierFitmentContract, supplierContractToNormalizedFitment } from "./shopImportFitment";
import { supplierFitmentV2ToShopCatalogV2Policy } from "./shopImportFitmentV2";
import type { ShopCatalogV2CompatibilityPolicy } from "./shopCatalogV2Compatibility";

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
  revozport: {
    brand: "Revozport",
    sourceKey: "revozport-workbook-fitment-v2",
    displayName: "Revozport workbook and official SKU fitment",
    engineRelevant: false,
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
  fitment?: unknown;
  fitmentAudit?: unknown;
  [key: string]: unknown;
};

export type SupplementalCatalogNormalization = {
  source: ShopCatalogSupplementalSource;
  scope: "auto" | "moto";
  productId: string;
  variantId: null;
  recordKey: string;
  mode: "NEEDS_REVIEW" | "VEHICLE_SPECIFIC" | "UNIVERSAL";
  engineRelevant: boolean;
  applications: Array<{
    scope?: "auto" | "moto";
    make: string;
    model: string;
    generation: string | null;
    yearFrom: number | null;
    yearTo: number | null;
    engineCode: string | null;
    fuel: string | null;
    opfGpf?: string | null;
    transmission?: string | null;
  }>;
  verification: "NEEDS_REVIEW" | "VERIFIED";
  compatibilityPolicy: ShopCatalogV2CompatibilityPolicy | null;
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
  const scope: "auto" | "moto" = product.scope?.trim().toLowerCase() === "moto" ? "moto" : "auto";
  const identity = product.sku?.trim() || product.slug.trim();
  if (!product.id.trim() || !identity)
    throw new TypeError("Supplemental product identity is incomplete");
  if (source === "revozport") {
    const parsed = normalizeSupplierFitmentContract(product.fitment);
    const contract = parsed.data;
    if (contract?.version === 2) {
      const compatibilityPolicy = supplierFitmentV2ToShopCatalogV2Policy(contract, {
        productId: product.id,
        variantId: null,
      });
      if (!compatibilityPolicy) {
        return {
          source,
          scope,
          productId: product.id,
          variantId: null,
          recordKey: `${product.id}:${identity}`,
          mode: "NEEDS_REVIEW" as const,
          engineRelevant: false,
          applications: [],
          verification: "NEEDS_REVIEW" as const,
          compatibilityPolicy: null,
          issues: ["supplier_fitment_policy_unresolved"],
        };
      }
      const normalized = supplierContractToNormalizedFitment(contract);
      const applications = normalized.applications.flatMap((application, index) => {
        if (!application.make || !application.models[0]) return [];
        const clause = contract.mode === "vehicle_specific" ? contract.policy.clauses[index] : null;
        const generation = clause?.constraints.find((item) => item.dimension === "generation");
        const years = clause?.constraints.find((item) => item.dimension === "year");
        const yearRange = years?.state === "EXACT" && typeof years.values[0] === "object"
          ? years.values[0]
          : null;
        return [{
          scope,
          make: application.make,
          model: application.models[0],
          generation: generation?.state === "EXACT" && typeof generation.values[0] === "string"
            ? generation.values[0]
            : application.chassisCodes[0] ?? null,
          yearFrom: yearRange?.from ?? null,
          yearTo: yearRange?.to ?? null,
          engineCode: null,
          fuel: application.fuel ?? null,
          opfGpf: application.opfGpf ?? null,
          transmission: application.transmission ?? null,
        }];
      });
      const auditRows = Array.isArray(product.fitmentAudit) ? product.fitmentAudit : [];
      const unresolvedRows = auditRows.filter((row) => {
        const resolution = String((row as Record<string, unknown>)?.resolution ?? "");
        return !["official_sku_url_confirmed", "corrected_from_official_sku_and_page"].includes(resolution);
      }).length;
      const issues = [
        ...(parsed.errors ?? []).map((error) => `supplier_fitment:${error.code}:${error.path}`),
        ...(unresolvedRows ? [`fitment_source_rows_need_review:${unresolvedRows}`] : []),
      ];
      return {
        source,
        scope,
        productId: product.id,
        variantId: null,
        recordKey: `${product.id}:${identity}`,
        mode: compatibilityPolicy.mode === "VEHICLE_SPECIFIC" ? "VEHICLE_SPECIFIC" as const
          : compatibilityPolicy.mode === "UNIVERSAL" ? "UNIVERSAL" as const : "NEEDS_REVIEW" as const,
        engineRelevant: false,
        applications,
        verification: compatibilityPolicy.clauses.length > 0 &&
          compatibilityPolicy.clauses.every((clause) => clause.verification === "VERIFIED")
          ? "VERIFIED" as const : "NEEDS_REVIEW" as const,
        compatibilityPolicy,
        issues,
      };
    }
  }
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
    compatibilityPolicy: null,
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
