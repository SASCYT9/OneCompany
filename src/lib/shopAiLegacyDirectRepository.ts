import "server-only";

import {
  getProductDisplayBrand,
  getShopProductsWithFitments,
} from "@/app/api/shop/stock/search/route";
import { runShopAiCandidatePipeline } from "@/lib/shopAiCatalogTools";
import { buildShopAiCatalogQuery } from "@/lib/shopAiAssistantRanking";
import type { ShopAiContext, ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import {
  hydrateShopAiKnowledgeCandidates,
  type ShopAiKnowledgeCandidate,
} from "@/lib/shopAiProductHydration";
import { normalizeShopSearchText, tokenizeShopSearchQuery } from "@/lib/shopSearch";
import { getShopStockCategoryGroupForProduct } from "@/lib/shopStockTaxonomy";
import {
  filterShopStockItemsByVehicleScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";

const LEGACY_CANDIDATE_LIMIT = 240;
const LEGACY_HYDRATION_LIMIT = 24;

type LegacyItem = Awaited<ReturnType<typeof getShopProductsWithFitments>>[number];

function scoreLegacyCandidate(item: LegacyItem, queryTokens: string[]) {
  if (!queryTokens.length) return 1;
  let score = 0;
  for (const token of queryTokens) {
    if (item.compactSkuText === token || item.skuText === token) score += 100;
    if (item.skuText.includes(token)) score += 20;
    if (item.fitmentText.includes(token)) score += 10;
    if (item.titleText.includes(token)) score += 5;
    if (item.searchText.includes(token)) score += 1;
  }
  return score;
}

function toShopAiProduct(item: LegacyItem, context: ShopAiContext): ShopAiProduct {
  const product = item.product;
  const defaultVariant =
    product.variants?.find((variant: { isDefault?: boolean }) => variant.isDefault) ??
    product.variants?.[0];
  return {
    id: product.id,
    name:
      context.locale === "en"
        ? product.title.en || product.title.ua
        : product.title.ua || product.title.en,
    brand: getProductDisplayBrand(product.brand),
    partNumber: product.sku || "",
    description:
      context.locale === "en"
        ? product.shortDescription?.en || product.shortDescription?.ua || ""
        : product.shortDescription?.ua || product.shortDescription?.en || "",
    category:
      context.locale === "en"
        ? product.category?.en || product.category?.ua || ""
        : product.category?.ua || product.category?.en || "",
    thumbnail: product.image || null,
    inStock: product.stock === "inStock",
    price: null,
    slug: product.slug,
    variantId: defaultVariant?.id || null,
    turn14Id: "",
    fitmentStatus: item.fitmentStatus,
    fitmentSource: item.fitmentSource,
    fitments: item.fitments.map((fitment) => ({
      make: fitment.make,
      models: fitment.models,
      chassisCodes: fitment.chassisCodes,
      yearRanges: fitment.yearRanges,
      confidence: fitment.confidence,
    })),
  };
}

function productPrice(product: ShopAiProduct, context: ShopAiContext) {
  if (context.currency === "EUR") return Number(product.priceSet?.eur ?? product.price ?? 0);
  if (context.currency === "UAH") return Number(product.priceSet?.uah ?? product.price ?? 0);
  return Number(product.priceSet?.usd ?? product.price ?? 0);
}

function matchesBudget(product: ShopAiProduct, plan: ShopAiPlan, context: ShopAiContext) {
  if (plan.minPrice === null && plan.maxPrice === null) return true;
  const price = productPrice(product, context);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (plan.minPrice !== null && price < plan.minPrice) return false;
  if (plan.maxPrice !== null && price > plan.maxPrice) return false;
  return true;
}

export type ShopAiDirectResult = {
  products: ShopAiProduct[];
  exactCount: number;
  requiresVerificationCount: number;
  rejected: {
    alreadyShown: number;
    incompatibleVehicle: number;
    missingRequestedEvidence: number;
  };
};

export async function retrieveShopAiCandidatesFromLegacyCatalog(input: {
  plan: ShopAiPlan;
  message: string;
  context: ShopAiContext;
  excludedProductIds?: string[];
}): Promise<ShopAiDirectResult> {
  const allItems = filterShopStockItemsByVehicleScope(
    await getShopProductsWithFitments(),
    parseShopStockVehicleScope(input.context.scope)
  );
  const categoryItems = input.plan.category
    ? allItems.filter(
        (item) =>
          getShopStockCategoryGroupForProduct(item, input.context.locale).id === input.plan.category
      )
    : allItems;
  const query = normalizeShopSearchText(buildShopAiCatalogQuery(input.plan));
  const queryTokens = tokenizeShopSearchQuery(query);
  const candidates = categoryItems
    .map((item) => ({ item, score: scoreLegacyCandidate(item, queryTokens) }))
    .filter(({ score }) => score > 0 || Boolean(input.plan.category))
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.item.product.id).localeCompare(String(right.item.product.id))
    )
    .slice(0, LEGACY_CANDIDATE_LIMIT)
    .map(({ item }) => toShopAiProduct(item, input.context));

  const pipeline = runShopAiCandidatePipeline({
    products: candidates,
    plan: input.plan,
    message: input.message,
    excludedProductIds: input.excludedProductIds,
    limit: LEGACY_HYDRATION_LIMIT,
  });
  const hydrated = await hydrateShopAiKnowledgeCandidates(
    pipeline.products.map(
      (product): ShopAiKnowledgeCandidate => ({
        productId: product.id,
        slug: product.slug,
        matchStatus: product.matchStatus ?? "requires_verification",
        matchReason: product.matchReason ?? "legacy-fitment-evidence",
        missingFacts: product.missingFacts ?? ["verified_fitment"],
        matchedApplicationId: product.matchedApplicationId ?? null,
        facts: product.facts,
        fitmentStatus: product.fitmentStatus,
        fitmentSource: product.fitmentSource,
        application: product.fitments?.[0]
          ? {
              make: product.fitments[0].make,
              models: product.fitments[0].models,
              chassisCodes: product.fitments[0].chassisCodes,
              yearFrom: product.fitments[0].yearRanges?.[0]?.from ?? null,
              yearTo: product.fitments[0].yearRanges?.[0]?.to ?? null,
              confidence: product.fitments[0].confidence ?? "unknown",
            }
          : null,
      })
    ),
    input.context
  );
  const products = hydrated.filter((product) => matchesBudget(product, input.plan, input.context));

  return {
    products: products.slice(0, 6),
    exactCount: pipeline.eligibleProducts.filter((product) => product.matchStatus === "exact")
      .length,
    requiresVerificationCount: pipeline.eligibleProducts.filter(
      (product) => product.matchStatus !== "exact"
    ).length,
    rejected: pipeline.rejected,
  };
}
