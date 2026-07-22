import "server-only";

import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "@/lib/shopPricingAudience";
import { prisma } from "@/lib/prisma";
import type {
  ShopAiContext,
  ShopAiMatchBasis,
  ShopAiMatchStatus,
  ShopAiProduct,
} from "@/lib/shopAiAssistantTypes";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";

export type ShopAiKnowledgeCandidate = {
  productId: string;
  slug: string;
  variantId?: string | null;
  matchStatus: ShopAiMatchStatus;
  matchBasis?: ShopAiMatchBasis;
  matchReason: string;
  missingFacts: string[];
  matchedApplicationId: string | null;
  identityMatchOnly?: boolean;
  facts?: ShopAiProduct["facts"];
  fitmentStatus?: ShopAiProduct["fitmentStatus"];
  fitmentSource?: ShopAiProduct["fitmentSource"];
  application?: {
    make: string | null;
    models: string[];
    chassisCodes: string[];
    yearFrom: number | null;
    yearTo: number | null;
    confidence: "high" | "medium" | "low" | "unknown";
  } | null;
};

function hasMoney(
  value:
    | {
        eur?: number | null;
        usd?: number | null;
        uah?: number | null;
      }
    | null
    | undefined
) {
  return Number(value?.eur ?? 0) > 0 || Number(value?.usd ?? 0) > 0 || Number(value?.uah ?? 0) > 0;
}

export async function hydrateShopAiKnowledgeCandidates(
  candidates: ShopAiKnowledgeCandidate[],
  context: ShopAiContext
): Promise<ShopAiProduct[]> {
  if (!candidates.length) return [];

  const [settingsRecord, session, loaded] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getCurrentShopCustomerSession(),
    Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        product: await getShopProductBySlugServer(candidate.slug),
      }))
    ),
  ]);
  const settings = getShopSettingsRuntime(settingsRecord);
  const pricingContext = buildShopViewerPricingContext(
    settings,
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null,
    undefined,
    { priceCountry: context.country }
  );

  return loaded.flatMap(({ candidate, product }) => {
    if (!product?.id || product.id !== candidate.productId) return [];
    const pricing = resolveShopProductPricing(product, pricingContext);
    const priceSet = expandShopPrices(pricing.effectivePrice, settings.currencyRates);
    const expandedCompareAt = pricing.effectiveCompareAt
      ? expandShopPrices(pricing.effectiveCompareAt, settings.currencyRates)
      : null;
    const compareAt = hasMoney(expandedCompareAt) ? expandedCompareAt : null;
    const activePrice =
      context.currency === "EUR"
        ? priceSet.eur
        : context.currency === "UAH"
          ? priceSet.uah
          : priceSet.usd;
    const activeCompareAt =
      context.currency === "EUR"
        ? compareAt?.eur
        : context.currency === "UAH"
          ? compareAt?.uah
          : compareAt?.usd;
    const defaultVariant =
      product.variants?.find((variant) => variant.id === candidate.variantId) ??
      product.variants?.find((variant) => variant.isDefault) ??
      product.variants?.[0];
    const application = candidate.application;

    return [
      {
        id: product.id,
        name:
          context.locale === "en"
            ? product.title.en || product.title.ua
            : product.title.ua || product.title.en,
        brand: product.brand || product.vendor || "",
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
        price: Number(activePrice || 0),
        priceSet,
        originalPrice: Number(activeCompareAt || 0) || null,
        originalPriceSet: compareAt,
        slug: product.slug,
        href: buildShopStorefrontProductPathForProduct(context.locale, product),
        variantId: defaultVariant?.id || null,
        turn14Id: "",
        matchStatus: candidate.matchStatus,
        matchBasis: candidate.matchBasis,
        matchReason: candidate.matchReason,
        missingFacts: candidate.missingFacts,
        matchedApplicationId: candidate.matchedApplicationId,
        productHref: buildShopStorefrontProductPathForProduct(context.locale, product),
        managerHref:
          candidate.matchStatus === "requires_verification"
            ? `/${context.locale}/contact?source=one-ai`
            : null,
        compatibility: candidate.identityMatchOnly
          ? undefined
          : candidate.matchStatus === "exact"
            ? ("confirmed" as const)
            : ("needs_review" as const),
        compatibilityReason: candidate.matchReason,
        fitmentStatus: candidate.fitmentStatus,
        fitmentSource: candidate.fitmentSource,
        facts: candidate.facts,
        fitments: application
          ? [
              {
                make: application.make,
                models: application.models,
                chassisCodes: application.chassisCodes,
                yearRanges:
                  application.yearFrom === null
                    ? []
                    : [
                        {
                          from: application.yearFrom,
                          to: application.yearTo,
                        },
                      ],
                confidence: application.confidence,
              },
            ]
          : [],
      },
    ];
  });
}
