import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import {
  extractProductFitment,
  areChassisCompatible,
  isExpectedChassisForMakeModel,
  type Fitment,
} from "@/lib/crossShopFitment";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import {
  getOrCreateShopSettings,
  getShopSettingsRuntime,
  type ShopCurrencyCode,
} from "@/lib/shopAdminSettings";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "@/lib/shopPricingAudience";
import {
  buildShopSearchText,
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
  isStructuredPartQuery,
  scoreVehicleSearchItem,
  type ShopVehicleSearchExpansion,
} from "@/lib/shopVehicleSearch";
import {
  getShopStockCategoryGroupForProduct,
  getShopStockCategoryLabelForProduct,
  matchesShopStockCategory,
} from "@/lib/shopStockTaxonomy";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
  resolveShopStockVehicleScope,
  type ShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import { vehicleYearRangeContains } from "@/lib/shopVehicleYears";
import {
  classifyProductFitment,
  mergePersistedFitment,
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  resolveSearchFitments,
  type NormalizedFitmentSource,
  type NormalizedFitmentStatus,
} from "@/lib/shopFitmentQuality";
import {
  classifyStrictCatalogKnowledgeRow,
  getStrictCatalogMatchRank,
  parseStrictCatalogSearchConstraints,
  type StrictCatalogKnowledgeRow,
  type StrictCatalogMatch,
  type StrictCatalogSearchConstraints,
} from "./strictCatalog";

const URBAN_VEHICLE_BRANDS = new Set([
  "land rover",
  "lamborghini",
  "rolls-royce",
  "mercedes-benz",
  "audi",
  "range rover",
  "bentley",
  "volkswagen",
  "urban",
  "urban automotive",
]);

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

export function getProductDisplayBrand(brand: string | null | undefined): string {
  if (!brand) return "";
  const lower = brand.trim().toLowerCase();
  if (URBAN_VEHICLE_BRANDS.has(lower)) {
    return "Urban Automotive";
  }
  return brand.trim();
}

let cachedProductsWithFitment: Array<{
  product: any;
  fitment: Fitment;
  fitments: Fitment[];
  fitmentStatus: NormalizedFitmentStatus;
  fitmentSource: NormalizedFitmentSource;
  vehicleScope: ShopStockVehicleScope;
  searchText: string;
  titleText: string;
  skuText: string;
  compactSkuText: string;
  fitmentText: string;
  yearRanges: Fitment["yearRanges"];
  fitmentMake: string | null;
}> | null = null;
let cachedTimestamp = 0;
let cachedFitmentOverrideUpdatedAt = 0;
let lastFitmentOverrideVersionCheck = 0;
const FITMENT_OVERRIDE_VERSION_CHECK_MS = 30 * 1000;

export async function getShopProductsWithFitments() {
  const now = Date.now();
  let overrideUpdatedAt = cachedFitmentOverrideUpdatedAt;
  if (
    !cachedProductsWithFitment ||
    now - lastFitmentOverrideVersionCheck >= FITMENT_OVERRIDE_VERSION_CHECK_MS
  ) {
    const overrideVersion = await prisma.shopProductMetafield.aggregate({
      where: {
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: NORMALIZED_FITMENT_KEY,
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
    getShopProductsServer(),
    prisma.shopProductMetafield.findMany({
      where: {
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: NORMALIZED_FITMENT_KEY,
      },
      select: { productId: true, value: true },
    }),
  ]);
  const fitmentOverrideByProductId = new Map(
    fitmentOverrides.map((item) => [item.productId, item.value])
  );

  if (
    !cachedProductsWithFitment ||
    products.length !== cachedProductsWithFitment.length ||
    now - cachedTimestamp > 5 * 60 * 1000 ||
    overrideUpdatedAt !== cachedFitmentOverrideUpdatedAt
  ) {
    cachedProductsWithFitment = products.map((product) => {
      const automaticFitment = extractProductFitment(product);
      const persistedValue = product.id ? fitmentOverrideByProductId.get(product.id) : null;
      const normalizedFitment = mergePersistedFitment(
        classifyProductFitment(product, automaticFitment),
        persistedValue
      );
      const fitments = resolveSearchFitments(automaticFitment, persistedValue);
      const fitment = fitments[0];
      const displayBrand = getProductDisplayBrand(product.brand);
      const titleText = buildShopSearchText([product.title?.en, product.title?.ua]);
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
        skuText,
        compactSkuText,
        fitmentText,
        yearRanges: fitment.yearRanges,
        fitmentMake: fitment.make,
        fitmentItems: fitments.map((value) => ({
          searchText,
          titleText,
          skuText,
          compactSkuText,
          fitmentText: buildFitmentText(value),
          yearRanges: value.yearRanges,
          fitmentMake: value.make,
        })),
      };
    });
    cachedTimestamp = now;
    cachedFitmentOverrideUpdatedAt = overrideUpdatedAt;
  }

  return cachedProductsWithFitment;
}

function computeRelevanceScoreWithReasons(
  item: {
    searchText: string;
    titleText: string;
    skuText: string;
    compactSkuText: string;
    fitmentText: string;
    yearRanges?: Fitment["yearRanges"];
    fitmentMake?: string | null;
    fitmentItems?: Array<{
      searchText: string;
      titleText: string;
      skuText: string;
      compactSkuText: string;
      fitmentText: string;
      yearRanges?: Fitment["yearRanges"];
      fitmentMake?: string | null;
    }>;
  },
  queryTokens: string[],
  rawQuery: string,
  expandedQuery: ShopVehicleSearchExpansion,
  brand?: string,
  titleEn?: string,
  titleUa?: string
) {
  const vehicleScore = (item.fitmentItems?.length ? item.fitmentItems : [item])
    .map((fitmentItem) => scoreVehicleSearchItem(fitmentItem, expandedQuery))
    .sort((left, right) => right.score - left.score)[0];
  const compactQuery = compactShopCode(rawQuery);
  if (isStructuredPartQuery(rawQuery) && item.compactSkuText.includes(compactQuery)) {
    return { score: 1000, reasons: ["sku:exact"] };
  }

  let score = 0;
  let matchedTokens = 0;
  const normalizedBrand = normalizeShopSearchText(brand);
  const normalizedTitleEn = normalizeShopSearchText(titleEn);
  const normalizedTitleUa = normalizeShopSearchText(titleUa);

  for (const token of queryTokens) {
    if (!item.searchText.includes(token)) {
      continue;
    }

    matchedTokens += 1;
    score += 1.0;

    if (item.fitmentText.includes(token)) {
      score += 3.0;
    }
    if (
      item.titleText.includes(token) ||
      normalizedTitleEn.includes(token) ||
      normalizedTitleUa.includes(token)
    ) {
      score += 1.5;
    }
    if (item.skuText.includes(token)) {
      score += 2.0;
    }
    if (normalizedBrand.includes(token)) {
      score += 1.0;
    }
  }

  if (matchedTokens === 0) {
    return vehicleScore.score > 0 ? vehicleScore : { score: 0, reasons: [] };
  }

  const coverage = matchedTokens / queryTokens.length;

  // For multi-token vehicle/SKU searches, avoid ranking one-token coincidences
  // above real fitment matches. The fallback path still broadens when strict
  // filters produce no results.
  if (queryTokens.length >= 2 && coverage < 0.5) {
    return vehicleScore.score > 0 ? vehicleScore : { score: 0, reasons: [] };
  }

  const textScore = score * coverage;
  if (vehicleScore.score > 0) {
    return {
      score: vehicleScore.score + textScore,
      reasons: [...vehicleScore.reasons, `text:${textScore.toFixed(2)}`].slice(0, 8),
    };
  }
  return { score: textScore, reasons: [`text:${textScore.toFixed(2)}`] };
}

function narrowVehicleSearchResults<
  T extends { searchText: string; score: number; fitments?: Fitment[] },
>(items: T[], expandedQuery: ShopVehicleSearchExpansion) {
  if (expandedQuery.intent !== "vehicle" && expandedQuery.intent !== "mixed") {
    return items;
  }

  let narrowed = items;
  const hasStructuredVehicleTarget =
    expandedQuery.makes.length > 0 &&
    (expandedQuery.models.length > 0 || expandedQuery.chassis.length > 0);
  const structuredMatches = hasStructuredVehicleTarget
    ? items.filter((item) =>
        (item.fitments ?? []).some((fitment) => {
          const makeMatches = expandedQuery.makes.some(
            (make) => normalizeShopSearchText(make) === normalizeShopSearchText(fitment.make)
          );
          if (!makeMatches) return false;
          const modelMatches =
            expandedQuery.models.length === 0 ||
            fitment.models.some((model) =>
              expandedQuery.models.some(
                (queryModel) =>
                  normalizeShopSearchText(queryModel) === normalizeShopSearchText(model)
              )
            );
          if (!modelMatches) return false;
          const chassisMatches =
            expandedQuery.chassis.length === 0 ||
            fitment.chassisCodes.some((chassis) =>
              expandedQuery.chassis.some((queryChassis) =>
                areChassisCompatible(chassis, queryChassis)
              )
            );
          if (!chassisMatches) return false;
          return (
            expandedQuery.years.length === 0 ||
            (fitment.yearRanges.length > 0 &&
              expandedQuery.years.some((year) =>
                fitment.yearRanges.some((range) => vehicleYearRangeContains(range, year))
              ))
          );
        })
      )
    : [];
  const hasStructuredMatches = structuredMatches.length > 0;
  if (hasStructuredMatches) {
    narrowed = structuredMatches;
  }

  if (!hasStructuredMatches && expandedQuery.requiredTokens.length > 0) {
    const fullRequiredMatches = items.filter((item) =>
      expandedQuery.requiredTokens.every((token) => item.searchText.includes(token))
    );
    const partialRequiredMatches = items.filter((item) =>
      expandedQuery.requiredTokens.some((token) => item.searchText.includes(token))
    );
    if (fullRequiredMatches.length > 0) {
      narrowed = fullRequiredMatches;
    } else if (partialRequiredMatches.length > 0) {
      narrowed = partialRequiredMatches;
    }
  }

  const minimumScore = expandedQuery.requiredTokens.length > 0 ? 12 : 8;
  const strongMatches = narrowed.filter((item) => item.score >= minimumScore);
  return strongMatches.length > 0 ? strongMatches : narrowed;
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

    if (item.product.stock === "inStock") {
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

function isMissingStrictCatalogSchema(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2021" ||
    code === "P2010" ||
    code === "42P01" ||
    code === "42703" ||
    /ShopProductKnowledge|ShopVehicleApplication|column .* does not exist|does not exist/i.test(
      message
    )
  );
}

type StrictCatalogResolution = {
  available: boolean;
  matches: Map<string, StrictCatalogMatch>;
};

async function resolveStrictCatalogMatches(
  constraints: StrictCatalogSearchConstraints,
  locale: "ua" | "en"
): Promise<StrictCatalogResolution> {
  if (constraints.invalid) {
    return { available: true, matches: new Map() };
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
        EXISTS (
          SELECT 1
          FROM "ShopVehicleApplication" known_application
          WHERE known_application."knowledgeId" = knowledge."id"
            AND known_application."isActive" = true
            AND known_application."revision" = knowledge."activeRevision"
        ) AS "hasApplications"
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strictCatalogConstraints = parseStrictCatalogSearchConstraints(searchParams);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const productKind = cleanShopAiProductKind(searchParams.get("productKind"));
    const strictMatch = strictCatalogConstraints.enabled;
    const make = searchParams.get("make")?.trim() || "";
    const model = searchParams.get("model")?.trim() || "";
    const chassis = searchParams.get("chassis")?.trim() || "";
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
    const strictCatalogApplied =
      strictMatch &&
      (strictCatalogConstraints.invalid || strictCatalogConstraints.hasKnowledgeConstraints);
    const strictCatalogPromise = strictCatalogApplied
      ? resolveStrictCatalogMatches(strictCatalogConstraints, locale === "en" ? "en" : "ua")
      : Promise.resolve<StrictCatalogResolution | null>(null);

    const [settingsRecord, session, allProductsWithFitments, strictCatalogResolution] =
      await Promise.all([
        getOrCreateShopSettings(prisma),
        getCurrentShopCustomerSession(),
        getShopProductsWithFitments(),
        strictCatalogPromise,
      ]);
    const scopedProductsWithFitments = filterShopStockItemsByVehicleScope(
      allProductsWithFitments,
      vehicleScope
    );
    const strictCatalogMatches = strictCatalogResolution?.matches ?? null;
    const productsWithFitments =
      strictCatalogApplied && strictCatalogMatches
        ? scopedProductsWithFitments.filter((item) => strictCatalogMatches.has(item.product.id))
        : scopedProductsWithFitments;
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

    const settings = getShopSettingsRuntime(settingsRecord);
    const pricingContext = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null,
      undefined,
      { priceCountry: country }
    );

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

    if (category && !strictCatalogApplied) {
      filtered = filtered.filter((item) => matchesShopStockCategory(item, category, locale));
    }
    if (productKind && productKind !== "any" && !strictCatalogApplied) {
      filtered = filtered.filter(matchesProductKind);
    }

    if (stock !== "all") {
      filtered = filtered.filter((item) => item.product.stock === stock);
    }

    if (hasPriceFilter) {
      filtered = filtered.filter(matchesPriceRange);
    }

    if (make && !strictCatalogApplied) {
      const makeNorm = normalizeShopSearchText(make);
      filtered = isVehicleMakeCompatibleWithScope(make, vehicleScope)
        ? filtered.filter((item) =>
            item.fitments.some(
              (fitment) => fitment.make && normalizeShopSearchText(fitment.make) === makeNorm
            )
          )
        : [];
    }

    if (model && !strictCatalogApplied) {
      const modelNorm = normalizeShopSearchText(model);
      filtered = filtered.filter((item) =>
        item.fitments.some((fitment) =>
          fitment.models.some((m: string) => normalizeShopSearchText(m) === modelNorm)
        )
      );
    }

    if (chassis && !strictCatalogApplied) {
      if (make && model && !isExpectedChassisForMakeModel(make, model, chassis)) {
        filtered = [];
      } else {
        filtered = filtered.filter((item) =>
          item.fitments.some((fitment) =>
            fitment.chassisCodes.some((c: string) => areChassisCompatible(c, chassis.toUpperCase()))
          )
        );
      }
    }

    // 2. Search query with relevance scoring
    const queryTokens = tokenizeShopSearchQuery(q);
    let expandedQuery = q ? expandVehicleAliases(q) : null;
    if (expandedQuery) {
      expandedQuery = enrichVehicleSearchFromCatalog(
        expandedQuery,
        productsWithFitments.flatMap((item) =>
          item.fitments.map((fitment) => ({ ...item, fitment }))
        ),
        {
          isExpectedChassis: isExpectedChassisForMakeModel,
        }
      );
    }
    const compactQuery = compactShopCode(q);
    const structuredPartQuery = isStructuredPartQuery(q);
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
        items.sort((a, b) => getProductPriceForSort(a.product) - getProductPriceForSort(b.product));
        return;
      }
      if (sort === "price_desc") {
        items.sort((a, b) => getProductPriceForSort(b.product) - getProductPriceForSort(a.product));
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

        let catalogScore = item.product.stock === "inStock" ? 120 : 0;
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
      if (!strictCatalogApplied) {
        // Legacy searches still require a lexical/vehicle hit. Strict searches
        // already have a canonical candidate set, so q is ranking-only there.
        scoredItems = scoredItems.filter((item) => item.score > 0);
        if (structuredPartQuery) {
          const exactSkuMatches = scoredItems.filter((item) =>
            item.compactSkuText.includes(compactQuery)
          );
          if (exactSkuMatches.length > 0) {
            scoredItems = exactSkuMatches;
          } else if (expandedQuery) {
            scoredItems = narrowVehicleSearchResults(scoredItems, expandedQuery);
          }
        } else if (expandedQuery) {
          scoredItems = narrowVehicleSearchResults(scoredItems, expandedQuery);
        }
      }
      // Sort by relevance score descending
      scoredItems.sort((a, b) => b.score - a.score);
      if (sort !== "default") {
        sortByExplicitSort(scoredItems);
      } else if (expandedQuery?.intent === "vehicle" || expandedQuery?.intent === "mixed") {
        diversifyStrongVehicleResults(scoredItems);
      }
    } else if (sort !== "default") {
      sortByExplicitSort(scoredItems);
    } else if (hasBrandFilter) {
      sortByDefaultCatalogOrder(scoredItems);
    } else {
      sortByDefaultCatalogOrder(scoredItems);
    }

    if (strictCatalogApplied && strictCatalogMatches) {
      scoredItems.sort(
        (left, right) =>
          getStrictCatalogMatchRank(strictCatalogMatches.get(left.product.id)) -
          getStrictCatalogMatchRank(strictCatalogMatches.get(right.product.id))
      );
    }

    let totalItems = scoredItems.length;
    let totalPages = Math.ceil(totalItems / limit);
    let paginatedItems = all ? scoredItems : scoredItems.slice((page - 1) * limit, page * limit);
    let fallbackApplied: "fitment" | "all" | null = null;
    let statsItems = scoredItems;

    if (!strictMatch && totalItems === 0 && q && (make || model || chassis || hasBrandFilter)) {
      // Fallback 1: Ignore vehicle fitment filters
      let fallbackFiltered = productsWithFitments;
      if (hasBrandFilter) {
        fallbackFiltered = fallbackFiltered.filter((item) =>
          brandNames.includes(normalizeShopSearchText(getProductDisplayBrand(item.product.brand)))
        );
      }
      if (stock !== "all") {
        fallbackFiltered = fallbackFiltered.filter((item) => item.product.stock === stock);
      }
      if (hasPriceFilter) {
        fallbackFiltered = fallbackFiltered.filter(matchesPriceRange);
      }
      if (category) {
        fallbackFiltered = fallbackFiltered.filter((item) =>
          matchesShopStockCategory(item, category, locale)
        );
      }
      if (productKind && productKind !== "any") {
        fallbackFiltered = fallbackFiltered.filter(matchesProductKind);
      }

      const fallbackScored = fallbackFiltered
        .map((item) => {
          const displayBrand = getProductDisplayBrand(item.product.brand);
          const scored = computeRelevanceScoreWithReasons(
            item,
            queryTokens,
            q,
            expandedQuery!,
            displayBrand,
            item.product.title?.en,
            item.product.title?.ua
          );
          return { ...item, score: scored.score, scoreReasons: scored.reasons };
        })
        .filter((item) => item.score > 0);
      if (expandedQuery) {
        fallbackScored.splice(
          0,
          fallbackScored.length,
          ...narrowVehicleSearchResults(fallbackScored, expandedQuery)
        );
      }

      fallbackScored.sort((a, b) => b.score - a.score);
      if (sort !== "default") {
        sortByExplicitSort(fallbackScored);
      }

      if (fallbackScored.length > 0) {
        fallbackApplied = "fitment";
        totalItems = fallbackScored.length;
        totalPages = Math.ceil(totalItems / limit);
        statsItems = fallbackScored;
        paginatedItems = all
          ? fallbackScored
          : fallbackScored.slice((page - 1) * limit, page * limit);
      } else if (hasBrandFilter) {
        // Fallback 2: Ignore brand/category as well (global query match)
        let globalSource = productsWithFitments;
        if (stock !== "all") {
          globalSource = globalSource.filter((item) => item.product.stock === stock);
        }
        if (hasPriceFilter) {
          globalSource = globalSource.filter(matchesPriceRange);
        }
        if (productKind && productKind !== "any") {
          globalSource = globalSource.filter(matchesProductKind);
        }
        const globalScored = globalSource
          .map((item) => {
            const displayBrand = getProductDisplayBrand(item.product.brand);
            const scored = computeRelevanceScoreWithReasons(
              item,
              queryTokens,
              q,
              expandedQuery!,
              displayBrand,
              item.product.title?.en,
              item.product.title?.ua
            );
            return { ...item, score: scored.score, scoreReasons: scored.reasons };
          })
          .filter((item) => item.score > 0);
        if (expandedQuery) {
          globalScored.splice(
            0,
            globalScored.length,
            ...narrowVehicleSearchResults(globalScored, expandedQuery)
          );
        }

        globalScored.sort((a, b) => b.score - a.score);
        if (sort !== "default") {
          sortByExplicitSort(globalScored);
        }

        if (globalScored.length > 0) {
          fallbackApplied = "all";
          totalItems = globalScored.length;
          totalPages = Math.ceil(totalItems / limit);
          statsItems = globalScored;
          paginatedItems = all
            ? globalScored
            : globalScored.slice((page - 1) * limit, page * limit);
        }
      }
    }

    // 3. Serialize output for frontend
    const sanitizedItems = paginatedItems.map(
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
          name:
            locale === "en"
              ? product.title.en || product.title.ua
              : product.title.ua || product.title.en,
          brand: getProductDisplayBrand(product.brand),
          partNumber: product.sku || "",
          description:
            locale === "en"
              ? product.shortDescription?.en || product.shortDescription?.ua || ""
              : product.shortDescription?.ua || product.shortDescription?.en || "",
          category: sourceCategory || getShopStockCategoryLabelForProduct({ product }, locale),
          thumbnail: product.image || null,
          inStock: product.stock === "inStock",
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
                  confidence: fitment.confidence,
                })),
              }
            : {}),
        };
      }
    );

    const globalFilterStats = buildFilterStats(
      productsWithFitments,
      locale,
      getProductPriceForFilter,
      priceCurrency
    );
    const filterStats = buildFilterStats(
      statsItems,
      locale,
      getProductPriceForFilter,
      priceCurrency
    );

    // Extract all unique brands and curated product groups for filter menus
    const brands = globalFilterStats.brands.map((entry) => entry.label);
    const categories = globalFilterStats.categories.map((entry) => entry.label);

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages,
        totalItems,
        source: "local",
        fallbackApplied,
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
  } catch (error: any) {
    console.error("[Stock Search API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
