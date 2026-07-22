import { NextRequest, NextResponse } from "next/server";

import { createGroundedShopAiAnswer, createShopAiPlan } from "@/lib/shopAiAssistantProvider";
import { resolveShopAiVehiclePlanFromKnowledge } from "@/lib/shopAiCanonicalVehicleResolver";
import { buildShopAiNoExactMatchMessage } from "@/lib/shopAiCatalogTools";
import { loadShopAiConversation, saveShopAiConversation } from "@/lib/shopAiConversationStore";
import {
  buildShopAiNoMoreOptionsMessage,
  inheritShopAiConversationContext,
} from "@/lib/shopAiAssistantConversation";
import { buildFallbackShopAiPlan, normalizeShopAiPlan } from "@/lib/shopAiAssistantPlanner";
import { buildShopAiCatalogQuery, diversifyShopAiProducts } from "@/lib/shopAiAssistantRanking";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { retrieveShopAiCandidatesFromLegacyCatalog } from "@/lib/shopAiLegacyDirectRepository";
import {
  buildShopAiPipelineHeaders,
  isShopAiEvalBoundaryEnabled,
  resolveShopAiEvalAccess,
  type ShopAiRetrievalMarker,
} from "@/lib/shopAiEvalBoundary";
import {
  buildShopAiOwnerSignature,
  redactShopAiContextValue,
  redactShopAiText,
} from "@/lib/shopAiPrivacy";
import { cleanShopAiProductKind } from "@/lib/shopAiProductKind";
import { validateGroundedShopAiOutput } from "@/lib/shopAiOutputValidator";
import { validateShopAiJsonRequest } from "@/lib/shopAiRequestBoundary";
import { rerankShopAiProductsSemantically } from "@/lib/shopAiSemanticRanking";
import {
  resolveCanonicalShopAiExactSku,
  retrieveShopAiCandidatesStrict,
} from "@/lib/shopAiStrictRepository";
import {
  completeShopAiRun,
  createShopAiRun,
  failShopAiRun,
  recordShopAiCandidateDecisions,
  recordShopAiNoResult,
} from "@/lib/shopAiTelemetry";
import {
  isShopAiV2CategoryEnabled,
  isShopAiV2ExactSkuBaselineEnabled,
  isShopAiV2RolloutCategory,
  isShopAiV2ShadowEnabled,
} from "@/lib/shopAiV2FeatureFlags";
import {
  decideShopAiRetrievalPath,
  decideShopAiVehicleResolutionPath,
  decideShopAiV2Pipeline,
} from "@/lib/shopAiV2PipelineDecision";
import { resolveShopAiVehiclePlan } from "@/lib/shopAiVehicleResolver";
import type {
  ShopAiAssistantResponse,
  ShopAiContext,
  ShopAiManagerContext,
  ShopAiProduct,
} from "@/lib/shopAiAssistantTypes";
import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";
import {
  filterShopStockItemsByVehicleScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import { prisma } from "@/lib/prisma";
import { readShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import { getShopProductsWithFitments } from "../search/route";

const MAX_MESSAGE_LENGTH = 800;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 100 * 1024;
const TURN_DEADLINE_MS = 6_000;

async function withinShopAiDeadline<T>(
  promise: Promise<T>,
  deadlineAt: number,
  fallback: T,
  onTimeout: () => void
) {
  const remainingMs = Math.max(0, deadlineAt - performance.now());
  if (remainingMs === 0) {
    onTimeout();
    return fallback;
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      onTimeout();
      resolve(fallback);
    }, remainingMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function jsonByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function boundShopAiResponse(response: ShopAiAssistantResponse): ShopAiAssistantResponse {
  if (jsonByteLength(response) <= MAX_RESPONSE_BYTES) return response;
  const compact = {
    ...response,
    products: response.products.slice(0, 6).map((product) => ({
      ...product,
      description: product.description.slice(0, 600),
      fitments: product.fitments?.slice(0, 3),
    })),
    followUps: response.followUps.slice(0, 3),
  };
  if (jsonByteLength(compact) <= MAX_RESPONSE_BYTES) return compact;
  return {
    ...compact,
    products: compact.products.slice(0, 3).map((product) => ({
      ...product,
      description: "",
      fitments: undefined,
    })),
  };
}

function cleanMessage(value: unknown, maxLength = MAX_MESSAGE_LENGTH) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanContext(value: unknown): ShopAiContext {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const filters =
    source.filters && typeof source.filters === "object"
      ? (source.filters as Record<string, unknown>)
      : {};
  const currency = String(source.currency ?? "EUR").toUpperCase();
  const rawYear = Number(filters.year ?? source.year);
  const productKind = cleanMessage(filters.productKind ?? source.productKind, 40);
  const normalizedProductKind = cleanShopAiProductKind(productKind);
  return {
    locale: source.locale === "en" ? "en" : "ua",
    currency: (["EUR", "USD", "UAH"] as string[]).includes(currency)
      ? (currency as ShopCurrencyCode)
      : "EUR",
    scope: source.scope === "moto" ? "moto" : source.scope === "auto" ? "auto" : undefined,
    country: redactShopAiContextValue(source.country, 80),
    query: redactShopAiContextValue(source.query, 300),
    category: redactShopAiContextValue(filters.category ?? source.category, 120),
    make: redactShopAiContextValue(filters.make ?? source.make, 80),
    model: redactShopAiContextValue(filters.model ?? source.model, 100),
    chassis: redactShopAiContextValue(filters.chassis ?? source.chassis, 60),
    year:
      Number.isInteger(rawYear) && rawYear >= 1900 && rawYear <= new Date().getFullYear() + 2
        ? rawYear
        : null,
    engine: redactShopAiContextValue(filters.engine ?? source.engine, 100),
    opfGpf:
      filters.opfGpf === "with" || filters.opfGpf === "without"
        ? filters.opfGpf
        : source.opfGpf === "with" || source.opfGpf === "without"
          ? source.opfGpf
          : null,
    productKind: normalizedProductKind ?? undefined,
    filters: {
      category: redactShopAiContextValue(filters.category, 120) || undefined,
      make: redactShopAiContextValue(filters.make, 80) || undefined,
      model: redactShopAiContextValue(filters.model, 100) || undefined,
      chassis: redactShopAiContextValue(filters.chassis, 60) || undefined,
      year:
        Number.isInteger(rawYear) && rawYear >= 1900 && rawYear <= new Date().getFullYear() + 2
          ? rawYear
          : null,
      engine: redactShopAiContextValue(filters.engine, 100) || undefined,
      opfGpf: filters.opfGpf === "with" || filters.opfGpf === "without" ? filters.opfGpf : null,
      productKind: normalizedProductKind ?? undefined,
    },
  };
}

function buildStorefrontSearchHref(
  context: ShopAiContext,
  plan: Awaited<ReturnType<typeof createShopAiPlan>>["plan"]
) {
  const params = new URLSearchParams();
  const query = buildShopAiCatalogQuery(plan);
  if (query) params.set("q", query);
  if (context.scope) params.set("scope", context.scope);
  if (plan.category) params.set("category", plan.category);
  if (plan.vehicle.make) params.set("make", plan.vehicle.make);
  if (plan.vehicle.model) params.set("model", plan.vehicle.model);
  if (plan.vehicle.chassis) params.set("chassis", plan.vehicle.chassis);
  if (plan.vehicle.year) params.set("year", String(plan.vehicle.year));
  if (plan.vehicle.engine) params.set("engine", plan.vehicle.engine);
  if (plan.opfGpf) params.set("opfGpf", plan.opfGpf);
  if (plan.productKind && plan.productKind !== "any") {
    params.set("productKind", plan.productKind);
  }
  params.set("strict", "1");
  if (plan.brand) params.set("brand", plan.brand);
  if (plan.stockOnly) params.set("stock", "inStock");
  if (plan.minPrice !== null) params.set("minPrice", String(plan.minPrice));
  if (plan.maxPrice !== null) params.set("maxPrice", String(plan.maxPrice));
  return `/${context.locale}/shop/catalog?${params.toString()}`;
}

function buildManagerContext(
  message: string,
  plan: Awaited<ReturnType<typeof createShopAiPlan>>["plan"],
  products: ShopAiProduct[],
  context: ShopAiContext
): ShopAiManagerContext {
  const vehicle = [plan.vehicle.make, plan.vehicle.model, plan.vehicle.chassis, plan.vehicle.year]
    .filter(Boolean)
    .join(" ");
  return {
    createdAt: Date.now(),
    vehicleType:
      context.scope ??
      (plan.vehicle.type === "motorcycle" ? "moto" : plan.vehicle.type === "car" ? "auto" : "auto"),
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
    ? ["Моє авто з OPF/GPF", "Моє авто без OPF/GPF", "Не знаю — перевірити OPF/GPF за VIN"]
    : [
        "My vehicle has OPF/GPF",
        "My vehicle has no OPF/GPF",
        "I am not sure — verify OPF/GPF from VIN",
      ];
}

function requestsVinVerification(message: string) {
  return (
    /\b(?:vin|він)\b/iu.test(message) && /\b(?:не\s+знаю|not\s+sure|verify|перевір)/iu.test(message)
  );
}

export async function POST(request: NextRequest) {
  const requestBoundary = validateShopAiJsonRequest(request.headers, request.nextUrl.toString());
  if (!requestBoundary.ok) {
    return NextResponse.json(
      { error: requestBoundary.error },
      { status: requestBoundary.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const turnStartedAt = performance.now();
  const turnCpuStartedAt = process.cpuUsage();
  const activeCpuMs = () => {
    const usage = process.cpuUsage(turnCpuStartedAt);
    return Math.round((usage.user + usage.system) / 1_000);
  };
  const turnDeadlineAt = turnStartedAt + TURN_DEADLINE_MS;
  let turnTimedOut = false;
  const markTurnTimedOut = () => {
    turnTimedOut = true;
  };
  let telemetryRunId: string | null = null;
  const evalBoundaryEnabled = isShopAiEvalBoundaryEnabled();
  const evalAccess = resolveShopAiEvalAccess(
    request.headers,
    evalBoundaryEnabled ? process.env.SHOP_AI_EVAL_TOKEN : null
  );
  if (evalAccess.attempted && !evalAccess.authorized) {
    return NextResponse.json(
      { error: "Unauthorized evaluation request" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  const ip = getRequestIp(request.headers);
  const customerSession = await getCurrentShopCustomerSession();
  const ownerKey = buildShopAiOwnerSignature({
    customerId: customerSession?.customerId,
    ip,
  });
  const allowed =
    evalAccess.requireV2 ||
    (await consumeRateLimit({
      keyParts: ["stock-ai", ownerKey],
      windowMs: 5 * 60 * 1000,
      maxPerWindow: 20,
    }));
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const evalCatalogState = evalAccess.authorized
      ? await readShopKnowledgeCatalogState(prisma)
      : null;
    const evalCatalogFingerprint = evalCatalogState?.fingerprint ?? null;
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }
    const rawMessage = cleanMessage(body.message);
    if (!rawMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    const message = redactShopAiText(rawMessage, MAX_MESSAGE_LENGTH).text;
    const context = cleanContext(body.context);
    const requestedConversationId = cleanMessage(body.conversationId, 100) || null;
    const storedConversation = await loadShopAiConversation(requestedConversationId, ownerKey);
    const conversationIdForSave = storedConversation ? requestedConversationId : null;
    const history = storedConversation?.history ?? [];
    const previousPlan = storedConversation?.previousPlan
      ? normalizeShopAiPlan(storedConversation.previousPlan, "", context)
      : null;
    const planningContext = cleanContext(
      inheritShopAiConversationContext(context, previousPlan, message)
    );
    const excludedProductIds = storedConversation?.shownProductIds ?? [];
    const fallbackPlan = buildFallbackShopAiPlan(message, planningContext);
    const initialPlan = await withinShopAiDeadline(
      createShopAiPlan({
        message,
        history,
        context: planningContext,
      }),
      turnDeadlineAt,
      { plan: fallbackPlan, degraded: true, usedProvider: false },
      markTurnTimedOut
    );
    let resolvedPlan = initialPlan.plan;
    const hasVehicleInput = Boolean(
      resolvedPlan.vehicle.make ||
        resolvedPlan.vehicle.model ||
        resolvedPlan.vehicle.chassis ||
        resolvedPlan.vehicle.year ||
        resolvedPlan.vehicle.engine ||
        resolvedPlan.vehicle.fuel ||
        resolvedPlan.vehicle.bodyStyle ||
        resolvedPlan.vehicle.drivetrain ||
        resolvedPlan.vehicle.transmission ||
        resolvedPlan.vehicle.market
    );
    const categoryCanUseV2 = isShopAiV2RolloutCategory(resolvedPlan.category);
    const shouldResolveExactSkuBaseline =
      !hasVehicleInput &&
      (isShopAiV2ExactSkuBaselineEnabled() || (evalAccess.requireV2 && !categoryCanUseV2));
    const exactSkuResolution = shouldResolveExactSkuBaseline
      ? await withinShopAiDeadline(
          resolveCanonicalShopAiExactSku(message),
          turnDeadlineAt,
          { available: false, matched: false },
          markTurnTimedOut
        )
      : { available: true, matched: false };
    const exactSkuBaseline = exactSkuResolution.available && exactSkuResolution.matched;
    if (exactSkuBaseline) {
      resolvedPlan = {
        ...resolvedPlan,
        needsClarification: false,
        clarification: null,
        requiredDetails: [],
      };
    }
    const pipelineDecision = decideShopAiV2Pipeline({
      evalRequiresV2: evalAccess.requireV2,
      categorySupported: categoryCanUseV2,
      categoryRolloutEnabled: isShopAiV2CategoryEnabled(resolvedPlan.category, ownerKey),
      exactSkuMatched: exactSkuBaseline,
    });
    if (pipelineDecision.evalRejected) {
      return NextResponse.json(
        { error: "V2 evaluation requires a supported planned category" },
        {
          status: 409,
          headers: buildShopAiPipelineHeaders({
            pipeline: "legacy",
            retrieval: "not-run",
            evalAuthenticated: true,
            commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
            catalogFingerprint: evalCatalogFingerprint,
          }),
        }
      );
    }
    const serveV2 = pipelineDecision.serveV2;
    let vehicleResolutionDegraded = false;
    if (serveV2 && hasVehicleInput) {
      const canonicalResolution = await withinShopAiDeadline(
        resolveShopAiVehiclePlanFromKnowledge(resolvedPlan, planningContext),
        turnDeadlineAt,
        { available: false, plan: resolvedPlan },
        markTurnTimedOut
      );
      resolvedPlan = canonicalResolution.plan;
      vehicleResolutionDegraded =
        decideShopAiVehicleResolutionPath({
          serveV2: true,
          hasVehicleInput,
          canonicalAvailable: canonicalResolution.available,
        }) === "v2-unavailable";
    }
    if (
      decideShopAiVehicleResolutionPath({
        serveV2,
        hasVehicleInput,
        canonicalAvailable: true,
      }) === "legacy"
    ) {
      const legacyProducts = await withinShopAiDeadline(
        getShopProductsWithFitments(),
        turnDeadlineAt,
        [],
        markTurnTimedOut
      );
      const catalog = filterShopStockItemsByVehicleScope(
        legacyProducts,
        parseShopStockVehicleScope(planningContext.scope)
      ).flatMap((item) =>
        item.fitments.map((fitment) => ({
          titleText: item.titleText,
          fitment,
        }))
      );
      resolvedPlan = resolveShopAiVehiclePlan(resolvedPlan, planningContext, catalog);
    }
    const planned = { ...initialPlan, plan: resolvedPlan };
    const shadowModeForTurn =
      isShopAiV2ShadowEnabled() && !serveV2 && isShopAiV2RolloutCategory(planned.plan.category);
    const runResult = await withinShopAiDeadline(
      createShopAiRun({
        conversationId: storedConversation?.id ?? null,
        ownerKeyHash: ownerKey,
        locale: planningContext.locale,
        currency: planningContext.currency,
        scope: planningContext.scope ?? null,
        message,
        normalizedQuery: buildShopAiCatalogQuery(planned.plan),
        constraints: planned.plan,
        traceSampled: shadowModeForTurn ? true : undefined,
      }),
      turnDeadlineAt,
      {
        persisted: false,
        value: null as { runId: string; traceSampled: boolean } | null,
      },
      markTurnTimedOut
    );
    telemetryRunId = runResult.value?.runId ?? null;
    const telemetryTraceSampled = runResult.value?.traceSampled ?? false;

    if (planned.plan.needsClarification) {
      const vinVerificationRequested = requestsVinVerification(rawMessage);
      const clarificationMessage =
        (vinVerificationRequested && planned.plan.requiredDetails?.includes("opfGpf")
          ? context.locale === "ua"
            ? "Щоб точно визначити OPF/GPF і не запропонувати несумісну систему, передайте VIN менеджеру. До перевірки я не показуватиму випадкові товари."
            : "To identify OPF/GPF accurately and avoid an incompatible system, send the VIN to a manager. I will not show unverified products before that check."
          : planned.plan.clarification) ||
        (context.locale === "ua"
          ? "Уточніть, будь ласка, марку, модель і рік."
          : "Please specify the make, model and year.");
      const response: ShopAiAssistantResponse = {
        mode: "clarification",
        answer: clarificationMessage,
        counts: { exact: 0, requiresVerification: 0 },
        message: clarificationMessage,
        products: [],
        totalItems: 0,
        plan: planned.plan,
        followUps: vinVerificationRequested
          ? []
          : buildRequiredDetailFollowUps(context.locale, planned.plan),
        searchHref: null,
        catalogHref: null,
        managerHref: `/${context.locale}/contact?source=one-ai`,
        managerContext: buildManagerContext(message, planned.plan, [], planningContext),
        degraded: planned.degraded || vehicleResolutionDegraded || turnTimedOut,
      };
      const nextConversationId = conversationIdForSave ?? crypto.randomUUID();
      const conversation = await withinShopAiDeadline(
        saveShopAiConversation({
          id: nextConversationId,
          locale: context.locale,
          currency: context.currency,
          previousPlan: planned.plan,
          history: [
            ...history,
            { role: "user", text: message },
            { role: "assistant", text: clarificationMessage },
          ],
          shownProductIds: excludedProductIds,
          ownerKey,
        }),
        turnDeadlineAt,
        { id: nextConversationId } as Awaited<ReturnType<typeof saveShopAiConversation>>,
        markTurnTimedOut
      );
      response.conversationId = conversation.id;
      if (turnTimedOut) response.degraded = true;
      response.runId = telemetryRunId ?? undefined;
      if (telemetryRunId) {
        await withinShopAiDeadline(
          completeShopAiRun({
            runId: telemetryRunId,
            mode: "clarification",
            response: {
              conversationId: conversation.id,
              mode: response.mode,
              counts: response.counts,
              followUps: response.followUps,
            },
            exactCount: 0,
            verificationCount: 0,
            candidateCount: 0,
            acceptedCount: 0,
            generationCalls: planned.usedProvider ? 1 : 0,
            embeddingCalls: 0,
            totalLatencyMs: Math.round(performance.now() - turnStartedAt),
            activeCpuMs: activeCpuMs(),
            degraded: Boolean(response.degraded),
          }),
          turnDeadlineAt,
          { persisted: false, value: null },
          markTurnTimedOut
        );
      }
      if (turnTimedOut) response.degraded = true;
      return NextResponse.json(boundShopAiResponse(response), {
        headers: buildShopAiPipelineHeaders({
          pipeline: serveV2 ? "v2" : "legacy",
          retrieval: "not-run",
          evalAuthenticated: evalAccess.authorized,
          commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
          catalogFingerprint: evalCatalogFingerprint,
          evalMetrics: {
            activeCpuMs: activeCpuMs(),
            retrievalLatencyMs: 0,
            generationCalls: planned.usedProvider ? 1 : 0,
            embeddingCalls: 0,
          },
        }),
      });
    }

    const retrievalStartedAt = performance.now();
    let candidateProducts: ShopAiProduct[];
    let candidateCount = 0;
    let retrievalDegraded = false;
    let retrievalMarker: ShopAiRetrievalMarker = "not-run";
    let shadowResult: Awaited<ReturnType<typeof retrieveShopAiCandidatesStrict>> | null = null;
    const strictEnabled = serveV2;
    if (strictEnabled) {
      const strict = await withinShopAiDeadline(
        retrieveShopAiCandidatesStrict({
          plan: planned.plan,
          message,
          context: planningContext,
          excludedProductIds,
          exactSkuOnly: exactSkuBaseline,
        }),
        turnDeadlineAt,
        {
          available: false,
          catalogFingerprint: null,
          products: [],
          exactCount: 0,
          requiresVerificationCount: 0,
          candidateCount: 0,
          retrievalLatencyMs: 0,
        },
        markTurnTimedOut
      );
      const strictRetrievalPath = decideShopAiRetrievalPath({
        serveV2: true,
        strictAvailable: strict.available,
      });
      if (strictRetrievalPath === "strict") {
        retrievalMarker = strictRetrievalPath;
        candidateProducts = strict.products;
        candidateCount = strict.candidateCount;
      } else {
        retrievalMarker = strictRetrievalPath;
        candidateProducts = [];
        candidateCount = 0;
        retrievalDegraded = true;
      }
    } else {
      retrievalMarker = "legacy";
      const legacy = await withinShopAiDeadline(
        retrieveShopAiCandidatesFromLegacyCatalog({
          plan: planned.plan,
          message,
          context: planningContext,
          excludedProductIds,
        }),
        turnDeadlineAt,
        {
          products: [],
          exactCount: 0,
          requiresVerificationCount: 0,
          rejected: {
            alreadyShown: 0,
            incompatibleVehicle: 0,
            missingRequestedEvidence: 0,
          },
        },
        markTurnTimedOut
      );
      candidateProducts = legacy.products;
      candidateCount = legacy.exactCount + legacy.requiresVerificationCount;
      if (shadowModeForTurn) {
        shadowResult = await withinShopAiDeadline(
          retrieveShopAiCandidatesStrict({
            plan: planned.plan,
            message,
            context: planningContext,
            excludedProductIds,
          }).catch((error) => {
            console.warn("Shop AI V2 shadow retrieval failed", error);
            return {
              available: false,
              catalogFingerprint: null,
              products: [],
              exactCount: 0,
              requiresVerificationCount: 0,
              candidateCount: 0,
              retrievalLatencyMs: 0,
            };
          }),
          turnDeadlineAt,
          {
            available: false,
            catalogFingerprint: null,
            products: [],
            exactCount: 0,
            requiresVerificationCount: 0,
            candidateCount: 0,
            retrievalLatencyMs: 0,
          },
          markTurnTimedOut
        );
      }
    }
    const retrievalLatencyMs = Math.round(performance.now() - retrievalStartedAt);
    if (planned.plan.brandOnly && planned.plan.brand) {
      const requestedBrand = planned.plan.brand.trim().toLocaleLowerCase("en-US");
      candidateProducts = candidateProducts.filter(
        (product) => product.brand.trim().toLocaleLowerCase("en-US") === requestedBrand
      );
    }
    if (planned.plan.stockOnly) {
      candidateProducts = candidateProducts.filter((product) => product.inStock);
    }
    const exactCount = candidateProducts.filter(
      (product) => product.matchStatus === "exact"
    ).length;
    const requiresVerificationCount = candidateProducts.filter(
      (product) => product.matchStatus === "requires_verification"
    ).length;

    const semanticResult = await withinShopAiDeadline(
      rerankShopAiProductsSemantically({
        products: candidateProducts,
        message,
        plan: planned.plan,
      }),
      turnDeadlineAt,
      { products: candidateProducts, usedEmbedding: false },
      markTurnTimedOut
    );
    const diversifiedProducts = diversifyShopAiProducts(
      semanticResult.products,
      message,
      planned.plan
    );
    const rankedProducts = [
      ...diversifiedProducts.filter((product) => product.matchStatus === "exact"),
      ...diversifiedProducts.filter((product) => product.matchStatus !== "exact"),
    ];
    const products = rankedProducts.slice(0, 6);
    const displayedExactCount = products.filter(
      (product) => product.matchStatus === "exact"
    ).length;
    const totalItems = Math.max(candidateCount, products.length);
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
    const verificationOnlyMessage =
      products.length && displayedExactCount === 0 && requiresVerificationCount > 0
        ? planningContext.locale === "ua"
          ? "Усі знайдені товари відповідають категорії та не мають відомих суперечностей, але їхню сумісність потрібно перевірити з менеджером."
          : "All returned products match the requested category and have no known contradiction, but a manager must verify their fitment."
        : null;
    const hasDisplayedVerification = products.some(
      (product) => product.matchStatus === "requires_verification"
    );
    const mixedVerificationMessage =
      displayedExactCount > 0 && hasDisplayedVerification
        ? planningContext.locale === "ua"
          ? "Знайшов кілька варіантів. Статус сумісності вказано окремо в кожній картці; товари з позначкою перевірки потрібно підтвердити з менеджером."
          : "I found several options. Each card shows its own fitment status; products marked for verification must be confirmed by a manager."
        : null;
    const proposedResponseMessage =
      noMoreOptionsMessage ??
      verificationOnlyMessage ??
      mixedVerificationMessage ??
      (products.length
        ? answer.message
        : buildShopAiNoExactMatchMessage(planningContext.locale, planned.plan));
    const responseMessage = validateGroundedShopAiOutput(proposedResponseMessage, products, {
      currency: planningContext.currency,
    })
      ? proposedResponseMessage
      : planningContext.locale === "ua"
        ? "Знайшов товари за вашим запитом. Перевірте окремий статус сумісності в кожній картці."
        : "I found products for your request. Review the individual fitment status on each card.";
    const catalogHref =
      totalItems > 0 ? buildStorefrontSearchHref(planningContext, planned.plan) : null;

    const response: ShopAiAssistantResponse = {
      mode: products.length ? "results" : "no_match",
      answer: responseMessage,
      counts: { exact: exactCount, requiresVerification: requiresVerificationCount },
      message: responseMessage,
      products,
      totalItems,
      plan: planned.plan,
      followUps: Array.from(
        new Set([
          ...buildRequiredDetailFollowUps(planningContext.locale, planned.plan),
          ...answer.followUps,
        ])
      ).slice(0, 3),
      searchHref: catalogHref,
      catalogHref,
      managerHref: `/${planningContext.locale}/contact?source=one-ai`,
      managerContext: buildManagerContext(message, planned.plan, products, planningContext),
      degraded:
        planned.degraded ||
        answer.degraded ||
        vehicleResolutionDegraded ||
        retrievalDegraded ||
        turnTimedOut,
    };
    const nextConversationId = conversationIdForSave ?? crypto.randomUUID();
    const conversation = await withinShopAiDeadline(
      saveShopAiConversation({
        id: nextConversationId,
        locale: context.locale,
        currency: context.currency,
        previousPlan: planned.plan,
        history: [
          ...history,
          { role: "user", text: message },
          { role: "assistant", text: responseMessage },
        ],
        shownProductIds: [...excludedProductIds, ...products.map((product) => product.id)],
        ownerKey,
      }),
      turnDeadlineAt,
      { id: nextConversationId } as Awaited<ReturnType<typeof saveShopAiConversation>>,
      markTurnTimedOut
    );
    response.conversationId = conversation.id;
    if (turnTimedOut) response.degraded = true;
    response.runId = telemetryRunId ?? undefined;
    if (telemetryRunId) {
      if (telemetryTraceSampled) {
        await withinShopAiDeadline(
          recordShopAiCandidateDecisions(telemetryRunId, [
            ...rankedProducts.map((product, index) => ({
              productId: product.id,
              variantId: product.variantId,
              vehicleApplicationId: product.matchedApplicationId,
              productSnapshot: {
                brand: product.brand,
                sku: product.partNumber,
                name: product.name,
                matchReason: product.matchReason,
                source: "served",
              },
              matchStatus: product.matchStatus ?? "requires_verification",
              rank: index + 1,
              reasonCodes: product.matchReason ? [product.matchReason] : [],
              missingFacts: product.missingFacts,
              shown: index < products.length,
            })),
            ...(shadowResult?.products ?? []).map((product, index) => ({
              productId: product.id,
              variantId: product.variantId,
              vehicleApplicationId: product.matchedApplicationId,
              productSnapshot: {
                brand: product.brand,
                sku: product.partNumber,
                name: product.name,
                matchReason: product.matchReason,
                source: "shadow_v2",
              },
              matchStatus: product.matchStatus ?? "requires_verification",
              rank: index + 1,
              reasonCodes: ["shadow_v2", ...(product.matchReason ? [product.matchReason] : [])],
              missingFacts: product.missingFacts,
              shown: false,
            })),
          ]),
          turnDeadlineAt,
          { persisted: false, value: null },
          markTurnTimedOut
        );
      }
      await withinShopAiDeadline(
        completeShopAiRun({
          runId: telemetryRunId,
          mode: products.length ? "results" : "no_match",
          response: {
            conversationId: conversation.id,
            mode: response.mode,
            counts: response.counts,
            productIds: products.map((product) => product.id),
            products: products.map((product) => ({
              productId: product.id,
              variantId: product.variantId,
              vehicleApplicationId: product.matchedApplicationId,
              matchStatus: product.matchStatus ?? "requires_verification",
              missingFacts: product.missingFacts,
            })),
            shadow: shadowResult
              ? {
                  available: shadowResult.available,
                  exactCount: shadowResult.exactCount,
                  requiresVerificationCount: shadowResult.requiresVerificationCount,
                  candidateCount: shadowResult.candidateCount,
                  productIds: shadowResult.products.map((product) => product.id),
                }
              : null,
            catalogHref,
          },
          exactCount,
          verificationCount: requiresVerificationCount,
          candidateCount,
          acceptedCount: products.length,
          generationCalls: planned.usedProvider || answer.usedProvider ? 1 : 0,
          embeddingCalls: semanticResult.usedEmbedding ? 1 : 0,
          retrievalLatencyMs,
          totalLatencyMs: Math.round(performance.now() - turnStartedAt),
          activeCpuMs: activeCpuMs(),
          degraded: Boolean(response.degraded),
        }),
        turnDeadlineAt,
        { persisted: false, value: null },
        markTurnTimedOut
      );
      if (!products.length) {
        await withinShopAiDeadline(
          recordShopAiNoResult({
            runId: telemetryRunId,
            conversationId: conversation.id,
            ownerKeyHash: ownerKey,
            locale: planningContext.locale,
          }),
          turnDeadlineAt,
          { persisted: false, value: null },
          markTurnTimedOut
        );
      }
    }
    if (turnTimedOut) response.degraded = true;
    return NextResponse.json(boundShopAiResponse(response), {
      headers: buildShopAiPipelineHeaders({
        pipeline: serveV2 ? "v2" : "legacy",
        retrieval: retrievalMarker,
        evalAuthenticated: evalAccess.authorized,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
        catalogFingerprint: evalCatalogFingerprint,
        evalMetrics: {
          activeCpuMs: activeCpuMs(),
          retrievalLatencyMs,
          generationCalls: planned.usedProvider || answer.usedProvider ? 1 : 0,
          embeddingCalls: semanticResult.usedEmbedding ? 1 : 0,
        },
      }),
    });
  } catch (error) {
    if (telemetryRunId) {
      await failShopAiRun({
        runId: telemetryRunId,
        errorCode: "ASSISTANT_TURN_FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        totalLatencyMs: Math.round(performance.now() - turnStartedAt),
        activeCpuMs: activeCpuMs(),
      });
    }
    console.error("Stock AI assistant failed", error);
    return NextResponse.json({ error: "AI assistant is temporarily unavailable" }, { status: 500 });
  }
}

export const runtime = "nodejs";
