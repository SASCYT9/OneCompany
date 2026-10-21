import { NextRequest, NextResponse } from "next/server";
import { isPriceWatchEnabled, runPriceWatch } from "@/lib/operations/priceWatch";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET ?? "").trim();
  return {
    configured: Boolean(secret),
    valid: Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`,
  };
}

/** Hourly supplier price checks for the Operations bot. Reads suppliers, never writes prices. */
export async function GET(request: NextRequest) {
  const auth = authorized(request);
  if (!auth.configured) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isPriceWatchEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  try {
    const result = await runPriceWatch({ client: prisma, budgetMs: 270_000 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[operations.price-watch.cron] failed", error);
    return NextResponse.json({ ok: false, error: "PRICE_WATCH_FAILED" }, { status: 500 });
  }
}
