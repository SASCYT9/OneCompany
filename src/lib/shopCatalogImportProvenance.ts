import { flattenShopCatalogRawPayload, type ShopCatalogRawLeaf } from "./shopCatalogSourceCoverage";

export type ShopCatalogImportProvenanceRow = {
  sourceRecordId: string;
  fieldPath: string;
  ordinal: number;
  rawValue: unknown;
  canonicalEntityType: "PRODUCT" | "VARIANT";
  canonicalEntityId: string;
  canonicalField: string;
  normalizedValue: unknown;
  mappingStatus: "MAPPED";
  mapperVersion: string;
  confidence: number;
  reason: null;
  productId: string;
  variantId: string | null;
};

type ImportPayload = {
  product: {
    variants: readonly { id?: unknown; [key: string]: unknown }[];
  };
  [key: string]: unknown;
};

function externalVariantId(value: unknown, index: number) {
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim()) {
    throw new Error(`Variant ${index} is missing an external id`);
  }
  return String(value);
}

/**
 * Builds immutable raw-leaf provenance while resolving nested variant leaves by
 * their path-local ordinal. The flattener's ordinal is per field path, so a
 * global ordinal must never be used as a variant array index.
 */
export function buildShopCatalogImportProvenance(input: {
  rawPayload: ImportPayload;
  productId: string;
  variantIds: ReadonlyMap<string, string>;
  mapperVersion: string;
  sourceRecordId: string;
}): ShopCatalogImportProvenanceRow[] {
  const variants = input.rawPayload.product.variants;
  const ownersByPath = new Map<string, string[]>();
  const variantIdsByIndex = variants.map((variant, index) => {
    const externalId = externalVariantId(variant.id, index);
    const canonicalId = input.variantIds.get(externalId);
    if (!canonicalId?.trim())
      throw new Error(`Missing canonical binding for variant ${externalId}`);
    return canonicalId;
  });
  const variantLeaves = variants.map((variant) => flattenShopCatalogRawPayload(variant));
  for (let index = 0; index < variantLeaves.length; index += 1) {
    for (const leaf of variantLeaves[index]!) {
      const path =
        leaf.fieldPath === "$" ? "product.variants" : `product.variants.${leaf.fieldPath}`;
      const owners = ownersByPath.get(path) ?? [];
      owners.push(variantIdsByIndex[index]!);
      ownersByPath.set(path, owners);
    }
  }

  return flattenShopCatalogRawPayload(input.rawPayload).map((leaf: ShopCatalogRawLeaf) => {
    const variantPath =
      leaf.fieldPath === "product.variants" || leaf.fieldPath.startsWith("product.variants.");
    const owners = ownersByPath.get(leaf.fieldPath);
    const variantId = variantPath ? owners?.[leaf.ordinal] : undefined;
    if (variantPath && variants.length > 0 && !variantId) {
      throw new Error(`Missing variant binding for raw leaf ${leaf.fieldPath}[${leaf.ordinal}]`);
    }
    const isVariant = Boolean(variantId);
    return {
      sourceRecordId: input.sourceRecordId,
      fieldPath: leaf.fieldPath,
      ordinal: leaf.ordinal,
      rawValue: leaf.value,
      canonicalEntityType: isVariant ? "VARIANT" : "PRODUCT",
      canonicalEntityId: variantId ?? input.productId,
      canonicalField: isVariant ? leaf.fieldPath.slice("product.variants.".length) : leaf.fieldPath,
      normalizedValue: leaf.value,
      mappingStatus: "MAPPED",
      mapperVersion: input.mapperVersion,
      confidence: 1,
      reason: null,
      productId: input.productId,
      variantId: variantId ?? null,
    } satisfies ShopCatalogImportProvenanceRow;
  });
}
