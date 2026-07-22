import type { ShopAiPlan } from "@/lib/shopAiAssistantTypes";

const SOFT_PREFERENCE_PATTERN =
  /(?:^|[^\p{L}\p{N}])(?:best|better|premium|popular|light(?:weight)?|easy|simple|aggressive|deep|quiet|loud|sound|tone|comfort|daily|track|race|street|road|style|look|найкращ[\p{L}]*|кращ[\p{L}]*|преміальн[\p{L}]*|популярн[\p{L}]*|легк[\p{L}]*|прост[\p{L}]*|агресивн[\p{L}]*|глибок[\p{L}]*|тих[\p{L}]*|гучн[\p{L}]*|звук[\p{L}]*|комфортн[\p{L}]*|щоденн[\p{L}]*|трек[\p{L}]*|гоночн[\p{L}]*|вуличн[\p{L}]*|стил[\p{L}]*|вигляд[\p{L}]*|лучш[\p{L}]*|громк[\p{L}]*)(?=$|[^\p{L}\p{N}])/iu;

/**
 * Vehicle, category, SKU, price, stock and explicit brand filters are fully
 * deterministic. Embeddings are reserved for qualitative preferences that
 * cannot be represented by those filters.
 */
export function shouldUseShopAiSemanticReranking(message: string, plan: ShopAiPlan) {
  if (plan.intent === "question" && !plan.category) return false;
  return SOFT_PREFERENCE_PATTERN.test(message);
}
