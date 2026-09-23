import "server-only";
import { getShopSearchFallbackQuery } from "./shopSearchRecovery";
import { SHOP_SEARCH_QUERY_MAX_LENGTH } from "./shopSearch";
import {
  computeRelevanceScoreWithReasons,
  filterShopStockSearchCandidates,
} from "./shopStockSearchMatching";

import {
  resolveCanonicalVehicleProductIds,
  isMissingStrictCatalogSchema,
} from "@/lib/shopStockCanonicalVehicleIds.server";
import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getShopFitmentCatalogProducts } from "@/lib/shopFitmentCatalogServer";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import {
  extractProductFitment,
  isExpectedChassisForMakeModel,
  type Fitment,
} from "@/lib/crossShopFitment";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { type ShopCurrencyCode } from "@/lib/shopAdminSettings";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import {
  buildShopSearchText,
  canonicalizeShopSearchQuery,
  tokenizeShopSearchQuery,
  normalizeShopSearchText,
} from "@/lib/shopSearch";
import { parseShopStockParamList } from "@/lib/shopStockSearchParams";
import { cleanShopAiProductKind, inferShopAiProductKind } from "@/lib/shopAiProductKind";
import { diversifyShopStockItems } from "@/lib/shopStockRanking";
import {
  buildVehicleSearchDebug,
  compactShopCode,
  enrichVehicleSearchFromCatalog,
  expandVehicleAliases,
  getVehicleResidualSearchTokens,
  projectCatalogVehicleResolutionItems,
  shouldEnrichVehicleSearchFromCatalog,
  type ShopVehicleSearchExpansion,
} from "@/lib/shopVehicleSearch";
import {
  getShopStockCategoryGroupForProduct,
  getShopStockCategoryLabelForProduct,
  matchesShopStockCategory,
} from "@/lib/shopStockTaxonomy";
import { getKwCardTitle } from "@/lib/shopKwCardPresentation";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
  resolveShopStockVehicleScope,
  type ShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import { shopFitmentMatchesVehicleConstraints } from "@/lib/shopVehicleConstraints";
import {
  classifyProductFitment,
  mergePersistedFitment,
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  parseNormalizedFitment,
  resolveSearchFitments,
  type NormalizedFitmentSource,
  type NormalizedFitmentStatus,
} from "@/lib/shopFitmentQuality";
import {
  parseSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  SUPPLIER_FITMENT_KEY,
} from "@/lib/shopImportFitment";
import {
  classifyStrictCatalogKnowledgeRow,
  getStrictCatalogMatchRank,
  parseStrictCatalogSearchConstraints,
  type StrictCatalogKnowledgeRow,
  type StrictCatalogMatch,
  type StrictCatalogSearchConstraints,
} from "@/app/api/shop/stock/search/strictCatalog";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import { compareShopCatalogLiveShadowPage } from "@/lib/shopCatalogLiveShadow";
import { queryShopCatalogProjectionShadow } from "@/lib/shopCatalogProjectionQuery.server";
import { resolveShopCatalogShadowFlag } from "@/lib/shopCatalogShadowFlag.server";
import {
  recordShopCatalogShadowObservation,
  resolveShopCatalogDeploymentCommit,
} from "@/lib/shopCatalogShadowTelemetry.server";
import { queryPremiumCatalogProjection } from "@/lib/shopCatalogPremiumProjection.server";
import { buildShopCatalogVehicleSearchPlan } from "@/lib/shopCatalogVehicleSearchPlan";
import {
  getShopConfirmedAvailability,
  isShopInStockProduct,
  shouldShowShopProductInCarousel,
} from "@/lib/shopWarehouseInventory";
import {
  EVENTURI_SHARED_V8_INTAKE_COPY,
  EVENTURI_SHARED_V8_INTAKE_SLUG,
  isEventuriSharedV8Intake,
  matchesEventuriSharedV8Application,
} from "@/lib/eventuriSharedIntake";
import { getProductDisplayBrand } from "@/lib/shopProductDisplayBrand";
import { canUsePremiumCatalogProjection } from "@/lib/shopCatalogPremiumEligibility";
import { compareShopStockPriceAmounts } from "@/lib/shopStockPriceSort";
import { singleFlight } from "@/lib/singleFlight";
export { getProductDisplayBrand } from "@/lib/shopProductDisplayBrand";

type StockSearchSort = "default" | "price_asc" | "price_desc" | "name_asc";
type StockSearchStock = "all" | "inStock" | "preOrder";

const STOCK_SEARCH_SORTS = new Set<StockSearchSort>([
  "default",
  "price_asc",
  "price_desc",
  "name_asc",
]);

const STOCK_SEARCH_STATES = new Set<StockSearchStock>(["all", "inStock", "preOrder"]);
const DEFAULT_STOCK_SEARCH_LIMIT = 24;
const MAX_STOCK_SEARCH_LIMIT = 96;
const STOCK_SEARCH_PRICE_CURRENCIES = new Set<ShopCurrencyCode>(["EUR", "USD", "UAH"]);

const CATALOG_BRAND_PRIORITY = [
  "Akrapovic",
  "Remus",
  "KW",
  "Ohlins",
  "GiroDisc",
  "iPE exhaust",
  "Eventuri",
  "Brabus",
  "Urban Automotive",
  "Burger Motorsports",
  "RaceChip",
  "CSF",
  "do88",
  "ADRO",
  "Ilmberger Carbon",
].map(normalizeShopSearchText);

type IndexedShopProduct = {
  product: any;
  fitment: Fitment;
  fitments: Fitment[];
  fitmentStatus: NormalizedFitmentStatus;
  fitmentSource: NormalizedFitmentSource;
  vehicleScope: ShopStockVehicleScope;
  searchText: string;
  titleText: string;
  canonicalTitles?: string[];
  skuText: string;
  brandText: string;
  compactSkuText: string;
  fitmentText: string;
  yearRanges: Fitment["yearRanges"];
  fitmentMake: string | null;
  fitmentItems?: Array<{
    searchText: string;
    titleText: string;
    skuText: string;
    brandText: string;
    compactSkuText: string;
    fitmentText: string;
    yearRanges: Fitment["yearRanges"];
    fitmentMake: string | null;
  }>;
};

let cachedProductsWithFitment: IndexedShopProduct[] | null = null;
let cachedTimestamp = 0;
let cachedBrowseProductsWithFitment: IndexedShopProduct[] | null = null;
let cachedBrowseTimestamp = 0;
let cachedFitmentOverrideUpdatedAt = 0;
let lastFitmentOverrideVersionCheck = 0;
const FITMENT_OVERRIDE_VERSION_CHECK_MS = 30 * 1000;

export function invalidateShopStockSearchCaches() {
  cachedProductsWithFitment = null;
  cachedTimestamp = 0;
  cachedBrowseProductsWithFitment = null;
  cachedBrowseTimestamp = 0;
  cachedFitmentOverrideUpdatedAt = 0;
  lastFitmentOverrideVersionCheck = 0;
}

function indexProductWithFitment(
  product: any,
  persisted?: { manual?: string; supplier?: string } | null
) {
  const automaticFitment = extractProductFitment(product);
  const automaticNormalized = classifyProductFitment(product, automaticFitment);
  const supplierContract = parseSupplierFitmentContract(persisted?.supplier);
  const supplierNormalized = supplierContract
    ? supplierContractToNormalizedFitment(supplierContract)
    : null;
  const persistedNormalized = parseNormalizedFitment(persisted?.manual);
  const automaticSafetyValue =
    automaticNormalized.status === "needs_review" || automaticNormalized.status === "universal"
      ? JSON.stringify(automaticNormalized)
      : null;
  const effectivePersistedValue =
    (persistedNormalized?.source === "manual"
      ? persisted?.manual
      : supplierNormalized
        ? JSON.stringify(supplierNormalized)
        : persisted?.manual) ?? automaticSafetyValue;
  const normalizedFitment = mergePersistedFitment(
    supplierNormalized ?? persistedNormalized ?? automaticNormalized,
    persistedNormalized?.source === "manual" ? persisted?.manual : null
  );
  const fitments = resolveSearchFitments(automaticFitment, effectivePersistedValue);
  const fitment = fitments[0];
  const displayBrand = getProductDisplayBrand(product.brand);
  const cardTitles = ["ua", "en"].map((locale) =>
    getKwCardTitle({ brand: displayBrand, title: product.title?.[locale] ?? "", locale })
  );
  const titleText = buildShopSearchText([product.title?.en, product.title?.ua, ...cardTitles]);
  const brandText = buildShopSearchText([displayBrand, product.vendor]);
  const skuText = buildShopSearchText([
    product.sku,
    ...(product.variants ?? []).flatMap((variant: any) => [variant.sku, variant.title]),
  ]);
  const compactSkuText = [
    product.sku,
    ...(product.variants ?? []).map((variant: any) => variant.sku),
  ]
    .map((value) => compactShopCode(value))
    .filter(Boolean)
    .join(" ");
  const buildFitmentText = (value: Fitment) =>
    buildShopSearchText([
      value.make,
      ...value.models,
      ...value.chassisCodes,
      ...(value.engines ?? []),
      value.fuel,
      ...(value.bodyStyles ?? []),
      ...(value.drivetrains ?? []),
      ...(value.markets ?? []),
      value.transmission,
      value.opfGpf,
      ...value.yearRanges.map((range) =>
        range.to === null
          ? `${range.from}+`
          : range.to === range.from
            ? String(range.from)
            : `${range.from}-${range.to}`
      ),
    ]);
  const fitmentText = buildShopSearchText(fitments.map(buildFitmentText));
  const searchText = buildShopSearchText([
    ...cardTitles,
    product.title?.en,
    product.title?.ua,
    product.sku,
    product.slug,
    displayBrand,
    product.vendor,
    product.productType,
    product.category?.ua,
    product.category?.en,
    product.collection?.ua,
    product.collection?.en,
    product.shortDescription?.ua,
    product.shortDescription?.en,
    product.longDescription?.ua,
    product.longDescription?.en,
    ...(product.highlights ?? []).flatMap((item: any) => [item.ua, item.en]),
    ...(product.collections ?? []).flatMap((item: any) => [
      item.handle,
      item.title?.ua,
      item.title?.en,
      item.brand,
    ]),
    ...(product.variants ?? []).flatMap((variant: any) => [
      variant.sku,
      variant.title,
      variant.optionValues?.join(" "),
    ]),
    ...fitments.flatMap((value) => [value.make, ...value.models, ...value.chassisCodes]),
    ...fitments.flatMap((value) => [
      ...(value.engines ?? []),
      value.fuel,
      ...(value.bodyStyles ?? []),
      ...(value.drivetrains ?? []),
      ...(value.markets ?? []),
      value.transmission,
      value.opfGpf,
    ]),
    ...(product.tags ?? []),
  ]);

  return {
    product,
    fitment,
    fitments,
    fitmentStatus: normalizedFitment.status,
    fitmentSource: normalizedFitment.source,
    vehicleScope: resolveShopStockVehicleScope(product.scope, normalizedFitment.vehicleType),
    searchText,
    titleText,
    canonicalTitles: [product.title?.ua, product.title?.en, ...cardTitles]
      .filter(Boolean)
      .map(canonicalizeShopSearchQuery),
    skuText,
    brandText,
    compactSkuText,
    fitmentText,
    yearRanges: fitment.yearRanges,
    fitmentMake: fitment.make,
    fitmentItems: fitments.map((value) => ({
      searchText,
      titleText,
      skuText,
      brandText,
      compactSkuText,
      fitmentText: buildFitmentText(value),
      yearRanges: value.yearRanges,
      fitmentMake: value.make,
    })),
  };
}

function consolidateEventuriSharedV8IntakeItems(
  items: NonNullable<typeof cachedProductsWithFitment>
): NonNullable<typeof cachedProductsWithFitment> {
  const sharedItems = items.filter((item) => isEventuriSharedV8Intake(item.product.sku));
  if (sharedItems.length === 0) return items;

  const representative =
    sharedItems.find((item) => item.product.slug === EVENTURI_SHARED_V8_INTAKE_SLUG) ??
    sharedItems[0];
  const fitmentKeys = new Set<string>();
  const fitments = sharedItems
    .flatMap((item) => item.fitments)
    .map((fitment) =>
      normalizeShopSearchText(fitment.make) === "audi"
        ? { ...fitment, models: [...new Set([...fitment.models, "RSQ8"])] }
        : fitment
    )
    .filter((fitment) => {
      const key = JSON.stringify([
        fitment.make,
        fitment.models,
        fitment.chassisCodes,
        fitment.yearRanges,
      ]);
      if (fitmentKeys.has(key)) return false;
      fitmentKeys.add(key);
      return true;
    });
  const product = {
    ...representative.product,
    slug: EVENTURI_SHARED_V8_INTAKE_SLUG,
    title: {
      ua: EVENTURI_SHARED_V8_INTAKE_COPY.titleUa,
      en: EVENTURI_SHARED_V8_INTAKE_COPY.titleEn,
    },
    shortDescription: {
      ua: EVENTURI_SHARED_V8_INTAKE_COPY.shortDescUa,
      en: EVENTURI_SHARED_V8_INTAKE_COPY.shortDescEn,
    },
    longDescription: {
      ua: EVENTURI_SHARED_V8_INTAKE_COPY.longDescUa,
      en: EVENTURI_SHARED_V8_INTAKE_COPY.longDescEn,
    },
    tags: [
      ...new Set([
        ...(representative.product.tags ?? []),
        "Audi RSQ8",
        "Audi SQ8",
        "Audi SQ7",
        "Lamborghini Urus",
        "Porsche Cayenne",
        "Bentley Bentayga",
        "4.0 V8 twin-turbo",
      ]),
    ],
  };
  const consolidated = indexProductWithFitment(product);
  const fitmentText = buildShopSearchText(
    fitments.flatMap((fitment) => [fitment.make, ...fitment.models, ...fitment.chassisCodes])
  );

  Object.assign(consolidated, {
    fitment: fitments[0] ?? consolidated.fitment,
    fitments,
    fitmentText,
    yearRanges: fitments.flatMap((fitment) => fitment.yearRanges),
    fitmentMake: fitments[0]?.make ?? consolidated.fitmentMake,
    fitmentItems: fitments.map((fitment) => ({
      searchText: consolidated.searchText,
      titleText: consolidated.titleText,
      skuText: consolidated.skuText,
      brandText: consolidated.brandText,
      compactSkuText: consolidated.compactSkuText,
      fitmentText: buildShopSearchText([fitment.make, ...fitment.models, ...fitment.chassisCodes]),
      yearRanges: fitment.yearRanges,
      fitmentMake: fitment.make,
    })),
  });

  const firstSharedIndex = items.findIndex((item) => isEventuriSharedV8Intake(item.product.sku));
  return items.flatMap((item, index) => {
    if (!isEventuriSharedV8Intake(item.product.sku)) return [item];
    return index === firstSharedIndex ? [consolidated] : [];
  });
}

async function getShopProductsWithFitmentsByIds(productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return [];
  if (isLocalStorefrontMode()) {
    const idSet = new Set(uniqueIds);
    return (await getShopProductsWithFitments()).filter((item) => idSet.has(item.product.id));
  }
  const [products, fitmentOverrides] = await Promise.all([
    // Vehicle resolution already narrowed the IDs. Reuse the compact fitment
    // projection instead of hydrating PDP-only media, options, metafields and
    // bundle graphs for every result. Search cards only need the scalar card
    // fields plus variants for SKU/fitment evidence.
    getShopFitmentCatalogProducts({ productIds: uniqueIds }),
    prisma.shopProductMetafield.findMany({
      where: {
        productId: { in: uniqueIds },
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: { in: [NORMALIZED_FITMENT_KEY, SUPPLIER_FITMENT_KEY] },
      },
      select: { productId: true, key: true, value: true },
    }),
  ]);
  const overrides = new Map<string, { manual?: string; supplier?: string }>();
  for (const item of fitmentOverrides) {
    const current = overrides.get(item.productId) ?? {};
    if (item.key === NORMALIZED_FITMENT_KEY) current.manual = item.value;
    if (item.key === SUPPLIER_FITMENT_KEY) current.supplier = item.value;
    overrides.set(item.productId, current);
  }
  return products.map((product) =>
    indexProductWithFitment(product, product.id ? overrides.get(product.id) : null)
  );
}

export const getShopProductsWithFitments = singleFlight(loadShopProductsWithFitments);
export const getShopBrowseProductsWithFitments = singleFlight(loadShopBrowseProductsWithFitments);

async function loadShopBrowseProductsWithFitments() {
  if (isLocalStorefrontMode()) return getShopProductsWithFitments();
  const now = Date.now();
  if (cachedBrowseProductsWithFitment && now - cachedBrowseTimestamp < 5 * 60 * 1000) {
    return cachedBrowseProductsWithFitment;
  }

  const products = await getShopFitmentCatalogProducts({
    includeVariants: false,
    includeCollections: false,
  });
  cachedBrowseProductsWithFitment = products.map((product) => indexProductWithFitment(product));
  cachedBrowseTimestamp = now;
  return cachedBrowseProductsWithFitment;
}

async function loadShopProductsWithFitments() {
  const now = Date.now();
  if (isLocalStorefrontMode()) {
    if (cachedProductsWithFitment && now - cachedTimestamp < 5 * 60 * 1000) {
      return cachedProductsWithFitment;
    }

    const products = await getShopProductsServer();
    cachedProductsWithFitment = products.map((product) => indexProductWithFitment(product));
    cachedTimestamp = now;
    cachedFitmentOverrideUpdatedAt = 0;
    lastFitmentOverrideVersionCheck = now;
    return cachedProductsWithFitment;
  }

  let overrideUpdatedAt = cachedFitmentOverrideUpdatedAt;
  if (
    !cachedProductsWithFitment ||
    now - lastFitmentOverrideVersionCheck >= FITMENT_OVERRIDE_VERSION_CHECK_MS
  ) {
    const overrideVersion = await prisma.shopProductMetafield.aggregate({
      where: {
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: { in: [NORMALIZED_FITMENT_KEY, SUPPLIER_FITMENT_KEY] },
      },
      _max: { updatedAt: true },
    });
    overrideUpdatedAt = overrideVersion._max.updatedAt?.getTime() ?? 0;
    lastFitmentOverrideVersionCheck = now;
  }
  if (
    cachedProductsWithFitment &&
    now - cachedTimestamp < 5 * 60 * 1000 &&
    overrideUpdatedAt === cachedFitmentOverrideUpdatedAt
  ) {
    return cachedProductsWithFitment;
  }

  const [products, fitmentOverrides] = await Promise.all([
    getShopFitmentCatalogProducts(),
    prisma.shopProductMetafield.findMany({
      where: {
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: { in: [NORMALIZED_FITMENT_KEY, SUPPLIER_FITMENT_KEY] },
      },
      select: { productId: true, key: true, value: true },
    }),
  ]);
  const fitmentOverrideByProductId = new Map<string, { manual?: string; supplier?: string }>();
  for (const item of fitmentOverrides) {
    const current = fitmentOverrideByProductId.get(item.productId) ?? {};
    if (item.key === NORMALIZED_FITMENT_KEY) current.manual = item.value;
    if (item.key === SUPPLIER_FITMENT_KEY) current.supplier = item.value;
    fitmentOverrideByProductId.set(item.productId, current);
  }

  if (
    !cachedProductsWithFitment ||
    products.length !== cachedProductsWithFitment.length ||
    now - cachedTimestamp > 5 * 60 * 1000 ||
    overrideUpdatedAt !== cachedFitmentOverrideUpdatedAt
  ) {
    cachedProductsWithFitment = products.map((product) =>
      indexProductWithFitment(
        product,
        product.id ? fitmentOverrideByProductId.get(product.id) : null
      )
    );
    cachedTimestamp = now;
    cachedFitmentOverrideUpdatedAt = overrideUpdatedAt;
  }

  return cachedProductsWithFitment;
}

function parseStockSearchSort(value: string | null): StockSearchSort {
  return value && STOCK_SEARCH_SORTS.has(value as StockSearchSort)
    ? (value as StockSearchSort)
    : "default";
}

function parseStockSearchStock(value: string | null): StockSearchStock {
  return value && STOCK_SEARCH_STATES.has(value as StockSearchStock)
    ? (value as StockSearchStock)
    : "all";
}

function parseStockSearchLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STOCK_SEARCH_LIMIT;
  return Math.min(MAX_STOCK_SEARCH_LIMIT, Math.max(1, Math.floor(parsed)));
}

function parseStockSearchPrice(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseStockSearchCurrency(value: string | null): ShopCurrencyCode {
  const normalized = value?.trim().toUpperCase() as ShopCurrencyCode | undefined;
  return normalized && STOCK_SEARCH_PRICE_CURRENCIES.has(normalized) ? normalized : "USD";
}

function hasAnyShopMoney(
  price: { eur?: number | null; usd?: number | null; uah?: number | null } | null | undefined
) {
  return (price?.eur ?? 0) > 0 || (price?.usd ?? 0) > 0 || (price?.uah ?? 0) > 0;
}

function incrementCount(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function buildFilterStats(
  productsWithFitments: Awaited<ReturnType<typeof getShopProductsWithFitments>>,
  locale: string,
  getProductPrice?: (product: any) => number,
  priceCurrency?: ShopCurrencyCode
) {
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  let inStock = 0;
  let preOrder = 0;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;

  for (const item of productsWithFitments) {
    incrementCount(brands, getProductDisplayBrand(item.product.brand));
    incrementCount(categories, getShopStockCategoryLabelForProduct(item, locale));

    if (isShopInStockProduct(item.product.sku, item.product.slug, item.product.storefrontDisplay)) {
      inStock += 1;
    } else {
      preOrder += 1;
    }

    const price = getProductPrice?.(item.product) ?? 0;
    if (Number.isFinite(price) && price > 0) {
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    }
  }

  const byCountThenLabel = (
    left: { label: string; count: number },
    right: { label: string; count: number }
  ) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, locale === "ua" ? "uk" : "en");
  };

  return {
    brands: Array.from(brands, ([label, count]) => ({ label, count })).sort(byCountThenLabel),
    categories: Array.from(categories, ([label, count]) => ({ label, count })).sort(
      byCountThenLabel
    ),
    stock: {
      all: productsWithFitments.length,
      inStock,
      preOrder,
    },
    price: {
      min: Number.isFinite(minPrice) ? Math.floor(minPrice) : 0,
      max: maxPrice > 0 ? Math.ceil(maxPrice) : 0,
      currency: priceCurrency ?? "USD",
    },
  };
}

const globalFilterStatsCache = new Map<
  string,
  { expiresAt: number; value: ReturnType<typeof buildFilterStats> }
>();

function readGlobalFilterStatsCache(key: string) {
  const cached = globalFilterStatsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    globalFilterStatsCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeGlobalFilterStatsCache(key: string, value: ReturnType<typeof buildFilterStats>) {
  if (globalFilterStatsCache.size >= 32) {
    const oldestKey = globalFilterStatsCache.keys().next().value;
    if (oldestKey) globalFilterStatsCache.delete(oldestKey);
  }
  globalFilterStatsCache.set(key, { expiresAt: Date.now() + 60_000, value });
}

function nullableStrictApplicationEquals(column: Prisma.Sql, value: string | null) {
  if (!value) return null;
  return Prisma.sql`
    (${column} IS NULL OR lower(trim(${column})) = lower(trim(${value})))
  `;
}

function presentStrictApplicationEquals(column: Prisma.Sql, value: string | null) {
  if (!value) return null;
  return Prisma.sql`
    (${column} IS NOT NULL AND lower(trim(${column})) = lower(trim(${value})))
  `;
}

type StrictCatalogResolution = {
  available: boolean;
  matches: Map<string, StrictCatalogMatch>;
};

let strictCoverageCache: { expiresAt: number; ready: boolean } | null = null;

async function hasStrictCatalogCoverage() {
  if (isLocalStorefrontMode()) return false;

  const now = Date.now();
  if (strictCoverageCache && strictCoverageCache.expiresAt > now) {
    return strictCoverageCache.ready;
  }
  const [publishedProducts, indexedProducts, activeApplications] = await Promise.all([
    prisma.shopProduct.count({ where: { isPublished: true, status: "ACTIVE" } }),
    prisma.shopProductKnowledge.count({
      where: {
        schemaVersion: { gte: 2 },
        activeRevision: { gt: 0 },
        status: { in: ["READY", "NEEDS_REVIEW"] },
        product: { isPublished: true, status: "ACTIVE" },
      },
    }),
    prisma.shopVehicleApplication.count({
      where: {
        isActive: true,
        verificationStatus: { not: "BLOCKED" },
        product: { isPublished: true, status: "ACTIVE" },
      },
    }),
  ]);
  const ready =
    publishedProducts > 0 && indexedProducts / publishedProducts >= 0.95 && activeApplications > 0;
  strictCoverageCache = { expiresAt: now + 5 * 60_000, ready };
  return ready;
}

async function resolveStrictCatalogMatches(
  constraints: StrictCatalogSearchConstraints,
  locale: "ua" | "en"
): Promise<StrictCatalogResolution> {
  if (constraints.invalid) {
    return { available: true, matches: new Map() };
  }
  if (!(await hasStrictCatalogCoverage())) {
    return { available: false, matches: new Map() };
  }

  const applicationClauses = [
    nullableStrictApplicationEquals(Prisma.sql`application."make"`, constraints.make),
    nullableStrictApplicationEquals(Prisma.sql`application."model"`, constraints.model),
    nullableStrictApplicationEquals(Prisma.sql`application."chassisCode"`, constraints.chassis),
    nullableStrictApplicationEquals(Prisma.sql`application."engine"`, constraints.engine),
    nullableStrictApplicationEquals(Prisma.sql`application."opfGpf"`, constraints.opfGpf),
    constraints.year
      ? Prisma.sql`
          (application."yearFrom" IS NULL OR application."yearFrom" <= ${constraints.year})
          AND (application."yearTo" IS NULL OR application."yearTo" >= ${constraints.year})
        `
      : null,
  ].filter((clause): clause is Prisma.Sql => clause !== null);
  const exactApplicationClauses = [
    presentStrictApplicationEquals(Prisma.sql`application."make"`, constraints.make),
    presentStrictApplicationEquals(Prisma.sql`application."model"`, constraints.model),
    presentStrictApplicationEquals(Prisma.sql`application."chassisCode"`, constraints.chassis),
    presentStrictApplicationEquals(Prisma.sql`application."engine"`, constraints.engine),
    presentStrictApplicationEquals(Prisma.sql`application."opfGpf"`, constraints.opfGpf),
    constraints.year
      ? Prisma.sql`
          (application."yearFrom" IS NOT NULL OR application."yearTo" IS NOT NULL)
          AND (application."yearFrom" IS NULL OR application."yearFrom" <= ${constraints.year})
          AND (application."yearTo" IS NULL OR application."yearTo" >= ${constraints.year})
        `
      : null,
  ].filter((clause): clause is Prisma.Sql => clause !== null);
  const requestedProductKind =
    constraints.productKind && constraints.productKind !== "any" ? constraints.productKind : null;

  try {
    const rows = await prisma.$queryRaw<StrictCatalogKnowledgeRow[]>(Prisma.sql`
      SELECT
        product."id" AS "productId",
        knowledge."categoryGroup" AS "categoryGroup",
        COALESCE(
          matched."productKind",
          knowledge."facts"->>'productKind'
        ) AS "productKind",
        knowledge."qualityFlags" AS "qualityFlags",
        knowledge."makes" AS "knowledgeMakes",
        knowledge."models" AS "knowledgeModels",
        knowledge."chassisCodes" AS "knowledgeChassisCodes",
        knowledge."yearRanges" AS "knowledgeYearRanges",
        knowledge."engines" AS "knowledgeEngines",
        COALESCE(
          knowledge."opfGpf",
          knowledge."facts"->>'opfGpf'
        ) AS "knowledgeOpfGpf",
        matched."id" AS "applicationId",
        matched."variantId" AS "applicationVariantId",
        matched."make" AS "applicationMake",
        matched."model" AS "applicationModel",
        matched."chassisCode" AS "applicationChassis",
        matched."yearFrom" AS "applicationYearFrom",
        matched."yearTo" AS "applicationYearTo",
        matched."engine" AS "applicationEngine",
        matched."opfGpf" AS "applicationOpfGpf",
        matched."isUniversal" AS "applicationUniversal",
        matched."verificationStatus"::text AS "applicationVerificationStatus",
        matched."source"::text AS "applicationSource",
        (
          matched."verificationStatus"::text = 'VERIFIED'
          AND matched."source"::text IN ('MANAGER', 'MANUAL_OVERRIDE', 'SUPPLIER')
        ) AS "applicationTrusted",
        EXISTS (
          SELECT 1
          FROM "ShopVehicleApplication" known_application
          WHERE known_application."knowledgeId" = knowledge."id"
            AND known_application."isActive" = true
            AND known_application."revision" = knowledge."activeRevision"
        ) AS "hasApplications",
        EXISTS (
          SELECT 1
          FROM "ShopVehicleApplication" trusted_application
          WHERE trusted_application."knowledgeId" = knowledge."id"
            AND trusted_application."isActive" = true
            AND trusted_application."revision" = knowledge."activeRevision"
            AND trusted_application."verificationStatus"::text = 'VERIFIED'
            AND trusted_application."source"::text IN ('MANAGER', 'MANUAL_OVERRIDE', 'SUPPLIER')
        ) AS "hasTrustedApplications",
        false AS "trustedKnowledgeVehicleEvidence"
      FROM "ShopProduct" product
      JOIN "ShopProductKnowledge" knowledge
        ON knowledge."productId" = product."id"
      LEFT JOIN LATERAL (
        SELECT application.*
        FROM "ShopVehicleApplication" application
        WHERE application."knowledgeId" = knowledge."id"
          AND application."isActive" = true
          AND application."revision" = knowledge."activeRevision"
          AND application."verificationStatus"::text <> 'BLOCKED'
          ${
            constraints.scope
              ? Prisma.sql`AND application."scope" = ${constraints.scope}`
              : Prisma.empty
          }
          ${
            requestedProductKind
              ? Prisma.sql`
                  AND (
                    application."productKind" IS NULL
                    OR lower(trim(application."productKind")) =
                       lower(trim(${requestedProductKind}))
                  )
                `
              : Prisma.empty
          }
          ${
            applicationClauses.length
              ? Prisma.sql`
                  AND (
                    application."isUniversal" = true
                    OR (${Prisma.join(applicationClauses, " AND ")})
                  )
                `
              : Prisma.empty
          }
        ORDER BY
          (
            application."verificationStatus"::text = 'VERIFIED'
            AND application."source"::text IN ('MANAGER', 'MANUAL_OVERRIDE', 'SUPPLIER')
            ${
              exactApplicationClauses.length
                ? Prisma.sql`
                    AND (
                      application."isUniversal" = true
                      OR (${Prisma.join(exactApplicationClauses, " AND ")})
                    )
                  `
                : Prisma.empty
            }
          ) DESC,
          application."confidence" DESC,
          application."updatedAt" DESC
        LIMIT 1
      ) matched ON true
      WHERE product."isPublished" = true
        AND product."status"::text = 'ACTIVE'
        AND knowledge."schemaVersion" >= 2
        AND knowledge."activeRevision" > 0
        AND knowledge."status"::text IN ('READY', 'NEEDS_REVIEW')
        AND NOT (
          'v2_backfill_required' = ANY(COALESCE(knowledge."qualityFlags", ARRAY[]::TEXT[]))
        )
        ${
          constraints.category
            ? Prisma.sql`
                AND lower(trim(COALESCE(knowledge."categoryGroup", ''))) =
                    lower(trim(${constraints.category}))
              `
            : Prisma.empty
        }
        ${
          requestedProductKind
            ? Prisma.sql`
                AND lower(trim(COALESCE(
                  matched."productKind",
                  knowledge."facts"->>'productKind',
                  ''
                ))) = lower(trim(${requestedProductKind}))
              `
            : Prisma.empty
        }
    `);

    const matches = new Map<string, StrictCatalogMatch>();
    for (const row of rows) {
      const match = classifyStrictCatalogKnowledgeRow(row, constraints, locale);
      if (match) matches.set(row.productId, match);
    }
    return { available: true, matches };
  } catch (error) {
    if (!isMissingStrictCatalogSchema(error)) throw error;
    return { available: false, matches: new Map() };
  }
}

export async function searchShopStock(request: { url: string }) {
  const startedAt = performance.now();
  const timings: string[] = [];
  let stageStartedAt = startedAt;
  const mark = (name: string) => {
    const now = performance.now();
    timings.push(`${name};dur=${(now - stageStartedAt).toFixed(1)}`);
    stageStartedAt = now;
  };
  try {
    const { searchParams } = new URL(request.url);
    if ((searchParams.get("q")?.length ?? 0) > SHOP_SEARCH_QUERY_MAX_LENGTH)
      return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
    if (
      !isLocalStorefrontMode() &&
      process.env.SHOP_CATALOG_V2_READER_MODE?.trim().toLowerCase() === "ssr"
    ) {
      if (canUsePremiumCatalogProjection(new URL(request.url).searchParams)) {
        try {
          return await queryPremiumCatalogProjection(searchParams);
        } catch (error) {
          console.error({
            event: "catalog_v2_accelerated_fallback",
            errorType: error instanceof Error ? error.name : "UnknownError",
          });
          // Keep the request available while the accelerated rollout is being
          // observed. The legacy path below uses the same URL and response shape.
        }
      }
    }
    const strictCatalogConstraints = parseStrictCatalogSearchConstraints(searchParams);
    // Keep the original code for exact SKU matching. Text/vehicle matching
    // canonicalizes independently, so brand aliases cannot rewrite an SKU.
    const rawQuery = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const rawProductType = searchParams.get("productType")?.trim() || "";
    const productType = rawProductType.length <= 120 ? rawProductType : "";
    const productKind = cleanShopAiProductKind(searchParams.get("productKind"));
    const strictMatch = strictCatalogConstraints.enabled;
    const allowFallback = searchParams.get("allowFallback") !== "0";
    const make = searchParams.get("make")?.trim() || "";
    const model = searchParams.get("model")?.trim() || "";
    const chassis = searchParams.get("chassis")?.trim() || "";
    const requestedYear = strictCatalogConstraints.year;
    const requestedEngine = strictCatalogConstraints.engine;
    const requestedFuel = searchParams.get("fuel")?.trim() || null;
    const requestedOpfGpf = strictCatalogConstraints.opfGpf;
    const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));
    const stock = parseStockSearchStock(searchParams.get("stock"));
    const sort = parseStockSearchSort(searchParams.get("sort"));
    const locale = searchParams.get("locale")?.trim() || "ua";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const all = searchParams.get("all") === "true";
    const debug = searchParams.get("debug") === "true";
    const includeFitment = searchParams.get("includeFitment") === "true";
    const country = searchParams.get("country");
    const limit = parseStockSearchLimit(searchParams.get("limit"));
    const priceCurrency = parseStockSearchCurrency(searchParams.get("currency"));
    let minPrice = parseStockSearchPrice(searchParams.get("minPrice"));
    let maxPrice = parseStockSearchPrice(searchParams.get("maxPrice"));
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }
    const hasPriceFilter = minPrice !== null || maxPrice !== null;
    const brandNames = parseShopStockParamList(searchParams, "brand").map((value) =>
      normalizeShopSearchText(value)
    );
    const hasBrandFilter = brandNames.length > 0;
    const hasVehicleConstraints = Boolean(
      make ||
      model ||
      chassis ||
      requestedYear ||
      requestedEngine ||
      requestedFuel ||
      requestedOpfGpf
    );
    const queryVehiclePlan = buildShopCatalogVehicleSearchPlan(searchParams, {
      readerMode: "legacy",
    });
    const q = [rawQuery, ...queryVehiclePlan.qualifierTerms].filter(Boolean).join(" ");
    const resolvedVehicleMake = queryVehiclePlan.constraints.make ?? "";
    const resolvedVehicleModel = queryVehiclePlan.constraints.model ?? "";
    const resolvedVehicleChassis = queryVehiclePlan.constraints.generation ?? "";
    const resolvedVehicleYear = queryVehiclePlan.constraints.year;
    const strictCatalogApplied =
      strictMatch &&
      (strictCatalogConstraints.invalid || strictCatalogConstraints.hasKnowledgeConstraints);
    const strictCatalogPromise = strictCatalogApplied
      ? resolveStrictCatalogMatches(strictCatalogConstraints, locale === "en" ? "en" : "ua")
      : Promise.resolve<StrictCatalogResolution | null>(null);
    const shadowFlag = resolveShopCatalogShadowFlag({
      nodeEnv: process.env.NODE_ENV,
      mode: process.env.SHOP_CATALOG_V2_SHADOW_MODE,
    });
    const rawBrands = searchParams
      .getAll("brand")
      .map((value) => value.trim())
      .filter(Boolean);
    const shadowUnsupported = Boolean(
      page !== 1 ||
      all ||
      sort !== "default" ||
      stock !== "all" ||
      productType ||
      (productKind && productKind !== "any") ||
      strictCatalogApplied ||
      minPrice !== null ||
      maxPrice !== null ||
      requestedOpfGpf ||
      rawBrands.length > 1
    );
    const shadowStartedAt = Date.now();
    const shadowPromise = shadowUnsupported
      ? null
      : queryShopCatalogProjectionShadow({
          flag: shadowFlag,
          query: {
            locale: locale === "en" ? "en" : "ua",
            limit,
            text: q,
            scope: searchParams.get("scope"),
            brand: rawBrands[0] ?? null,
            category: category || null,
            make,
            model,
            generation: chassis,
            year: requestedYear,
            engine: requestedEngine,
            fuel: searchParams.get("fuel"),
          },
        }).catch((error: unknown) => ({ error }) as const);
    const useCompactBrowseCatalog = Boolean(
      !isLocalStorefrontMode() &&
      !q &&
      !category &&
      !productType &&
      (!productKind || productKind === "any") &&
      !hasBrandFilter &&
      !hasVehicleConstraints &&
      !strictCatalogApplied &&
      !all &&
      searchParams.get("carousel") !== "1"
    );

    const [settings, session, canonicalVehicleProductIds, strictCatalogResolution] =
      await Promise.all([
        // Public catalog settings are tag-cached and invalidated by the admin
        // settings routes. This removes one live DB read from every search.
        getPublicShopSettingsRuntime(),
        getCurrentShopCustomerSession(),
        resolveCanonicalVehicleProductIds({
          make: resolvedVehicleMake,
          model: resolvedVehicleModel,
          chassis: resolvedVehicleChassis,
          year: resolvedVehicleYear,
          engine: requestedEngine,
          fuel: requestedFuel,
          opfGpf: requestedOpfGpf,
          scope: vehicleScope,
        }),
        strictCatalogPromise,
      ]);
    mark("context");
    const pricingContextPromise = buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: session?.customerId,
      customerGroup: session?.group,
      isAuthenticated: Boolean(session),
      customerB2BDiscountPercent: session?.b2bDiscountPercent,
      priceCountry: country,
    });
    const allProductsWithFitments =
      requestedFuel && canonicalVehicleProductIds === null
        ? []
        : canonicalVehicleProductIds === null
          ? useCompactBrowseCatalog
            ? await getShopBrowseProductsWithFitments()
            : await getShopProductsWithFitments()
          : await getShopProductsWithFitmentsByIds(canonicalVehicleProductIds);
    mark("catalog");
    let scopedProductsWithFitments = filterShopStockItemsByVehicleScope(
      allProductsWithFitments,
      vehicleScope
    );
    if (
      canonicalVehicleProductIds !== null &&
      !requestedFuel &&
      matchesEventuriSharedV8Application(make, model)
    ) {
      const sharedIntakeItems = filterShopStockItemsByVehicleScope(
        (await getShopProductsWithFitments()).filter((item) =>
          isEventuriSharedV8Intake(item.product.sku)
        ),
        vehicleScope
      );
      scopedProductsWithFitments = [
        ...scopedProductsWithFitments.filter((item) => !isEventuriSharedV8Intake(item.product.sku)),
        ...sharedIntakeItems,
      ];
    }
    const strictCatalogEffective =
      strictCatalogApplied && strictCatalogResolution?.available === true;
    const strictCatalogMatches = strictCatalogEffective
      ? (strictCatalogResolution?.matches ?? null)
      : null;
    const productsWithFitments = consolidateEventuriSharedV8IntakeItems(
      strictCatalogEffective && strictCatalogMatches
        ? scopedProductsWithFitments.filter((item) => strictCatalogMatches.has(item.product.id))
        : scopedProductsWithFitments
    );
    const matchesProductKind = (item: (typeof productsWithFitments)[number]) => {
      if (!productKind || productKind === "any") return true;
      const categoryGroup = getShopStockCategoryGroupForProduct(item, locale);
      const evidence = [
        item.product.title?.ua,
        item.product.title?.en,
        item.product.category?.ua,
        item.product.category?.en,
        item.product.productType,
        item.product.sku,
        ...(item.product.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      return inferShopAiProductKind(evidence, categoryGroup.id) === productKind;
    };

    const pricingContext = await pricingContextPromise;

    const pricingCache = new WeakMap<object, ReturnType<typeof resolveShopProductPricing>>();
    const priceSetCache = new WeakMap<object, ReturnType<typeof expandShopPrices>>();

    const getProductPricing = (product: any) => {
      const cached = pricingCache.get(product);
      if (cached) return cached;
      const pricing = resolveShopProductPricing(product, pricingContext);
      pricingCache.set(product, pricing);
      return pricing;
    };

    const getProductPriceSet = (product: any) => {
      const cached = priceSetCache.get(product);
      if (cached) return cached;
      const effectivePriceSet = expandShopPrices(
        getProductPricing(product).effectivePrice,
        settings.currencyRates
      );
      priceSetCache.set(product, effectivePriceSet);
      return effectivePriceSet;
    };

    const getProductPriceForSort = (product: any) => {
      const effectivePriceSet = getProductPriceSet(product);
      if (effectivePriceSet.usd > 0) return effectivePriceSet.usd;
      const usdRate = settings.currencyRates.USD || 1.152174;
      const uahRate = settings.currencyRates.UAH || 53.0;
      if (effectivePriceSet.eur > 0) return effectivePriceSet.eur * usdRate;
      if (effectivePriceSet.uah > 0) return effectivePriceSet.uah / (uahRate / usdRate);
      return 0;
    };

    const getProductPriceForFilter = (product: any) => {
      const effectivePriceSet = getProductPriceSet(product);
      if (priceCurrency === "EUR") return effectivePriceSet.eur ?? 0;
      if (priceCurrency === "UAH") return effectivePriceSet.uah ?? 0;
      return effectivePriceSet.usd ?? 0;
    };

    const matchesPriceRange = (item: (typeof productsWithFitments)[number]) => {
      if (!hasPriceFilter) return true;
      const price = getProductPriceForFilter(item.product);
      if (!Number.isFinite(price) || price <= 0) return false;
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    };

    // 1. Filter logic
    let filtered = productsWithFitments;

    if (hasBrandFilter) {
      filtered = filtered.filter((item) => {
        const displayBrand = normalizeShopSearchText(getProductDisplayBrand(item.product.brand));
        return brandNames.includes(displayBrand);
      });
    }

    if (category && !strictCatalogEffective) {
      filtered = filtered.filter((item) => matchesShopStockCategory(item, category, locale));
    }
    if (productType) {
      const normalizedProductType = normalizeShopSearchText(productType);
      filtered = filtered.filter(
        (item) => normalizeShopSearchText(item.product.productType ?? "") === normalizedProductType
      );
    }
    if (productKind && productKind !== "any" && !strictCatalogEffective) {
      filtered = filtered.filter(matchesProductKind);
    }

    if (searchParams.get("carousel") === "1") {
      filtered = filtered.filter(({ product }) =>
        shouldShowShopProductInCarousel(product.sku, product.slug, product.storefrontDisplay)
      );
    }

    if (stock !== "all") {
      filtered = filtered.filter(
        (item) =>
          (isShopInStockProduct(item.product.sku, item.product.slug, item.product.storefrontDisplay)
            ? "inStock"
            : "preOrder") === stock
      );
    }

    if (hasPriceFilter) {
      filtered = filtered.filter(matchesPriceRange);
    }

    if (requestedFuel && canonicalVehicleProductIds === null) {
      // Legacy fitment snapshots do not carry a verified fuel dimension.
      // Fail closed rather than claiming a fuel match from incomplete data.
      filtered = [];
    } else if (
      (make || model || chassis || requestedYear) &&
      !strictCatalogEffective &&
      canonicalVehicleProductIds === null
    ) {
      if (
        (make && !isVehicleMakeCompatibleWithScope(make, vehicleScope)) ||
        (make && model && chassis && !isExpectedChassisForMakeModel(make, model, chassis))
      ) {
        filtered = [];
      } else {
        const makeNorm = normalizeShopSearchText(make);
        const modelNorm = normalizeShopSearchText(model);
        filtered = filtered.filter((item) =>
          item.fitments.some((fitment) =>
            shopFitmentMatchesVehicleConstraints(fitment, {
              make: makeNorm,
              model: modelNorm,
              chassis,
              year: requestedYear,
            })
          )
        );
      }
    }

    // 2. Search query with relevance scoring
    const queryTokens = tokenizeShopSearchQuery(q);
    let expandedQuery = q ? expandVehicleAliases(q) : null;
    if (expandedQuery && shouldEnrichVehicleSearchFromCatalog(expandedQuery)) {
      expandedQuery = enrichVehicleSearchFromCatalog(
        expandedQuery,
        projectCatalogVehicleResolutionItems(productsWithFitments),
        {
          isExpectedChassis: isExpectedChassisForMakeModel,
        }
      );
    }
    let correctedQuery: string | null = null;
    let scoredItems = filtered.map((item) => {
      let score = 1;
      let scoreReasons: string[] = [];
      const displayBrand = getProductDisplayBrand(item.product.brand);
      if (q && queryTokens.length > 0) {
        const scored = computeRelevanceScoreWithReasons(
          item,
          queryTokens,
          q,
          expandedQuery!,
          displayBrand,
          item.product.title?.en,
          item.product.title?.ua
        );
        score = scored.score;
        scoreReasons = scored.reasons;
      }
      return { ...item, score, scoreReasons };
    });

    const sortByNameAsc = (
      left: (typeof scoredItems)[number],
      right: (typeof scoredItems)[number]
    ) => {
      const titleA =
        locale === "en"
          ? left.product.title.en || left.product.title.ua || ""
          : left.product.title.ua || left.product.title.en || "";
      const titleB =
        locale === "en"
          ? right.product.title.en || right.product.title.ua || ""
          : right.product.title.ua || right.product.title.en || "";
      return titleA.localeCompare(titleB, locale === "ua" ? "uk" : "en");
    };

    const sortByExplicitSort = (items: typeof scoredItems) => {
      if (sort === "price_asc") {
        items.sort((a, b) =>
          compareShopStockPriceAmounts(
            getProductPriceForFilter(a.product),
            getProductPriceForFilter(b.product),
            "asc"
          )
        );
        return;
      }
      if (sort === "price_desc") {
        items.sort((a, b) =>
          compareShopStockPriceAmounts(
            getProductPriceForFilter(a.product),
            getProductPriceForFilter(b.product),
            "desc"
          )
        );
        return;
      }
      if (sort === "name_asc") {
        items.sort(sortByNameAsc);
      }
    };

    const sortByDefaultCatalogOrder = (items: typeof scoredItems) => {
      const diversified = diversifyShopStockItems(items, (item) => {
        const displayBrand = getProductDisplayBrand(item.product.brand);
        const normalizedBrand = normalizeShopSearchText(displayBrand);
        const brandPriority = CATALOG_BRAND_PRIORITY.indexOf(normalizedBrand);
        const title = item.product.title.ua || item.product.title.en || "";
        const normalizedTitle = normalizeShopSearchText(title);
        const hasImage = Boolean(item.product.image || item.product.gallery?.[0]);
        const hasFitment = Boolean(
          item.fitments.some(
            (fitment) => fitment.make || fitment.models.length || fitment.chassisCodes.length
          )
        );
        const productPrice = getProductPriceForSort(item.product);
        const isMinorAccessory =
          /\b(accessory|adaptor|adapter|replacement|spare|bracket|clamp)\b/.test(normalizedTitle) ||
          /\b(адаптер|кронштейн|хомут|запасн)/.test(normalizedTitle);
        const isCoreUpgrade =
          /\b(exhaust|system|suspension|coilover|brake|disc|intake|intercooler|radiator|body kit|spoiler|diffuser|tuner)\b/.test(
            normalizedTitle
          ) ||
          /\b(вихлоп|система|підвіск|гальм|диск|впуск|інтеркулер|радіатор|обвіс|спойлер|дифузор|тюнер)/.test(
            normalizedTitle
          );

        let catalogScore = isShopInStockProduct(
          item.product.sku,
          item.product.slug,
          item.product.storefrontDisplay
        )
          ? 120
          : 0;
        if (hasImage) catalogScore += 45;
        if (productPrice > 0) catalogScore += 15 + Math.min(30, Math.log10(productPrice + 1) * 6);
        if (hasFitment) catalogScore += 12;
        if (isCoreUpgrade) catalogScore += 20;
        if (isMinorAccessory) catalogScore -= 40;
        if (brandPriority >= 0) catalogScore += Math.max(6, 24 - brandPriority);

        return {
          brand: displayBrand,
          score: catalogScore,
          stableKey: `${title} ${item.product.sku || item.product.slug}`,
        };
      });

      items.splice(0, items.length, ...diversified);
    };

    const diversifyStrongVehicleResults = (items: typeof scoredItems) => {
      if (items.length < 2) return;
      const topScore = items[0]?.score ?? 0;
      const relevanceFloor = topScore * 0.55;
      const strong = items.filter((item) => item.score >= relevanceFloor);
      if (strong.length < 2) return;
      const strongSet = new Set(strong);
      const categoryPriority: Record<string, number> = {
        exhaust: 18,
        carbonAero: 17,
        brakes: 15,
        suspension: 14,
        performance: 13,
        cooling: 12,
        chipTuning: 10,
        wheels: 7,
        lighting: 6,
        interior: 5,
        accessories: -12,
        merch: -20,
        other: -5,
      };
      const diversified = diversifyShopStockItems(strong, (item) => {
        const group = getShopStockCategoryGroupForProduct(item, locale);
        const title = item.product.title?.ua || item.product.title?.en || "";
        const normalizedTitle = buildShopSearchText([
          item.product.title?.ua,
          item.product.title?.en,
        ]);
        let completenessScore = 0;
        if (group.id === "exhaust") {
          if (
            /\b(system|slip on|evolution line|racing line|catback|cat back|система)\b/.test(
              normalizedTitle
            )
          ) {
            completenessScore += 32;
          }
          if (
            /\b(bracket|heat shield|tailpipe|tip|link pipe|replacement|кронштейн|насадк|захист)\b/.test(
              normalizedTitle
            )
          ) {
            completenessScore -= 14;
          }
        } else if (group.id === "suspension") {
          if (
            /\b(coilover|suspension kit|damper kit|комплект амортиз|комплект койловер)\b/.test(
              normalizedTitle
            )
          ) {
            completenessScore += 28;
          }
          if (/\b(bracket|mount|кронштейн|опор[аи])\b/.test(normalizedTitle)) {
            completenessScore -= 14;
          }
        } else if (group.id === "brakes") {
          if (/\b(brake kit|rotor kit|комплект.*гальм|комплект.*диск)\b/.test(normalizedTitle)) {
            completenessScore += 18;
          }
          if (/\b(replacement ring|змінн.*кільц)\b/.test(normalizedTitle)) {
            completenessScore -= 10;
          }
        }
        return {
          brand: group.id,
          score: item.score + (categoryPriority[group.id] ?? 0) + completenessScore,
          stableKey: `${title} ${item.product.sku || item.product.slug}`,
        };
      });
      items.splice(
        0,
        items.length,
        ...diversified,
        ...items.filter((item) => !strongSet.has(item))
      );
    };

    if (q && queryTokens.length > 0) {
      if (!strictCatalogEffective) {
        scoredItems = filterShopStockSearchCandidates(scoredItems, expandedQuery!);
        if (scoredItems.length === 0 && allowFallback) {
          const recovery = getShopSearchFallbackQuery(q, await getShopProductsWithFitments());
          if (recovery) {
            let recoveredExpansion = expandVehicleAliases(recovery);
            if (shouldEnrichVehicleSearchFromCatalog(recoveredExpansion))
              recoveredExpansion = enrichVehicleSearchFromCatalog(
                recoveredExpansion,
                projectCatalogVehicleResolutionItems(productsWithFitments),
                { isExpectedChassis: isExpectedChassisForMakeModel }
              );
            const recoveredTokens = tokenizeShopSearchQuery(recovery);
            const recoveredItems = filtered.map((item) => {
              const scored = computeRelevanceScoreWithReasons(
                item,
                recoveredTokens,
                recovery,
                recoveredExpansion,
                getProductDisplayBrand(item.product.brand),
                item.product.title?.en,
                item.product.title?.ua
              );
              return { ...item, score: scored.score, scoreReasons: scored.reasons };
            });
            const recovered = filterShopStockSearchCandidates(recoveredItems, recoveredExpansion);
            if (recovered.length) {
              scoredItems = recovered;
              correctedQuery = recovery;
              expandedQuery = recoveredExpansion;
            }
          }
        }
      }
      // Sort by relevance score descending
      scoredItems.sort((a, b) => b.score - a.score);
      if (sort !== "default") {
        sortByExplicitSort(scoredItems);
      } else if (
        expandedQuery &&
        getVehicleResidualSearchTokens(expandedQuery).length === 0 &&
        (expandedQuery.intent === "vehicle" || expandedQuery.intent === "mixed")
      ) {
        diversifyStrongVehicleResults(scoredItems);
      }
    } else if (sort !== "default") {
      sortByExplicitSort(scoredItems);
    } else if (hasBrandFilter) {
      sortByDefaultCatalogOrder(scoredItems);
    } else {
      sortByDefaultCatalogOrder(scoredItems);
    }

    if (strictCatalogEffective && strictCatalogMatches) {
      scoredItems.sort(
        (left, right) =>
          getStrictCatalogMatchRank(strictCatalogMatches.get(left.product.id)) -
          getStrictCatalogMatchRank(strictCatalogMatches.get(right.product.id))
      );
    }

    const totalItems = scoredItems.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedItems = all ? scoredItems : scoredItems.slice((page - 1) * limit, page * limit);
    const detailedVisibleItems = useCompactBrowseCatalog
      ? await getShopProductsWithFitmentsByIds(
          paginatedItems.map((item) => item.product.id).filter((id): id is string => Boolean(id))
        )
      : [];
    const detailedVisibleItemsById = new Map(
      detailedVisibleItems.map((item) => [item.product.id, item])
    );
    const renderedPaginatedItems = useCompactBrowseCatalog
      ? paginatedItems.map((item) => {
          const detailed = detailedVisibleItemsById.get(item.product.id);
          return detailed ? { ...item, ...detailed } : item;
        })
      : paginatedItems;
    const fallbackApplied: "fitment" | "all" | null = null;
    const statsItems = scoredItems;

    // 3. Serialize output for frontend
    // The compact fitment projection intentionally omits galleries. Fetch
    // image media only for the visible page so a stale KW primary URL can
    // recover from the same product's gallery without bloating the 17k-row
    // catalog cache or adding media joins to every fitment scan.
    const visibleProductIds =
      renderedPaginatedItems.length <= MAX_STOCK_SEARCH_LIMIT
        ? Array.from(
            new Set(
              renderedPaginatedItems
                .filter(({ product }) => {
                  const brand = normalizeShopSearchText(getProductDisplayBrand(product.brand));
                  return !product.image || brand.includes("kw");
                })
                .map(({ product }) => product.id)
                .filter((id): id is string => Boolean(id))
            )
          )
        : [];
    const visibleMediaRows =
      !isLocalStorefrontMode() && visibleProductIds.length
        ? await prisma.$queryRaw<Array<{ productId: string; src: string }>>(Prisma.sql`
          SELECT DISTINCT ON ("productId") "productId", "src"
          FROM "ShopProductMedia"
          WHERE "productId" IN (${Prisma.join(visibleProductIds)})
            AND "mediaType" = 'IMAGE'
          ORDER BY "productId" ASC, "position" ASC, "createdAt" ASC, "id" ASC
        `)
        : [];
    const visibleMediaByProduct = new Map<string, string[]>();
    for (const media of visibleMediaRows) {
      const sources = visibleMediaByProduct.get(media.productId) ?? [];
      if (media.src?.trim()) sources.push(media.src.trim());
      visibleMediaByProduct.set(media.productId, sources);
    }
    const sanitizedItems = renderedPaginatedItems.map(
      ({ product, fitments, fitmentStatus, fitmentSource }) => {
        const pricing = getProductPricing(product);
        const strictCatalogMatch = strictCatalogMatches?.get(product.id);
        const sourceCategory =
          locale === "en"
            ? product.category?.en || product.category?.ua || ""
            : product.category?.ua || product.category?.en || "";

        const usdRate = settings.currencyRates.USD || 1.152174;
        const uahRate = settings.currencyRates.UAH || 53.0;

        const effectivePriceSet = expandShopPrices(pricing.effectivePrice, settings.currencyRates);

        const expandedEffectiveCompareAtSet = pricing.effectiveCompareAt
          ? expandShopPrices(pricing.effectiveCompareAt, settings.currencyRates)
          : null;
        const effectiveCompareAtSet = hasAnyShopMoney(expandedEffectiveCompareAtSet)
          ? expandedEffectiveCompareAtSet
          : null;

        const expandedB2cPriceSet = pricing.bands?.b2c?.price
          ? expandShopPrices(pricing.bands.b2c.price, settings.currencyRates)
          : null;
        const b2cCompareAtFallback = hasAnyShopMoney(expandedB2cPriceSet)
          ? expandedB2cPriceSet
          : null;

        const compareAtPriceSet = effectiveCompareAtSet ?? b2cCompareAtFallback;

        const dealerPrice =
          effectivePriceSet.usd > 0
            ? effectivePriceSet.usd
            : effectivePriceSet.eur > 0
              ? effectivePriceSet.eur * usdRate
              : effectivePriceSet.uah > 0
                ? effectivePriceSet.uah / (uahRate / usdRate)
                : 0;

        const msrp =
          compareAtPriceSet && compareAtPriceSet.usd > 0
            ? compareAtPriceSet.usd
            : compareAtPriceSet && compareAtPriceSet.eur > 0
              ? compareAtPriceSet.eur * usdRate
              : compareAtPriceSet && compareAtPriceSet.uah > 0
                ? compareAtPriceSet.uah / (uahRate / usdRate)
                : null;

        const defaultVariant =
          product.variants?.find((v: any) => v.isDefault) || product.variants?.[0];

        return {
          id: product.id,
          name: getKwCardTitle({
            brand: getProductDisplayBrand(product.brand),
            title:
              locale === "en"
                ? product.title.en || product.title.ua
                : product.title.ua || product.title.en,
            locale,
          }),
          brand: getProductDisplayBrand(product.brand),
          partNumber: product.sku || "",
          description:
            locale === "en"
              ? product.shortDescription?.en || product.shortDescription?.ua || ""
              : product.shortDescription?.ua || product.shortDescription?.en || "",
          category: sourceCategory || getShopStockCategoryLabelForProduct({ product }, locale),
          // Keep the primary image first, but retain the product's own gallery
          // as a deterministic fallback when a CDN URL is stale or unavailable.
          imageSources: Array.from(
            new Set(
              [
                product.image,
                ...(Array.isArray(product.gallery) ? product.gallery : []),
                ...(product.id ? (visibleMediaByProduct.get(product.id) ?? []) : []),
                ...(product.variants ?? []).map((variant: any) => variant.image),
              ]
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
            )
          ),
          thumbnail: product.image || product.gallery?.[0] || null,
          inStock: isShopInStockProduct(product.sku, product.slug, product.storefrontDisplay),
          availability: getShopConfirmedAvailability(
            product.sku,
            product.slug,
            product.storefrontDisplay
          ),
          showInCarousel: shouldShowShopProductInCarousel(
            product.sku,
            product.slug,
            product.storefrontDisplay
          ),
          price: dealerPrice,
          priceUsd: effectivePriceSet.usd,
          priceEur: effectivePriceSet.eur,
          priceUah: effectivePriceSet.uah,
          priceSet: effectivePriceSet,
          originalPrice: msrp,
          originalPriceSet: compareAtPriceSet,
          markupPct: pricing.discountPercent || 0,
          slug: product.slug,
          href: buildShopStorefrontProductPathForProduct(locale, product),
          variantId: strictCatalogMatch?.variantId || defaultVariant?.id || null,
          turn14Id: "", // empty so frontend knows it's a shop product
          source: "local" as const,
          ...(strictCatalogMatch
            ? {
                matchStatus: strictCatalogMatch.matchStatus,
                missingFacts: strictCatalogMatch.missingFacts,
                matchReason: strictCatalogMatch.matchReason,
                matchedApplicationId: strictCatalogMatch.matchedApplicationId,
              }
            : {}),
          ...(includeFitment
            ? {
                fitmentStatus,
                fitmentSource,
                fitments: fitments.map((fitment) => ({
                  make: fitment.make,
                  models: fitment.models,
                  chassisCodes: fitment.chassisCodes,
                  yearRanges: fitment.yearRanges,
                  engines: fitment.engines ?? [],
                  fuel: fitment.fuel ?? null,
                  bodyStyles: fitment.bodyStyles ?? [],
                  drivetrains: fitment.drivetrains ?? [],
                  markets: fitment.markets ?? [],
                  transmission: fitment.transmission ?? null,
                  opfGpf: fitment.opfGpf ?? "unknown",
                  confidence: fitment.confidence,
                })),
              }
            : {}),
        };
      }
    );

    const canCacheGlobalFilterStats =
      canonicalVehicleProductIds === null && !strictCatalogEffective;
    const globalFilterStatsCacheKey = canCacheGlobalFilterStats
      ? JSON.stringify({
          locale,
          vehicleScope,
          priceCurrency,
          country: country ?? "",
          customerId: session?.customerId ?? "",
          group: session?.group ?? "",
          b2bDiscountPercent: session?.b2bDiscountPercent ?? 0,
          rates: settings.currencyRates,
          catalogTimestamp: cachedTimestamp,
          fitmentVersion: cachedFitmentOverrideUpdatedAt,
        })
      : "";
    let globalFilterStats = globalFilterStatsCacheKey
      ? readGlobalFilterStatsCache(globalFilterStatsCacheKey)
      : null;
    if (!globalFilterStats) {
      globalFilterStats = buildFilterStats(
        productsWithFitments,
        locale,
        getProductPriceForFilter,
        priceCurrency
      );
      if (globalFilterStatsCacheKey) {
        writeGlobalFilterStatsCache(globalFilterStatsCacheKey, globalFilterStats);
      }
    }
    const filterPopulationIsGlobal =
      !q &&
      !hasBrandFilter &&
      !category &&
      !productType &&
      (!productKind || productKind === "any") &&
      stock === "all" &&
      !hasPriceFilter &&
      !hasVehicleConstraints &&
      !strictCatalogEffective &&
      fallbackApplied === null;
    const filterStats = filterPopulationIsGlobal
      ? globalFilterStats
      : buildFilterStats(statsItems, locale, getProductPriceForFilter, priceCurrency);

    // Extract all unique brands and curated product groups for filter menus
    const brands = globalFilterStats.brands.map((entry) => entry.label);
    const categories = globalFilterStats.categories.map((entry) => entry.label);

    mark("filter_rank_price");
    if (shadowPromise) {
      const shadow = await shadowPromise;
      const shadowDurationMs = Date.now() - shadowStartedAt;
      const deploymentCommit = resolveShopCatalogDeploymentCommit(process.env);
      const persistShadowObservation = (outcome: { mismatch: boolean; error: boolean }) => {
        if (!deploymentCommit) return;
        after(async () => {
          try {
            await recordShopCatalogShadowObservation({
              deploymentCommit,
              locale: locale === "en" ? "en" : "ua",
              brand: rawBrands[0] ?? null,
              category: category || null,
              durationMs: shadowDurationMs,
              ...outcome,
            });
          } catch (telemetryError) {
            console.error("[Catalog V2 Shadow]", {
              event: "catalog_v2_shadow_telemetry_persist_error",
              error:
                telemetryError instanceof Error ? telemetryError.message : String(telemetryError),
            });
          }
        });
      };
      if ("error" in shadow) {
        persistShadowObservation({ mismatch: false, error: true });
        console.error("[Catalog V2 Shadow]", {
          event: "catalog_v2_shadow_error",
          durationMs: shadowDurationMs,
          error: shadow.error instanceof Error ? shadow.error.message : String(shadow.error),
        });
      } else if (shadow.enabled) {
        const comparison = compareShopCatalogLiveShadowPage({
          legacyProductIds: sanitizedItems.map((item) => item.id),
          projectionProductIds: shadow.result.items.map((item) => item.productId),
          legacyHasMore: page < totalPages,
          projectionHasMore: shadow.result.hasMore,
        });
        persistShadowObservation({ mismatch: !comparison.parity, error: false });
        console.info("[Catalog V2 Shadow]", {
          event: "catalog_v2_shadow_page_comparison",
          durationMs: shadowDurationMs,
          filterDimensions: [
            ...(q ? ["text"] : []),
            ...(searchParams.get("scope") ? ["scope"] : []),
            ...(rawBrands[0] ? ["brand"] : []),
            ...(category ? ["category"] : []),
            ...(make ? ["make"] : []),
            ...(model ? ["model"] : []),
            ...(chassis ? ["generation"] : []),
            ...(requestedYear ? ["year"] : []),
            ...(requestedEngine ? ["engine"] : []),
          ],
          ...comparison,
        });
      }
    }

    mark("shadow");
    const response = NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages,
        totalItems,
        source: "local",
        fallbackApplied,
        correctedQuery,
        ...(debug && q
          ? {
              debug: {
                query: buildVehicleSearchDebug(expandedQuery ?? expandVehicleAliases(q)),
                topReasons: paginatedItems.slice(0, 10).map((item: any) => ({
                  slug: item.product.slug,
                  sku: item.product.sku,
                  score: item.score,
                  reasons: item.scoreReasons ?? [],
                })),
              },
            }
          : {}),
      },
      filters: {
        brands,
        categories,
        price: globalFilterStats.price,
      },
      filterStats,
      globalFilterStats,
    });
    response.headers.set(
      "Cache-Control",
      session ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300"
    );
    response.headers.set(
      "Server-Timing",
      [...timings, `total;dur=${(performance.now() - startedAt).toFixed(1)}`].join(", ")
    );
    return response;
  } catch (error: any) {
    console.error("[Stock Search API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
