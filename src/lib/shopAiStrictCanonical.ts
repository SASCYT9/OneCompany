import {
  classifyStrictCatalogKnowledgeRow,
  type StrictCatalogKnowledgeRow,
  type StrictCatalogMatch,
  type StrictCatalogSearchConstraints,
} from "@/app/api/shop/stock/search/strictCatalog";
import type { ShopAiContext, ShopAiPlan } from "@/lib/shopAiAssistantTypes";
import { cleanShopAiProductKind } from "@/lib/shopAiProductKind";

export type ShopAiStrictCanonicalRow = StrictCatalogKnowledgeRow;

export function buildShopAiStrictCanonicalConstraints(
  plan: ShopAiPlan,
  context: ShopAiContext
): StrictCatalogSearchConstraints {
  const productKind = cleanShopAiProductKind(plan.productKind);
  const constraints = {
    category: plan.category,
    productKind,
    scope: context.scope ?? null,
    make: plan.vehicle.make,
    model: plan.vehicle.model,
    chassis: plan.vehicle.chassis,
    year: plan.vehicle.year,
    engine: plan.vehicle.engine,
    opfGpf: plan.opfGpf ?? null,
  };

  return {
    enabled: true,
    invalid: false,
    ...constraints,
    hasKnowledgeConstraints: Boolean(
      constraints.category ||
        (constraints.productKind && constraints.productKind !== "any") ||
        constraints.make ||
        constraints.model ||
        constraints.chassis ||
        constraints.year ||
        constraints.engine ||
        constraints.opfGpf
    ),
  };
}

export function classifyShopAiStrictCanonicalRow(
  row: ShopAiStrictCanonicalRow,
  plan: ShopAiPlan,
  context: ShopAiContext
): StrictCatalogMatch | null {
  return classifyStrictCatalogKnowledgeRow(
    row,
    buildShopAiStrictCanonicalConstraints(plan, context),
    context.locale
  );
}
