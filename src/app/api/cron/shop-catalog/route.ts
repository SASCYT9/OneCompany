import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const result = await runShopCatalogOutboxRuntime({
      workerId: `catalog-cron:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
      limit: 20,
    });
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    console.error("[shop-catalog.cron] recovery worker failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Catalog recovery worker failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
