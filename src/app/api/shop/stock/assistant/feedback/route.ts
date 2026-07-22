import { NextRequest, NextResponse } from "next/server";

import { loadShopAiConversation } from "@/lib/shopAiConversationStore";
import { parseShopAiFeedbackPayload, recordShopAiFeedback } from "@/lib/shopAiTelemetry";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { buildShopAiOwnerSignature } from "@/lib/shopAiPrivacy";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";
import { validateShopAiJsonRequest } from "@/lib/shopAiRequestBoundary";

export const runtime = "nodejs";

const MAX_FEEDBACK_BODY_BYTES = 4_096;

function bodyIsTooLarge(request: NextRequest) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return false;
  const length = Number(rawLength);
  return Number.isFinite(length) && length > MAX_FEEDBACK_BODY_BYTES;
}

export async function POST(request: NextRequest) {
  const requestBoundary = validateShopAiJsonRequest(request.headers, request.nextUrl.toString());
  if (!requestBoundary.ok) {
    return NextResponse.json(
      { error: requestBoundary.error },
      { status: requestBoundary.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (bodyIsTooLarge(request)) {
    return NextResponse.json({ error: "Feedback payload is too large" }, { status: 413 });
  }

  const ip = getRequestIp(request.headers);
  const customerSession = await getCurrentShopCustomerSession();
  const ownerKeyHash = buildShopAiOwnerSignature({
    customerId: customerSession?.customerId,
    ip,
  });
  const allowed = await consumeRateLimit({
    keyParts: ["stock-ai-feedback", ownerKeyHash],
    windowMs: 5 * 60 * 1000,
    maxPerWindow: 20,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(rawBody), "utf8") > MAX_FEEDBACK_BODY_BYTES) {
    return NextResponse.json({ error: "Feedback payload is too large" }, { status: 413 });
  }

  const parsed = parseShopAiFeedbackPayload(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const validatedConversation = parsed.value.conversationId
    ? await loadShopAiConversation(parsed.value.conversationId, ownerKeyHash)
    : null;
  const result = await recordShopAiFeedback({
    ...parsed.value,
    conversationId: validatedConversation?.id ?? null,
    ownerKeyHash,
  });

  return NextResponse.json(
    {
      accepted: true,
      persisted: result.persisted,
      feedbackId: result.value?.feedbackId ?? null,
      reviewTaskCreated: Boolean(result.value?.reviewTaskId),
    },
    { status: result.persisted ? 201 : 202 }
  );
}
