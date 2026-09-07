import "server-only";

import { createCachedCrossShopFitmentMatcher } from "@/lib/crossShopFitment";
import { projectCrossShopRecommendationCards } from "@/lib/crossShopRecommendationCard";

// Catalog refreshes replace product objects. Cache only derived fitment, never
// prices, publication status, or complete recommendation responses in ISR.
const match = createCachedCrossShopFitmentMatcher();

export function findCrossShopFitmentMatches(...args: Parameters<typeof match>) {
  return projectCrossShopRecommendationCards(match(...args));
}
