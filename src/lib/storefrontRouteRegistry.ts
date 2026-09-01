export type StorefrontListingSurface = "catalog" | "collections" | "products";

export const STOREFRONT_ROUTE_REGISTRY = [
  { segment: "racechip", brandAliases: ["racechip"], legacySlugPrefixes: ["racechip-"], listingSurface: "catalog", paginated: true },
  { segment: "do88", brandAliases: ["do88"], legacySlugPrefixes: ["do88-"], listingSurface: "collections", paginated: false },
  { segment: "brabus", brandAliases: ["brabus"], legacySlugPrefixes: ["brabus-"], listingSurface: "products", paginated: true },
  { segment: "girodisc", brandAliases: ["girodisc"], legacySlugPrefixes: ["girodisc-"], listingSurface: "catalog", paginated: true },
  {
    segment: "burger",
    brandAliases: [
      "burger motorsports",
      "burger motorsports inc",
      "burger motorsports inc.",
      "burger motorsports, inc.",
    ],
    legacySlugPrefixes: ["burger-"],
    listingSurface: "products",
    paginated: true,
  },
  { segment: "ohlins", brandAliases: ["ohlins"], legacySlugPrefixes: ["ohlins-"], listingSurface: "catalog", paginated: true },
  {
    segment: "akrapovic",
    brandAliases: ["akrapovic"],
    legacySlugPrefixes: ["akrapovic-", "ducati-akrapovic-"],
    listingSurface: "collections",
    paginated: false,
  },
  {
    segment: "ilmberger",
    brandAliases: ["ilmberger", "ilmberger carbon"],
    legacySlugPrefixes: ["ilmberger-"],
    listingSurface: "collections",
    paginated: false,
  },
  { segment: "csf", brandAliases: ["csf"], legacySlugPrefixes: ["csf-"], listingSurface: "collections", paginated: true },
  {
    segment: "urban",
    brandAliases: ["urban", "urban automotive"],
    legacySlugPrefixes: ["urb-"],
    listingSurface: "products",
    paginated: false,
  },
  { segment: "adro", brandAliases: ["adro"], legacySlugPrefixes: ["adro-"], listingSurface: "collections", paginated: true },
  {
    segment: "ipe",
    brandAliases: ["ipe", "ipe exhaust", "innotech performance exhaust"],
    legacySlugPrefixes: ["ipe-"],
    listingSurface: "collections",
    paginated: true,
  },
] as const satisfies readonly {
  segment: string;
  brandAliases: readonly string[];
  legacySlugPrefixes: readonly string[];
  listingSurface: StorefrontListingSurface;
  paginated: boolean;
}[];

export type StorefrontSegment = (typeof STOREFRONT_ROUTE_REGISTRY)[number]["segment"];

export function getStorefrontRoute(segment: StorefrontSegment) {
  return STOREFRONT_ROUTE_REGISTRY.find((route) => route.segment === segment)!;
}

export const SHOP_PRODUCT_LEGACY_PREFIX_ROUTES = STOREFRONT_ROUTE_REGISTRY.flatMap((route) =>
  route.legacySlugPrefixes.map((prefix) => ({ prefix, segment: route.segment }))
);
