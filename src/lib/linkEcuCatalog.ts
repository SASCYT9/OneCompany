import type { AdminShopProductPayload } from "@/lib/shopAdminCatalog";
import {
  SUPPLIER_FITMENT_KEY,
  SUPPLIER_FITMENT_NAMESPACE,
  upgradeSupplierFitmentContractToV2,
  type SupplierFitmentImportContract,
  type SupplierFitmentV1Contract,
} from "@/lib/shopImportFitment";
import {
  applySupplierCopyOverride,
  buildSupplierDescriptionHtml,
  slugifySupplierText,
  supplierCopyVehicleApplications,
  supplierCopyVehicleTags,
  trimSupplierSlug,
  type SupplierCopy,
  type SupplierCopyOverride,
  type SupplierCopySpec,
  type SupplierCopyVehicle,
} from "@/lib/supplierCatalogCopy";

export const LINK_ECU_BRAND = "Link ECU";
/** Ігор, 17.10.2026: storefront EUR = EU RRP from linkecu.com × 1.20. */
export const LINK_ECU_PRICE_MARKUP = 1.2;
export const LINK_ECU_SOURCE_FEED = "https://linkecu.com/products.json?currency=EUR";

export type LinkEcuKind = "wire-in" | "plug-in" | "ls-bundle" | "pdm";

export type LinkEcuSpecRow = { heading: string; values: string[] };

export type LinkEcuSourceSection = {
  title: string;
  rows: LinkEcuSpecRow[];
  paragraphs: string[];
  items: string[];
};

export type LinkEcuSourceProduct = {
  sku: string;
  handle: string;
  url: string;
  titleSource: string;
  productType: string;
  kind: LinkEcuKind;
  rrpEur: number;
  grams: number;
  images: string[];
  bodyParagraphs: string[];
  sections: LinkEcuSourceSection[];
  updatedAt: string | null;
};

export type LinkEcuSpec = SupplierCopySpec;
export type LinkEcuVehicle = SupplierCopyVehicle;
export type LinkEcuCopy = SupplierCopy;
export type LinkEcuCopyOverride = SupplierCopyOverride;
export const applyLinkEcuCopyOverride = applySupplierCopyOverride;

type LocalizedPair = { ua: string; en: string };

const KIND_COPY: Record<
  LinkEcuKind,
  { category: LocalizedPair; collection: LocalizedPair; productType: string; tag: string }
> = {
  "wire-in": {
    category: { ua: "Блоки керування двигуном (ECU)", en: "Engine Management ECUs" },
    collection: { ua: "Wire-In ECU", en: "Wire-In ECUs" },
    productType: "Engine Management ECU",
    tag: "Wire-In ECU",
  },
  "plug-in": {
    category: { ua: "Блоки керування двигуном (ECU)", en: "Engine Management ECUs" },
    collection: { ua: "Plug-In ECU", en: "Plug-In ECUs" },
    productType: "Engine Management ECU",
    tag: "Plug-In ECU",
  },
  "ls-bundle": {
    category: { ua: "Блоки керування двигуном (ECU)", en: "Engine Management ECUs" },
    collection: { ua: "Комплекти для двигунів GM LS", en: "GM LS Engine Kits" },
    productType: "Engine Management ECU",
    tag: "LS Engine Harness",
  },
  pdm: {
    category: { ua: "Модулі розподілу живлення (PDM)", en: "Power Distribution Modules" },
    collection: { ua: "PDM", en: "PDM" },
    productType: "Power Distribution Module",
    tag: "PDM",
  },
};

export function linkEcuKindCopy(kind: LinkEcuKind) {
  return KIND_COPY[kind];
}

/** Storefront EUR price: RRP × 1.20, rounded up to a whole euro. */
export function calculateLinkEcuPriceEur(rrpEur: number): number {
  if (!Number.isFinite(rrpEur) || rrpEur <= 0) {
    throw new Error("Link ECU RRP must be a positive number");
  }
  const cents = Math.round(rrpEur * LINK_ECU_PRICE_MARKUP * 100);
  return Math.ceil(cents / 100);
}

/** Readable, stable slug: model name from the Link title plus the Link part number. */
export function buildLinkEcuSlug(product: Pick<LinkEcuSourceProduct, "titleSource" | "sku">) {
  const name = product.titleSource
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bbundle\b/gi, " ")
    .replace(/\+/g, " ");
  return `link-ecu-${trimSupplierSlug(name, 56)}-${slugifySupplierText(product.sku)}`;
}

export const buildLinkEcuDescriptionHtml = buildSupplierDescriptionHtml;

/**
 * Supplier fitment for the vehicle filter. Plug-In ECUs carry Link's own
 * "Models Supported" list; Wire-In ECUs, engine-swap kits and the PDM are
 * universal and must not appear as fitting one specific car.
 */
export function buildLinkEcuSupplierFitment(
  product: Pick<LinkEcuSourceProduct, "kind" | "url" | "updatedAt">,
  vehicles: LinkEcuVehicle[]
): SupplierFitmentImportContract {
  const source = {
    supplier: LINK_ECU_BRAND,
    sourceRef: product.url,
    sourceUpdatedAt: product.updatedAt,
  };
  if (product.kind !== "plug-in") {
    return {
      version: 1,
      mode: "universal",
      scope: "auto",
      applications: [],
      parentSku: null,
      source,
      note:
        product.kind === "ls-bundle"
          ? "Engine kit for GM LS V8 engines; vehicle fitment depends on the engine swap."
          : "Universal product: wired or configured for the engine or vehicle by the installer.",
    };
  }
  const unique = supplierCopyVehicleApplications(vehicles);
  const v1: SupplierFitmentV1Contract = {
    version: 1,
    mode: unique.length ? "vehicle_specific" : "needs_review",
    scope: "auto",
    applications: unique,
    parentSku: null,
    source,
    note: "Applications from Link's own Models Supported list for this Plug-In ECU.",
  };
  return v1.mode === "vehicle_specific" ? upgradeSupplierFitmentContractToV2(v1) : v1;
}

/** Search and filter tags: brand, family, kind and the vehicles a Plug-In ECU fits. */
export function buildLinkEcuTags(
  product: Pick<LinkEcuSourceProduct, "kind" | "titleSource">,
  vehicles: LinkEcuVehicle[]
) {
  const tags = new Set<string>([LINK_ECU_BRAND, "category:electronics", "store:main"]);
  tags.add(KIND_COPY[product.kind].tag);
  const family = product.titleSource.match(/\b(G4X|G5)\b/i)?.[1]?.toUpperCase();
  if (family) tags.add(family);
  for (const tag of supplierCopyVehicleTags(vehicles)) tags.add(tag);
  return Array.from(tags);
}

/** Admin import payload for one Link product (always a DRAFT; publication is a separate step). */
export function buildLinkEcuProductPayload(
  product: LinkEcuSourceProduct,
  copy: LinkEcuCopy,
  sourceGeneratedAt: string
): AdminShopProductPayload {
  const kind = linkEcuKindCopy(product.kind);
  const priceEur = calculateLinkEcuPriceEur(product.rrpEur);
  const bodyHtmlUa = buildLinkEcuDescriptionHtml(copy, "ua");
  const bodyHtmlEn = buildLinkEcuDescriptionHtml(copy, "en");
  const fitment = buildLinkEcuSupplierFitment(product, copy.vehicles);
  const weightKg = product.grams > 0 ? Math.round(product.grams) / 1000 : null;
  const images = product.images;
  const image = images[0] ?? null;
  return {
    slug: buildLinkEcuSlug(product),
    sku: product.sku,
    scope: "auto",
    storefront: "main",
    brand: LINK_ECU_BRAND,
    vendor: LINK_ECU_BRAND,
    productType: kind.productType,
    productCategory: kind.category.en,
    categoryId: null,
    tags: buildLinkEcuTags(product, copy.vehicles),
    collectionIds: [],
    status: "DRAFT",
    titleUa: copy.titleUa,
    titleEn: copy.titleEn,
    categoryUa: kind.category.ua,
    categoryEn: kind.category.en,
    shortDescUa: copy.shortDescUa,
    shortDescEn: copy.shortDescEn,
    longDescUa: bodyHtmlUa,
    longDescEn: bodyHtmlEn,
    bodyHtmlUa,
    bodyHtmlEn,
    leadTimeUa: null,
    leadTimeEn: null,
    // Supplier stock is not OneCompany warehouse stock: sell to order.
    stock: "preOrder",
    collectionUa: kind.collection.ua,
    collectionEn: kind.collection.en,
    priceSourceCurrency: "EUR",
    priceEur,
    priceEurEurope: null,
    priceUsd: null,
    priceUah: null,
    priceEurB2b: null,
    priceUsdB2b: null,
    priceUahB2b: null,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    compareAtEurB2b: null,
    compareAtUsdB2b: null,
    compareAtUahB2b: null,
    // Shopify variant grams on linkecu.com = Link's shipping weight for the boxed item.
    weight: weightKg,
    length: null,
    width: null,
    height: null,
    isDimensionsEstimated: false,
    image,
    seoTitleUa: copy.seoTitleUa,
    seoTitleEn: copy.seoTitleEn,
    seoDescriptionUa: copy.seoDescriptionUa,
    seoDescriptionEn: copy.seoDescriptionEn,
    isPublished: false,
    publishedAt: null,
    gallery: images,
    highlights: { ua: copy.keyPointsUa, en: copy.keyPointsEn },
    media: images.map((src, index) => ({
      src,
      altText: index === 0 ? copy.imageAltEn : copy.titleEn,
      position: index + 1,
      mediaType: "IMAGE" as const,
    })),
    options: [],
    variants: [
      {
        title: "Default",
        sku: product.sku,
        position: 1,
        inventoryQty: 0,
        inventoryPolicy: "CONTINUE",
        fulfillmentService: "manual",
        priceSourceCurrency: "EUR",
        priceEur,
        priceEurEurope: null,
        priceUsd: null,
        priceUah: null,
        priceEurB2b: null,
        priceUsdB2b: null,
        priceUahB2b: null,
        compareAtEur: null,
        compareAtUsd: null,
        compareAtUah: null,
        compareAtEurB2b: null,
        compareAtUsdB2b: null,
        compareAtUahB2b: null,
        grams: product.grams > 0 ? product.grams : null,
        weight: weightKg,
        weightUnit: weightKg ? "kg" : null,
        requiresShipping: true,
        taxable: true,
        image,
        isDefault: true,
      },
    ],
    metafields: [
      {
        namespace: SUPPLIER_FITMENT_NAMESPACE,
        key: SUPPLIER_FITMENT_KEY,
        value: JSON.stringify(fitment),
        valueType: "json",
      },
      { namespace: "link_ecu_import", key: "official_url", value: product.url, valueType: "url" },
      {
        namespace: "link_ecu_import",
        key: "rrp_eur",
        value: product.rrpEur.toFixed(2),
        valueType: "number_decimal",
      },
      {
        namespace: "link_ecu_import",
        key: "price_formula",
        value: `EU RRP × ${LINK_ECU_PRICE_MARKUP.toFixed(2)}, rounded up to a whole euro`,
        valueType: "single_line_text_field",
      },
      {
        namespace: "link_ecu_import",
        key: "source_feed",
        value: LINK_ECU_SOURCE_FEED,
        valueType: "url",
      },
      {
        namespace: "link_ecu_import",
        key: "source_generated_at",
        value: sourceGeneratedAt,
        valueType: "date_time",
      },
    ],
  };
}
