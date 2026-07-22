import { excludePreviouslyShownShopAiProducts } from "@/lib/shopAiAssistantConversation";
import {
  extractDeclaredPowerGain,
  filterShopAiProductsForPowerGoal,
} from "@/lib/shopAiAssistantPower";
import {
  diversifyShopAiProducts,
  evaluateShopAiProductVehicleFitment,
  filterShopAiProductsForVehicle,
} from "@/lib/shopAiAssistantRanking";
import type {
  ShopAiMatchStatus,
  ShopAiPlan,
  ShopAiProduct,
  ShopAiProductKind,
} from "@/lib/shopAiAssistantTypes";
import { areChassisCompatible } from "@/lib/crossShopFitment";
import { formatShopAiProductKind, inferShopAiProductKind } from "@/lib/shopAiProductKind";

export type ShopAiCandidatePipelineResult = {
  products: ShopAiProduct[];
  eligibleProducts: ShopAiProduct[];
  compatibleCount: number;
  goalMatchedCount: number;
  rejected: {
    alreadyShown: number;
    incompatibleVehicle: number;
    missingRequestedEvidence: number;
  };
};

function differenceById(source: ShopAiProduct[], retained: ShopAiProduct[]) {
  const retainedIds = new Set(retained.map((product) => product.id));
  return source.filter((product) => !retainedIds.has(product.id));
}

function productEvidence(product: ShopAiProduct) {
  return `${product.name} ${product.description}`;
}

function detectOpfGpf(product: ShopAiProduct): "with" | "without" | null {
  const evidence = productEvidence(product);
  if (/\b(?:non[- ]?opf|non[- ]?gpf|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))\b/iu.test(evidence)) {
    return "without";
  }
  return /\b(?:opf|gpf)\b/iu.test(evidence) ? "with" : null;
}

function detectMaterial(product: ShopAiProduct) {
  const evidence = productEvidence(product);
  const values = [
    /\b(?:titanium|титан\w*)\b/iu.test(evidence) ? ("titanium" as const) : null,
    /\b(?:stainless steel|нержавіюч\w*\s+стал\w*)\b/iu.test(evidence)
      ? ("stainless_steel" as const)
      : null,
    /\b(?:carbon(?: fiber)?|карбон\w*)\b/iu.test(evidence) ? ("carbon" as const) : null,
  ].filter(Boolean);
  return values.length === 1 ? values[0]! : values.length > 1 ? ("mixed" as const) : null;
}

function detectInstallationType(product: ShopAiProduct) {
  const evidence = productEvidence(product);
  if (/\b(?:plug[ -]?and[ -]?play|bolt[ -]?on|direct fit|пряма заміна)\b/iu.test(evidence)) {
    return "direct_fit" as const;
  }
  if (/\b(?:weld|welding|зварюван)\b/iu.test(evidence)) return "welding_required" as const;
  if (
    /\b(?:professional installation|installation required|професійн\w*\s+встановлен)\b/iu.test(
      evidence
    )
  ) {
    return "professional_installation" as const;
  }
  return null;
}

export function detectShopAiProductKind(
  product: ShopAiProduct,
  category: ShopAiPlan["category"] = null
): ShopAiProductKind {
  if (product.facts?.productKind && product.facts.productKind !== "any") {
    return product.facts.productKind;
  }
  const evidence = `${product.name} ${product.category ?? ""}`;
  return inferShopAiProductKind(evidence, category);
}

function annotateProduct(product: ShopAiProduct, plan: ShopAiPlan): ShopAiProduct {
  const requestedChassis = plan.vehicle.chassis?.toUpperCase();
  const vehicleEvaluation = evaluateShopAiProductVehicleFitment(product, plan);
  const matchingFitments = requestedChassis
    ? (product.fitments ?? []).filter((fitment) =>
        fitment.chassisCodes.some((code) => areChassisCompatible(code, requestedChassis))
      )
    : (product.fitments ?? []);
  const confidences = matchingFitments.map((fitment) => fitment.confidence ?? "unknown");
  const compatibility =
    vehicleEvaluation.status === "unknown"
      ? "needs_review"
      : requestedChassis
        ? product.fitmentStatus === "verified" && confidences.includes("high")
          ? "confirmed"
          : product.fitmentStatus !== "needs_review" &&
              (confidences.includes("high") || confidences.includes("medium"))
            ? "likely"
            : "needs_review"
        : product.fitmentStatus !== "needs_review" &&
            (confidences.includes("high") || confidences.includes("medium"))
          ? "likely"
          : "needs_review";
  const hasTrustedSource =
    product.fitmentStatus === "verified" || product.fitmentSource === "import";
  const hasVehicleConstraint = Boolean(
    plan.vehicle.make ||
      plan.vehicle.model ||
      plan.vehicle.chassis ||
      plan.vehicle.year ||
      plan.vehicle.engine ||
      plan.opfGpf
  );
  const matchStatus: ShopAiMatchStatus =
    !hasVehicleConstraint || (vehicleEvaluation.status === "match" && hasTrustedSource)
      ? "exact"
      : "requires_verification";
  const missingFacts = new Set<string>();
  if (matchStatus === "requires_verification") {
    if (!hasTrustedSource) missingFacts.add("verified_fitment");
    if (vehicleEvaluation.status === "unknown") {
      if (
        plan.vehicle.chassis &&
        !matchingFitments.some((fitment) => fitment.chassisCodes.length > 0)
      ) {
        missingFacts.add("chassis");
      }
      if (
        plan.vehicle.year &&
        !matchingFitments.some((fitment) => (fitment.yearRanges ?? []).length > 0)
      ) {
        missingFacts.add("year");
      }
      if (plan.vehicle.model && !matchingFitments.some((fitment) => fitment.models.length > 0)) {
        missingFacts.add("model");
      }
    }
  }
  const material = detectMaterial(product);
  const opfGpf = detectOpfGpf(product);
  const installationType = detectInstallationType(product);
  const powerGainHp = extractDeclaredPowerGain(product);
  const productKind = detectShopAiProductKind(product, plan.category);

  return {
    ...product,
    compatibility,
    compatibilityReason: `${vehicleEvaluation.reason}:${requestedChassis ?? "no-chassis"}:${vehicleEvaluation.confidence}`,
    matchStatus,
    matchReason:
      matchStatus === "exact"
        ? `verified:${vehicleEvaluation.reason}`
        : `verification-required:${vehicleEvaluation.reason}`,
    missingFacts: Array.from(missingFacts),
    matchedApplicationId: null,
    facts: {
      material,
      materialVerified:
        product.facts?.materialVerified === true && product.facts.material === material,
      opfGpf,
      opfGpfVerified: product.facts?.opfGpfVerified === true && product.facts.opfGpf === opfGpf,
      installationType,
      installationTypeVerified:
        product.facts?.installationTypeVerified === true &&
        product.facts.installationType === installationType,
      powerGainHp,
      powerGainVerified:
        product.facts?.powerGainVerified === true && product.facts.powerGainHp === powerGainHp,
      productKind,
      productKindVerified:
        product.facts?.productKindVerified === true && product.facts.productKind === productKind,
    },
  };
}

function filterForOpfGpf(products: ShopAiProduct[], plan: ShopAiPlan) {
  if (!plan.opfGpf) return products;
  return products.filter((product) => detectOpfGpf(product) === plan.opfGpf);
}

function filterForEngineCode(products: ShopAiProduct[], plan: ShopAiPlan) {
  const engine = plan.vehicle.engine?.trim().toUpperCase();
  if (!engine || !/^(?:[BSN]\d{2}[A-Z0-9]*|EA\d{3})$/.test(engine)) return products;
  const pattern = new RegExp(`\\b${engine}\\b`, "i");
  return products.filter((product) => pattern.test(productEvidence(product)));
}

function filterForProductKind(products: ShopAiProduct[], plan: ShopAiPlan) {
  if (!plan.productKind || plan.productKind === "any") return products;
  return products.filter(
    (product) => detectShopAiProductKind(product, plan.category) === plan.productKind
  );
}

/**
 * Deterministic catalog tools run before any language-model response.
 * A semantic reranker may reorder accepted products later, but cannot restore
 * a candidate rejected by vehicle or claimed-performance constraints.
 */
export function runShopAiCandidatePipeline(input: {
  products: ShopAiProduct[];
  plan: ShopAiPlan;
  message: string;
  excludedProductIds?: string[];
  limit?: number;
}): ShopAiCandidatePipelineResult {
  const unseen = excludePreviouslyShownShopAiProducts(
    input.products,
    input.excludedProductIds ?? [],
    input.message
  );
  const compatible = filterShopAiProductsForVehicle(unseen, input.plan);
  const engineMatched = filterForEngineCode(compatible, input.plan);
  const opfMatched = filterForOpfGpf(engineMatched, input.plan);
  const kindMatched = filterForProductKind(opfMatched, input.plan);
  const goalMatched = filterShopAiProductsForPowerGoal(kindMatched, input.plan).map((product) =>
    annotateProduct(product, input.plan)
  );
  const vehicleRejected = differenceById(unseen, compatible);
  const evidenceRejected = differenceById(compatible, goalMatched);
  const exact = goalMatched.filter((product) => product.matchStatus === "exact");
  const requiresVerification = goalMatched.filter((product) => product.matchStatus !== "exact");
  const ranked = [
    ...diversifyShopAiProducts(exact, input.message, input.plan),
    ...diversifyShopAiProducts(requiresVerification, input.message, input.plan),
  ].slice(0, input.limit ?? 6);

  return {
    products: ranked,
    eligibleProducts: goalMatched,
    compatibleCount: compatible.length,
    goalMatchedCount: goalMatched.length,
    rejected: {
      alreadyShown: input.products.length - unseen.length,
      incompatibleVehicle: vehicleRejected.length,
      missingRequestedEvidence: evidenceRejected.length,
    },
  };
}

export function buildShopAiComparisonSet(products: ShopAiProduct[], limit = 3) {
  const selected: ShopAiProduct[] = [];
  const seenBrands = new Set<string>();
  for (const product of products) {
    const brand = product.brand.trim().toLocaleLowerCase("en-US");
    if (!brand || seenBrands.has(brand)) continue;
    selected.push(product);
    seenBrands.add(brand);
    if (selected.length === limit) return selected;
  }
  for (const product of products) {
    if (selected.some((candidate) => candidate.id === product.id)) continue;
    selected.push(product);
    if (selected.length === limit) break;
  }
  return selected;
}

export function buildShopAiNoExactMatchMessage(locale: "ua" | "en", plan: ShopAiPlan) {
  const vehicle = [plan.vehicle.make, plan.vehicle.model, plan.vehicle.chassis, plan.vehicle.year]
    .filter(Boolean)
    .join(" ");
  const constraints = [
    plan.vehicle.engine ? `${locale === "ua" ? "двигун" : "engine"} ${plan.vehicle.engine}` : null,
    plan.opfGpf === "with" ? "OPF/GPF" : plan.opfGpf === "without" ? "NON-OPF" : null,
    formatShopAiProductKind(plan.productKind, locale),
    plan.powerGainHp ? `+${plan.powerGainHp} ${locale === "ua" ? "к.с." : "hp"}` : null,
  ].filter(Boolean);
  const subject = [vehicle, constraints.length ? `(${constraints.join(", ")})` : null]
    .filter(Boolean)
    .join(" ");

  return locale === "ua"
    ? `Точного варіанта для ${subject || "цього запиту"} у каталозі зараз немає. Я не підміняю його товаром для іншого кузова або конфігурації; менеджер може перевірити сумісні рішення під замовлення.`
    : `There is no exact catalog match for ${subject || "this request"}. I will not substitute a product for another chassis or configuration; a manager can check compatible special-order options.`;
}
