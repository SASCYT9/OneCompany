import type { ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import { areChassisCompatible } from "@/lib/crossShopFitment";
import { shopAiProductKindQueryTerm } from "@/lib/shopAiProductKind";
import {
  isShopSearchCodeToken,
  normalizeShopSearchText,
  tokenizeShopSearchQuery,
} from "@/lib/shopSearch";
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
    plan.brand,
    shopAiProductKindQueryTerm(plan.productKind),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return structuredQuery || plan.searchQuery;
}

const SHOP_AI_LEXICAL_STOP_WORDS = new Set([
  "about",
  "accessories",
  "accessory",
  "aero",
  "available",
  "body",
  "brakes",
  "carbon",
  "category",
  "check",
  "chip",
  "choose",
  "compare",
  "complete",
  "confirmed",
  "cooling",
  "exact",
  "exhaust",
  "find",
  "from",
  "help",
  "interior",
  "item",
  "kit",
  "lighting",
  "merch",
  "moto",
  "motorcycle",
  "need",
  "open",
  "other",
  "parts",
  "performance",
  "product",
  "products",
  "set",
  "show",
  "suspension",
  "system",
  "this",
  "tuning",
  "upgrade",
  "want",
  "what",
  "wheel",
  "wheels",
  "with",
  "you",
  "aksesuary",
  "choho",
  "chyp",
  "detali",
  "dopomozhy",
  "dvyhuna",
  "dysky",
  "halma",
  "karbon",
  "karbonovyi",
  "khochu",
  "mototsykla",
  "obvis",
  "okholodzhennia",
  "osvitlennia",
  "pidibraty",
  "pidviska",
  "pochaty",
  "salonu",
  "tiuninh",
  "vstanovyty",
  "vykhlop",
  "аерообвіс",
  "встановити",
  "двигателя",
  "двигуна",
  "допоможи",
  "карбоновии",
  "карбоновыи",
  "мотоцикла",
  "начать",
  "подобрать",
  "помоги",
  "почати",
  "підібрати",
  "треба",
  "установить",
  "уточнити",
  "хочу",
  "чего",
  "чип",
  "чого",
  "авто",
  "аксесуари",
  "аксессуары",
  "вихлоп",
  "выхлоп",
  "гальма",
  "деталі",
  "детали",
  "диски",
  "для",
  "карбон",
  "мерч",
  "мені",
  "мне",
  "обвіс",
  "обвес",
  "освітлення",
  "освещение",
  "охолодження",
  "охлаждение",
  "підвіска",
  "подвеска",
  "салону",
  "салона",
  "тормоза",
  "тюнінг",
  "тюнинг",
  "товар",
  "товари",
  "товаров",
  "категорія",
  "категории",
  "покажи",
  "покажите",
  "знайди",
  "найди",
  "підбери",
  "подбери",
  "порівняти",
  "сравни",
  "перевір",
  "проверь",
  "відкрий",
  "открой",
  "dlia",
  "dla",
  "avto",
  "tovar",
  "pokazhy",
  "pidbery",
  "znaidy",
  "perevir",
]);

/**
 * Builds a bounded OR query for catalog full-text ranking. Product-name
 * requests often contain conversational wrappers; requiring every word would
 * turn a precise title lookup into a false no-match.
 */
export function buildShopAiLexicalWebsearchQuery(plan: ShopAiPlan, message: string) {
  const candidates = tokenizeShopSearchQuery(
    [buildShopAiCatalogQuery(plan), plan.searchQuery, message].filter(Boolean).join(" ")
  );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of candidates) {
    if (SHOP_AI_LEXICAL_STOP_WORDS.has(token)) continue;
    if (token.length < 3 && !isShopSearchCodeToken(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
    if (unique.length >= 32) break;
  }
  return unique.join(" OR ");
}

export function selectShopAiDirectCatalogTitleMatches<T extends Pick<ShopAiProduct, "name">>(
  message: string,
  products: readonly T[]
) {
  const normalizedMessage = normalizeShopSearchText(message);
  const matches = products.flatMap((product) => {
    const title = normalizeShopSearchText(product.name);
    return title.length >= 8 && normalizedMessage.includes(title) ? [{ product, title }] : [];
  });
  return matches
    .filter(
      (match) =>
        !matches.some(
          (other) => other.title.length > match.title.length && other.title.includes(match.title)
        )
    )
    .map((match) => match.product);
}

export function hasDirectShopAiCatalogTitleMatch(
  message: string,
  products: readonly Pick<ShopAiProduct, "name">[]
) {
  return selectShopAiDirectCatalogTitleMatches(message, products).length > 0;
}

/**
 * An availability question about one explicitly named catalog item must still
 * return that item so the storefront can show its real stock state. For broad
 * requests ("only in stock"), stock remains a hard constraint.
 */
export function filterShopAiProductsForStock(
  products: readonly ShopAiProduct[],
  message: string,
  stockOnly: boolean
) {
  if (!stockOnly) return [...products];
  const directMatches = selectShopAiDirectCatalogTitleMatches(message, products);
  return directMatches.length ? directMatches : products.filter((product) => product.inStock);
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
