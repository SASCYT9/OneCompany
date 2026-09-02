import { createHash } from "node:crypto";

export type ShopifySnapshotNode = Record<string, unknown> & {
  id?: string;
  __parentId?: string;
};

export type ShopifySnapshotProduct = ShopifySnapshotNode & {
  id: string;
  title?: string;
  handle?: string;
  vendor?: string;
  productType?: string;
  status?: string;
  tags?: string[];
  variants: ShopifySnapshotNode[];
  media: ShopifySnapshotNode[];
  metafields: ShopifySnapshotNode[];
};

export type ShopifySnapshotAudit = {
  schemaVersion: 1;
  sourceKey: string;
  productCount: number;
  variantCount: number;
  mediaCount: number;
  metafieldCount: number;
  activeCount: number;
  draftCount: number;
  archivedCount: number;
  missingSkuCount: number;
  duplicateSkus: string[];
  missingMediaCount: number;
  vendors: Record<string, number>;
  importSelection: {
    canonicalBrand: "KW Suspensions";
    includedProducts: number;
    excludedProducts: number;
    excludedByReason: Record<string, number>;
  };
  productTypes: Record<string, number>;
  vehicleTagCounts: { makes: number; vehicles: number; engines: number };
  fingerprint: string;
};

export type KwShopifyProductSelection = {
  action: "IMPORT" | "IGNORE_WITH_REASON";
  canonicalBrand: "KW Suspensions" | null;
  reason: string;
};

const KW_VENDOR_ALIASES = new Set(["kw", "kw automotive ukraine"]);

/** Source-scoped allow-list: ST shares the shop but is not part of this migration. */
export function classifyKwShopifyProduct(product: Pick<ShopifySnapshotProduct, "vendor">): KwShopifyProductSelection {
  const vendor = product.vendor?.trim().toLowerCase() ?? "";
  if (KW_VENDOR_ALIASES.has(vendor)) {
    return {
      action: "IMPORT",
      canonicalBrand: "KW Suspensions",
      reason: vendor === "kw automotive ukraine" ? "legacy KW vendor alias" : "canonical KW vendor",
    };
  }
  return {
    action: "IGNORE_WITH_REASON",
    canonicalBrand: null,
    reason: vendor === "st" ? "ST products are outside the approved migration scope" : `vendor not approved: ${product.vendor || "(empty)"}`,
  };
}

export function selectKwShopifyProducts(products: readonly ShopifySnapshotProduct[]) {
  return products.filter((product) => classifyKwShopifyProduct(product).action === "IMPORT");
}

export type ShopifyTranslationAudit = {
  schemaVersion: 1;
  locale: string;
  productCount: number;
  productsWithAnyTranslation: number;
  productsWithTitle: number;
  productsWithBody: number;
  productsWithOutdatedTranslation: number;
  missingTitle: number;
  missingBody: number;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "__parentId")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function increment(target: Record<string, number>, rawValue: unknown) {
  const key = typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : "(empty)";
  target[key] = (target[key] ?? 0) + 1;
}

function connectionKind(id: string) {
  if (id.includes("/ProductVariant/")) return "variants" as const;
  if (id.includes("/MediaImage/") || id.includes("/Video/") || id.includes("/Model3d/") || id.includes("/ExternalVideo/")) {
    return "media" as const;
  }
  if (id.includes("/Metafield/")) return "metafields" as const;
  return null;
}

/** Reassembles Shopify's ungrouped bulk JSONL without dropping unknown fields. */
export function parseShopifyProductJsonl(jsonl: string): ShopifySnapshotProduct[] {
  const products = new Map<string, ShopifySnapshotProduct>();
  const children: ShopifySnapshotNode[] = [];
  for (const [index, sourceLine] of jsonl.split(/\r?\n/u).entries()) {
    const line = sourceLine.trim();
    if (!line) continue;
    const parsed = JSON.parse(line) as ShopifySnapshotNode;
    if (!parsed.id) throw new TypeError(`Shopify snapshot line ${index + 1} has no id`);
    if (parsed.id.includes("/Product/") && !parsed.__parentId) {
      products.set(parsed.id, { ...parsed, id: parsed.id, variants: [], media: [], metafields: [] });
    } else {
      children.push(parsed);
    }
  }
  for (const child of children) {
    const kind = connectionKind(child.id!);
    const product = child.__parentId ? products.get(child.__parentId) : undefined;
    if (kind && product) product[kind].push(child);
  }
  return [...products.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function auditShopifySnapshot(
  products: readonly ShopifySnapshotProduct[],
  sourceKey = "shopify-catalog"
): ShopifySnapshotAudit {
  const vendors: Record<string, number> = {};
  const productTypes: Record<string, number> = {};
  const skuCounts = new Map<string, number>();
  let activeCount = 0;
  let draftCount = 0;
  let archivedCount = 0;
  let missingSkuCount = 0;
  let missingMediaCount = 0;
  let makeTags = 0;
  let vehicleTags = 0;
  let engineTags = 0;
  let includedProducts = 0;
  const excludedByReason: Record<string, number> = {};

  for (const product of products) {
    increment(vendors, product.vendor);
    increment(productTypes, product.productType);
    const selection = classifyKwShopifyProduct(product);
    if (selection.action === "IMPORT") includedProducts += 1;
    else increment(excludedByReason, selection.reason);
    if (product.status === "ACTIVE") activeCount += 1;
    else if (product.status === "DRAFT") draftCount += 1;
    else if (product.status === "ARCHIVED") archivedCount += 1;
    if (product.media.length === 0) missingMediaCount += 1;
    for (const variant of product.variants) {
      const sku = typeof variant.sku === "string" ? variant.sku.trim().toUpperCase() : "";
      if (!sku) missingSkuCount += 1;
      else skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
    }
    for (const tag of product.tags ?? []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized.startsWith("brand:")) makeTags += 1;
      else if (normalized.startsWith("veh:")) vehicleTags += 1;
      else if (normalized.startsWith("eng:")) engineTags += 1;
    }
  }

  const duplicateSkus = [...skuCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sku]) => sku)
    .sort();
  const fingerprint = createHash("sha256")
    .update(products.map((product) => stableJson(product)).sort().join("\n"))
    .digest("hex");

  return {
    schemaVersion: 1,
    sourceKey,
    productCount: products.length,
    variantCount: products.reduce((total, product) => total + product.variants.length, 0),
    mediaCount: products.reduce((total, product) => total + product.media.length, 0),
    metafieldCount: products.reduce((total, product) => total + product.metafields.length, 0),
    activeCount,
    draftCount,
    archivedCount,
    missingSkuCount,
    duplicateSkus,
    missingMediaCount,
    vendors,
    importSelection: {
      canonicalBrand: "KW Suspensions",
      includedProducts,
      excludedProducts: products.length - includedProducts,
      excludedByReason,
    },
    productTypes,
    vehicleTagCounts: { makes: makeTags, vehicles: vehicleTags, engines: engineTags },
    fingerprint,
  };
}

export function auditShopifyProductTranslations(jsonl: string, locale: string): ShopifyTranslationAudit {
  let productCount = 0;
  let productsWithAnyTranslation = 0;
  let productsWithTitle = 0;
  let productsWithBody = 0;
  let productsWithOutdatedTranslation = 0;
  for (const [index, sourceLine] of jsonl.split(/\r?\n/u).entries()) {
    const line = sourceLine.trim();
    if (!line) continue;
    const row = JSON.parse(line) as { id?: string; translations?: unknown };
    if (!row.id?.includes("/Product/")) throw new TypeError(`Translation snapshot line ${index + 1} is not a product`);
    productCount += 1;
    const translations = Array.isArray(row.translations)
      ? row.translations.filter((entry): entry is { key?: string; value?: string; outdated?: boolean } => Boolean(entry && typeof entry === "object"))
      : [];
    if (translations.some((entry) => Boolean(entry.value?.trim()))) productsWithAnyTranslation += 1;
    if (translations.some((entry) => entry.key === "title" && Boolean(entry.value?.trim()))) productsWithTitle += 1;
    if (translations.some((entry) => entry.key === "body_html" && Boolean(entry.value?.trim()))) productsWithBody += 1;
    if (translations.some((entry) => entry.outdated === true)) productsWithOutdatedTranslation += 1;
  }
  return {
    schemaVersion: 1,
    locale,
    productCount,
    productsWithAnyTranslation,
    productsWithTitle,
    productsWithBody,
    productsWithOutdatedTranslation,
    missingTitle: productCount - productsWithTitle,
    missingBody: productCount - productsWithBody,
  };
}

export function parseShopifyProductTranslationMap(jsonl: string) {
  const translations = new Map<string, Array<{ key?: string; value?: string; outdated?: boolean }>>();
  for (const [index, sourceLine] of jsonl.split(/\r?\n/u).entries()) {
    const line = sourceLine.trim();
    if (!line) continue;
    const row = JSON.parse(line) as { id?: string; translations?: unknown };
    if (!row.id?.includes("/Product/")) throw new TypeError(`Translation snapshot line ${index + 1} is not a product`);
    translations.set(
      row.id,
      Array.isArray(row.translations)
        ? row.translations.filter((entry): entry is { key?: string; value?: string; outdated?: boolean } => Boolean(entry && typeof entry === "object"))
        : []
    );
  }
  return translations;
}
