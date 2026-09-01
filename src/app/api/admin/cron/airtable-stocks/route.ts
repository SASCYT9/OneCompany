import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { fetchAirtableProductsWithStocks } from "@/lib/airtable";
import { prisma } from "@/lib/prisma";
import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { syncAirtableStocksToCatalog } from "@/lib/airtableStockCatalogSync.server";

const AIRTABLE_STOCK_SESSION = {
  email: "airtable-stock-cron@system.local",
  name: "Airtable stock cron",
  permissions: ["*"],
  issuedAt: 0,
  nonce: "airtable-stock-cron",
};

export async function GET(req: Request) {
  const cronSecret = resolveSecret("CRON_SECRET");

  if (!matchesBearerSecret(req.headers, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Airtable Sync] Starting stock sync...");
    const airtableProducts = await fetchAirtableProductsWithStocks();
    console.log(`[Airtable Sync] Fetched ${airtableProducts.length} items from Airtable`);

    const result = await syncAirtableStocksToCatalog({
      prisma,
      items: airtableProducts,
      session: AIRTABLE_STOCK_SESSION,
    });
    const catalogMutations = result.mutations;

    if (catalogMutations.length) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-airtable-stock:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, catalogMutations.length)),
          });
        } catch (error) {
          console.error("[shop-catalog.airtable-stock] immediate publish failed; cron recovery remains active", {
            outboxIds: catalogMutations.map((mutation) => mutation.outboxId),
            error,
          });
        }
      });
    }

    console.log(`[Airtable Sync] Successfully updated ${result.updated} variants from Airtable`);

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      updated: result.updated,
      productsUpdated: result.productsUpdated,
      unmatchedSkus: result.unmatchedSkus,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Airtable Sync] Error syncing stocks:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
