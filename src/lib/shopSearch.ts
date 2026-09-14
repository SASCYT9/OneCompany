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

export const SHOP_SEARCH_QUERY_MAX_LENGTH = 1024;

// Reviewed equivalent product terms, shared with SQL for existing index rows.
// Ambiguous words such as "диски" are deliberately not mapped to wheels/brakes.
export const SHOP_SEARCH_TOKEN_ALIASES: Readonly<Record<string, string>> = {
  exhaust: "exhaust|fiexhaust|вихлоп(?:на|ні|них|ної|ну|у|и)?|выхлоп(?:ная|ные|ных|ной|ную|а)?",
  intake: "intake|впуск(?:на|ні|них|ної|ну|у)?",
  downpipe: "downpipes?|даунпайп(?:и|ів|а)?|даунпаип(?:и|ів|а)?",
  suspension: "suspensions?|підвіск(?:а|и|у)|подвеск(?:а|и|у)",
  carbon: "carbon|карбон(?:овий|овии|ові|ового|ова|ове|у)?",
  diffuser: "diffusers?|дифузор(?:и|ів|а)?|диффузор(?:ы|ов|а)?",
  spoiler: "spoilers?|спойлер(?:и|ів|а)?|споилер(?:и|ів|а)?",
  intercooler: "intercoolers?|інтеркулер(?:и|ів|а)?|интеркулер(?:ы|ов|а)?",
  radiator: "radiators?|радіатор(?:и|ів|а)?|радиатор(?:ы|ов|а)?",
  system: "systems?|систем(?:а|и|у|ою|ы)",
  do88: "do[ -]*88",
  racechip: "race[ -]*chip",
  girodisc: "giro[ -]*disc",
  bootmod3: "boot[ -]*mod[ -]*3|bm3",
  burger: "burger(?:[ -]+motorsports?)?|bms",
  gsport: "g[ -]*sport(?:[ -]+by[ -]+gesi)?|gesi",
  kw: "kw(?:[ -]+suspensions?)?",
  ipe: "ipe(?:[ -]+exhaust)?|innotech(?:[ -]+performance)?(?:[ -]+exhaust)?",
  urban: "urban(?:[ -]+automotive)?",
  ilmberger: "ilmberger(?:[ -]+carbon)?",
  wifi: "wi[ -]*fi",
};
const productAliasPatterns = Object.entries(SHOP_SEARCH_TOKEN_ALIASES).map(
  ([canonical, pattern]) =>
    [new RegExp(`(^| )(?:${pattern})(?= |$)`, "g"), `$1${canonical}`] as const
);

const SHOP_SEARCH_BRAND_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^| )(?:акраповіч|акрапович|акроповіч|акропович)(?= |$)/g, "$1akrapovic"],
  [/(^| )(?:ремус)(?= |$)/g, "$1remus"],
  [/(^| )(?:брабус)(?= |$)/g, "$1brabus"],
  [/(^| )(?:евентурі|евентури)(?= |$)/g, "$1eventuri"],
  [/(^| )(?:олінс|олинс|ohlins)(?= |$)/g, "$1ohlins"],
  [/(^| )(?:ре[йи]счіп|ре[йи]счип|race chip)(?= |$)/g, "$1racechip"],
  [/(^| )(?:гіродиск|гиродиск|giro disc)(?= |$)/g, "$1girodisc"],
  [/(^| )do 88(?= |$)/g, "$1do88"],
  [/(^| )адро(?= |$)/g, "$1adro"],
  [/(^| )бургер(?: моторспортс?)?(?= |$)/g, "$1burger"],
  [/(^| )бут[ -]*мод[ -]*3(?= |$)/g, "$1bootmod3"],
  [/(^| )до[ -]*88(?= |$)/g, "$1do88"],
  [/(^| )кв(?= |$)/g, "$1kw"],
  [/(^| )урбан(?= |$)/g, "$1urban"],
  [/(^| )[іи]ль?мбергер(?= |$)/g, "$1ilmberger"],
  [/(^| )а[йи]п[іи](?= |$)/g, "$1ipe"],
  [/(^| )дж[іи] спорт(?= |$)/g, "$1gsport"],
];

const SCRIPT_LOOKALIKES: Readonly<Record<string, string>> = {
  А: "A",
  а: "a",
  В: "B",
  Е: "E",
  е: "e",
  К: "K",
  М: "M",
  м: "m",
  Н: "H",
  О: "O",
  о: "o",
  Р: "P",
  р: "p",
  С: "C",
  с: "c",
  Т: "T",
  Х: "X",
  х: "x",
  І: "I",
  і: "i",
  Ѕ: "S",
  ѕ: "s",
};

function normalizeMixedScriptCodes(value: string) {
  if (!/[АаВЕеКМмНОоРрСсТХхІіЅѕ]/.test(value)) return value;
  return value.replace(/[\p{L}\p{N}]+/gu, (word) => {
    // Repair visually identical letters in Latin names/codes; retain ordinary
    // Cyrillic words so their language aliases and product names still work.
    if (!/[АаВЕеКМмНОоРрСсТХхІіЅѕ]/.test(word)) return word;
    if (
      !/[a-z]/i.test(word) &&
      !(
        /\d/.test(word) &&
        [...word].every((letter) => /\d/.test(letter) || SCRIPT_LOOKALIKES[letter])
      )
    )
      return word;
    return [...word].map((letter) => SCRIPT_LOOKALIKES[letter] ?? letter).join("");
  });
}

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
  return normalizeMixedScriptCodes(String(value ?? ""))
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
  return canonicalizeShopSearchQuery(parts.filter(Boolean).join(" "));
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
  let normalized = normalizeShopSearchAliases(query);
  for (const [alias, canonical] of SHOP_SEARCH_QUERY_ALIASES) {
    normalized = normalized.replace(new RegExp(`(^| )${alias}(?= |$)`, "g"), `$1${canonical}`);
  }
  return normalized;
}

const searchQueryTokenCache = new Map<string, string[]>();
export function tokenizeShopSearchQuery(query: string | null | undefined) {
  const key = query ?? "";
  const cached = searchQueryTokenCache.get(key);
  if (cached) return cached;
  const tokens = canonicalizeShopSearchQuery(query)
    .split(" ")
    .filter((token) => token.length > 1 || isShopSearchCodeToken(token));
  if (searchQueryTokenCache.size >= 256) searchQueryTokenCache.clear();
  searchQueryTokenCache.set(key, tokens);
  return tokens;
}

/** Search aliases only: catalog labels, SKUs and stored fitment remain unchanged. */
export function normalizeShopSearchAliases(value: string | null | undefined) {
  let text = normalizeShopSearchText(value);
  for (const [pattern, replacement] of SHOP_SEARCH_BRAND_ALIASES)
    text = text.replace(pattern, replacement);
  text = text
    .replace(/(^| )м\s*(\d{1,3})(?= |$)/g, "$1m$2")
    .replace(/\b(rs|s)\s*q\s*([3-8])\b/g, "$1q$2")
    .replace(
      /\b([a-z]{1,3})\s*(\d{1,4})\s*(rr|xr|rs|rt|gs|r)\b/g,
      (match, prefix: string, code: string, suffix: string) =>
        isShopVehicleSearchToken(`${prefix}${code}${suffix}`) ? `${prefix}${code}${suffix}` : match
    )
    .replace(/\b([a-z]{1,4})\s+(\d{1,3}[a-z]{0,2})\b/g, (match, prefix: string, code: string) =>
      isShopVehicleSearchToken(`${prefix}${code}`) ? `${prefix}${code}` : match
    )
    .replace(/\b(?:fiexhaust|frequency intelligent(?: exhaust)?)\b/g, "fi exhaust")
    .replace(/(^| )(?:фі|фи)(?= |$)/g, "$1fi")
    .replace(/(^| )(?:рс\s*ку\s*8|рс\s*кю\s*8)(?= |$)/g, "$1rsq8");
  for (const [pattern, replacement] of productAliasPatterns)
    text = text.replace(pattern, replacement);
  return text;
}

/** Compatible with JavaScript and PostgreSQL regexes, including old indexes. */
export function shopSearchTokenPattern(token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alias = /^(?:rs|s)q[3-8]$/.test(token)
    ? token.replace("q", "[ -]*q[ -]*")
    : token === "fi"
      ? "(?:(?<!wi[ -])fi|fiexhaust|frequency intelligent)"
      : SHOP_SEARCH_TOKEN_ALIASES[token]
        ? `(?:${SHOP_SEARCH_TOKEN_ALIASES[token]})`
        : isShopVehicleSearchToken(token)
          ? escaped.replace(/([a-z])(\d)/, "$1[ -]*$2").replace(/(\d)([a-z])/, "$1[ -]*$2")
          : escaped;
  return token.length <= 2 ||
    isShopSearchCodeToken(token) ||
    Boolean(SHOP_SEARCH_TOKEN_ALIASES[token])
    ? `(^|[^0-9a-zа-яіїєґ])${alias}($|[^0-9a-zа-яіїєґ])`
    : alias;
}

const searchTokenPatterns = new Map<string, RegExp>();

/** Catalog indexes are already normalized; do not scan long descriptions again per token. */
export function matchesShopSearchToken(normalizedSearchText: string, token: string) {
  let pattern = searchTokenPatterns.get(token);
  if (!pattern) {
    if (searchTokenPatterns.size >= 256) searchTokenPatterns.clear();
    pattern = new RegExp(shopSearchTokenPattern(token), "i");
    searchTokenPatterns.set(token, pattern);
  }
  return pattern.test(normalizedSearchText);
}

export function isShopSearchCodeToken(token: string) {
  return /^(?:[a-z]{1,4}\d{1,5}[a-z]{0,2}|\d{2,5}[a-z]{1,3}|mk\d|mqb|amg|opf|gpf)$/i.test(token);
}

export function isShopVehicleSearchToken(token: string) {
  return /^(?:[efg]\d{2,3}[a-z]?|f9x|g8x|w\d{3}|c\d{3}|r\d{2,3}|[sm]1000(?:rr|r|xr)|mk\d|mqb|rsq?\d|sq\d|s\d|m\d{1,3}|x\d{1,2}m?|z\d|b[89]|c[78]|8[vy]|4[gmno]|718|9\d{2}|sf\d{2,3}|s63(?:tu\d?)?|b58|s58|n5[45]|amg|gt[34]?)$/i.test(
    token
  );
}

const SHOP_SEARCH_BRAND_TOKENS = new Set([
  "akrapovic",
  "adro",
  "bootmod3",
  "brabus",
  "burger",
  "csf",
  "do88",
  "eventuri",
  "fi",
  "gsport",
  "girodisc",
  "ilmberger",
  "kw",
  "ohlins",
  "racechip",
  "remus",
  "urban",
  "ipe",
]);

/** A single named brand must not be satisfied by a rival's SKU or description. */
export function matchesShopSearchBrandIntent(brand: string | undefined, query: string) {
  if (!brand) return true;
  const requested = [
    ...new Set(
      tokenizeShopSearchQuery(query).filter((token) => SHOP_SEARCH_BRAND_TOKENS.has(token))
    ),
  ];
  if (requested.length !== 1) return true;
  return tokenizeShopSearchQuery(brand).includes(requested[0]);
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

  const normalizedText = normalizeShopSearchAliases(searchText);
  return queryTokens.every((token) => matchesShopSearchToken(normalizedText, token));
}
