import type { ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import { areChassisCompatible } from "@/lib/crossShopFitment";
import { shopAiProductKindQueryTerm } from "@/lib/shopAiProductKind";
import { diversifyShopStockItems } from "@/lib/shopStockRanking";

const normalizeBrand = (value: string) => value.trim().toLocaleLowerCase("en-US");
const normalizeVehicleValue = (value: string) =>
  value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

export type ShopAiVehicleFitmentEvaluation = {
  status: "match" | "unknown" | "contradiction";
  reason: string;
  confidence: "high" | "medium" | "low" | "unknown";
};

export function buildShopAiCatalogQuery(plan: ShopAiPlan) {
  const structuredQuery = [
    plan.vehicle.make,
    plan.vehicle.model,
    plan.vehicle.chassis,
    plan.vehicle.year,
    plan.vehicle.engine,
    plan.vehicle.fuel,
    plan.vehicle.bodyStyle,
    plan.vehicle.drivetrain,
    plan.vehicle.transmission,
    plan.vehicle.market,
    plan.category,
    plan.brand,
    plan.opfGpf === "with" ? "OPF GPF" : plan.opfGpf === "without" ? "NON OPF" : null,
    shopAiProductKindQueryTerm(plan.productKind),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return structuredQuery || plan.searchQuery;
}

export function evaluateShopAiProductVehicleFitment(
  product: ShopAiProduct,
  plan: ShopAiPlan
): ShopAiVehicleFitmentEvaluation {
  const requestedMake = plan.vehicle.make?.trim();
  const requestedModel = plan.vehicle.model?.trim();
  const requestedChassis = plan.vehicle.chassis?.trim().toUpperCase();
  const requestedYear = plan.vehicle.year;
  if (!requestedMake && !requestedModel && !requestedChassis && !requestedYear) {
    return { status: "unknown", reason: "vehicle-not-specified", confidence: "unknown" };
  }

  let bestUnknown: ShopAiVehicleFitmentEvaluation | null = null;
  for (const fitment of product.fitments ?? []) {
    let hasMissingEvidence = false;
    if (requestedMake) {
      if (
        fitment.make &&
        normalizeVehicleValue(fitment.make) !== normalizeVehicleValue(requestedMake)
      ) {
        continue;
      }
      if (!fitment.make) hasMissingEvidence = true;
    }
    if (requestedModel) {
      if (
        fitment.models.length > 0 &&
        !fitment.models.some(
          (model) => normalizeVehicleValue(model) === normalizeVehicleValue(requestedModel)
        )
      ) {
        continue;
      }
      if (fitment.models.length === 0) hasMissingEvidence = true;
    }
    if (requestedChassis) {
      if (
        fitment.chassisCodes.length > 0 &&
        !fitment.chassisCodes.some((chassis) => areChassisCompatible(chassis, requestedChassis))
      ) {
        continue;
      }
      if (fitment.chassisCodes.length === 0) hasMissingEvidence = true;
    }
    if (requestedYear) {
      const ranges = fitment.yearRanges ?? [];
      if (
        ranges.length > 0 &&
        !ranges.some(
          (range) => range.from <= requestedYear && (range.to === null || range.to >= requestedYear)
        )
      ) {
        continue;
      }
      if (ranges.length === 0) hasMissingEvidence = true;
    }

    const confidence = fitment.confidence ?? "unknown";
    if (!hasMissingEvidence) {
      return { status: "match", reason: "single-application-match", confidence };
    }
    bestUnknown = {
      status: "unknown",
      reason: "application-matches-with-missing-evidence",
      confidence,
    };
  }

  if (bestUnknown) return bestUnknown;

  if ((product.fitments ?? []).length === 0 && requestedChassis) {
    const evidence = `${product.name} ${product.description}`.toUpperCase();
    const evidenceChassis = evidence.match(/\b[A-Z][0-9]{2,3}[A-Z]?\b/g) ?? [];
    if (evidenceChassis.some((chassis) => areChassisCompatible(chassis, requestedChassis))) {
      return {
        status: "unknown",
        reason: "text-only-chassis-evidence",
        confidence: "low",
      };
    }
  }

  return {
    status: "contradiction",
    reason: "no-correlated-vehicle-application",
    confidence: "unknown",
  };
}

export function filterShopAiProductsForVehicle(products: ShopAiProduct[], plan: ShopAiPlan) {
  return products.filter(
    (product) => evaluateShopAiProductVehicleFitment(product, plan).status !== "contradiction"
  );
}

export function diversifyShopAiProducts(
  products: ShopAiProduct[],
  message: string,
  plan?: ShopAiPlan
) {
  if (products.length < 2) return products;

  const normalizedMessage = normalizeBrand(message);
  const requestedBrand =
    plan?.brand ??
    products.find((product) => {
      const brand = normalizeBrand(product.brand);
      return brand.length > 2 && normalizedMessage.includes(brand);
    })?.brand;

  if (
    requestedBrand &&
    (plan?.brandOnly || /(?:^|\s)(?:тільки|лише|only|exclusively)(?:\s|$)/iu.test(message))
  ) {
    const normalizedRequestedBrand = normalizeBrand(requestedBrand);
    return products.filter((product) => normalizeBrand(product.brand) === normalizedRequestedBrand);
  }

  const relevance = new Map(
    products.map((product, index) => [product.id, products.length - index])
  );
  const normalizedRequestedBrand = requestedBrand ? normalizeBrand(requestedBrand) : null;
  return diversifyShopStockItems(products, (product) => ({
    brand: product.brand,
    score:
      (relevance.get(product.id) ?? 0) +
      (normalizedRequestedBrand && normalizeBrand(product.brand) === normalizedRequestedBrand
        ? products.length * 0.35
        : 0),
    stableKey: `${product.brand} ${product.partNumber} ${product.id}`,
  }));
}
