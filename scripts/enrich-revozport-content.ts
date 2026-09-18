import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PrismaClient, type Prisma } from "@prisma/client";
import { buildRevozportEnrichment, type RevozportSource, type OfficialRevozportProduct } from "./_lib/revozport-enrichment";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";

const output = ".tmp/revozport-enrichment";
const commit = process.argv.includes("--commit");
const inspectDatabase = commit || process.argv.includes("--check-database");
const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v, 2);

async function main() {
  const { products: sources } = JSON.parse(await readFile(".tmp/revozport-catalog-preview.json", "utf8")) as { products: (RevozportSource & Record<string, unknown>)[] };
  const cache = JSON.parse(await readFile(".tmp/revozport-official-audit/products.json", "utf8")) as { fetchedAt: string; products: OfficialRevozportProduct[] };
  if (commit && !process.argv.includes("--target=onecompany.global")) throw new Error("Commit requires explicit --target=onecompany.global");
  if (commit && Date.now() - Date.parse(cache.fetchedAt) > 86400000) throw new Error("Refresh the official source audit first");
  const plans = sources.map((source) => ({ source, ...buildRevozportEnrichment(source, cache.products) }));
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/regional-prices-draft.json`, json({ fetchedAt: cache.fetchedAt, applied: false, products: plans.map((p) => p.regionalDraft) }));
  await writeFile(`${output}/content-plan.json`, json(plans.map((p) => ({ sku: p.source.sku, ...p.data }))));
  console.log(json({ mode: commit ? "commit" : "dry-run", products: plans.length, localized: plans.filter((p) => p.data.titleUa).length,
    exactOfficialMatches: plans.filter((p) => p.official).length,
    recoveredImages: plans.filter((p) => !p.source.image && p.data.image).length,
    galleries: plans.filter((p) => (p.data.gallery?.length ?? 0) > 1).length,
    note: "Prices, stock, fitment, visibility and tax configuration are not modified." }));
  if (!inspectDatabase) return;
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({ where: { brand: "Revozport" }, include: { media: true } });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(`${output}/${stamp}-before.json`, json(rows));
    const changes: { sku: string; id: string; version: string; data: Prisma.ShopProductUpdateInput; addedImages: number }[] = [];
    const skipped: { sku: string; reason: string }[] = [];
    for (const plan of plans) {
      const onlySku = process.argv.find((arg) => arg.startsWith("--sku="))?.slice(6);
      if (onlySku && plan.source.sku !== onlySku) continue;
      const row = rows.find((r) => r.sku === plan.source.sku);
      if (!row) { skipped.push({ sku: plan.source.sku, reason: "Missing Revozport DB record" }); continue; }
      const data: Record<string, unknown> = {};
      let conflict = false;
      for (const [key, value] of Object.entries(plan.data)) {
        const current = (row as unknown as Record<string, unknown>)[key];
        if (json(current) === json(value)) continue;
        // Preserve edits since the supplier import. Never overwrite divergent content.
        if (json(current) !== json(plan.source[key])) { conflict = true; break; }
        data[key] = value;
      }
      if (conflict) { skipped.push({ sku: plan.source.sku, reason: "Current content diverged from source; manual review required" }); continue; }
      const existing = new Set(row.media.map((m) => m.src));
      const additions = (plan.data.gallery ?? []).filter((src) => !existing.has(src));
      const position = Math.max(0, ...row.media.map((m) => m.position));
      if (additions.length) data.media = { create: additions.map((src, index) => ({ src, altText: plan.data.titleEn ?? row.titleEn, mediaType: "IMAGE", position: position + index + 1 })) };
      if (Object.keys(data).length) changes.push({ sku: plan.source.sku, id: row.id, version: row.catalogVersion.toString(), data: data as Prisma.ShopProductUpdateInput, addedImages: additions.length });
    }
    await writeFile(`${output}/${stamp}-db-plan.json`, json({ changes, skipped }));
    console.log(json({ databaseProducts: rows.length, changes: changes.length, skipped, addedImages: changes.reduce((n, p) => n + p.addedImages, 0) }));
    if (!commit) return;
    const completed: unknown[] = [];
    for (const change of changes) {
      const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: change.id, expectedCatalogVersion: change.version, changeDomains: ["CONTENT", "SEO", "MEDIA"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          const current = await tx.shopProduct.findUniqueOrThrow({ where: { id: change.id }, select: { brand: true, sku: true } });
          if (current.brand !== "Revozport" || current.sku !== change.sku) throw new Error("Brand/SKU changed; refusing mutation");
          await tx.shopProduct.update({ where: { id: change.id }, data: change.data });
          return buildShopCatalogAdminSnapshot(tx, change.id, nextCatalogVersion, { type: "IMPORT", id: "revozport-content@system.local", reason: "revozport.verified-content-and-gallery" });
        },
      });
      completed.push({ sku: change.sku, ...mutation });
      await writeFile(`${output}/${stamp}-completed.json`, json(completed));
      if (completed.length % 25 === 0) console.log(`Saved ${completed.length}/${changes.length}`);
    }
    console.log(json({ saved: completed.length, publication: "Queued through existing catalog outbox; verify receipts and live storefront separately." }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
