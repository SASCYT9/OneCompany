import { readFile } from "node:fs/promises";
import path from "node:path";

import { isOpsLocalDemoMode } from "@/app/admin/operations/demoMode";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsPriceWatch } from "@/components/admin/operations/OpsPriceWatch";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { loadPriceWatchOverview, type PriceWatchOverview } from "@/lib/operations/priceWatch";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Local preview: the result of scripts/operations/price-watch-dry-run.ts, nothing from the database. */
async function loadDemoOverview(): Promise<PriceWatchOverview | null> {
  const file = path.resolve(
    process.cwd(),
    process.env.OPS_PRICE_WATCH_DEMO_FILE ?? ".tmp/price-watch-demo.json"
  );
  try {
    return JSON.parse(await readFile(file, "utf8")) as PriceWatchOverview;
  } catch {
    return null;
  }
}

export default async function OperationsPricesPage() {
  await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
  const overview = isOpsLocalDemoMode()
    ? await loadDemoOverview()
    : await loadPriceWatchOverview(prisma).catch((error) => {
        console.error("[operations.prices] overview failed", error);
        return null;
      });
  return <OpsPriceWatch overview={overview} />;
}
