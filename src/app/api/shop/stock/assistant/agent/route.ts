import { NextRequest, NextResponse } from "next/server";

import {
  loadOneAiConversation,
  saveOneAiConversation,
  createOneAiConversationState,
} from "@/lib/shopAiAgent/conversationStore";
import { isOneAiAgentEnabled } from "@/lib/shopAiAgent/featureFlag";
import { OneAiConfigurationError, runOneAiTurn } from "@/lib/shopAiAgent/runTurn";
import type { OneAiContext, OneAiEvent } from "@/lib/shopAiAgent/types";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import {
  buildShopAiOwnerSignature,
  redactShopAiContextValue,
  redactShopAiText,
} from "@/lib/shopAiPrivacy";
import { validateShopAiJsonRequest } from "@/lib/shopAiRequestBoundary";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 800;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const DEFAULT_DAILY_LIMIT = 2_000;

function resolveOneAiDailyLimit() {
  const value = Number(process.env.SHOP_AI_AGENT_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

function cleanContext(value: unknown): OneAiContext {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const filters =
    source.filters && typeof source.filters === "object"
      ? (source.filters as Record<string, unknown>)
      : {};
  const pick = (key: string, maxLength: number) =>
    redactShopAiContextValue(filters[key] ?? source[key], maxLength) || undefined;
  const currency = String(source.currency ?? "EUR").toUpperCase();
  const year = Number(filters.year ?? source.year);
  return {
    locale: source.locale === "en" ? "en" : "ua",
    currency: currency === "USD" || currency === "UAH" ? currency : "EUR",
    scope: source.scope === "moto" ? "moto" : source.scope === "auto" ? "auto" : undefined,
    country: redactShopAiContextValue(source.country, 80) || undefined,
    vehicle: {
      make: pick("make", 60),
      model: pick("model", 80),
      chassis: pick("chassis", 40),
      year:
        Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 2
          ? year
          : null,
      engine: pick("engine", 60),
    },
    category: pick("category", 60),
  };
}

function encodeEvent(event: OneAiEvent) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: NextRequest) {
  if (!isOneAiAgentEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const boundary = validateShopAiJsonRequest(request.headers, request.nextUrl.toString());
  if (!boundary.ok) {
    return NextResponse.json(
      { error: boundary.error },
      { status: boundary.status, headers: { "Cache-Control": "no-store" } }
    );
  }
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
  const rawMessage = String(body.message ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
  if (!rawMessage) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  const message = redactShopAiText(rawMessage, MAX_MESSAGE_LENGTH).text;
  const context = cleanContext(body.context);

  const customerSession = await getCurrentShopCustomerSession();
  const ownerKey = buildShopAiOwnerSignature({
    customerId: customerSession?.customerId,
    ip: getRequestIp(request.headers),
  });
  const allowed = await consumeRateLimit({
    keyParts: ["one-ai-agent", ownerKey],
    windowMs: 10 * 60 * 1000,
    maxPerWindow: 30,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  // A shop-wide daily ceiling keeps the Gemini bill bounded even under abuse
  // (gemini-3.5-flash-lite costs about $0.004 per answer, so 2,000 answers ≈ $8 a day).
  const withinDailyBudget = await consumeRateLimit({
    keyParts: ["one-ai-agent-daily"],
    windowMs: 24 * 60 * 60 * 1000,
    maxPerWindow: resolveOneAiDailyLimit(),
  });
  if (!withinDailyBudget) {
    return NextResponse.json({ error: "Daily limit reached" }, { status: 429 });
  }

  const requestedId =
    typeof body.conversationId === "string" ? body.conversationId.trim().slice(0, 100) : null;
  const stored = await loadOneAiConversation(requestedId, ownerKey);
  const state = stored?.state ?? createOneAiConversationState();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: OneAiEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          closed = true;
        }
      };
      try {
        const result = await runOneAiTurn({
          message,
          context,
          state,
          emit,
          signal: request.signal,
        });
        const fallbackAnswer =
          context.locale === "ua"
            ? "Не вдалося сформувати відповідь. Спробуйте переформулювати запит або напишіть менеджеру."
            : "I could not prepare an answer. Try rephrasing or contact a manager.";
        if (!result.answer) emit({ type: "text", text: fallbackAnswer });
        state.history.push(
          { role: "user", text: message },
          { role: "assistant", text: result.answer || fallbackAnswer, shownRefs: result.shownRefs }
        );
        const conversationId = await saveOneAiConversation({
          id: stored?.id ?? null,
          ownerKey,
          locale: context.locale,
          currency: context.currency,
          state,
        });
        console.info(
          JSON.stringify({
            event: "one_ai_turn",
            model: result.usage.model,
            calls: result.usage.modelCalls,
            tools: result.usage.tools,
            inputTokens: result.usage.inputTokens,
            cachedTokens: result.usage.cachedTokens,
            outputTokens: result.usage.outputTokens,
            thoughtTokens: result.usage.thoughtTokens,
            costUsd: result.usage.costUsd,
            latencyMs: result.usage.latencyMs,
            firstTextMs: result.usage.firstTextMs,
            cards: result.shownRefs.length,
          })
        );
        emit({
          type: "done",
          conversationId,
          catalogHref: result.catalogHref ?? state.lastCatalogHref,
          usage: process.env.NODE_ENV === "production" ? undefined : result.usage,
        });
      } catch (error) {
        const aborted = request.signal.aborted;
        if (!aborted) {
          console.error("One AI turn failed", {
            name: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error),
          });
        }
        emit({
          type: "error",
          code: error instanceof OneAiConfigurationError ? "not_configured" : "unavailable",
          message:
            context.locale === "ua"
              ? "One AI тимчасово недоступний. Спробуйте ще раз за хвилину або напишіть менеджеру."
              : "One AI is temporarily unavailable. Try again in a minute or contact a manager.",
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // The client already went away.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
