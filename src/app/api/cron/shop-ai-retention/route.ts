import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getShopAiRetentionCutoffs } from "@/lib/shopAiRetention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isTelemetrySchemaUnavailable(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2010" ||
    code === "P2021" ||
    code === "P2022" ||
    code === "42P01" ||
    code === "42703" ||
    /ShopAiRun|ShopAiConversation|ShopAiCandidateDecision|does not exist/i.test(message)
  );
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const cutoffs = getShopAiRetentionCutoffs();

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const deletedAggregateRuns = await transaction.shopAiRun.deleteMany({
        where: { createdAt: { lt: cutoffs.aggregateBefore } },
      });
      const deletedCandidateDecisions = await transaction.shopAiCandidateDecision.deleteMany({
        where: {
          run: {
            createdAt: { lt: cutoffs.detailedTraceBefore },
          },
        },
      });
      const scrubbedDetailedRuns = await transaction.shopAiRun.updateMany({
        where: {
          createdAt: {
            gte: cutoffs.aggregateBefore,
            lt: cutoffs.detailedTraceBefore,
          },
          redactedQuery: { not: "[retention-expired]" },
        },
        data: {
          redactedQuery: "[retention-expired]",
          normalizedQuery: null,
          constraints: {},
          response: {},
          errorMessage: null,
        },
      });
      const deletedExpiredConversations = await transaction.shopAiConversation.deleteMany({
        where: { expiresAt: { lt: cutoffs.expiredConversationBefore } },
      });

      return {
        deletedAggregateRuns: deletedAggregateRuns.count,
        deletedCandidateDecisions: deletedCandidateDecisions.count,
        scrubbedDetailedRuns: scrubbedDetailedRuns.count,
        deletedExpiredConversations: deletedExpiredConversations.count,
      };
    });

    return NextResponse.json({
      ok: true,
      ready: true,
      durationMs: Date.now() - startedAt,
      cutoffs: {
        detailedTraceBefore: cutoffs.detailedTraceBefore.toISOString(),
        aggregateBefore: cutoffs.aggregateBefore.toISOString(),
      },
      ...result,
    });
  } catch (error) {
    if (isTelemetrySchemaUnavailable(error)) {
      return NextResponse.json({
        ok: true,
        ready: false,
        durationMs: Date.now() - startedAt,
        reason: "shop-ai-v2-migration-not-applied",
      });
    }
    console.error("One AI retention failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "One AI retention failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
