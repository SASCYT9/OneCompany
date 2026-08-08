import "server-only";

import { prisma } from "@/lib/prisma";
import type { ShopAiAttributionEventPayload } from "@/lib/shopAiEventPayload";
import { canLinkShopAiRun } from "@/lib/shopAiTelemetry";

function eventSignal(event: ShopAiAttributionEventPayload["event"]) {
  if (event === "manager_handoff") return "MANAGER_HANDOFF" as const;
  if (event === "add_to_cart") return "ADD_TO_CART" as const;
  return "CLICK" as const;
}

export async function recordShopAiAttributionEvent(input: {
  payload: ShopAiAttributionEventPayload;
  ownerKeyHash: string;
  validatedConversationId: string | null;
  cartToken?: string | null;
  customerId?: string | null;
}) {
  const run = await prisma.shopAiRun.findUnique({
    where: { id: input.payload.runId },
    select: {
      id: true,
      conversationId: true,
      constraints: true,
      candidateDecisions: {
        where: {
          productId: input.payload.productId,
          variantId: input.payload.variantId,
          shown: true,
        },
        orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { id: true, productId: true, variantId: true },
      },
    },
  });
  const candidate = run?.candidateDecisions[0] ?? null;
  const linked = Boolean(
    run &&
      candidate &&
      canLinkShopAiRun({
        runConversationId: run.conversationId,
        runConstraints: run.constraints,
        validatedConversationId: input.validatedConversationId,
        ownerKeyHash: input.ownerKeyHash,
      })
  );
  if (!run || !candidate || !linked) {
    return { accepted: false as const, reason: "candidate_not_owned" as const };
  }

  const cart =
    input.payload.event === "add_to_cart" && (input.cartToken || input.customerId)
      ? await prisma.shopCart.findFirst({
          where: {
            OR: [
              ...(input.cartToken ? [{ token: input.cartToken }] : []),
              ...(input.customerId ? [{ customerId: input.customerId }] : []),
            ],
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        })
      : null;

  const result = await prisma.$transaction(async (transaction) => {
    const feedback = await transaction.shopAiFeedback.create({
      data: {
        runId: run.id,
        conversationId: run.conversationId,
        candidateDecisionId: candidate.id,
        productId: candidate.productId,
        variantId: candidate.variantId,
        signal: eventSignal(input.payload.event),
        metadata: {
          locale: input.payload.locale,
          source: "storefront_one_ai",
        },
      },
      select: { id: true },
    });
    const attributedCartItems = cart
      ? await transaction.shopCartItem.updateMany({
          where: {
            cartId: cart.id,
            productId: candidate.productId,
            variantId: candidate.variantId,
          },
          data: {
            oneAiRunId: run.id,
            oneAiCandidateDecisionId: candidate.id,
          },
        })
      : { count: 0 };
    return { feedbackId: feedback.id, attributedCartItems: attributedCartItems.count };
  });

  return { accepted: true as const, ...result };
}
