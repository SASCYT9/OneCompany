export const STOREFRONT_ROUTE_REGISTRY = [
  { segment: "racechip", brandAliases: ["racechip"], legacySlugPrefixes: ["racechip-"] },
  { segment: "do88", brandAliases: ["do88"], legacySlugPrefixes: ["do88-"] },
  { segment: "brabus", brandAliases: ["brabus"], legacySlugPrefixes: ["brabus-"] },
  { segment: "girodisc", brandAliases: ["girodisc"], legacySlugPrefixes: ["girodisc-"] },
  {
    segment: "burger",
    brandAliases: [
      "burger motorsports",
      "burger motorsports inc",
      "burger motorsports inc.",
      "burger motorsports, inc.",
    ],
    legacySlugPrefixes: ["burger-"],
  },
  { segment: "ohlins", brandAliases: ["ohlins"], legacySlugPrefixes: ["ohlins-"] },
  {
    segment: "akrapovic",
    brandAliases: ["akrapovic"],
    legacySlugPrefixes: ["akrapovic-", "ducati-akrapovic-"],
  },
  {
    segment: "ilmberger",
    brandAliases: ["ilmberger", "ilmberger carbon"],
    legacySlugPrefixes: ["ilmberger-"],
  },
  { segment: "csf", brandAliases: ["csf"], legacySlugPrefixes: ["csf-"] },
  {
    segment: "urban",
    brandAliases: ["urban", "urban automotive"],
    legacySlugPrefixes: ["urb-"],
  },
  { segment: "adro", brandAliases: ["adro"], legacySlugPrefixes: ["adro-"] },
  {
    segment: "ipe",
    brandAliases: ["ipe", "innotech performance exhaust"],
    legacySlugPrefixes: ["ipe-"],
  },
] as const;

export type StorefrontSegment = (typeof STOREFRONT_ROUTE_REGISTRY)[number]["segment"];

export const SHOP_PRODUCT_LEGACY_PREFIX_ROUTES = STOREFRONT_ROUTE_REGISTRY.flatMap((route) =>
  route.legacySlugPrefixes.map((prefix) => ({ prefix, segment: route.segment }))
);
