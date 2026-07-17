import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createPrismaShopKnowledgeV2Repository,
  runShopKnowledgeOutboxWorker,
} from "@/lib/shopKnowledgeV2";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isKnowledgeSchemaUnavailable(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2010" ||
    code === "P2021" ||
    code === "42P01" ||
    code === "42703" ||
    /ShopKnowledgeOutbox|does not exist/i.test(message)
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
  try {
    const result = await runShopKnowledgeOutboxWorker(
      createPrismaShopKnowledgeV2Repository(prisma),
      {
        workerId: `cron:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
        batchSize: 20,
        maxAttempts: 8,
        staleLockMs: 15 * 60_000,
      }
    );
    return NextResponse.json({
      ok: true,
      ready: true,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    if (isKnowledgeSchemaUnavailable(error)) {
      return NextResponse.json({
        ok: true,
        ready: false,
        durationMs: Date.now() - startedAt,
        reason: "knowledge-v2-migration-not-applied",
      });
    }
    console.error("Shop Knowledge V2 recovery worker failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Knowledge recovery worker failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
