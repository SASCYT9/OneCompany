import { resolveShopCountry, type ShopCountry } from "@/lib/shopCountries";
import { EUROPE_PRICING_COUNTRIES, isEuropePricingCountry } from "@/lib/shopEuropePricing";

/** Commercial markets reuse the existing Europe pricing boundary, not a VAT jurisdiction. */
export const SHOP_MARKETS = [
  {
    id: "ukraine",
    shippingZoneId: "ua-standard",
    ua: "Україна",
    en: "Ukraine",
    currency: "UAH",
    countries: ["UA", "Ukraine"],
  },
  {
    id: "europe",
    shippingZoneId: "europe-standard",
    ua: "Європа",
    en: "Europe",
    currency: "EUR",
    countries: EUROPE_PRICING_COUNTRIES.flatMap((country) => [
      country.code,
      country.name,
      ...(country.aliases ?? []),
    ]),
  },
  {
    id: "america",
    shippingZoneId: "us-standard",
    ua: "Америка — США",
    en: "America — United States",
    currency: "USD",
    countries: ["US", "USA", "United States", "United States of America"],
  },
] as const;

export type ShopMarket = (typeof SHOP_MARKETS)[number];
export type ShopMarketId = ShopMarket["id"] | "other";

export function resolveShopMarket(value: string | null | undefined): ShopMarketId {
  const country = resolveShopCountry(value);
  if (country?.code === "UA") return "ukraine";
  if (country?.code === "US") return "america";
  if (country && isEuropePricingCountry(country.code)) return "europe";
  return "other";
}

export function groupShopCountriesByMarket(countries: readonly ShopCountry[]) {
  const groups = [
    ...SHOP_MARKETS.map((market) => ({
      id: market.id as ShopMarketId,
      ua: market.ua as string,
      en: market.en as string,
      countries: [] as ShopCountry[],
    })),
    {
      id: "other" as const,
      ua: "Інші країни",
      en: "Other countries",
      countries: [] as ShopCountry[],
    },
  ];
  for (const country of countries) {
    groups.find((group) => group.id === resolveShopMarket(country.code))!.countries.push(country);
  }
  return groups.filter((group) => group.countries.length > 0);
}

/**
 * Prepare missing settings rows without changing existing rates or their priority.
 * New rows go before the first catch-all, so it cannot shadow them when enabled.
 * The caller creates DISABLED rows until their delivery terms are configured.
 */
export function addMissingShopMarketZones<T extends { id: string; countriesText: string }>(
  zones: readonly T[],
  create: (market: ShopMarket) => T
): T[] {
  const existingIds = new Set(zones.map((zone) => zone.id));
  const additions = SHOP_MARKETS.filter((market) => !existingIds.has(market.shippingZoneId)).map(
    create
  );
  const fallbackIndex = zones.findIndex((zone) =>
    zone.countriesText.split(",").some((country) => country.trim() === "*")
  );
  const index = fallbackIndex < 0 ? zones.length : fallbackIndex;
  return [...zones.slice(0, index), ...additions, ...zones.slice(index)];
}
