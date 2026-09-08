export type ShopAlternativeSearchItem = {
  slug: string;
  href: string;
  brand: string;
  sku: string;
  image: string | null;
  title: {
    ua: string;
    en: string;
  };
  searchText: string;
};

type SearchPart = string | number | null | undefined | false;

// Keep the storefront forgiving for the common Ukrainian/Russian keyboard
// forms customers use for vehicle makes. These are query aliases only; stored
// product data and URLs always keep their canonical Latin labels.
const SHOP_SEARCH_QUERY_ALIASES = [
  ["мерседес бенц", "mercedes benz"],
  ["мерседес", "mercedes benz"],
  ["фольксваген", "volkswagen"],
  ["ламборгіні", "lamborghini"],
  ["ламборгини", "lamborghini"],
  ["порше", "porsche"],
  ["ауді", "audi"],
  ["ауди", "audi"],
  ["тойота", "toyota"],
  ["хонда", "honda"],
  ["ніссан", "nissan"],
  ["ниссан", "nissan"],
  ["мазда", "mazda"],
  ["форд", "ford"],
  ["вольво", "volvo"],
  ["шкода", "skoda"],
  ["рено", "renault"],
  ["ягуар", "jaguar"],
  ["бмв", "bmw"],
] as const;

export function normalizeShopSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×]/g, "x")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^0-9a-zA-ZА-Яа-яІіЇїЄєҐґ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildShopSearchText(parts: readonly SearchPart[]) {
  return normalizeShopSearchText(parts.filter(Boolean).join(" "));
}

export function getShopSearchQueryVariants(query: string | null | undefined) {
  const normalized = normalizeShopSearchText(query);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  for (const [alias, canonical] of SHOP_SEARCH_QUERY_ALIASES) {
    for (const variant of [...variants]) {
      if (variant.includes(alias)) variants.add(variant.replace(alias, canonical));
    }
  }
  return [...variants];
}

export function canonicalizeShopSearchQuery(query: string | null | undefined) {
  return getShopSearchQueryVariants(query)[1] ?? normalizeShopSearchText(query);
}

export function tokenizeShopSearchQuery(query: string | null | undefined) {
  return normalizeShopSearchText(query)
    .split(" ")
    .filter((token) => token.length > 1 || isShopSearchCodeToken(token));
}

export function isShopSearchCodeToken(token: string) {
  return /^(?:[a-z]{1,4}\d{1,5}[a-z]{0,2}|\d{2,5}[a-z]{1,3}|mk\d|mqb|amg|opf|gpf)$/i.test(token);
}

export function isShopVehicleSearchToken(token: string) {
  return /^(?:[efg]\d{2,3}[a-z]?|f9x|g8x|w\d{3}|c\d{3}|r\d{2,3}|mk\d|mqb|rsq?\d|sq\d|s\d|m\d{1,3}|x\d{1,2}m?|z\d|b[89]|c[78]|8[vy]|4[gmno]|718|9\d{2}|sf\d{2,3}|s63(?:tu\d?)?|b58|s58|n5[45]|amg|gt[34]?)$/i.test(
    token
  );
}

export function hasShopVehicleSearchSignal(searchText: string) {
  return normalizeShopSearchText(searchText)
    .split(" ")
    .some((token) => isShopVehicleSearchToken(token));
}

export function matchesShopSearchQuery(searchText: string, query: string | null | undefined) {
  const queryTokens = tokenizeShopSearchQuery(query);
  if (queryTokens.length === 0) {
    return true;
  }

  const normalizedText = normalizeShopSearchText(searchText);
  const textTokens = new Set(normalizedText.split(" ").filter(Boolean));

  return queryTokens.every((token) => {
    if (isShopSearchCodeToken(token)) {
      return textTokens.has(token);
    }

    return normalizedText.includes(token);
  });
}
