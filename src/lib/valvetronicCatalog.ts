import type { AdminShopProductPayload } from "@/lib/shopAdminCatalog";
import {
  SUPPLIER_FITMENT_KEY,
  SUPPLIER_FITMENT_NAMESPACE,
  upgradeSupplierFitmentContractToV2,
  type SupplierFitmentImportContract,
  type SupplierFitmentV1Contract,
} from "@/lib/shopImportFitment";
import {
  buildSupplierDescriptionHtml,
  supplierCopyVehicleApplications,
  supplierCopyVehicleTags,
  trimSupplierSlug,
  type SupplierCopy,
} from "@/lib/supplierCatalogCopy";

export const VALVETRONIC_BRAND = "Valvetronic Designs";
export const VALVETRONIC_STORE = "https://valvetronic.com";
export const VALVETRONIC_SOURCE_FEED = `${VALVETRONIC_STORE}/products.json`;
/** Ігор (23.10.2026): price without the discount + 15% + delivery $12 per kg. */
export const VALVETRONIC_MARKUP = 1.15;
export const VALVETRONIC_USD_PER_KG = 12;
const SKU_PREFIX = "VTD";

export type ValvetronicSourceVariant = {
  id: number;
  sku: string | null;
  title: string;
  options: string[];
  /** Regular price in USD (the higher of price and compare_at_price). */
  priceUsd: number;
  salePriceUsd: number | null;
  /** Shipping weight from valvetronic.com; 0 when the brand left it empty. */
  grams: number;
  image: string | null;
};

export type ValvetronicSourceProduct = {
  id: number;
  handle: string;
  url: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  optionNames: string[];
  bodyParagraphs: string[];
  /** YouTube video ids embedded in the brand's description. */
  videos: string[];
  images: string[];
  variants: ValvetronicSourceVariant[];
  updatedAt: string | null;
};

/** Shipping weights sent by the brand or Ігор, by Valvetronic SKU (kg); they win over the feed. */
export type ValvetronicWeightOverrides = Record<string, number>;

export function valvetronicWeightKg(
  variant: Pick<ValvetronicSourceVariant, "sku" | "grams">,
  overrides: ValvetronicWeightOverrides = {}
): number | null {
  const override = variant.sku ? overrides[variant.sku] : undefined;
  if (override !== undefined && Number.isFinite(override) && override > 0) return override;
  // Exact grams: rounding the weight first can move the price by a dollar.
  return variant.grams > 0 ? variant.grams / 1000 : null;
}

/** Regular price × 1.15 + $12 per kg of shipping weight, rounded up to a whole dollar. */
export function calculateValvetronicPriceUsd(regularUsd: number, weightKg: number) {
  if (!Number.isFinite(regularUsd) || regularUsd <= 0) {
    throw new Error("Regular price must be a positive number");
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Shipping weight must be a positive number");
  }
  const cents = Math.round(
    (regularUsd * VALVETRONIC_MARKUP + VALVETRONIC_USD_PER_KG * weightKg) * 100
  );
  return Math.ceil(cents / 100);
}

export type ValvetronicPricedVariant = {
  variant: ValvetronicSourceVariant;
  sku: string;
  weightKg: number;
  priceUsd: number;
};

/** Variants that cannot be priced yet (no shipping weight), as "SKU / title". */
export function valvetronicVariantsWithoutWeight(
  product: ValvetronicSourceProduct,
  overrides: ValvetronicWeightOverrides = {}
) {
  return product.variants
    .filter((variant) => valvetronicWeightKg(variant, overrides) === null)
    .map((variant) => variant.sku ?? variant.title);
}

export function valvetronicSku(product: Pick<ValvetronicSourceProduct, "id">) {
  return `${SKU_PREFIX}-${product.id}`;
}

/**
 * The brand's own SKU, so a customer or manager can search by it; a missing SKU, or one the
 * brand repeats on two variants of the same product, gets our stable id instead.
 */
export function valvetronicVariantSkus(product: Pick<ValvetronicSourceProduct, "variants">) {
  const counts = new Map<string, number>();
  for (const variant of product.variants) {
    if (variant.sku) counts.set(variant.sku, (counts.get(variant.sku) ?? 0) + 1);
  }
  return product.variants.map((variant) =>
    variant.sku && counts.get(variant.sku) === 1 ? variant.sku : `${SKU_PREFIX}-${variant.id}`
  );
}

export function priceValvetronicProduct(
  product: ValvetronicSourceProduct,
  overrides: ValvetronicWeightOverrides = {}
): ValvetronicPricedVariant[] {
  const skus = valvetronicVariantSkus(product);
  return product.variants.map((variant, index) => {
    const weightKg = valvetronicWeightKg(variant, overrides);
    if (weightKg === null) {
      throw new Error(`${product.handle}: ${variant.sku ?? variant.title} has no shipping weight`);
    }
    return {
      variant,
      sku: skus[index],
      weightKg,
      priceUsd: calculateValvetronicPriceUsd(variant.priceUsd, weightKg),
    };
  });
}

/** Readable, stable slug from the brand's title plus the tail of its product id. */
export function buildValvetronicSlug(product: Pick<ValvetronicSourceProduct, "id" | "title">) {
  const name = product.title
    .replace(/\bvalvetronic(?: designs)?\b/gi, " ")
    .replace(/[™®]/g, "")
    .replace(/\+/g, " plus ");
  return `valvetronic-designs-${trimSupplierSlug(name, 80)}-${String(product.id).slice(-5)}`;
}

/**
 * Product type: decides the Nova Poshta size class (src/lib/shopShippingClass.ts), so a remote
 * or a clamp is not priced as a whole exhaust system. Every product sits in the exhaust category.
 */
export function valvetronicProductType(product: Pick<ValvetronicSourceProduct, "title">) {
  const title = product.title;
  if (
    /\b(?:clamps?|gaskets?|hangers?|remote|harness|antenna|actuator|motor|springs?|simulators?|plugs?|caps?|wire|adaptor|adapter|control(?:ler| box| kit)?|controller)\b/i.test(
      title
    )
  ) {
    return "Exhaust Accessories";
  }
  if (/\btips?\b/i.test(title) && !/\b(?:system|exhaust package)\b/i.test(title)) {
    return "Exhaust Tips";
  }
  if (/\b(?:down ?pipes?|test pipes?|catalytic|catted)\b/i.test(title)) return "Downpipes";
  if (/\b(?:headers?|manifolds?)\b/i.test(title)) return "Exhaust Headers";
  if (/\bmufflers?\b/i.test(title) && !/\bsystem\b/i.test(title)) return "Mufflers";
  if (/\bmid ?pipe\b/i.test(title)) return "Exhaust Mid Pipes";
  return "Exhaust Systems";
}

const CATEGORY = { ua: "Вихлопні системи", en: "Exhaust Systems" } as const;

/** Supplier fitment: the cars named by Valvetronic; universal parts fit any car. */
export function buildValvetronicSupplierFitment(
  product: Pick<ValvetronicSourceProduct, "url" | "updatedAt">,
  copy: Pick<SupplierCopy, "vehicles">
): SupplierFitmentImportContract {
  const source = {
    supplier: VALVETRONIC_BRAND,
    sourceRef: product.url,
    sourceUpdatedAt: product.updatedAt,
  };
  const applications = supplierCopyVehicleApplications(copy.vehicles);
  if (!applications.length) {
    return {
      version: 1,
      mode: "needs_review",
      scope: "auto",
      applications: [],
      parentSku: null,
      source,
      note: "No vehicle named on valvetronic.com (universal part or not read).",
    };
  }
  const v1: SupplierFitmentV1Contract = {
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications,
    parentSku: null,
    source,
    note: "Vehicles from the Valvetronic Designs product title and fitment list.",
  };
  return upgradeSupplierFitmentContractToV2(v1);
}

function moneyFields(priceUsd: number) {
  return {
    priceSourceCurrency: "USD",
    priceEur: null,
    priceEurEurope: null,
    priceUsd,
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
  } as const;
}

/** "All Models" / "Universal" are not cars the vehicle picker can match. */
const PLACEHOLDER_MODEL = /\b(?:all|any|universal|various|models?)\b/i;

/** Admin import payload for one Valvetronic product (always a DRAFT; publication is a separate step). */
export function buildValvetronicProductPayload(
  product: ValvetronicSourceProduct,
  reviewedCopy: SupplierCopy,
  sourceGeneratedAt: string,
  weightOverrides: ValvetronicWeightOverrides = {}
): AdminShopProductPayload {
  if (!product.variants.length) throw new Error(`${product.handle}: no variant to sell`);
  const copy = {
    ...reviewedCopy,
    vehicles: reviewedCopy.vehicles.filter((vehicle) => !PLACEHOLDER_MODEL.test(vehicle.model)),
  };
  const variants = priceValvetronicProduct(product, weightOverrides);
  const primary = variants[0];
  const productType = valvetronicProductType(product);
  const bodyHtmlUa = buildSupplierDescriptionHtml(copy, "ua");
  const bodyHtmlEn = buildSupplierDescriptionHtml(copy, "en");
  const fitment = buildValvetronicSupplierFitment(product, copy);
  const optionNames = product.optionNames;
  const images = product.images;
  const image = images[0] ?? null;
  const tags = new Set<string>([VALVETRONIC_BRAND, "store:main", productType]);
  for (const tag of supplierCopyVehicleTags(copy.vehicles)) tags.add(tag);
  return {
    slug: buildValvetronicSlug(product),
    sku: valvetronicSku(product),
    scope: "auto",
    storefront: "main",
    brand: VALVETRONIC_BRAND,
    vendor: VALVETRONIC_BRAND,
    productType,
    productCategory: CATEGORY.en,
    categoryId: null,
    tags: Array.from(tags),
    collectionIds: [],
    status: "DRAFT",
    titleUa: copy.titleUa,
    titleEn: copy.titleEn,
    categoryUa: CATEGORY.ua,
    categoryEn: CATEGORY.en,
    shortDescUa: copy.shortDescUa,
    shortDescEn: copy.shortDescEn,
    longDescUa: bodyHtmlUa,
    longDescEn: bodyHtmlEn,
    bodyHtmlUa,
    bodyHtmlEn,
    leadTimeUa: null,
    leadTimeEn: null,
    // Made to order by Valvetronic Designs: sell to order.
    stock: "preOrder",
    collectionUa: null,
    collectionEn: null,
    ...moneyFields(primary.priceUsd),
    // valvetronic.com shipping weight; the brand gives no box size.
    weight: primary.weightKg,
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
    media: [
      ...images.map((src, index) => ({
        src,
        altText: index === 0 ? copy.imageAltEn : copy.titleEn,
        position: index + 1,
        mediaType: "IMAGE" as const,
      })),
      ...product.videos.map((id, index) => ({
        src: `https://www.youtube.com/embed/${id}`,
        altText: copy.titleEn,
        position: images.length + index + 1,
        mediaType: "EXTERNAL_VIDEO" as const,
      })),
    ],
    options: optionNames.map((name, index) => ({
      name,
      position: index + 1,
      values: Array.from(
        new Set(product.variants.map((variant) => variant.options[index]).filter(Boolean))
      ),
    })),
    variants: variants.map(({ variant, sku, weightKg, priceUsd }, index) => ({
      title: variant.options.join(" / ") || "Default",
      sku,
      position: index + 1,
      option1Value: optionNames[0] ? (variant.options[0] ?? null) : null,
      option2Value: optionNames[1] ? (variant.options[1] ?? null) : null,
      option3Value: optionNames[2] ? (variant.options[2] ?? null) : null,
      inventoryQty: 0,
      inventoryPolicy: "CONTINUE" as const,
      fulfillmentService: "manual",
      ...moneyFields(priceUsd),
      grams: Math.round(weightKg * 1000),
      weight: weightKg,
      weightUnit: "kg",
      requiresShipping: true,
      taxable: true,
      image: variant.image ?? image,
      isDefault: index === 0,
    })),
    metafields: [
      {
        namespace: SUPPLIER_FITMENT_NAMESPACE,
        key: SUPPLIER_FITMENT_KEY,
        value: JSON.stringify(fitment),
        valueType: "json",
      },
      {
        namespace: "valvetronic_import",
        key: "official_url",
        value: product.url,
        valueType: "url",
      },
      {
        namespace: "valvetronic_import",
        key: "pricing",
        value: JSON.stringify({
          markup: VALVETRONIC_MARKUP,
          usdPerKg: VALVETRONIC_USD_PER_KG,
          variants: variants.map(({ variant, sku, weightKg, priceUsd }) => ({
            sku,
            supplierSku: variant.sku,
            regularUsd: variant.priceUsd,
            salePriceUsd: variant.salePriceUsd,
            weightKg,
            priceUsd,
          })),
        }),
        valueType: "json",
      },
      {
        namespace: "valvetronic_import",
        key: "price_formula",
        value:
          "valvetronic.com regular price (not the sale price) × 1.15 + $12 per kg of shipping weight, rounded up to $1",
        valueType: "single_line_text_field",
      },
      {
        namespace: "valvetronic_import",
        key: "source_feed",
        value: VALVETRONIC_SOURCE_FEED,
        valueType: "url",
      },
      {
        namespace: "valvetronic_import",
        key: "source_generated_at",
        value: sourceGeneratedAt,
        valueType: "date_time",
      },
    ],
  };
}
