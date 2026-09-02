import { createHash } from "node:crypto";

import { buildKwNormalizedFitment, type KwProductNormalization } from "./shopCatalogKwNormalization";
import type { ShopifySnapshotNode, ShopifySnapshotProduct } from "./shopifyCatalogSnapshot";

export type ShopifyProductTranslation = { key?: string; value?: string; outdated?: boolean };

export type KwCanonicalProductDraft = {
  source: { sourceKey: "shopify-kw-suspensions"; externalProductId: string; revision: string; payloadHash: string };
  product: {
    slug: string;
    sku: string | null;
    scope: "auto";
    brand: "KW Suspensions";
    vendor: "KW Suspensions";
    titleUa: string;
    titleEn: string;
    bodyHtmlUa: string | null;
    bodyHtmlEn: string | null;
    seoTitleUa: string | null;
    seoTitleEn: string | null;
    seoDescriptionUa: string | null;
    seoDescriptionEn: string | null;
    productType: string | null;
    productCategory: string;
    tags: string[];
    stock: "inStock" | "preOrder";
    status: "ACTIVE" | "DRAFT" | "ARCHIVED";
    isPublished: false;
    priceUah: string | null;
    priceEur: string | null;
    compareAtUah: string | null;
    image: string | null;
  };
  variants: Array<{
    externalVariantId: string;
    title: string | null;
    sku: string | null;
    barcode: string | null;
    position: number;
    optionValues: string[];
    inventoryQty: number;
    inventoryPolicy: "DENY" | "CONTINUE";
    priceUah: string | null;
    compareAtUah: string | null;
    isDefault: boolean;
  }>;
  media: Array<{ externalMediaId: string; mediaType: string; src: string; altText: string | null; position: number }>;
  options: Array<{ externalOptionId: string; name: string; position: number; values: string[] }>;
  metafields: Array<{ externalMetafieldId: string; namespace: string; key: string; value: string; valueType: string }>;
  normalization: KwProductNormalization;
  issues: string[];
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decimalValue(value: unknown) {
  const string = stringValue(value);
  return string !== null && /^\d+(?:\.\d+)?$/u.test(string) ? string : null;
}

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

function productMetafield(product: ShopifySnapshotProduct, namespace: string, key: string) {
  return product.metafields.find((entry) => entry.namespace === namespace && entry.key === key);
}

function translated(translations: readonly ShopifyProductTranslation[], key: string) {
  const translation = translations.find((entry) => entry.key === key && stringValue(entry.value));
  return translation && !translation.outdated ? stringValue(translation.value) : null;
}

function mapVariant(variant: ShopifySnapshotNode, index: number) {
  const selectedOptions = Array.isArray(variant.selectedOptions)
    ? variant.selectedOptions.filter((value): value is { value?: unknown } => Boolean(value && typeof value === "object"))
    : [];
  return {
    externalVariantId: variant.id!,
    title: stringValue(variant.title),
    sku: stringValue(variant.sku),
    barcode: stringValue(variant.barcode),
    position: typeof variant.position === "number" && variant.position > 0 ? variant.position : index + 1,
    optionValues: selectedOptions.map((option) => stringValue(option.value)).filter((value): value is string => value !== null),
    inventoryQty: typeof variant.inventoryQuantity === "number" ? variant.inventoryQuantity : 0,
    inventoryPolicy: variant.inventoryPolicy === "CONTINUE" ? "CONTINUE" as const : "DENY" as const,
    priceUah: decimalValue(variant.price),
    compareAtUah: decimalValue(variant.compareAtPrice),
    isDefault: index === 0,
  };
}

export function buildKwCanonicalProductDraft(input: {
  product: ShopifySnapshotProduct;
  normalization: KwProductNormalization;
  enTranslations?: readonly ShopifyProductTranslation[];
}): KwCanonicalProductDraft {
  const { product, normalization } = input;
  const translations = input.enTranslations ?? [];
  const issues = [...normalization.issues];
  const titleUa = stringValue(product.title);
  const titleEn = translated(translations, "title");
  const bodyHtmlUa = stringValue(product.descriptionHtml);
  const bodyHtmlEn = translated(translations, "body_html");
  if (!titleUa) issues.push("title_ua_missing");
  if (!titleEn) issues.push("title_en_missing");
  if (bodyHtmlUa && !bodyHtmlEn) issues.push("body_html_en_missing");
  const variants = product.variants.map(mapVariant).sort((left, right) => left.position - right.position);
  if (!variants.length) issues.push("variants_missing");
  if (variants.some((variant) => !variant.sku)) issues.push("variant_sku_missing");
  if (variants.some((variant) => !variant.priceUah)) issues.push("variant_price_uah_missing");
  const media = product.media.flatMap((entry, index) => {
    const image = entry.image && typeof entry.image === "object" ? entry.image as Record<string, unknown> : null;
    const src = stringValue(image?.url);
    if (!src) {
      issues.push("media_url_missing");
      return [];
    }
    return [{
      externalMediaId: entry.id!,
      mediaType: stringValue(entry.mediaContentType) ?? "IMAGE",
      src,
      altText: stringValue(entry.alt),
      position: index + 1,
    }];
  });
  const options = (Array.isArray(product.options) ? product.options : []).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const option = entry as Record<string, unknown>;
    const values = Array.isArray(option.optionValues)
      ? option.optionValues.flatMap((value) => value && typeof value === "object" && stringValue((value as Record<string, unknown>).name) ? [stringValue((value as Record<string, unknown>).name)!] : [])
      : [];
    return [{
      externalOptionId: stringValue(option.id) ?? `option-${index + 1}`,
      name: stringValue(option.name) ?? `Option ${index + 1}`,
      position: typeof option.position === "number" ? option.position : index + 1,
      values,
    }];
  });
  const metafields = product.metafields.flatMap((entry) => {
    const namespace = stringValue(entry.namespace);
    const key = stringValue(entry.key);
    const value = stringValue(entry.value);
    if (!namespace || !key || value === null) return [];
    return [{
      externalMetafieldId: entry.id!,
      namespace,
      key,
      value,
      valueType: stringValue(entry.type) ?? "single_line_text_field",
    }];
  });
  metafields.push({
    externalMetafieldId: `derived:${product.id}:onecompany.normalized_fitment`,
    namespace: "onecompany",
    key: "normalized_fitment",
    value: JSON.stringify(buildKwNormalizedFitment(normalization)),
    valueType: "json",
  });
  const euroPrice = decimalValue(productMetafield(product, "custom", "custom_price_eur")?.value);
  if (!euroPrice) issues.push("product_price_eur_missing");
  const primary = variants[0];
  const seo = product.seo && typeof product.seo === "object" ? product.seo as Record<string, unknown> : {};
  const slug = stringValue(product.handle) ?? `kw-${product.id.split("/").at(-1)}`;
  const status = product.status === "ARCHIVED" ? "ARCHIVED" as const : product.status === "DRAFT" ? "DRAFT" as const : "ACTIVE" as const;
  return {
    source: {
      sourceKey: "shopify-kw-suspensions",
      externalProductId: product.id,
      revision: stringValue(product.updatedAt) ?? "unknown",
      payloadHash: createHash("sha256").update(stableJson(product)).digest("hex"),
    },
    product: {
      slug,
      sku: primary?.sku ?? null,
      scope: "auto",
      brand: "KW Suspensions",
      vendor: "KW Suspensions",
      titleUa: titleUa ?? slug,
      titleEn: titleEn ?? titleUa ?? slug,
      bodyHtmlUa,
      bodyHtmlEn,
      seoTitleUa: stringValue(seo.title),
      seoTitleEn: translated(translations, "meta_title"),
      seoDescriptionUa: stringValue(seo.description),
      seoDescriptionEn: translated(translations, "meta_description"),
      productType: stringValue(product.productType),
      productCategory: normalization.categoryKey,
      tags: [...new Set(product.tags ?? [])],
      stock: variants.some((variant) => variant.inventoryQty > 0) ? "inStock" : "preOrder",
      status,
      isPublished: false,
      priceUah: primary?.priceUah ?? null,
      priceEur: euroPrice,
      compareAtUah: primary?.compareAtUah ?? null,
      image: media[0]?.src ?? null,
    },
    variants,
    media,
    options,
    metafields,
    normalization,
    issues: [...new Set(issues)].sort(),
  };
}
