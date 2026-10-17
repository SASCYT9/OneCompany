import "server-only";

import { getShopProductsBySlugsServer } from "@/lib/shopCatalogServer";
import { searchShopStock } from "@/lib/shopStockSearch.server";
import type { StockSearchResponse } from "@/lib/shopStockSearchTypes";

import {
  ONE_AI_CATEGORY_IDS,
  buildOneAiCatalogHref,
  buildOneAiSearchAttempts,
  buildOneAiSearchParams,
  cleanOneAiSearchArgs,
  describeOneAiProductForModel,
  hasOneAiSearchConstraint,
  registerOneAiProduct,
  toOneAiProduct,
  type OneAiSearchArgs,
} from "./catalogQuery";
import { buildOneAiCards, cleanOneAiReplies } from "./presentation";
import type { OneAiContext, OneAiConversationState, OneAiEvent } from "./types";

/** Function declarations the model can call. Descriptions are the model's manual. */
export const ONE_AI_TOOL_DECLARATIONS = [
  {
    name: "search_products",
    description:
      "Search the One Company catalog (real products, live prices and availability). " +
      "Use structured vehicle fields whenever the customer named a vehicle: make as the manufacturer " +
      "(BMW, Mercedes-Benz, Porsche, Audi, Volkswagen, Lamborghini, Toyota, Ford, Tesla, Land Rover, Ducati...), " +
      "model as the catalog model name (M3, Golf, 911, G-Class, Urus, Supra, Panigale, S 1000 RR...), " +
      "chassis as the generation code (G80, G87, F90, MK8, 992, W463A, W205, 8Y, C8, A90...). " +
      "Put the product type in `query` (exhaust, downpipe, intake, intercooler, coilovers, brake discs, carbon diffuser...) " +
      "or use `category`. An exact part number goes into `query` alone. " +
      "Results include facet counts (brands and categories available for these filters). " +
      "If a result says `relaxed`, the filter was widened — check titles before claiming a fit.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Product type, keywords or an exact part number." },
        make: { type: "string" },
        model: { type: "string" },
        chassis: {
          type: "string",
          description: "Generation / body code, e.g. G80, MK8, 992, W463A.",
        },
        year: { type: "integer" },
        engine: {
          type: "string",
          description: "Engine code or name, e.g. S58, B58, EA888, 4.0 TFSI.",
        },
        category: { type: "string", enum: ONE_AI_CATEGORY_IDS },
        brand: { type: "string", description: "One brand, e.g. Akrapovič, Remus, Eventuri, KW." },
        min_price: { type: "number", description: "In the customer's currency." },
        max_price: { type: "number", description: "In the customer's currency." },
        in_stock_only: { type: "boolean" },
        vehicle_type: { type: "string", enum: ["car", "motorcycle"] },
        sort: { type: "string", enum: ["relevance", "price_asc", "price_desc"] },
        limit: { type: "integer", description: "1–12, default 8." },
      },
    },
  },
  {
    name: "get_product_details",
    description:
      "Full facts for up to 4 products already returned by search_products (description, highlights, " +
      "variants, lead time). Use it before comparing products or answering a detailed question about one.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        refs: { type: "array", items: { type: "string" }, description: "Product refs like p3." },
      },
      required: ["refs"],
    },
  },
  {
    name: "show_products",
    description:
      "Show product cards to the customer under your answer. Call it in the same response as your final text. " +
      "Give every card a one-line reason in the customer's language (why it suits them: sound, power, material, " +
      "price, availability). Use layout `compare` with 2–4 products and `rows` (label + one value per product, " +
      "same order as items) when the customer asks to compare.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ref: { type: "string" },
              reason: { type: "string" },
            },
            required: ["ref"],
          },
        },
        layout: { type: "string", enum: ["cards", "compare"] },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              values: { type: "array", items: { type: "string" } },
            },
            required: ["label", "values"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "suggest_replies",
    description:
      "2–4 short quick-reply buttons (max ~40 characters each) the customer can tap next, written as the " +
      "customer would say them. Call it with your final text, especially when you ask a clarifying question.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        options: { type: "array", items: { type: "string" } },
      },
      required: ["options"],
    },
  },
] as const;

export type OneAiToolName = (typeof ONE_AI_TOOL_DECLARATIONS)[number]["name"];

export type OneAiToolSession = {
  context: OneAiContext;
  state: OneAiConversationState;
  emit: (event: OneAiEvent) => void;
  /** Refs shown as cards in this turn (saved to history for "compare the first two"). */
  shownRefs: string[];
  catalogHref: string | null;
};

async function runCatalogSearch(args: OneAiSearchArgs, context: OneAiContext) {
  const params = buildOneAiSearchParams(args, context);
  const response = await searchShopStock({
    url: `https://one-ai.internal/api/shop/stock/search?${params.toString()}`,
  });
  const payload = (await response.json()) as StockSearchResponse;
  return payload;
}

function describeSearchForStatus(args: OneAiSearchArgs, locale: OneAiContext["locale"]) {
  const vehicle = [args.make, args.model, args.chassis].filter(Boolean).join(" ");
  const what = [args.brand, args.query].filter(Boolean).join(" ");
  const parts = [what, vehicle].filter(Boolean).join(" · ");
  if (locale === "ua") return parts ? `Шукаю в каталозі: ${parts}` : "Шукаю в каталозі";
  return parts ? `Searching the catalog: ${parts}` : "Searching the catalog";
}

export async function executeOneAiSearch(rawArgs: unknown, session: OneAiToolSession) {
  const args = cleanOneAiSearchArgs(rawArgs);
  if (!hasOneAiSearchConstraint(args)) {
    return {
      error: "Give at least a vehicle, a product type, a brand, a budget or a part number.",
    };
  }
  session.emit({ type: "status", text: describeSearchForStatus(args, session.context.locale) });

  for (const attempt of buildOneAiSearchAttempts(args)) {
    const payload = await runCatalogSearch(attempt.args, session.context);
    const items = payload.data ?? [];
    if (!items.length) continue;
    const products = items.map((item) =>
      registerOneAiProduct(session.state, item.id, (ref) =>
        toOneAiProduct(item, ref, session.context.locale)
      )
    );
    const href = buildOneAiCatalogHref(attempt.args, session.context);
    session.catalogHref = href;
    session.state.lastCatalogHref = href;
    const facets = payload.filterStats;
    return {
      found: payload.meta?.totalItems ?? products.length,
      showing: products.length,
      relaxed: attempt.relaxed ?? undefined,
      corrected_query: payload.meta?.correctedQuery ?? undefined,
      products: products.map((product) => describeOneAiProductForModel(product, session.context)),
      brands_available: facets?.brands
        ?.slice(0, 12)
        .map((brand) => `${brand.label} (${brand.count})`),
      categories_available: facets?.categories
        ?.slice(0, 10)
        .map((category) => `${category.key ?? category.label} (${category.count})`),
    };
  }
  return {
    found: 0,
    products: [],
    note: "Nothing in the catalog for these filters, even after widening them.",
  };
}

function stripHtml(value: string | undefined | null, maxLength: number) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export async function executeOneAiProductDetails(rawArgs: unknown, session: OneAiToolSession) {
  const source = rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};
  const refs = (Array.isArray(source.refs) ? source.refs : [])
    .map((ref) => String(ref).trim())
    .filter((ref) => session.state.products[ref])
    .slice(0, 4);
  if (!refs.length) return { error: "Unknown refs. Use refs from search_products results." };
  session.emit({
    type: "status",
    text: session.context.locale === "ua" ? "Читаю характеристики" : "Reading the specifications",
  });
  const known = refs.map((ref) => session.state.products[ref]);
  const details = await getShopProductsBySlugsServer(known.map((product) => product.slug));
  const isUa = session.context.locale === "ua";
  return {
    products: known.map((product) => {
      const detail = details.find((item) => item.slug === product.slug);
      const pick = (text?: { ua?: string; en?: string } | null) =>
        (isUa ? text?.ua || text?.en : text?.en || text?.ua) ?? "";
      return {
        ...describeOneAiProductForModel(product, session.context),
        description: stripHtml(
          pick(detail?.longDescription) || pick(detail?.shortDescription),
          900
        ),
        highlights: (detail?.highlights ?? [])
          .map((highlight) => stripHtml(pick(highlight), 160))
          .filter(Boolean)
          .slice(0, 6),
        lead_time: stripHtml(pick(detail?.leadTime), 120) || undefined,
        variants: (detail?.variants ?? [])
          .map((variant) => stripHtml(variant.title ?? variant.optionValues?.join(" / "), 80))
          .filter(Boolean)
          .slice(0, 6),
      };
    }),
  };
}

export function executeOneAiShowProducts(rawArgs: unknown, session: OneAiToolSession) {
  const result = buildOneAiCards(rawArgs, session.state);
  if (!result.ok) return { error: result.error };
  // A second show_products call in the same answer adds only new cards; a
  // comparison always re-renders its full set.
  const cards =
    result.layout === "compare"
      ? result.cards
      : result.cards.filter((card) => !session.shownRefs.includes(card.ref));
  for (const card of cards) {
    if (!session.shownRefs.includes(card.ref)) session.shownRefs.push(card.ref);
  }
  if (cards.length) {
    session.emit({
      type: "products",
      layout: result.layout,
      products: cards,
      comparison: result.comparison,
    });
  }
  return { shown: result.cards.map((card) => card.ref) };
}

export function executeOneAiSuggestReplies(rawArgs: unknown, session: OneAiToolSession) {
  const options = cleanOneAiReplies(rawArgs);
  if (options.length) session.emit({ type: "replies", options });
  return { shown: options.length };
}

export async function executeOneAiTool(name: string, args: unknown, session: OneAiToolSession) {
  switch (name) {
    case "search_products":
      return executeOneAiSearch(args, session);
    case "get_product_details":
      return executeOneAiProductDetails(args, session);
    case "show_products":
      return executeOneAiShowProducts(args, session);
    case "suggest_replies":
      return executeOneAiSuggestReplies(args, session);
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** UI tools only render; a response that calls nothing else needs no further model call. */
export function isOneAiPresentationTool(name: string) {
  return name === "show_products" || name === "suggest_replies";
}
