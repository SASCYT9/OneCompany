import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runShopStorageRetention } from "@/lib/shopStorageRetention";

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
    const result = await runShopStorageRetention(prisma);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (error) {
    console.error("[shop-retention.cron] failed", error);
    return NextResponse.json(
      { ok: false, error: "Shop storage retention failed", durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
