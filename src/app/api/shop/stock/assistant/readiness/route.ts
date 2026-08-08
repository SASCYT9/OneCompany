import { NextRequest, NextResponse } from "next/server";

import {
  buildShopAiPipelineHeaders,
  isShopAiEvalBoundaryEnabled,
  resolveShopAiEvalAccess,
} from "@/lib/shopAiEvalBoundary";
import { validateShopAiJsonRequest } from "@/lib/shopAiRequestBoundary";
import { collectShopAiV2DataReadiness } from "@/lib/shopAiV2DataReadiness";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!isShopAiEvalBoundaryEnabled()) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const requestBoundary = validateShopAiJsonRequest(request.headers, request.nextUrl.toString());
  if (!requestBoundary.ok) {
    return NextResponse.json(
      { error: requestBoundary.error },
      { status: requestBoundary.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const evalAccess = resolveShopAiEvalAccess(request.headers, process.env.SHOP_AI_EVAL_TOKEN);
  if (!evalAccess.authorized || !evalAccess.requireV2) {
    return NextResponse.json(
      { error: "Unauthorized evaluation request" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const readiness = await collectShopAiV2DataReadiness(prisma);
    return NextResponse.json(readiness, {
      headers: buildShopAiPipelineHeaders({
        pipeline: "v2",
        retrieval: "not-run",
        evalAuthenticated: true,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
        catalogFingerprint: readiness.catalogFingerprint,
        evalMetrics: {
          activeCpuMs: 0,
          retrievalLatencyMs: 0,
          generationCalls: 0,
          embeddingCalls: 0,
        },
      }),
    });
  } catch (error) {
    console.error("OneAI V2 readiness check failed", error);
    return NextResponse.json(
      { error: "OneAI V2 readiness check failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
