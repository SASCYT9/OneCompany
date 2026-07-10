import { createHash } from "node:crypto";

import type { ShopProduct } from "@/lib/shopCatalog";
import { extractProductFitment } from "@/lib/crossShopFitment";
import {
  classifyProductFitment,
  mergePersistedFitment,
  type NormalizedFitment,
} from "@/lib/shopFitmentQuality";
import { buildShopSearchText } from "@/lib/shopSearch";
import { getShopStockCategoryGroupForProduct } from "@/lib/shopStockTaxonomy";

export const SHOP_PRODUCT_KNOWLEDGE_VERSION = 1;

export type ShopProductKnowledgeRecord = {
  productId: string;
  schemaVersion: number;
  vehicleType: NormalizedFitment["vehicleType"];
  makes: string[];
  models: string[];
  chassisCodes: string[];
  yearRanges: NormalizedFitment["yearRanges"];
  engines: string[];
  bodyStyles: string[];
  markets: string[];
  categoryGroup: string;
  powerGainHp: number | null;
  torqueGainNm: number | null;
  material: string | null;
  opfGpf: string | null;
  installationType: string | null;
  fitmentStatus: NormalizedFitment["status"];
  fitmentSource: NormalizedFitment["source"];
  applications: NormalizedFitment["applications"];
  facts: Record<string, unknown>;
  searchText: string;
  contentHash: string;
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function productEvidence(product: ShopProduct) {
  return [
    product.brand,
    product.vendor,
    product.sku,
    product.title.ua,
    product.title.en,
    product.category.ua,
    product.category.en,
    product.productType,
    product.collection.ua,
    product.collection.en,
    product.shortDescription.ua,
    product.shortDescription.en,
    product.longDescription.ua,
    product.longDescription.en,
    ...(product.tags ?? []),
    ...(product.highlights ?? []).flatMap((item) => [item.ua, item.en]),
    ...(product.variants ?? []).flatMap((variant) => [
      variant.sku,
      variant.title,
      ...(variant.optionValues ?? []),
    ]),
  ].filter(Boolean);
}

function extractLargestExplicitGain(text: string, unit: "power" | "torque") {
  const patterns =
    unit === "power"
      ? [
          /\+\s*(\d{1,4})\s*(?:hp|bhp|ps|к\.?\s*с\.?|кінськ\w*\s+сил)/giu,
          /(?:gain|increase|приріст|додає|додатков\w*)[^\d+]{0,24}\+?\s*(\d{1,4})\s*(?:hp|bhp|ps|к\.?\s*с\.?)/giu,
        ]
      : [
          /\+\s*(\d{1,4})\s*(?:nm|нм|н·м)/giu,
          /(?:torque|крутн\w*\s+момент)[^\d+]{0,24}\+?\s*(\d{1,4})\s*(?:nm|нм|н·м)/giu,
        ];

  const values = patterns.flatMap((pattern) =>
    Array.from(text.matchAll(pattern), (match) => Number(match[1])).filter(Number.isFinite)
  );
  return values.length ? Math.max(...values) : null;
}

function detectMaterial(text: string) {
  const values = [
    /\b(?:titanium|титан(?:овий|ова|ове|ові)?)\b/iu.test(text) ? "titanium" : null,
    /\b(?:stainless steel|нержавіюч\w*\s+стал\w*)\b/iu.test(text) ? "stainless_steel" : null,
    /\b(?:carbon(?: fiber)?|карбон(?:овий|ова|ове|ові)?)\b/iu.test(text) ? "carbon" : null,
  ].filter(Boolean);
  return values.length === 1 ? values[0]! : values.length > 1 ? "mixed" : null;
}

function detectOpfGpf(text: string) {
  if (/\b(?:non[- ]?opf|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))\b/iu.test(text)) return "without";
  if (/\b(?:opf|gpf)\b/iu.test(text)) return "compatible_or_equipped";
  return null;
}

function detectInstallationType(text: string) {
  if (/\b(?:plug[ -]?and[ -]?play|bolt[ -]?on|direct fit|пряма заміна)\b/iu.test(text)) {
    return "direct_fit";
  }
  if (/\b(?:weld|welding|зварюван)\b/iu.test(text)) return "welding_required";
  if (
    /\b(?:professional installation|installation required|професійн\w*\s+встановлен)\b/iu.test(text)
  ) {
    return "professional_installation";
  }
  return null;
}

function buildNormalizedFitment(product: ShopProduct, persistedValue?: string | null) {
  const inferred = classifyProductFitment(product, extractProductFitment(product));
  return mergePersistedFitment(inferred, persistedValue);
}

export function buildShopProductKnowledge(
  product: ShopProduct,
  persistedFitmentValue?: string | null
): ShopProductKnowledgeRecord | null {
  if (!product.id) return null;

  const fitment = buildNormalizedFitment(product, persistedFitmentValue);
  const applications = fitment.applications;
  const makes = unique([fitment.make, ...applications.map((item) => item.make)]);
  const models = unique([...fitment.models, ...applications.flatMap((item) => item.models)]);
  const chassisCodes = unique([
    ...fitment.chassisCodes,
    ...applications.flatMap((item) => item.chassisCodes),
  ]).map((value) => value.toUpperCase());
  const yearRanges = applications.length
    ? applications.flatMap((item) => item.yearRanges)
    : fitment.yearRanges;
  const engines = unique(applications.flatMap((item) => item.engines));
  const bodyStyles = unique(applications.flatMap((item) => item.bodyStyles));
  const markets = unique(applications.flatMap((item) => item.markets));
  const categoryGroup = getShopStockCategoryGroupForProduct({ product }, "ua").id;
  const evidence = productEvidence(product).join(" | ");
  const searchText = buildShopSearchText([
    ...productEvidence(product),
    ...makes,
    ...models,
    ...chassisCodes,
    ...engines,
    ...bodyStyles,
    ...markets,
    categoryGroup,
  ]);
  const powerGainHp = extractLargestExplicitGain(evidence, "power");
  const torqueGainNm = extractLargestExplicitGain(evidence, "torque");
  const material = detectMaterial(evidence);
  const opfGpf = detectOpfGpf(evidence);
  const installationType = detectInstallationType(evidence);
  const facts = {
    sku: product.sku || null,
    brand: product.brand || null,
    stock: product.stock,
    confidence: fitment.confidence,
    powerGainHp,
    torqueGainNm,
    material,
    opfGpf,
    installationType,
  };
  const hashPayload = JSON.stringify({
    version: SHOP_PRODUCT_KNOWLEDGE_VERSION,
    fitment,
    categoryGroup,
    facts,
    searchText,
  });

  return {
    productId: product.id,
    schemaVersion: SHOP_PRODUCT_KNOWLEDGE_VERSION,
    vehicleType: fitment.vehicleType,
    makes,
    models,
    chassisCodes,
    yearRanges,
    engines,
    bodyStyles,
    markets,
    categoryGroup,
    powerGainHp,
    torqueGainNm,
    material,
    opfGpf,
    installationType,
    fitmentStatus: fitment.status,
    fitmentSource: fitment.source,
    applications,
    facts,
    searchText,
    contentHash: createHash("sha256").update(hashPayload).digest("hex"),
  };
}
