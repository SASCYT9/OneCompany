import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { serializeShopSettings } from "@/lib/shopAdminSettings";
import { prisma } from "@/lib/prisma";
import { syncShopNbuCurrencyRates } from "@/lib/shopCurrencyNbuSync.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export async function POST() {
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const result = await syncShopNbuCurrencyRates(prisma, session);
    if (result.changed) {
      revalidateTag("shop-settings", { expire: 0 });
      after(async () => {
        try { await runShopCatalogOutboxRuntime({ workerId: `settings-nbu:${randomUUID()}`, limit: 10 }); }
        catch (error) { console.error("NBU publication pending for scheduled worker", error); }
      });
    }
    return NextResponse.json({ settings: serializeShopSettings(result.settings), nbu: result.nbu, changed: result.changed, catalogPublication: result.publications });
  } catch (error) {
    if ((error as Error).message.startsWith("SHOP_PRICE_SOURCE_REQUIRED")) return NextResponse.json({ error: "Спочатку підтвердьте вихідну валюту для всіх цін товарів і варіантів.", code: "SHOP_PRICE_SOURCE_REQUIRED" }, { status: 409 });
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((error as Error).message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin shop settings NBU refresh", error);
    return NextResponse.json({ error: "Не вдалося оновити курси з НБУ" }, { status: 500 });
  }
}
