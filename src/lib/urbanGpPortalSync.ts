import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma, PrismaClient } from '@prisma/client';
import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import {
  buildAdminProductCreateData,
  buildAdminProductUpdateData,
  type AdminShopProductMediaInput,
  type AdminShopProductOptionInput,
  type AdminShopProductPayload,
  type AdminShopProductVariantInput,
} from '@/lib/shopAdminCatalog';
import {
  getOrCreateShopSettings,
  getShopSettingsRuntime,
  type ShopCurrencyCode,
} from '@/lib/shopAdminSettings';
import {
  getUrbanExactCategoryUa,
  getUrbanModelFacetsFromHandles,
  inferUrbanFamilyFromValues,
  structuredUrbanFamilyTag,
  type UrbanCatalogFamily,
} from '@/lib/urbanCatalogFacets';
import { htmlToPlainText, sanitizeRichTextHtml } from '@/lib/sanitizeRichTextHtml';

const GP_PORTAL_COLLECTION_URL =
  'https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling';
const GP_PORTAL_BASE_URL = 'https://gp-portal.eu';
const URBAN_BRAND = 'Urban Automotive';
const USD_IMPORT_FLOOR = 200;
const MAX_COLLECTION_PAGES = 30;
const STOP_AFTER_STALE_PAGES = 2;
const MAX_RETRIES = 3;
const URBAN_SYNC_TRANSACTION_TIMEOUT_MS = 120_000;
const URBAN_SYNC_TRANSACTION_MAX_WAIT_MS = 15_000;
const URBAN_CARD_BY_HANDLE = new Map(
  URBAN_COLLECTION_CARDS.map((card, index) => [
    card.collectionHandle,
    {
      ...card,
      order: index,
    },
  ])
);

type CurrencyRates = Record<ShopCurrencyCode, number>;
type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;
type SleepImpl = (ms: number) => Promise<void>;

type GpPortalOption =
  | string
  | {
      name?: string | null;
      position?: number | null;
      values?: Array<string | null> | null;
    };

export type GpPortalVariant = {
  id?: string | number | null;
  title?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  requires_shipping?: boolean | null;
  taxable?: boolean | null;
  featured_image?: string | { src?: string | null; url?: string | null } | null;
  available?: boolean | null;
  price?: number | null;
  weight?: number | null;
  compare_at_price?: number | null;
  inventory_management?: string | null;
  inventory_policy?: string | null;
  inventory_quantity?: number | null;
  barcode?: string | null;
};

export type GpPortalProduct = {
  id?: string | number | null;
  handle: string;
  title: string;
  description?: string | null;
  vendor?: string | null;
  type?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  price?: number | null;
  compare_at_price?: number | null;
  featured_image?: string | { src?: string | null; url?: string | null } | null;
  images?: Array<string | null> | null;
  options?: GpPortalOption[] | null;
  variants?: GpPortalVariant[] | null;
  available?: boolean | null;
};

export type UrbanGpPortalIssue = {
  handle: string;
  title: string;
  reason: string;
};

export type PreparedUrbanGpPortalProduct = {
  slug: string;
  sku: string | null;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  manufacturer: string;
  vehicleBrand: string;
  brand: string;
  vendor: string;
  productType: string | null;
  exactCategory: string;
  categoryUa: string | null;
  family: UrbanCatalogFamily;
  tags: string[];
  stock: 'inStock' | 'preOrder';
  image: string;
  gallery: string[];
  vehicleModelHandles: string[];
  collectionHandles: string[];
  primaryModelHandle: string;
  collectionLabel: string;
  priceEur: number;
  priceUsd: number;
  priceUah: number;
  compareAtEur: number | null;
  compareAtUsd: number | null;
  compareAtUah: number | null;
  variants: AdminShopProductVariantInput[];
  options: AdminShopProductOptionInput[];
  media: AdminShopProductMediaInput[];
  sourceHandle: string;
  sourceVendor: string | null;
  sourceType: string | null;
  sourceTags: string[];
  sourcePriceEur: number;
  sourceCompareAtEur: number | null;
  fallbackImageUsed: boolean;
};

export type PreparedUrbanGpPortalDataset = {
  sourceCount: number;
  importableItems: PreparedUrbanGpPortalProduct[];
  skippedItems: UrbanGpPortalIssue[];
  blockers: UrbanGpPortalIssue[];
  unmappedVehicleBrands: string[];
  unmappedVehicleModels: string[];
  unmappedCategories: string[];
};

type ApplyUrbanGpPortalSnapshotInput = {
  items: PreparedUrbanGpPortalProduct[];
  blockers: UrbanGpPortalIssue[];
  commit: boolean;
  backupCurrentCatalog?: (catalog: unknown[]) => Promise<string>;
  now?: Date;
};

type ApplyUrbanGpPortalSnapshotResult = {
  committed: boolean;
  archivedCount: number;
  upsertedCount: number;
  backupPath: string | null;
};

type RunUrbanGpPortalSyncOptions = {
  commit?: boolean;
  collectionUrl?: string;
  baseUrl?: string;
  usdImportFloor?: number;
  fetchImpl?: FetchImpl;
  sleepImpl?: SleepImpl;
  maxPages?: number;
  stopAfterStalePages?: number;
};

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMatchText(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[./]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: string | null | undefined) {
  return normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function centsToEur(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Number(value) / 100;
}

function roundWhole(value: number) {
  return Math.round(value);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeTags(tags: GpPortalProduct['tags']) {
  if (Array.isArray(tags)) {
    return tags
      .map((entry) => normalizeWhitespace(String(entry ?? '')))
      .filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean);
  }

  return [];
}

function normalizeImageUrl(value: string | { src?: string | null; url?: string | null } | null | undefined) {
  if (!value) return null;
  const raw =
    typeof value === 'string'
      ? value
      : typeof value.src === 'string'
        ? value.src
        : typeof value.url === 'string'
          ? value.url
          : '';

  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('//')) return `https:${cleaned}`;
  return cleaned;
}

function stripQueryAndHash(url: string) {
  return url.split(/[?#]/, 1)[0] ?? url;
}

export function isGpPortalPlaceholderImage(image: string | null | undefined) {
  const normalized = String(image ?? '').trim().toLowerCase();
  const normalizedPath = stripQueryAndHash(normalized);
  if (!normalized) return true;

  if (
    [
      'image-coming-soon',
      'coming-soon',
      'comingsoon',
      'placeholder',
      'no-image',
      'image_coming_soon',
    ].some((marker) => normalized.includes(marker))
  ) {
    return true;
  }

  if (
    normalizedPath.includes("cdn.shopify.com") &&
    (/\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(normalizedPath))
  ) {
    return true;
  }

  return false;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function normalizeVendor(value: string | null | undefined) {
  return normalizeWhitespace(String(value ?? '')).toLowerCase();
}

function buildPagedCollectionUrl(collectionUrl: string, page: number) {
  const url = new URL(collectionUrl);
  url.searchParams.set('page', String(page));
  return url.toString();
}

function buildRetryableHeaders(accept: string): HeadersInit {
  return {
    'user-agent': 'OneCompany Urban GP Portal Sync',
    accept,
  };
}

function exactCategoryFromProduct(product: GpPortalProduct, family: UrbanCatalogFamily) {
  const value = normalizeWhitespace(String(product.type ?? product.product_type ?? ''));
  if (value) return value;

  const fallbackByFamily: Record<UrbanCatalogFamily, string> = {
    bodykits: 'Bodykits',
    exterior: 'Exterior Components',
    wheels: 'Wheels',
    exhaust: 'Exhaust',
    interior: 'Interior',
    accessories: 'Accessories',
  };

  return fallbackByFamily[family];
}

function buildStructuredTags({
  rawTags,
  family,
  vehicleBrand,
}: {
  rawTags: string[];
  family: UrbanCatalogFamily;
  vehicleBrand: string;
}) {
  const slugifiedBrand = normalizeUrbanCatalogTagValue(vehicleBrand);
  return uniqueStrings([
    ...rawTags,
    structuredUrbanFamilyTag(family),
    'urban-source:gp-portal',
    `urban-vehicle-brand:${slugifiedBrand}`,
    'urban-manufacturer:urban-automotive',
  ]);
}

function normalizeUrbanCatalogTagValue(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractSequenceHandles(text: string, marker: RegExp, lookup: Record<string, string>) {
  const matches = [...text.matchAll(marker)];
  const handles: string[] = [];

  matches.forEach((match) => {
    const token = normalizeMatchText(match[0] ?? '');
    const handle = lookup[token];
    if (handle && !handles.includes(handle)) {
      handles.push(handle);
    }
  });

  return handles;
}

function getUrbanCard(handle: string) {
  return URBAN_CARD_BY_HANDLE.get(handle) ?? null;
}

function getUrbanPrimaryFallbackImage(handle: string | null | undefined) {
  if (!handle) return null;
  return getUrbanCard(handle)?.externalImageUrl ?? null;
}

function getUrbanFallbackImage(handles: string[]) {
  for (const handle of handles) {
    const image = getUrbanPrimaryFallbackImage(handle);
    if (image) {
      return image;
    }
  }

  return null;
}

function inferCollectionHandlesFromSource(title: string, tags: string[]) {
  const haystack = normalizeMatchText(`${title} ${tags.join(' ')}`);
  const handles: string[] = [];
  const add = (handle: string | null | undefined) => {
    if (handle && !handles.includes(handle)) {
      handles.push(handle);
    }
  };

  if (/\bdefender\b|\bl663\b/.test(haystack)) {
    const defenderHandles = extractSequenceHandles(haystack, /\b(?:90|110|130|octa)\b/g, {
      '90': 'land-rover-defender-90',
      '110': 'land-rover-defender-110',
      '130': 'land-rover-defender-130',
      octa: 'land-rover-defender-110-octa',
    });
    defenderHandles.forEach(add);

    if (!defenderHandles.length && /\bl663\b/.test(haystack)) {
      add('land-rover-defender-90');
      add('land-rover-defender-110');
      add('land-rover-defender-130');
    } else if (!defenderHandles.length && /\bdefender\b/.test(haystack) && !/\bclassic\b/.test(haystack)) {
      add('land-rover-defender-90');
      add('land-rover-defender-110');
      add('land-rover-defender-130');
    }
  }

  extractSequenceHandles(haystack, /\bl460\b|\bl461\b|\bl494\b/g, {
    l460: 'range-rover-l460',
    l461: 'range-rover-sport-l461',
    l494: 'range-rover-sport-l494',
  }).forEach(add);

  if (/\bdiscovery\b/.test(haystack) && /\b5\b/.test(haystack)) add('land-rover-discovery-5');
  if (/\burus\b/.test(haystack)) {
    if (/\bperformante\b/.test(haystack)) {
      add('lamborghini-urus-performante');
    } else if (/\bse\b/.test(haystack)) {
      add('lamborghini-urus-se');
    } else if (/\burus s\b|\bs urus\b/.test(haystack)) {
      add('lamborghini-urus-s');
    } else {
      add('lamborghini-urus');
    }
  }

  if (/\baventador\b/.test(haystack)) add('lamborghini-aventador-s');

  if (/\bcullinan\b/.test(haystack)) {
    add(/\bseries ii\b/.test(haystack) ? 'rolls-royce-cullinan-series-ii' : 'rolls-royce-cullinan');
  }

  if (/\bghost\b/.test(haystack) && /\bseries ii\b/.test(haystack)) add('rolls-royce-ghost-series-ii');

  if (/\bg[\s-]?wagon\b|\bg[\s-]?class\b|\bg63\b|\bw465\b/.test(haystack)) {
    if (/\baero\s?kit\b|\baerokit\b/.test(haystack)) {
      add('mercedes-g-wagon-w465-aerokit');
    } else if (/\bsoftkit\b/.test(haystack)) {
      add('mercedes-g-wagon-softkit');
    } else {
      add('mercedes-g-wagon-w465-widetrack');
    }
  }

  if (/\beqc\b/.test(haystack)) add('mercedes-eqc');

  if (/\brsq8\b/.test(haystack)) {
    add(/\bfacelift\b|\b2024\b|\b2025\b/.test(haystack) ? 'audi-rsq8-facelift' : 'audi-rsq8');
  }

  if (/\brs6\b|\brs7\b/.test(haystack)) add('audi-rs6-rs7');
  if (/\brs4\b/.test(haystack)) add('audi-rs4');
  if (/\brs3\b/.test(haystack)) add('audi-rs3');
  if (/\bcontinental gt\b|\bcontinental gtc\b/.test(haystack)) add('bentley-continental-gt');
  if (/\bgolf r\b/.test(haystack)) add('volkswagen-golf-r');
  if (/\bt6 1\b|\bt6\.1\b|\btransporter\b/.test(haystack)) add('volkswagen-transporter-t6-1');

  return handles;
}

function buildCollectionLabel(handles: string[]) {
  return handles
    .map((handle) => getUrbanCard(handle)?.title ?? null)
    .filter((label): label is string => Boolean(label))
    .join(' / ');
}

function normalizeGalleryImages(product: GpPortalProduct) {
  return uniqueStrings([
    normalizeImageUrl(product.featured_image),
    ...(product.images ?? []).map((image) => normalizeImageUrl(image)),
    ...((product.variants ?? []).map((variant) => normalizeImageUrl(variant.featured_image))),
  ]).filter((image) => !isGpPortalPlaceholderImage(image));
}

function normalizeOptions(options: GpPortalProduct['options']) {
  const normalizedOptions: Array<AdminShopProductOptionInput | null> = (options ?? [])
    .map((option, index) => {
      if (typeof option === 'string') {
        const normalizedName = normalizeWhitespace(option);
        if (!normalizedName || normalizedName === 'Title') return null;

        return {
          name: normalizedName,
          position: index + 1,
          values: [],
        } satisfies AdminShopProductOptionInput;
      }

      const name = normalizeWhitespace(String(option?.name ?? ''));
      if (!name || name === 'Title') return null;

      return {
        name,
        position: Number(option?.position ?? index + 1) || index + 1,
        values: uniqueStrings((option?.values ?? []).map((value) => String(value ?? '').trim())),
      } satisfies AdminShopProductOptionInput;
    });

  return normalizedOptions.filter((option): option is AdminShopProductOptionInput => option !== null);
}

function buildMedia(gallery: string[], title: string) {
  return gallery.map(
    (src, index) =>
      ({
        src,
        altText: title,
        position: index + 1,
        mediaType: 'IMAGE',
      }) satisfies AdminShopProductMediaInput
  );
}

function productAvailable(product: GpPortalProduct, variants: GpPortalVariant[]) {
  if (typeof product.available === 'boolean') {
    return product.available;
  }

  if (variants.length) {
    return variants.some((variant) => variant.available !== false);
  }

  return true;
}

function buildVariant(
  variant: GpPortalVariant,
  index: number,
  fallbackImage: string | null,
  currencyRates: CurrencyRates
) {
  const rawPriceEur = centsToEur(variant.price ?? null);
  const rawCompareAtEur = variant.compare_at_price == null ? null : centsToEur(variant.compare_at_price);
  const price = buildUrbanGpPortalPriceSet(rawPriceEur, currencyRates);
  const compareAt = rawCompareAtEur != null ? buildUrbanGpPortalPriceSet(rawCompareAtEur, currencyRates) : null;
  const inventoryQty = Number.isFinite(variant.inventory_quantity ?? NaN)
    ? Number(variant.inventory_quantity)
    : variant.available === false
      ? 0
      : 1;
  const variantImage = normalizeImageUrl(variant.featured_image);
  const usableVariantImage =
    variantImage && !isGpPortalPlaceholderImage(variantImage) ? variantImage : fallbackImage;
  const inventoryPolicy = normalizeWhitespace(
    String(variant.inventory_policy ?? variant.inventory_management ?? '')
  ).toLowerCase();

  return {
    title: normalizeWhitespace(String(variant.title ?? 'Default Title')) || 'Default Title',
    sku: normalizeWhitespace(String(variant.sku ?? '')) || null,
    position: index + 1,
    option1Value: variant.option1 && variant.option1 !== 'Default Title' ? variant.option1 : null,
    option1LinkedTo: null,
    option2Value: variant.option2 ?? null,
    option2LinkedTo: null,
    option3Value: variant.option3 ?? null,
    option3LinkedTo: null,
    grams: Number.isFinite(variant.weight ?? NaN) ? Number(variant.weight) : null,
    inventoryTracker: normalizeWhitespace(String(variant.inventory_management ?? '')) || null,
    inventoryQty,
    inventoryPolicy: inventoryPolicy === 'deny' ? 'DENY' : 'CONTINUE',
    fulfillmentService: 'manual',
    priceEur: price.eur,
    priceUsd: price.usd,
    priceUah: price.uah,
    compareAtEur: compareAt?.eur ?? null,
    compareAtUsd: compareAt?.usd ?? null,
    compareAtUah: compareAt?.uah ?? null,
    requiresShipping: variant.requires_shipping !== false,
    taxable: variant.taxable !== false,
    barcode: normalizeWhitespace(String(variant.barcode ?? '')) || null,
    image: usableVariantImage,
    weightUnit: null,
    taxCode: null,
    costPerItem: null,
    isDefault: index === 0,
  } satisfies AdminShopProductVariantInput;
}

function buildAdminPayload(item: PreparedUrbanGpPortalProduct, collectionIds: string[], now: Date): AdminShopProductPayload {
  return {
    slug: item.slug,
    sku: item.sku,
    scope: 'auto',
    brand: item.vehicleBrand,
    vendor: item.vendor,
    productType: item.productType,
    productCategory: item.exactCategory,
    tags: item.tags,
    collectionIds,
    status: 'ACTIVE',
    titleUa: item.title,
    titleEn: item.title,
    categoryUa: item.categoryUa,
    categoryEn: item.exactCategory,
    shortDescUa: item.descriptionText,
    shortDescEn: item.descriptionText,
    longDescUa: item.descriptionText,
    longDescEn: item.descriptionText,
    bodyHtmlUa: item.descriptionHtml,
    bodyHtmlEn: item.descriptionHtml,
    leadTimeUa: null,
    leadTimeEn: null,
    stock: item.stock,
    collectionUa: item.collectionLabel,
    collectionEn: item.collectionLabel,
    priceEur: item.priceEur,
    priceUsd: item.priceUsd,
    priceUah: item.priceUah,
    compareAtEur: item.compareAtEur,
    compareAtUsd: item.compareAtUsd,
    compareAtUah: item.compareAtUah,
    image: item.image,
    seoTitleUa: item.title,
    seoTitleEn: item.title,
    seoDescriptionUa: item.descriptionText,
    seoDescriptionEn: item.descriptionText,
    isPublished: true,
    publishedAt: now.toISOString(),
    gallery: item.gallery,
    highlights: null,
    media: item.media,
    options: item.options,
    variants: item.variants,
    metafields: [
      {
        namespace: 'custom',
        key: 'gp_portal_handle',
        value: item.sourceHandle,
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'urban_sync_source',
        value: 'gp-portal',
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'vehicle_brand',
        value: item.vehicleBrand,
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'vehicle_model_handles',
        value: item.vehicleModelHandles.join(','),
        valueType: 'multi_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'vehicle_family',
        value: item.family,
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'manufacturer',
        value: item.manufacturer,
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'source_vendor',
        value: item.sourceVendor ?? '',
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'source_type',
        value: item.sourceType ?? '',
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'source_tags',
        value: item.sourceTags.join('\n'),
        valueType: 'multi_line_text_field',
      },
    ],
  };
}

function getUrbanCatalogWhere() {
  return {
    scope: 'auto',
    OR: [
      {
        metafields: {
          some: {
            namespace: 'custom',
            key: 'urban_sync_source',
            value: 'gp-portal',
          },
        },
      },
      {
        vendor: {
          in: ['Urban', URBAN_BRAND],
        },
      },
      {
        brand: {
          in: ['Urban', URBAN_BRAND],
        },
      },
      {
        slug: {
          startsWith: 'urb-',
        },
      },
    ],
  };
}

async function defaultBackupCurrentCatalog(catalog: unknown[]) {
  const directory = path.join(process.cwd(), 'backups', 'urban-gp-portal');
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `urban-gp-portal-backup-${nowStamp()}.json`);
  await fs.writeFile(filePath, JSON.stringify(catalog, null, 2), 'utf8');
  return filePath;
}

async function ensureUrbanCollections(tx: Prisma.TransactionClient) {
  const collectionIdByHandle = new Map<string, string>();

  for (const [index, card] of URBAN_COLLECTION_CARDS.entries()) {
    const record = await tx.shopCollection.upsert({
      where: { handle: card.collectionHandle },
      update: {
        titleUa: card.title,
        titleEn: card.title,
        brand: card.brand,
        heroImage: card.externalImageUrl,
        isPublished: true,
        isUrban: true,
        sortOrder: index,
      },
      create: {
        handle: card.collectionHandle,
        titleUa: card.title,
        titleEn: card.title,
        brand: card.brand,
        heroImage: card.externalImageUrl,
        isPublished: true,
        isUrban: true,
        sortOrder: index,
      },
      select: {
        id: true,
      },
    });

    collectionIdByHandle.set(card.collectionHandle, record.id);
  }

  return collectionIdByHandle;
}

export function extractGpPortalProductHandles(html: string) {
  const handles: string[] = [];
  const seen = new Set<string>();
  const rx = /\/(?:collections\/[^"'?#]+\/)?products\/([^"'?#/]+)(?=[?#"'\/]|$)/gi;

  for (const match of html.matchAll(rx)) {
    const handle = String(match[1] ?? '').trim();
    if (!handle || seen.has(handle)) {
      continue;
    }

    seen.add(handle);
    handles.push(handle);
  }

  return handles;
}

export function usdImportFloorToEur(usdAmount: number, currencyRates: CurrencyRates) {
  const usdRate = currencyRates.USD > 0 ? currencyRates.USD : 1;
  return round2(usdAmount / usdRate);
}

export function buildUrbanGpPortalPriceSet(sourcePriceEur: number, currencyRates: CurrencyRates) {
  const markedUpEur = roundWhole(sourcePriceEur * 1.2);
  return {
    eur: markedUpEur,
    usd: roundWhole(markedUpEur * currencyRates.USD),
    uah: roundWhole(markedUpEur * currencyRates.UAH),
  };
}

export function prepareUrbanGpPortalProducts(
  products: GpPortalProduct[],
  options: {
    currencyRates: CurrencyRates;
    usdImportFloor?: number;
  }
): PreparedUrbanGpPortalDataset {
  const importableItems: PreparedUrbanGpPortalProduct[] = [];
  const skippedItems: UrbanGpPortalIssue[] = [];
  const blockers: UrbanGpPortalIssue[] = [];
  const unmappedVehicleBrands = new Set<string>();
  const unmappedVehicleModels = new Set<string>();
  const unmappedCategories = new Set<string>();
  const priceFloorEur = usdImportFloorToEur(options.usdImportFloor ?? USD_IMPORT_FLOOR, options.currencyRates);

  products.forEach((product) => {
    const tags = normalizeTags(product.tags);
    const sourcePriceEur = centsToEur(product.price ?? null);
    if (sourcePriceEur <= 0 || sourcePriceEur < priceFloorEur) {
      skippedItems.push({
        handle: product.handle,
        title: product.title,
        reason: `below import threshold (${sourcePriceEur.toFixed(2)} EUR < ${priceFloorEur.toFixed(2)} EUR)`,
      });
      return;
    }

    const collectionHandles = inferCollectionHandlesFromSource(product.title, tags);
    if (!collectionHandles.length) {
      unmappedVehicleModels.add(product.title);
      skippedItems.push({
        handle: product.handle,
        title: product.title,
        reason: 'hidden: no Urban collection match',
      });
      return;
    }

    const modelFacets = getUrbanModelFacetsFromHandles(collectionHandles);
    const primaryModelHandle =
      collectionHandles.find((handle) => Boolean(getUrbanCard(handle))) ?? collectionHandles[0] ?? null;
    const primaryModel = primaryModelHandle ? getUrbanCard(primaryModelHandle) : null;
    const vehicleBrand = primaryModel?.brand ?? modelFacets[0]?.brand ?? null;
    if (!vehicleBrand) {
      unmappedVehicleBrands.add(product.title);
      skippedItems.push({
        handle: product.handle,
        title: product.title,
        reason: 'hidden: no vehicle brand match from Urban collection handles',
      });
      return;
    }

    const gallery = normalizeGalleryImages(product);
    const orderedFallbackHandles = primaryModelHandle
      ? [primaryModelHandle, ...collectionHandles.filter((handle) => handle !== primaryModelHandle)]
      : collectionHandles;
    const resolvedFallbackImage = getUrbanFallbackImage(orderedFallbackHandles);
    const image = gallery[0] ?? resolvedFallbackImage;

    if (!image) {
      skippedItems.push({
        handle: product.handle,
        title: product.title,
        reason: 'hidden: no usable product image or fallback image available',
      });
      return;
    }

    const descriptionHtml = sanitizeRichTextHtml(String(product.description ?? '').trim());
    const descriptionText = htmlToPlainText(descriptionHtml) || normalizeWhitespace(product.title);
    const price = buildUrbanGpPortalPriceSet(sourcePriceEur, options.currencyRates);
    const family = inferUrbanFamilyFromValues([
      String(product.type ?? product.product_type ?? ''),
      product.title,
      ...tags,
      buildCollectionLabel(collectionHandles),
    ]);
    const exactCategory = exactCategoryFromProduct(product, family);
    const exactCategoryUa = getUrbanExactCategoryUa(exactCategory);
    if (exactCategoryUa.isFallback) {
      unmappedCategories.add(exactCategory);
    }
    const sourceCompareAtEur = product.compare_at_price == null ? null : centsToEur(product.compare_at_price);
    const compareAt =
      sourceCompareAtEur != null ? buildUrbanGpPortalPriceSet(sourceCompareAtEur, options.currencyRates) : null;
    const variants = (product.variants ?? []).length
      ? (product.variants ?? [])
      : [
          {
            title: 'Default Title',
            sku: null,
            available: product.available ?? true,
            price: product.price ?? null,
            compare_at_price: product.compare_at_price ?? null,
            featured_image: null,
          } satisfies GpPortalVariant,
        ];
    const itemGallery = gallery.length ? gallery : [image];
    const normalizedOptions = normalizeOptions(product.options);
    const normalizedVariants = variants.map((variant, index) =>
      buildVariant(variant, index, image, options.currencyRates)
    );

    importableItems.push({
      slug: product.handle,
      sku: normalizeWhitespace(String(normalizedVariants[0]?.sku ?? '')) || null,
      title: normalizeWhitespace(product.title),
      descriptionHtml,
      descriptionText,
      manufacturer: URBAN_BRAND,
      vehicleBrand,
      brand: vehicleBrand,
      vendor: URBAN_BRAND,
      productType: normalizeWhitespace(String(product.type ?? product.product_type ?? '')) || null,
      exactCategory,
      categoryUa: exactCategoryUa.label,
      family,
      tags: buildStructuredTags({
        rawTags: tags,
        family,
        vehicleBrand,
      }),
      stock: productAvailable(product, variants) ? 'inStock' : 'preOrder',
      image,
      gallery: itemGallery,
      vehicleModelHandles: collectionHandles,
      collectionHandles,
      primaryModelHandle: primaryModelHandle ?? collectionHandles[0],
      collectionLabel: buildCollectionLabel(collectionHandles),
      priceEur: price.eur,
      priceUsd: price.usd,
      priceUah: price.uah,
      compareAtEur: compareAt?.eur ?? null,
      compareAtUsd: compareAt?.usd ?? null,
      compareAtUah: compareAt?.uah ?? null,
      variants: normalizedVariants,
      options: normalizedOptions,
      media: buildMedia(itemGallery, product.title),
      sourceHandle: product.handle,
      sourceVendor: product.vendor ?? null,
      sourceType: normalizeWhitespace(String(product.type ?? product.product_type ?? '')) || null,
      sourceTags: tags,
      sourcePriceEur,
      sourceCompareAtEur,
      fallbackImageUsed: itemGallery[0] === resolvedFallbackImage && !gallery.length,
    });
  });

  return {
    sourceCount: products.length,
    importableItems,
    skippedItems,
    blockers,
    unmappedVehicleBrands: Array.from(unmappedVehicleBrands.values()).sort(),
    unmappedVehicleModels: Array.from(unmappedVehicleModels.values()).sort(),
    unmappedCategories: Array.from(unmappedCategories.values()).sort(),
  };
}

export async function applyUrbanGpPortalSnapshot(
  prisma: PrismaClient,
  input: ApplyUrbanGpPortalSnapshotInput
): Promise<ApplyUrbanGpPortalSnapshotResult> {
  if (!input.commit) {
    return {
      committed: false,
      archivedCount: 0,
      upsertedCount: 0,
      backupPath: null,
    };
  }

  if (input.blockers.length) {
    throw new Error(`Cannot commit Urban GP Portal sync while blockers remain (${input.blockers.length})`);
  }

  const existingCatalog = await prisma.shopProduct.findMany({
    where: getUrbanCatalogWhere(),
    include: {
      variants: true,
      media: true,
      collections: {
        include: {
          collection: true,
        },
      },
      options: true,
      metafields: true,
    },
  });
  const backupPath = await (input.backupCurrentCatalog ?? defaultBackupCurrentCatalog)(existingCatalog);
  const now = input.now ?? new Date();
  const collectionIdByHandle = await prisma.$transaction(
    async (tx) => ensureUrbanCollections(tx),
    {
      timeout: URBAN_SYNC_TRANSACTION_TIMEOUT_MS,
      maxWait: URBAN_SYNC_TRANSACTION_MAX_WAIT_MS,
    }
  );

  for (const item of input.items) {
    const collectionIds = uniqueStrings(
      item.collectionHandles.map((handle) => collectionIdByHandle.get(handle) ?? null)
    );
    const payload = buildAdminPayload(item, collectionIds, now);

    await prisma.shopProduct.upsert({
      where: { slug: payload.slug },
      update: buildAdminProductUpdateData(payload),
      create: buildAdminProductCreateData(payload),
    });
  }

  const archivedCount = await prisma.$transaction(
    async (tx) => {
      const currentSlugs = input.items.map((item) => item.slug);
      const archiveResult = await tx.shopProduct.updateMany({
        where: {
          AND: [
            getUrbanCatalogWhere(),
            {
              slug: {
                notIn: currentSlugs,
              },
            },
          ],
        },
        data: {
          status: 'ARCHIVED',
          isPublished: false,
          publishedAt: null,
        },
      });

      return archiveResult.count;
    },
    {
      timeout: URBAN_SYNC_TRANSACTION_TIMEOUT_MS,
      maxWait: URBAN_SYNC_TRANSACTION_MAX_WAIT_MS,
    }
  );

  return {
    committed: true,
    archivedCount,
    upsertedCount: input.items.length,
    backupPath,
  };
}

type CrawlGpPortalCollectionProductsResult = {
  products: GpPortalProduct[];
  pagesCrawled: number;
  candidateHandles: number;
  validatedUrbanProducts: number;
  retryCount: number;
};

async function fetchWithRetry({
  url,
  accept,
  fetchImpl,
  sleepImpl,
  retryState,
}: {
  url: string;
  accept: string;
  fetchImpl: FetchImpl;
  sleepImpl: SleepImpl;
  retryState: { retryCount: number };
}) {
  let attempt = 0;

  while (true) {
    const response = await fetchImpl(url, {
      headers: buildRetryableHeaders(accept),
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      retryState.retryCount += 1;
      await sleepImpl(250 * 2 ** attempt);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return response;
  }
}

export async function crawlGpPortalCollectionProducts({
  collectionUrl,
  baseUrl,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
  maxPages = MAX_COLLECTION_PAGES,
  stopAfterStalePages = STOP_AFTER_STALE_PAGES,
}: {
  collectionUrl: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
  sleepImpl?: SleepImpl;
  maxPages?: number;
  stopAfterStalePages?: number;
}): Promise<CrawlGpPortalCollectionProductsResult> {
  const retryState = { retryCount: 0 };
  const seenHandles = new Set<string>();
  const validatedProducts = new Map<string, GpPortalProduct>();
  let pagesCrawled = 0;
  let stalePages = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchWithRetry({
      url: buildPagedCollectionUrl(collectionUrl, page),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      fetchImpl,
      sleepImpl,
      retryState,
    });
    const html = await response.text();
    pagesCrawled += 1;

    const pageHandles = extractGpPortalProductHandles(html);
    const newCandidateHandles = pageHandles.filter((handle) => !seenHandles.has(handle));
    newCandidateHandles.forEach((handle) => seenHandles.add(handle));

    let newValidProducts = 0;
    for (const handle of newCandidateHandles) {
      const productResponse = await fetchWithRetry({
        url: `${baseUrl}/products/${handle}.js`,
        accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
        fetchImpl,
        sleepImpl,
        retryState,
      });
      const product = (await productResponse.json()) as GpPortalProduct;
      if (normalizeVendor(product.vendor) !== 'urban') {
        continue;
      }

      if (!validatedProducts.has(handle)) {
        validatedProducts.set(handle, product);
        newValidProducts += 1;
      }
    }

    stalePages = newValidProducts === 0 ? stalePages + 1 : 0;
    if (stalePages >= stopAfterStalePages) {
      break;
    }
  }

  return {
    products: Array.from(validatedProducts.values()),
    pagesCrawled,
    candidateHandles: seenHandles.size,
    validatedUrbanProducts: validatedProducts.size,
    retryCount: retryState.retryCount,
  };
}

export async function runUrbanGpPortalSync(
  prisma: PrismaClient,
  options: RunUrbanGpPortalSyncOptions = {}
) {
  const settingsRecord = await getOrCreateShopSettings(prisma);
  const settings = getShopSettingsRuntime(settingsRecord);
  const collectionUrl = options.collectionUrl ?? GP_PORTAL_COLLECTION_URL;
  const baseUrl = options.baseUrl ?? GP_PORTAL_BASE_URL;

  const crawled = await crawlGpPortalCollectionProducts({
    collectionUrl,
    baseUrl,
    fetchImpl: options.fetchImpl,
    sleepImpl: options.sleepImpl,
    maxPages: options.maxPages,
    stopAfterStalePages: options.stopAfterStalePages,
  });
  const prepared = prepareUrbanGpPortalProducts(crawled.products, {
    currencyRates: settings.currencyRates,
    usdImportFloor: options.usdImportFloor ?? USD_IMPORT_FLOOR,
  });
  const applied = await applyUrbanGpPortalSnapshot(prisma, {
    items: prepared.importableItems,
    blockers: prepared.blockers,
    commit: options.commit === true,
  });

  return {
    collectionUrl,
    handlesCount: crawled.validatedUrbanProducts,
    pagesCrawled: crawled.pagesCrawled,
    candidateHandles: crawled.candidateHandles,
    validatedUrbanProducts: crawled.validatedUrbanProducts,
    retryCount: crawled.retryCount,
    ...prepared,
    ...applied,
  };
}
