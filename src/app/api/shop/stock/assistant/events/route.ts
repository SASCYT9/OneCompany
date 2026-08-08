import { NextRequest, NextResponse } from "next/server";

import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { loadShopAiConversation } from "@/lib/shopAiConversationStore";
import { parseShopAiAttributionEvent } from "@/lib/shopAiEventPayload";
import { recordShopAiAttributionEvent } from "@/lib/shopAiEvents";
import { buildShopAiOwnerSignature } from "@/lib/shopAiPrivacy";
import { validateShopAiJsonRequest } from "@/lib/shopAiRequestBoundary";
import { SHOP_CART_COOKIE } from "@/lib/shopCart";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";

export const runtime = "nodejs";

const MAX_EVENT_BODY_BYTES = 4_096;

export async function POST(request: NextRequest) {
  const boundary = validateShopAiJsonRequest(request.headers, request.nextUrl.toString());
  if (!boundary.ok) {
    return NextResponse.json(
      { error: boundary.error },
      { status: boundary.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EVENT_BODY_BYTES) {
    return NextResponse.json({ error: "Event payload is too large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > MAX_EVENT_BODY_BYTES) {
    return NextResponse.json({ error: "Event payload is too large" }, { status: 413 });
  }
  const parsed = parseShopAiAttributionEvent(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const ip = getRequestIp(request.headers);
  const customerSession = await getCurrentShopCustomerSession();
  const ownerKeyHash = buildShopAiOwnerSignature({
    customerId: customerSession?.customerId,
    ip,
  });
  const allowed = await consumeRateLimit({
    keyParts: ["stock-ai-events", ownerKeyHash],
    windowMs: 5 * 60 * 1000,
    maxPerWindow: 60,
  });
  if (!allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const conversation = parsed.value.conversationId
    ? await loadShopAiConversation(parsed.value.conversationId, ownerKeyHash)
    : null;
  const result = await recordShopAiAttributionEvent({
    payload: parsed.value,
    ownerKeyHash,
    validatedConversationId: conversation?.id ?? null,
    cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value ?? null,
    customerId: customerSession?.customerId ?? null,
  });
  if (!result.accepted) {
    return NextResponse.json({ error: "Event candidate is not available" }, { status: 409 });
  }
  return NextResponse.json(
    {
      accepted: true,
      eventId: result.feedbackId,
      attributedCartItems: result.attributedCartItems,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
