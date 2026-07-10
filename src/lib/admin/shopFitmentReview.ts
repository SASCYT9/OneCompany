import type { PrismaClient } from "@prisma/client";

import { extractProductFitment } from "@/lib/crossShopFitment";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import {
  classifyProductFitment,
  mergePersistedFitment,
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  type NormalizedFitment,
  type NormalizedFitmentStatus,
} from "@/lib/shopFitmentQuality";

export type FitmentReviewProduct = {
  id: string;
  slug: string;
  sku: string;
  brand: string;
  title: string;
  image: string;
  fitment: NormalizedFitment;
  automaticFitment: NormalizedFitment;
  hasOverride: boolean;
};

export type FitmentReviewReport = {
  products: FitmentReviewProduct[];
  counts: Record<NormalizedFitmentStatus, number>;
  brands: Array<{ brand: string; count: number }>;
};

type AutomaticAssessment = Omit<FitmentReviewProduct, "fitment" | "hasOverride">;

let automaticCache: AutomaticAssessment[] | null = null;
let automaticCacheAt = 0;
const AUTOMATIC_CACHE_TTL_MS = 5 * 60 * 1000;

async function getAutomaticAssessments() {
  if (automaticCache && Date.now() - automaticCacheAt < AUTOMATIC_CACHE_TTL_MS) {
    return automaticCache;
  }

  const products = await getShopProductsServer();
  automaticCache = products.flatMap((product) => {
    if (!product.id) return [];
    const automaticFitment = classifyProductFitment(product, extractProductFitment(product));
    return [
      {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        brand: product.brand || product.vendor || "Unassigned",
        title: product.title.ua || product.title.en || product.slug,
        image: product.image,
        automaticFitment,
      },
    ];
  });
  automaticCacheAt = Date.now();
  return automaticCache;
}

export function clearFitmentReviewCache() {
  automaticCache = null;
  automaticCacheAt = 0;
}

export async function getFitmentReviewReport(prisma: PrismaClient): Promise<FitmentReviewReport> {
  const [automatic, overrides] = await Promise.all([
    getAutomaticAssessments(),
    prisma.shopProductMetafield.findMany({
      where: {
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: NORMALIZED_FITMENT_KEY,
      },
      select: { productId: true, value: true },
    }),
  ]);
  const overrideByProductId = new Map(overrides.map((item) => [item.productId, item.value]));
  const counts: Record<NormalizedFitmentStatus, number> = {
    inferred: 0,
    verified: 0,
    universal: 0,
    needs_review: 0,
  };
  const brandCounts = new Map<string, number>();

  const products = automatic.map((product) => {
    const override = overrideByProductId.get(product.id);
    const fitment = mergePersistedFitment(product.automaticFitment, override);
    counts[fitment.status] += 1;
    if (fitment.status === "needs_review") {
      brandCounts.set(product.brand, (brandCounts.get(product.brand) ?? 0) + 1);
    }
    return {
      ...product,
      fitment,
      hasOverride: Boolean(override),
    };
  });

  return {
    products,
    counts,
    brands: Array.from(brandCounts, ([brand, count]) => ({ brand, count })).sort(
      (left, right) => right.count - left.count || left.brand.localeCompare(right.brand)
    ),
  };
}
