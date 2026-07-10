import { NextRequest, NextResponse } from "next/server";

import { createGroundedShopAiAnswer, createShopAiPlan } from "@/lib/shopAiAssistantProvider";
import {
  buildShopAiNoExactMatchMessage,
  runShopAiCandidatePipeline,
} from "@/lib/shopAiCatalogTools";
import { loadShopAiConversation, saveShopAiConversation } from "@/lib/shopAiConversationStore";
import {
  buildShopAiNoMoreOptionsMessage,
  inheritShopAiConversationContext,
} from "@/lib/shopAiAssistantConversation";
import { normalizeShopAiPlan } from "@/lib/shopAiAssistantPlanner";
import { buildShopAiCatalogQuery, diversifyShopAiProducts } from "@/lib/shopAiAssistantRanking";
import { rerankShopAiProductsSemantically } from "@/lib/shopAiSemanticRanking";
import type {
  ShopAiAssistantResponse,
  ShopAiContext,
  ShopAiHistoryMessage,
  ShopAiManagerContext,
  ShopAiProduct,
} from "@/lib/shopAiAssistantTypes";
import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";

const MAX_MESSAGE_LENGTH = 800;
const MAX_HISTORY_MESSAGES = 10;

function cleanMessage(value: unknown, maxLength = MAX_MESSAGE_LENGTH) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanHistory(value: unknown): ShopAiHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY_MESSAGES).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const role = source.role === "assistant" ? "assistant" : "user";
    const text = cleanMessage(source.text, 600);
    return text ? [{ role, text }] : [];
  });
}

function cleanContext(value: unknown): ShopAiContext {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const currency = String(source.currency ?? "EUR").toUpperCase();
  return {
    locale: source.locale === "en" ? "en" : "ua",
    currency: (["EUR", "USD", "UAH"] as string[]).includes(currency)
      ? (currency as ShopCurrencyCode)
      : "EUR",
    country: cleanMessage(source.country, 80),
    query: cleanMessage(source.query, 300),
    category: cleanMessage(source.category, 120),
    make: cleanMessage(source.make, 80),
    model: cleanMessage(source.model, 100),
    chassis: cleanMessage(source.chassis, 60),
    opfGpf: source.opfGpf === "with" || source.opfGpf === "without" ? source.opfGpf : null,
  };
}

function cleanExcludedProductIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanMessage(item, 100))
    .filter(Boolean)
    .slice(0, 30);
}

function buildSearchUrl(
  request: NextRequest,
  context: ShopAiContext,
  plan: Awaited<ReturnType<typeof createShopAiPlan>>["plan"]
) {
  const url = new URL("/api/shop/stock/search", request.nextUrl.origin);
  url.searchParams.set("locale", context.locale);
  url.searchParams.set("currency", context.currency);
  url.searchParams.set("limit", "48");
  url.searchParams.set("includeFitment", "true");
  url.searchParams.set("page", "1");
  url.searchParams.set("q", buildShopAiCatalogQuery(plan));
  if (plan.category) url.searchParams.set("category", plan.category);
  if (plan.vehicle.make) url.searchParams.set("make", plan.vehicle.make);
  if (plan.vehicle.model) url.searchParams.set("model", plan.vehicle.model);
  if (plan.vehicle.chassis) url.searchParams.set("chassis", plan.vehicle.chassis);
  if (plan.minPrice !== null) url.searchParams.set("minPrice", String(plan.minPrice));
  if (plan.maxPrice !== null) url.searchParams.set("maxPrice", String(plan.maxPrice));
  if (context.country) url.searchParams.set("country", context.country);
  return url;
}

function buildStorefrontSearchHref(context: ShopAiContext, searchUrl: URL) {
  const params = new URLSearchParams(searchUrl.searchParams);
  params.delete("locale");
  params.delete("limit");
  params.delete("includeFitment");
  return `/${context.locale}/shop/stock?${params.toString()}`;
}

function buildManagerContext(
  message: string,
  plan: Awaited<ReturnType<typeof createShopAiPlan>>["plan"],
  products: ShopAiProduct[]
): ShopAiManagerContext {
  const vehicle = [plan.vehicle.make, plan.vehicle.model, plan.vehicle.chassis, plan.vehicle.year]
    .filter(Boolean)
    .join(" ");
  return {
    createdAt: Date.now(),
    vehicleType: plan.vehicle.type === "motorcycle" ? "moto" : "auto",
    vehicle,
    request: message.slice(0, 800),
    products: products.slice(0, 3).map((product) => ({
      brand: product.brand,
      sku: product.partNumber,
      name: product.name,
    })),
  };
}

function buildRequiredDetailFollowUps(locale: "ua" | "en", plan: ShopAiAssistantResponse["plan"]) {
  if (!plan.requiredDetails?.includes("opfGpf")) return [];
  return locale === "ua"
    ? ["Моє авто з OPF/GPF", "Моє авто без OPF/GPF"]
    : ["My vehicle has OPF/GPF", "My vehicle has no OPF/GPF"];
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request.headers);
  const allowed = await consumeRateLimit({
    keyParts: ["stock-ai", ip],
    windowMs: 5 * 60 * 1000,
    maxPerWindow: 20,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const message = cleanMessage(body.message);
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    const context = cleanContext(body.context);
    const history = cleanHistory(body.history);
    const requestedConversationId = cleanMessage(body.conversationId, 100) || null;
    const storedConversation = await loadShopAiConversation(requestedConversationId);
    const previousPlan =
      body.previousPlan && typeof body.previousPlan === "object"
        ? normalizeShopAiPlan(body.previousPlan, "", context)
        : storedConversation?.previousPlan
          ? normalizeShopAiPlan(storedConversation.previousPlan, "", context)
          : null;
    const planningContext = inheritShopAiConversationContext(context, previousPlan, message);
    const excludedProductIds = Array.from(
      new Set([
        ...cleanExcludedProductIds(body.excludedProductIds),
        ...(storedConversation?.shownProductIds ?? []),
      ])
    ).slice(-100);
    const planned = await createShopAiPlan({ message, history, context: planningContext });

    if (planned.plan.needsClarification) {
      const conversation = await saveShopAiConversation({
        id: requestedConversationId,
        locale: context.locale,
        currency: context.currency,
        previousPlan: planned.plan,
        shownProductIds: excludedProductIds,
      });
      const response: ShopAiAssistantResponse = {
        conversationId: conversation.id,
        message:
          planned.plan.clarification ||
          (context.locale === "ua"
            ? "Уточніть, будь ласка, марку, модель і рік."
            : "Please specify the make, model and year."),
        products: [],
        totalItems: 0,
        plan: planned.plan,
        followUps: [],
        searchHref: null,
        managerHref: `/${context.locale}/contact?source=one-ai`,
        managerContext: buildManagerContext(message, planned.plan, []),
        degraded: planned.degraded,
      };
      return NextResponse.json(response);
    }

    const searchUrl = buildSearchUrl(request, planningContext, planned.plan);
    const searchResponse = await fetch(searchUrl, {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!searchResponse.ok) {
      throw new Error(`Catalog search failed with ${searchResponse.status}`);
    }
    const searchData = (await searchResponse.json()) as {
      data?: ShopAiProduct[];
      meta?: { totalItems?: number };
    };
    const candidateResult = runShopAiCandidatePipeline({
      products: searchData.data ?? [],
      plan: planned.plan,
      message,
      excludedProductIds,
      limit: 6,
    });
    const semanticProducts = await rerankShopAiProductsSemantically({
      products: candidateResult.eligibleProducts,
      message,
      plan: planned.plan,
    });
    const products = diversifyShopAiProducts(semanticProducts, message).slice(0, 6);
    const totalItems =
      planned.plan.vehicle.chassis || planned.plan.powerGainHp
        ? candidateResult.goalMatchedCount
        : Math.max(0, Number(searchData.meta?.totalItems) || 0);
    const answer = await createGroundedShopAiAnswer({
      message,
      history,
      context: planningContext,
      plan: planned.plan,
      products,
      totalItems,
    });
    const noMoreOptionsMessage = buildShopAiNoMoreOptionsMessage(
      planningContext.locale,
      planned.plan,
      message,
      excludedProductIds,
      products
    );

    const response: ShopAiAssistantResponse = {
      message:
        noMoreOptionsMessage ??
        (products.length
          ? answer.message
          : buildShopAiNoExactMatchMessage(planningContext.locale, planned.plan)),
      products,
      totalItems,
      plan: planned.plan,
      followUps: Array.from(
        new Set([
          ...buildRequiredDetailFollowUps(planningContext.locale, planned.plan),
          ...answer.followUps,
        ])
      ).slice(0, 3),
      searchHref: products.length ? buildStorefrontSearchHref(planningContext, searchUrl) : null,
      managerHref: `/${planningContext.locale}/contact?source=one-ai`,
      managerContext: buildManagerContext(message, planned.plan, products),
      degraded: planned.degraded || answer.degraded,
    };
    const conversation = await saveShopAiConversation({
      id: requestedConversationId,
      locale: context.locale,
      currency: context.currency,
      previousPlan: planned.plan,
      shownProductIds: [...excludedProductIds, ...products.map((product) => product.id)],
    });
    response.conversationId = conversation.id;
    return NextResponse.json(response);
  } catch (error) {
    console.error("Stock AI assistant failed", error);
    return NextResponse.json({ error: "AI assistant is temporarily unavailable" }, { status: 500 });
  }
}

export const runtime = "nodejs";
