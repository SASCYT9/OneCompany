import { buildShopSearchText, isShopSearchCodeToken, normalizeShopSearchText } from "./shopSearch";

export type ShopVehicleSearchIntent = "sku" | "vehicle" | "mixed" | "text";

export type ShopVehicleSearchExpansion = {
  raw: string;
  normalized: string;
  compact: string;
  intent: ShopVehicleSearchIntent;
  tokens: string[];
  requiredTokens: string[];
  makes: string[];
  models: string[];
  chassis: string[];
  platforms: string[];
  engines: string[];
  softTerms: string[];
  aliasIds: string[];
};

export type ShopVehicleSearchItem = {
  searchText: string;
  titleText: string;
  skuText: string;
  compactSkuText: string;
  fitmentText: string;
};

export type ShopVehicleSearchScore = {
  score: number;
  reasons: string[];
};

type VehicleAliasGroup = {
  id: string;
  aliases: string[];
  makes?: string[];
  models?: string[];
  chassis?: string[];
  platforms?: string[];
  engines?: string[];
  softTerms?: string[];
};

const VEHICLE_ALIAS_GROUPS: VehicleAliasGroup[] = [
  {
    id: "bmw-g8x",
    aliases: ["g8x", "g80", "g81", "g82", "g83", "g87", "m3 g80", "m4 g82", "m2 g87"],
    makes: ["BMW"],
    models: ["M2", "M3", "M4"],
    chassis: ["G80", "G81", "G82", "G83", "G87"],
    platforms: ["G8X"],
    engines: ["S58"],
    softTerms: ["competition", "xdrive"],
  },
  {
    id: "bmw-f8x",
    aliases: ["f8x", "f80", "f82", "f83", "f87", "m3 f80", "m4 f82", "m2 f87"],
    makes: ["BMW"],
    models: ["M2", "M3", "M4"],
    chassis: ["F80", "F82", "F83", "F87"],
    platforms: ["F8X"],
    engines: ["S55", "N55"],
  },
  {
    id: "bmw-modern-engines",
    aliases: ["s58", "b58", "n54", "n55"],
    makes: ["BMW"],
    engines: ["S58", "B58", "N54", "N55"],
    softTerms: ["m2", "m3", "m4", "m340i", "m440i", "supra"],
  },
  {
    id: "bmw-m-range",
    aliases: ["m2", "m3", "m4", "m5", "m8", "x3m", "x5m", "x4m", "x6m"],
    makes: ["BMW"],
    models: ["M2", "M3", "M4", "M5", "M8", "X3 M", "X4 M", "X5 M", "X6 M"],
  },
  {
    id: "porsche-911",
    aliases: ["911", "992", "991", "gt3", "gt3 rs", "gt4", "turbo", "carrera", "gts"],
    makes: ["Porsche"],
    models: ["911", "GT3", "GT4", "Turbo", "Carrera", "GTS"],
    chassis: ["991", "992"],
    platforms: ["911"],
  },
  {
    id: "porsche-718",
    aliases: ["718", "981", "982", "boxster", "cayman"],
    makes: ["Porsche"],
    models: ["718", "718 Boxster/Cayman", "Boxster", "Cayman"],
    chassis: ["718", "981", "982"],
  },
  {
    id: "porsche-suv",
    aliases: ["cayenne", "macan", "panamera"],
    makes: ["Porsche"],
    models: ["Cayenne", "Macan", "Panamera"],
    chassis: ["95B", "958", "971", "972", "9YA"],
  },
  {
    id: "audi-rsq8",
    aliases: ["rsq8", "rs q8", "rs-q8"],
    makes: ["Audi"],
    models: ["RS Q8", "RSQ8"],
    chassis: ["4M", "F1"],
    engines: ["EA825"],
  },
  {
    id: "audi-rs6-rs7-c8",
    aliases: ["rs6 c8", "rs7 c8", "c8 rs6", "c8 rs7", "rs6", "rs7"],
    makes: ["Audi"],
    models: ["RS6", "RS7"],
    chassis: ["C8"],
    engines: ["EA825"],
  },
  {
    id: "audi-rs3",
    aliases: ["rs3 8y", "rs3 8v", "8y rs3", "8v rs3", "rs3"],
    makes: ["Audi"],
    models: ["RS3"],
    chassis: ["8Y", "8V"],
    engines: ["EA855"],
  },
  {
    id: "vw-mqb",
    aliases: ["mqb", "mk7", "mk7.5", "mk8", "golf r", "golf gti", "ea888"],
    makes: ["Volkswagen", "Audi"],
    models: ["Golf", "Golf R", "Golf GTI", "A3", "S3"],
    chassis: ["MQB", "MK7", "MK7.5", "MK8", "8V", "8Y"],
    engines: ["EA888"],
  },
  {
    id: "mercedes-g-class",
    aliases: ["g wagon", "g-wagon", "gwagon", "g class", "g-class", "g63", "w463", "w463a", "w465"],
    makes: ["Mercedes-Benz", "Mercedes-AMG"],
    models: ["G-Class", "G63", "G-Wagon"],
    chassis: ["W463", "W463A", "W465"],
    platforms: ["G-Wagon"],
  },
  {
    id: "mercedes-amg",
    aliases: ["c63", "e63", "s63", "amg gt", "gt63"],
    makes: ["Mercedes-AMG", "Mercedes-Benz"],
    models: ["C63", "E63", "S63", "AMG GT", "GT63"],
  },
  {
    id: "land-rover-defender",
    aliases: ["defender", "defender l663", "l663", "defender 90", "defender 110", "defender 130"],
    makes: ["Land Rover"],
    models: ["Defender", "Defender 90", "Defender 110", "Defender 130"],
    chassis: ["L663"],
    platforms: ["Defender"],
    softTerms: ["90", "110", "130", "octa"],
  },
  {
    id: "range-rover-sport",
    aliases: ["range rover sport", "rrs", "l494", "l461"],
    makes: ["Range Rover", "Land Rover"],
    models: ["Range Rover Sport"],
    chassis: ["L494", "L461"],
  },
  {
    id: "range-rover-full-size",
    aliases: ["range rover", "l405", "l460"],
    makes: ["Range Rover", "Land Rover"],
    models: ["Range Rover"],
    chassis: ["L405", "L460"],
  },
  {
    id: "lamborghini-urus",
    aliases: ["urus", "urus s", "urus performante", "urus se"],
    makes: ["Lamborghini"],
    models: ["Urus", "Urus S", "Urus Performante", "Urus SE"],
  },
  {
    id: "lamborghini-huracan-aventador",
    aliases: ["huracan", "huracán", "aventador"],
    makes: ["Lamborghini"],
    models: ["Huracan", "Huracán", "Aventador"],
    chassis: ["LP610", "LP640", "LP700", "LP740", "LP750"],
  },
  {
    id: "ferrari-core",
    aliases: ["296", "488", "f8", "812", "458"],
    makes: ["Ferrari"],
    models: ["296", "488", "F8", "812", "458"],
  },
  {
    id: "toyota-supra",
    aliases: ["supra", "supra a90", "a90 supra", "a90", "a91"],
    makes: ["Toyota"],
    models: ["GR Supra", "Supra"],
    chassis: ["A90", "A91"],
    engines: ["B58"],
  },
  {
    id: "nissan-gtr",
    aliases: ["gtr", "gt-r", "r35", "gtr r35", "gt-r r35"],
    makes: ["Nissan"],
    models: ["GT-R", "GTR"],
    chassis: ["R35"],
  },
  {
    id: "toyota-subaru-86",
    aliases: ["brz", "gr86", "gt86", "zd8", "zn8"],
    makes: ["Subaru", "Toyota"],
    models: ["BRZ", "GR86", "GT86"],
    chassis: ["ZD8", "ZN8", "ZC6", "ZN6"],
  },
  {
    id: "honda-civic-type-r",
    aliases: ["civic fk8", "civic fl5", "fk8", "fl5", "type r", "type-r"],
    makes: ["Honda"],
    models: ["Civic Type R", "Civic"],
    chassis: ["FK8", "FL5"],
  },
];

function uniq(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    const key = normalizeShopSearchText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

export function compactShopCode(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isStructuredPartQuery(value: string) {
  const compact = compactShopCode(value);
  return compact.length >= 4 && /[a-z]/i.test(compact) && /\d/.test(compact);
}

function normalizedIncludesPhrase(normalizedHaystack: string, phrase: string) {
  const normalizedNeedle = normalizeShopSearchText(phrase);
  if (!normalizedNeedle) return false;
  return normalizedHaystack === normalizedNeedle || normalizedHaystack.includes(normalizedNeedle);
}

function hasVehicleSignal(expansion: Omit<ShopVehicleSearchExpansion, "intent">) {
  return (
    expansion.makes.length > 0 ||
    expansion.models.length > 0 ||
    expansion.chassis.length > 0 ||
    expansion.platforms.length > 0 ||
    expansion.engines.length > 0
  );
}

export function parseVehicleSearchQuery(query: string): ShopVehicleSearchIntent {
  if (isStructuredPartQuery(query) && /[-/]/.test(query)) {
    return "sku";
  }

  const expansion = expandVehicleAliases(query);
  if (expansion.intent === "sku") {
    return "sku";
  }
  if (hasVehicleSignal(expansion) && isStructuredPartQuery(query)) {
    return "mixed";
  }
  if (hasVehicleSignal(expansion)) {
    return "vehicle";
  }
  return "text";
}

export function expandVehicleAliases(query: string): ShopVehicleSearchExpansion {
  const normalized = normalizeShopSearchText(query);
  const compact = compactShopCode(query);
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 1 || isShopSearchCodeToken(token));

  let matchedGroups = VEHICLE_ALIAS_GROUPS.filter((group) =>
    group.aliases.some((alias) => normalizedIncludesPhrase(normalized, alias))
  );
  const hasSpecificBmwMPlatform = matchedGroups.some(
    (group) => group.id === "bmw-g8x" || group.id === "bmw-f8x"
  );
  if (hasSpecificBmwMPlatform) {
    matchedGroups = matchedGroups.filter((group) => group.id !== "bmw-m-range");
  }

  const requiredTokens = tokens.filter(
    (token) =>
      isShopSearchCodeToken(token) ||
      matchedGroups.some((group) =>
        [...(group.models ?? []), ...(group.chassis ?? []), ...(group.engines ?? [])].some(
          (value) => normalizeShopSearchText(value) === token
        )
      )
  );

  const base = {
    raw: query,
    normalized,
    compact,
    tokens,
    requiredTokens: uniq(requiredTokens).map((value) => normalizeShopSearchText(value)),
    makes: uniq(matchedGroups.flatMap((group) => group.makes ?? [])),
    models: uniq(matchedGroups.flatMap((group) => group.models ?? [])),
    chassis: uniq(matchedGroups.flatMap((group) => group.chassis ?? [])),
    platforms: uniq(matchedGroups.flatMap((group) => group.platforms ?? [])),
    engines: uniq(matchedGroups.flatMap((group) => group.engines ?? [])),
    softTerms: uniq(matchedGroups.flatMap((group) => group.softTerms ?? [])),
    aliasIds: matchedGroups.map((group) => group.id),
  };

  const intent: ShopVehicleSearchIntent =
    isStructuredPartQuery(query) && /[-/]/.test(query)
      ? "sku"
      : hasVehicleSignal(base)
        ? isStructuredPartQuery(query)
          ? "mixed"
          : "vehicle"
        : "text";

  return { ...base, intent };
}

function textHasAny(text: string, values: string[]) {
  return values.some((value) => {
    const normalized = normalizeShopSearchText(value);
    return normalized && text.includes(normalized);
  });
}

function scoreTokens(
  text: string,
  values: string[],
  weight: number,
  reasonLabel: string,
  reasons: string[]
) {
  let score = 0;
  for (const value of values) {
    const normalized = normalizeShopSearchText(value);
    if (!normalized || !text.includes(normalized)) continue;
    score += weight;
    reasons.push(`${reasonLabel}:${value}`);
  }
  return score;
}

export function scoreVehicleSearchItem(
  item: ShopVehicleSearchItem,
  expandedQuery: ShopVehicleSearchExpansion
): ShopVehicleSearchScore {
  if (!expandedQuery.normalized) {
    return { score: 1, reasons: [] };
  }

  if (expandedQuery.intent === "sku" && item.compactSkuText.includes(expandedQuery.compact)) {
    return { score: 1000, reasons: ["sku:exact"] };
  }

  const reasons: string[] = [];
  let score = 0;
  const allText = item.searchText;

  const chassisInFitment = scoreTokens(
    item.fitmentText,
    expandedQuery.chassis,
    70,
    "fitment.chassis",
    reasons
  );
  score += chassisInFitment;
  score += scoreTokens(item.titleText, expandedQuery.chassis, 45, "title.chassis", reasons);
  score += scoreTokens(allText, expandedQuery.chassis, 25, "text.chassis", reasons);

  const modelInFitment = scoreTokens(
    item.fitmentText,
    expandedQuery.models,
    45,
    "fitment.model",
    reasons
  );
  score += modelInFitment;
  score += scoreTokens(item.titleText, expandedQuery.models, 35, "title.model", reasons);
  score += scoreTokens(allText, expandedQuery.models, 15, "text.model", reasons);

  score += scoreTokens(item.fitmentText, expandedQuery.platforms, 35, "fitment.platform", reasons);
  score += scoreTokens(item.titleText, expandedQuery.platforms, 25, "title.platform", reasons);
  score += scoreTokens(allText, expandedQuery.platforms, 15, "text.platform", reasons);

  score += scoreTokens(item.fitmentText, expandedQuery.engines, 20, "fitment.engine", reasons);
  score += scoreTokens(item.titleText, expandedQuery.engines, 18, "title.engine", reasons);
  score += scoreTokens(allText, expandedQuery.engines, 10, "text.engine", reasons);

  score += scoreTokens(item.fitmentText, expandedQuery.makes, 8, "fitment.make", reasons);
  score += scoreTokens(item.titleText, expandedQuery.makes, 6, "title.make", reasons);
  score += scoreTokens(allText, expandedQuery.makes, 2, "text.make", reasons);

  score += scoreTokens(allText, expandedQuery.softTerms, 3, "text.soft", reasons);

  if (chassisInFitment > 0 && modelInFitment > 0) {
    score += 80;
    reasons.unshift("fitment:model+chassis");
  }

  for (const token of expandedQuery.tokens) {
    if (!allText.includes(token)) continue;
    score += item.titleText.includes(token) ? 8 : 2;
    reasons.push(item.titleText.includes(token) ? `title.token:${token}` : `text.token:${token}`);
  }

  if (expandedQuery.requiredTokens.length > 0) {
    const matchedRequired = expandedQuery.requiredTokens.filter((token) => allText.includes(token));
    if (matchedRequired.length === 0) {
      score *= 0.2;
      reasons.push("required:miss");
    } else {
      score *= matchedRequired.length / expandedQuery.requiredTokens.length;
      reasons.push(`required:${matchedRequired.join("+")}`);
    }
  }

  if (score === 0 && expandedQuery.intent === "text") {
    const matched = expandedQuery.tokens.filter((token) => allText.includes(token));
    if (matched.length > 0) {
      score = matched.length;
      reasons.push(`text:fallback:${matched.join("+")}`);
    }
  }

  if (expandedQuery.intent === "vehicle" || expandedQuery.intent === "mixed") {
    const hasSpecificMatch =
      textHasAny(item.fitmentText, expandedQuery.chassis) ||
      textHasAny(item.titleText, expandedQuery.chassis) ||
      textHasAny(item.fitmentText, expandedQuery.models) ||
      textHasAny(item.titleText, expandedQuery.models) ||
      textHasAny(item.fitmentText, expandedQuery.engines) ||
      textHasAny(item.titleText, expandedQuery.engines);
    if (!hasSpecificMatch && textHasAny(allText, expandedQuery.makes)) {
      score *= 0.35;
      reasons.push("make-only:penalty");
    }
  }

  return { score, reasons: reasons.slice(0, 8) };
}

export function buildVehicleSearchDebug(expandedQuery: ShopVehicleSearchExpansion) {
  return {
    intent: expandedQuery.intent,
    tokens: expandedQuery.tokens,
    requiredTokens: expandedQuery.requiredTokens,
    aliases: {
      ids: expandedQuery.aliasIds,
      makes: expandedQuery.makes,
      models: expandedQuery.models,
      chassis: expandedQuery.chassis,
      platforms: expandedQuery.platforms,
      engines: expandedQuery.engines,
      softTerms: expandedQuery.softTerms,
    },
  };
}
