import { randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncShopNbuCurrencyRates } from "@/lib/shopCurrencyNbuSync.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!dryRun && process.env.SHOP_NBU_DAILY_SYNC_ENABLED !== "1")
    return NextResponse.json({ skipped: true, reason: "Daily NBU sync not enabled" });
  try {
    const result = await syncShopNbuCurrencyRates(prisma, undefined, dryRun);
    if (result.changed) {
      revalidateTag("shop-settings", { expire: 0 });
      after(async () => {
        await runShopCatalogOutboxRuntime({ workerId: `nbu-cron:${randomUUID()}`, limit: 10 });
      });
    }
    return NextResponse.json({ ok: true, changed: result.changed, dryRun, nbu: result.nbu });
  } catch (error) {
    console.error("NBU daily sync failed", error);
    return NextResponse.json({ error: "NBU sync failed; current rates retained" }, { status: 503 });
  }
}
