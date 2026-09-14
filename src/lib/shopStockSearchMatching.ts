import type { Fitment } from "./crossShopFitment";
import {
  canonicalizeShopSearchQuery,
  matchesShopSearchQuery,
  matchesShopSearchToken,
  matchesShopSearchBrandIntent,
  normalizeShopSearchText,
  tokenizeShopSearchQuery,
} from "./shopSearch";
import {
  compactShopCode,
  isStructuredPartQuery,
  scoreVehicleSearchItem,
  filterVehicleSearchResidualTokens,
  type ShopVehicleSearchExpansion,
} from "./shopVehicleSearch";
import {
  shopVehicleChassisMatches,
  shopVehicleMakesMatch,
  shopVehicleModelsMatch,
  shopVehicleYearAllows,
} from "./shopVehicleConstraints";

export function computeRelevanceScoreWithReasons(
  item: {
    searchText: string;
    titleText: string;
    canonicalTitles?: string[];
    skuText: string;
    compactSkuText: string;
    fitmentText: string;
    yearRanges?: Fitment["yearRanges"];
    fitmentMake?: string | null;
    fitmentItems?: Array<{
      searchText: string;
      titleText: string;
      skuText: string;
      compactSkuText: string;
      fitmentText: string;
      yearRanges?: Fitment["yearRanges"];
      fitmentMake?: string | null;
    }>;
  },
  queryTokens: string[],
  rawQuery: string,
  expandedQuery: ShopVehicleSearchExpansion,
  brand?: string,
  titleEn?: string,
  titleUa?: string
) {
  const vehicleScore = (item.fitmentItems?.length ? item.fitmentItems : [item])
    .map((fitmentItem) => scoreVehicleSearchItem(fitmentItem, expandedQuery))
    .sort((left, right) => right.score - left.score)[0];
  const compactQuery = compactShopCode(rawQuery);
  if (isStructuredPartQuery(rawQuery) && item.compactSkuText.includes(compactQuery)) {
    return { score: 1000, reasons: ["sku:exact"] };
  }

  let score = 0;
  let matchedTokens = 0;
  const normalizedBrand = normalizeShopSearchText(brand);
  const normalizedTitleEn = normalizeShopSearchText(titleEn);
  const normalizedTitleUa = normalizeShopSearchText(titleUa);

  const exactTitle = item.canonicalTitles
    ? item.canonicalTitles.includes(expandedQuery.normalized)
    : [titleEn, titleUa].some(
        (title) =>
          title && canonicalizeShopSearchQuery(title) === canonicalizeShopSearchQuery(rawQuery)
      );
  if (exactTitle) return { score: 10000, reasons: ["title:exact"] };

  for (const token of queryTokens) {
    if (!matchesShopSearchToken(item.searchText, token)) {
      continue;
    }

    matchedTokens += 1;
    score += 1.0;

    if (item.fitmentText.includes(token)) {
      score += 3.0;
    }
    if (
      item.titleText.includes(token) ||
      normalizedTitleEn.includes(token) ||
      normalizedTitleUa.includes(token)
    ) {
      score += 1.5;
    }
    if (item.skuText.includes(token)) {
      score += 2.0;
    }
    if (normalizedBrand.includes(token)) {
      score += 1.0;
    }
  }

  if (matchedTokens === 0) {
    return vehicleScore.score > 0 ? vehicleScore : { score: 0, reasons: [] };
  }

  const coverage = matchedTokens / queryTokens.length;

  // For multi-token vehicle/SKU searches, avoid ranking one-token coincidences
  // above real fitment matches. The fallback path still broadens when strict
  // filters produce no results.
  if (queryTokens.length >= 2 && coverage < 0.5) {
    return vehicleScore.score > 0 ? vehicleScore : { score: 0, reasons: [] };
  }

  const identityText = [item.titleText, normalizedBrand, item.skuText].join(" ");
  const identityMatch = queryTokens.every((token) => matchesShopSearchToken(identityText, token));
  const textScore = score * coverage + (identityMatch ? 2000 : 0);
  if (vehicleScore.score > 0) {
    return {
      score: vehicleScore.score + textScore,
      reasons: [...vehicleScore.reasons, `text:${textScore.toFixed(2)}`].slice(0, 8),
    };
  }
  return { score: textScore, reasons: [`text:${textScore.toFixed(2)}`] };
}

export function narrowVehicleSearchResults<
  T extends { searchText: string; titleText?: string; score: number; fitments?: Fitment[] },
>(items: T[], expandedQuery: ShopVehicleSearchExpansion) {
  if (expandedQuery.intent !== "vehicle" && expandedQuery.intent !== "mixed") {
    return items;
  }

  let narrowed = items;
  // Alias metadata helps ranking, but a model-only query does not request a
  // specific engine or chassis. Missing optional metadata must not hide it.
  const explicitModel = expandedQuery.models.some((model) =>
    matchesShopSearchQuery(expandedQuery.raw, model)
  );
  const requestedChassis = expandedQuery.chassis.filter((chassis) =>
    matchesShopSearchQuery(expandedQuery.raw, chassis)
  );
  const chassisConstraints = explicitModel ? requestedChassis : expandedQuery.chassis;
  const engineConstraints = expandedQuery.engines.filter((engine) =>
    matchesShopSearchQuery(expandedQuery.raw, engine)
  );
  const hasStructuredVehicleTarget =
    expandedQuery.makes.length > 0 &&
    (expandedQuery.models.length > 0 || expandedQuery.chassis.length > 0);
  const structuredMatches = hasStructuredVehicleTarget
    ? items.filter((item) =>
        (item.fitments ?? []).some((fitment) => {
          const makeMatches = expandedQuery.makes.some((make) =>
            shopVehicleMakesMatch(fitment.make, make)
          );
          if (!makeMatches) return false;
          const modelMatches =
            expandedQuery.models.length === 0 ||
            fitment.models.some((model) =>
              expandedQuery.models.some((queryModel) =>
                shopVehicleModelsMatch(model, queryModel, fitment.make)
              )
            );
          if (!modelMatches) return false;
          const chassisMatches =
            chassisConstraints.length === 0 ||
            fitment.chassisCodes.some((chassis) =>
              chassisConstraints.some((queryChassis) =>
                shopVehicleChassisMatches(chassis, queryChassis)
              )
            );
          if (!chassisMatches) return false;
          const engineMatches =
            engineConstraints.length === 0 ||
            (fitment.engines ?? []).some((engine) =>
              engineConstraints.some(
                (queryEngine) =>
                  normalizeShopSearchText(engine) === normalizeShopSearchText(queryEngine)
              )
            );
          if (!engineMatches) return false;
          return (
            expandedQuery.years.length === 0 ||
            expandedQuery.years.some((year) => shopVehicleYearAllows(fitment, year))
          );
        })
      )
    : [];
  const hasStructuredMatches = structuredMatches.length > 0;
  if (hasStructuredVehicleTarget) {
    // Once make + model/chassis were parsed, never relax back to token-only
    // matching. An honest no-match is safer than a neighbouring vehicle.
    // Any remaining words are product intent (`Eventuri`, `Burger Motorsports`,
    // a SKU fragment, etc.) and must also match the candidate. This prevents a
    // vehicle-only result set from pretending that a brand-specific query was
    // understood when it was not.
    const structuredSet = new Set(
      filterVehicleSearchResidualTokens(structuredMatches, expandedQuery)
    );
    // A title is authoritative for textual discovery. Incomplete inferred
    // fitment must not hide the very product whose title the customer pasted.
    // Explicit selector constraints are applied by the caller beforehand.
    const queryTokens = tokenizeShopSearchQuery(expandedQuery.raw);
    return items.filter(
      (item) =>
        structuredSet.has(item) ||
        Boolean(
          item.titleText &&
          queryTokens.every((token) => matchesShopSearchToken(item.titleText!, token))
        )
    );
  }

  if (!hasStructuredMatches && expandedQuery.requiredTokens.length > 0) {
    // A missing exact model/code must not broaden to a neighbouring model.
    // In particular S1000R cannot be satisfied by the prefix of S1000RR.
    narrowed = items.filter((item) =>
      expandedQuery.requiredTokens.every((token) => matchesShopSearchToken(item.searchText, token))
    );
  }

  const minimumScore = expandedQuery.requiredTokens.length > 0 ? 12 : 8;
  const strongMatches = narrowed.filter((item) => item.score >= minimumScore);
  return filterVehicleSearchResidualTokens(
    strongMatches.length > 0 ? strongMatches : narrowed,
    expandedQuery
  );
}

export function filterShopStockSearchCandidates<
  T extends {
    searchText: string;
    titleText?: string;
    compactSkuText: string;
    score: number;
    fitments?: Fitment[];
    product?: { brand: string };
    brandText?: string;
    canonicalTitles?: string[];
  },
>(items: T[], query: ShopVehicleSearchExpansion) {
  const compact = compactShopCode(query.raw);
  const skuMatches =
    compact.length >= 2
      ? items.filter((item) => item.compactSkuText.split(" ").includes(compact))
      : [];
  if (skuMatches.length) return skuMatches;
  if (query.intent === "sku")
    return items.filter((item) =>
      item.compactSkuText.split(" ").some((sku) => sku.includes(compact))
    );
  items = items.filter(
    (item) =>
      item.canonicalTitles?.includes(query.normalized) ||
      matchesShopSearchBrandIntent(item.product?.brand ?? item.brandText, query.raw)
  );
  if (query.intent === "vehicle" || query.intent === "mixed")
    return narrowVehicleSearchResults(items, query);
  const queryTokens = tokenizeShopSearchQuery(query.raw);
  return items.filter(
    (item) =>
      item.score > 0 && queryTokens.every((token) => matchesShopSearchToken(item.searchText, token))
  );
}
