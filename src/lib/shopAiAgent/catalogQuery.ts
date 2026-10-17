/**
 * Pure helpers behind the One AI catalog tools: argument cleaning, brand
 * spelling, catalog URLs and the compact product view the model reads.
 * Kept free of server imports so the rules are unit-testable.
 */
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { SHOP_STOCK_CATEGORY_GROUPS } from "@/lib/shopStockTaxonomy";
import type { StockItem } from "@/lib/shopStockSearchTypes";
import { resolveShopCatalogProductHref } from "@/lib/shopStorefrontRouting";

import type {
  OneAiAvailability,
  OneAiContext,
  OneAiConversationState,
  OneAiLocale,
  OneAiProduct,
} from "./types";

export const ONE_AI_CATEGORY_IDS = SHOP_STOCK_CATEGORY_GROUPS.map((group) => group.id);
const CATEGORY_ID_SET = new Set<string>(ONE_AI_CATEGORY_IDS);

export const ONE_AI_SEARCH_LIMIT_DEFAULT = 8;
export const ONE_AI_SEARCH_LIMIT_MAX = 12;

export type OneAiSearchArgs = {
  query?: string;
  make?: string;
  model?: string;
  chassis?: string;
  year?: number;
  engine?: string;
  category?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  in_stock_only?: boolean;
  vehicle_type?: "car" | "motorcycle";
  sort?: "relevance" | "price_asc" | "price_desc";
  limit?: number;
};

/** Catalog spelling for brands customers and the model write differently. */
const BRAND_ALIASES: Record<string, string> = {
  akrapovic: "AKRAPOVIC",
  akra: "AKRAPOVIC",
  акрапович: "AKRAPOVIC",
  акрапі: "AKRAPOVIC",
  remus: "Remus",
  ремус: "Remus",
  kw: "KW Suspensions",
  "kw suspension": "KW Suspensions",
  "kw suspensions": "KW Suspensions",
  ohlins: "OHLINS",
  олінс: "OHLINS",
  eventuri: "Eventuri",
  евентурі: "Eventuri",
  bmc: "BMC",
  "bmc air filter": "BMC",
  mst: "MST Performance",
  "mst performance": "MST Performance",
  do88: "DO88",
  csf: "CSF",
  setrab: "Setrab",
  garrett: "Garrett",
  gfb: "GFB",
  "go fast bits": "GFB",
  girodisc: "GiroDisc",
  stopflex: "STOPFLEX",
  racechip: "RaceChip",
  "race chip": "RaceChip",
  burger: "Burger Motorsports",
  "burger motorsports": "Burger Motorsports",
  bms: "Burger Motorsports",
  jb4: "Burger Motorsports",
  bootmod3: "BootMod3",
  bm3: "BootMod3",
  fi: "Fi EXHAUST",
  "fi exhaust": "Fi EXHAUST",
  "frequency intelligent": "Fi EXHAUST",
  ipe: "iPE exhaust",
  "ipe exhaust": "iPE exhaust",
  innotech: "iPE exhaust",
  brabus: "Brabus",
  брабус: "Brabus",
  adro: "ADRO",
  revozport: "Revozport",
  urban: "Urban Automotive",
  "urban automotive": "Urban Automotive",
  wheelforce: "WheelForce",
  "wheel force": "WheelForce",
  ilmberger: "Ilmberger Carbon",
  "ilmberger carbon": "Ilmberger Carbon",
  "g sport": "G-Sport by GESi",
  gesi: "G-Sport by GESi",
};

export function normalizeOneAiToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("uk-UA")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function resolveOneAiBrand(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return BRAND_ALIASES[normalizeOneAiToken(raw)] ?? raw.slice(0, 60);
}

function cleanText(value: unknown, maxLength: number) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function cleanPrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

/** Validates model-generated arguments; anything unexpected is dropped, never trusted. */
export function cleanOneAiSearchArgs(input: unknown): OneAiSearchArgs {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const year = Number(source.year);
  const limit = Number(source.limit);
  const category = cleanText(source.category, 40);
  let minPrice = cleanPrice(source.min_price);
  let maxPrice = cleanPrice(source.max_price);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return {
    query: cleanText(source.query, 120),
    make: cleanText(source.make, 60),
    model: cleanText(source.model, 60),
    chassis: cleanText(source.chassis, 40),
    year:
      Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 2
        ? year
        : undefined,
    engine: cleanText(source.engine, 40),
    category: category && CATEGORY_ID_SET.has(category) ? category : undefined,
    brand: resolveOneAiBrand(cleanText(source.brand, 60)) ?? undefined,
    min_price: minPrice,
    max_price: maxPrice,
    in_stock_only: source.in_stock_only === true,
    vehicle_type:
      source.vehicle_type === "motorcycle"
        ? "motorcycle"
        : source.vehicle_type === "car"
          ? "car"
          : undefined,
    sort: source.sort === "price_asc" || source.sort === "price_desc" ? source.sort : "relevance",
    limit:
      Number.isInteger(limit) && limit > 0
        ? Math.min(ONE_AI_SEARCH_LIMIT_MAX, limit)
        : ONE_AI_SEARCH_LIMIT_DEFAULT,
  };
}

export function hasOneAiSearchConstraint(args: OneAiSearchArgs) {
  return Boolean(
    args.query ||
      args.make ||
      args.model ||
      args.chassis ||
      args.category ||
      args.brand ||
      args.max_price ||
      args.min_price ||
      args.in_stock_only
  );
}

/**
 * The search attempts, strictest first. A generation code the catalog spells
 * differently ("Mk8" vs "MK8", "992.2") should not end in "nothing found", so
 * the vehicle is relaxed step by step and the model is told what was relaxed.
 */
export function buildOneAiSearchAttempts(args: OneAiSearchArgs) {
  const attempts: Array<{ args: OneAiSearchArgs; relaxed: string | null }> = [
    { args, relaxed: null },
  ];
  if (args.query && args.category && (args.make || args.model)) {
    // Extra words ("GT 5.0", "loud") make the text filter too strict when the
    // category and the vehicle already say what is wanted.
    attempts.push({
      args: { ...args, query: undefined },
      relaxed: `the words "${args.query}" matched nothing — results are the whole ${args.category} category for this vehicle`,
    });
  }
  if (args.chassis && (args.make || args.model)) {
    attempts.push({
      args: { ...args, chassis: undefined },
      relaxed: `no exact match for generation "${args.chassis}" — results are for ${[args.make, args.model].filter(Boolean).join(" ")} without the generation check; read each title to confirm the generation`,
    });
  }
  if (args.make || args.model || args.chassis) {
    const vehicleText = [args.make, args.model, args.chassis].filter(Boolean).join(" ");
    attempts.push({
      args: {
        ...args,
        make: undefined,
        model: undefined,
        chassis: undefined,
        year: undefined,
        engine: undefined,
        query: [args.query, vehicleText].filter(Boolean).join(" "),
      },
      relaxed: `structured vehicle filter found nothing — this is a text search for "${vehicleText}"; titles must mention the vehicle to count as a fit`,
    });
  }
  if (args.brand) {
    attempts.push({
      args: { ...args, brand: undefined },
      relaxed: `no ${args.brand} products for this request — these are other brands`,
    });
  }
  return attempts;
}

export function buildOneAiSearchParams(
  args: OneAiSearchArgs,
  context: Pick<OneAiContext, "locale" | "currency" | "scope">
) {
  const params = new URLSearchParams();
  if (args.query) params.set("q", args.query);
  if (args.make) params.set("make", args.make);
  if (args.model) params.set("model", args.model);
  if (args.chassis) params.set("chassis", args.chassis);
  if (args.year) params.set("year", String(args.year));
  if (args.engine) params.set("engine", args.engine);
  if (args.category) params.set("category", args.category);
  if (args.brand) params.set("brand", args.brand);
  if (args.min_price) params.set("minPrice", String(args.min_price));
  if (args.max_price) params.set("maxPrice", String(args.max_price));
  if (args.in_stock_only) params.set("stock", "inStock");
  if (args.sort === "price_asc" || args.sort === "price_desc") params.set("sort", args.sort);
  const scope =
    args.vehicle_type === "motorcycle"
      ? "moto"
      : args.vehicle_type === "car"
        ? "auto"
        : context.scope;
  if (scope) params.set("scope", scope);
  params.set("currency", context.currency);
  params.set("locale", context.locale);
  params.set("limit", String(args.limit ?? ONE_AI_SEARCH_LIMIT_DEFAULT));
  return params;
}

/** Storefront catalog page with the same filters, for the "see all" link. */
export function buildOneAiCatalogHref(
  args: OneAiSearchArgs,
  context: Pick<OneAiContext, "locale" | "currency" | "scope">
) {
  const search = buildOneAiSearchParams(args, context);
  search.delete("locale");
  search.delete("limit");
  if (!args.min_price && !args.max_price) search.delete("currency");
  return `/${context.locale}/shop/catalog?${search.toString()}`;
}

const MAX_REGISTRY_PRODUCTS = 60;

/**
 * Gives a product a short ref that stays the same for the whole conversation,
 * so "порівняй перші два" can point back at earlier cards.
 */
export function registerOneAiProduct(
  state: Pick<OneAiConversationState, "products" | "nextRef">,
  productId: string,
  build: (ref: string) => OneAiProduct
) {
  const existing = Object.values(state.products).find((product) => product.id === productId);
  if (existing) {
    const refreshed = build(existing.ref);
    state.products[existing.ref] = refreshed;
    return refreshed;
  }
  const ref = `p${state.nextRef}`;
  state.nextRef += 1;
  const product = build(ref);
  state.products[ref] = product;
  const refs = Object.keys(state.products);
  if (refs.length > MAX_REGISTRY_PRODUCTS) {
    for (const stale of refs.slice(0, refs.length - MAX_REGISTRY_PRODUCTS)) {
      delete state.products[stale];
    }
  }
  return product;
}

export function resolveOneAiAvailability(
  item: Pick<StockItem, "inStock" | "availability">
): OneAiAvailability {
  if (item.availability === "inTransit") return "inTransit";
  if (item.inStock || item.availability === "inStock") return "inStock";
  return "onOrder";
}

export function toOneAiProduct(item: StockItem, ref: string, locale: OneAiLocale): OneAiProduct {
  return {
    ref,
    id: item.id,
    slug: item.slug,
    href: resolveShopCatalogProductHref(locale, item.href, item.slug),
    brand: item.brand,
    name: cleanText(item.name, 200) ?? item.slug,
    sku: item.partNumber ?? "",
    image: item.thumbnail ?? item.imageSources?.[0] ?? null,
    priceSet: item.priceSet ?? null,
    compareAtSet: item.originalPriceSet ?? null,
    availability: resolveOneAiAvailability(item),
    category: item.category ?? null,
    summary: cleanText(item.description, 260) ?? "",
  };
}

export function oneAiPriceAmount(
  priceSet: OneAiProduct["priceSet"],
  currency: ShopCurrencyCode
): number | null {
  if (!priceSet) return null;
  const amount = Number(
    currency === "EUR" ? priceSet.eur : currency === "UAH" ? priceSet.uah : priceSet.usd
  );
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

const AVAILABILITY_FOR_MODEL: Record<OneAiAvailability, string> = {
  inStock: "in stock (ships now)",
  inTransit: "in transit to our warehouse",
  onOrder: "on order from the supplier",
};

/** What the model sees for one product: short, factual, no HTML. */
export function describeOneAiProductForModel(
  product: OneAiProduct,
  context: Pick<OneAiContext, "locale" | "currency">
) {
  const price = oneAiPriceAmount(product.priceSet, context.currency);
  const was = oneAiPriceAmount(product.compareAtSet, context.currency);
  return {
    ref: product.ref,
    brand: product.brand,
    title: product.name,
    sku: product.sku || undefined,
    price: price ? formatShopMoney(context.locale, price, context.currency) : "price on request",
    old_price:
      was && price && was > price
        ? formatShopMoney(context.locale, was, context.currency)
        : undefined,
    availability: AVAILABILITY_FOR_MODEL[product.availability],
    category: product.category ?? undefined,
    about: product.summary || undefined,
  };
}
