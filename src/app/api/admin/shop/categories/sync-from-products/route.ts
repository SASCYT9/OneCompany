import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { syncCatalogCategories } from "@/lib/shopAdminCategories";
import { prisma } from "@/lib/prisma";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE);
    const result = await syncCatalogCategories(prisma, session);
    const { catalog, ...summary } = result;
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "category.sync_from_products",
      entityType: "shop.category",
      metadata: { ...summary, catalogMutations: catalog.length },
    });
    if (catalog.length) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-category-sync:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, catalog.length)),
          });
        } catch (error) {
          console.error("[shop-catalog.category-sync] immediate publish failed; cron recovery remains active", {
            outboxIds: catalog.map((mutation) => mutation.outboxId),
            error,
          });
        }
      });
    }
    return NextResponse.json({ ...summary, catalogMutations: catalog.length });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop category sync", error);
    return NextResponse.json({ error: "Failed to sync categories from products" }, { status: 500 });
  }
}
