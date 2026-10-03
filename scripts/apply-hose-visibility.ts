import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { classifySmallHoseProduct } from "../src/lib/shopHoseVisibility";
import type { ShopCurrencyCode } from "../src/lib/shopCurrencyDefaults";

async function main() {
  const args = process.argv.slice(2);
  const value = (key: string) => args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  if (value("target") !== "https://onecompany.global" || !value("env-path")) throw new Error("Explicit target and env-path required");
  const directory = resolve("outputs/site-commerce-2026-10-03");
  const plan = JSON.parse(readFileSync(resolve(directory, "hide-plan.json"), "utf8"));
  const source = readFileSync(resolve(directory, "hose-clamp-candidates.json"));
  if (createHash("sha256").update(source).digest("hex") !== plan.sourceSha256 || plan.target !== value("target")) throw new Error("Before-image or target mismatch");
  const env = parse(readFileSync(value("env-path")!));
  const url = env.DIRECT_URL || env.DATABASE_URL;
  if (!url) throw new Error("Database URL missing");
  process.env.DATABASE_URL = url;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const commit = args.includes("--commit");
  const batchSize = Number(value("batch-size") ?? 10);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) throw new Error("Batch size must be 1..20");
  try {
    const settings = await prisma.shopSettings.findUniqueOrThrow({ where: { key: "shop" }, select: { currencyRates: true } });
    const rates = settings.currencyRates as Record<ShopCurrencyCode, number>;
    if (["EUR", "USD", "UAH"].some((key) => rates[key as ShopCurrencyCode] !== plan.currencyRates[key])) throw new Error("Currency rates changed; prepare a fresh plan");
    const resultsPath = resolve(directory, "hide-results.json");
    const prior = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : null;
    if (prior && prior.sourceSha256 !== plan.sourceSha256) throw new Error("Previous results belong to a different before-image");
    const results: Array<{ id: string; sku: string; canonicalVersion: string; outboxId: string }> = prior?.results ?? [];
    const previousChanges = results.length;
    const { coordinateShopCatalogProductMutationWithClient } = await import("../src/lib/shopCatalogMutationCoordinator.server");
    const { buildShopCatalogAdminSnapshot } = await import("../src/lib/shopCatalogAdminSnapshot.server");
    let alreadyHidden = 0;
    for (let offset = 0; offset < plan.entries.length; offset += batchSize) {
      const batch = plan.entries.slice(offset, offset + batchSize);
      const rows = await prisma.shopProduct.findMany({ where: { id: { in: batch.map((entry: { id: string }) => entry.id) } }, include: { variants: true } });
      for (const entry of batch) {
        const row = rows.find((product) => product.id === entry.id);
        if (!row || row.sku !== entry.sku || row.status !== entry.before.status) throw new Error(`Identity/status changed for ${entry.sku}; stop`);
        if (!row.isPublished) { alreadyHidden++; continue; }
        if (row.catalogVersion.toString() !== entry.before.catalogVersion.toString() || !classifySmallHoseProduct(row, rates).hide) throw new Error(`Version/price changed for ${entry.sku}; stop and refresh`);
        if (!commit) continue;
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: row.id, expectedCatalogVersion: row.catalogVersion.toString(), changeDomains: ["VISIBILITY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({ where: { id: row.id }, data: { isPublished: false } });
            return buildShopCatalogAdminSnapshot(tx, row.id, nextCatalogVersion, { type: "IMPORT", id: "owner-approved-hose-hide-2026-10-03", reason: "Owner request: hide hoses/clamps up to USD 200; retain cards and order history" });
          },
        });
        results.push({ id: row.id, sku: row.sku ?? "", canonicalVersion: mutation.canonicalVersion, outboxId: mutation.outboxId });
        writeFileSync(resultsPath, JSON.stringify({ planReadAt: plan.readAt, sourceSha256: plan.sourceSha256, results }, null, 2));
      }
      if (commit) {
        const stillPublished = await prisma.shopProduct.count({ where: { id: { in: batch.map((entry: { id: string }) => entry.id) }, isPublished: true } });
        if (stillPublished) throw new Error("Post-batch publication check failed; stop");
        console.log(JSON.stringify({ processed: Math.min(offset + batchSize, plan.entries.length), total: plan.entries.length, changed: results.length, alreadyHidden }));
      }
    }
    console.log(JSON.stringify({ mode: commit ? "commit" : "dry-run", selected: plan.entries.length, changed: results.length - previousChanges, totalChanges: results.length, alreadyHidden, sourceSha256: plan.sourceSha256 }));
  } finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Visibility update failed"); process.exitCode = 1; });
