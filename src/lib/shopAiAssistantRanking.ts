import type { ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import { areChassisCompatible } from "@/lib/crossShopFitment";
import { diversifyShopStockItems } from "@/lib/shopStockRanking";

const normalizeBrand = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function buildShopAiCatalogQuery(plan: ShopAiPlan) {
  const structuredQuery = [
    plan.vehicle.make,
    plan.vehicle.model,
    plan.vehicle.chassis,
    plan.vehicle.year,
    plan.vehicle.engine,
    plan.category,
    plan.opfGpf === "with" ? "OPF GPF" : plan.opfGpf === "without" ? "NON OPF" : null,
    plan.productKind === "system"
      ? "exhaust system"
      : plan.productKind === "downpipe"
        ? "downpipe"
        : plan.productKind === "link_pipe"
          ? "link pipe"
          : plan.productKind === "tips"
            ? "exhaust tips"
            : null,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return structuredQuery || plan.searchQuery;
}

export function filterShopAiProductsForVehicle(products: ShopAiProduct[], plan: ShopAiPlan) {
  const requestedChassis = plan.vehicle.chassis?.trim().toUpperCase();
  if (!requestedChassis) return products;

  return products.filter((product) => {
    const fitmentChassis = (product.fitments ?? []).flatMap(
      (fitment) => fitment.chassisCodes ?? []
    );
    if (fitmentChassis.length > 0) {
      return fitmentChassis.some((chassis) => areChassisCompatible(chassis, requestedChassis));
    }

    const evidence = `${product.name} ${product.description}`.toUpperCase();
    const evidenceChassis = evidence.match(/\b[A-Z][0-9]{2,3}[A-Z]?\b/g) ?? [];
    return evidenceChassis.some((chassis) => areChassisCompatible(chassis, requestedChassis));
  });
}

export function diversifyShopAiProducts(products: ShopAiProduct[], message: string) {
  if (products.length < 2) return products;

  const normalizedMessage = normalizeBrand(message);
  const requestedBrand = products.find((product) => {
    const brand = normalizeBrand(product.brand);
    return brand.length > 2 && normalizedMessage.includes(brand);
  })?.brand;

  if (requestedBrand) {
    const normalizedRequestedBrand = normalizeBrand(requestedBrand);
    return products.filter((product) => normalizeBrand(product.brand) === normalizedRequestedBrand);
  }

  const relevance = new Map(
    products.map((product, index) => [product.id, products.length - index])
  );
  return diversifyShopStockItems(products, (product) => ({
    brand: product.brand,
    score: relevance.get(product.id) ?? 0,
    stableKey: `${product.brand} ${product.partNumber} ${product.id}`,
  }));
}
