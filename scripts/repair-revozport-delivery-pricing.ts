import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { type RevozportSource } from "./_lib/revozport-enrichment";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { estimateRevozportDeliveryPricingWeight } from "./_lib/revozport-delivery-estimator";
const commit = process.argv.includes("--commit");
const sourcePath = process.argv.find((arg) => arg.startsWith("--source="))?.slice(9);
if (!sourcePath || (commit && !process.argv.includes("--target=onecompany.global"))) throw new Error("Source and exact commit target required");
const output = ".tmp/revozport-delivery-analogue-repair";
const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v, 2);
const round = (value: number) => Math.round(value * 1000) / 1000;
const g90 = ["RZ-BM-1081", "RZ-BM-1082", "RZ-BM-1083", "RZ-BM-1085", "RZ-BM-1086", "RZ-BM-1087", "RZ-BM-1088", "RZ-BM-1089"];
async function main() {
 const db = new PrismaClient();
 try {
  const { products } = JSON.parse(await readFile(sourcePath!, "utf8")) as { products: RevozportSource[] };
  const bySku = new Map(products.map((product) => [product.sku, product]));
  const rows = await db.shopProduct.findMany({ where: { brand: "Revozport", status: "ACTIVE", isPublished: true }, include: { metafields: true, variants: { orderBy: [{ isDefault: "desc" }, { position: "asc" }] } }, orderBy: { sku: "asc" } });
  if (rows.length !== 170) throw new Error(`Public scope changed: ${rows.length}, expected 170; review before applying`);
  await mkdir(output, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(`${output}/${stamp}-before.json`, json(rows));
  const referenceSum = g90.reduce((sum, sku) => sum + Number(bySku.get(sku)?.weight ?? 0), 0);
  if (referenceSum <= 0 || g90.some((sku) => !bySku.has(sku))) throw new Error("Incomplete G90 reference");
  const plan = rows.map((row) => {
   const source = bySku.get(row.sku ?? "");
   if (!source) throw new Error(`Missing exact source SKU ${row.sku}`);
   const actualWeight = Number(row.variants[0]?.weight ?? row.weight ?? 0);
   const estimate = estimateRevozportDeliveryPricingWeight(source, products);
   const reference = g90.includes(row.sku!) ? round(Number(source.weight) / referenceSum * 84 * 1.1) : null;
   const weight = reference ?? (actualWeight > 0 ? round(actualWeight * 1.1) : estimate.weightKg);
   if (!Number.isFinite(weight) || weight <= 0) throw new Error(`Invalid weight ${row.sku}`);
   return { id: row.id, sku: row.sku, slug: row.slug, version: row.catalogVersion.toString(), actualWeightKg: actualWeight || null, weightKg: weight, baseWeightKg: reference != null ? round(weight / 1.1) : actualWeight > 0 ? actualWeight : estimate.baseWeightKg, confidence: actualWeight > 0 ? "supplier" : estimate.confidence, analogues: actualWeight > 0 ? [] : estimate.analogues, dimensionsUsable: estimate.dimensionsUsable,
    source: reference != null ? "approved_g90_84kg_full_set_proportional_allocation" : actualWeight > 0 ? "supplier_shipping_weight_plus_10pct" : estimate.source,
    deliveryUsd: Math.round(weight * 25 * 100) / 100,
    previousMetafields: row.metafields.filter((field) => field.namespace === "revozport_logistics") };
  });
  const g90Rows = plan.filter((row) => g90.includes(row.sku!));
  if (g90Rows.length !== 8) throw new Error("G90 set scope changed");
  const correction = round(92.4 - g90Rows.reduce((sum, row) => sum + row.weightKg, 0));
  g90Rows[g90Rows.length - 1].weightKg = round(g90Rows[g90Rows.length - 1].weightKg + correction);
  g90Rows[g90Rows.length - 1].deliveryUsd = Math.round(g90Rows[g90Rows.length - 1].weightKg * 25 * 100) / 100;
  await writeFile(`${output}/plan.json`, json(plan));
  console.log(json({ target: "onecompany.global", mode: commit ? "commit" : "dry-run", publishedProducts: rows.length, estimated: plan.filter((row) => row.actualWeightKg == null).length, reservePercent: 10, g90TotalKg: round(g90Rows.reduce((sum, row) => sum + row.weightKg, 0)), sample: plan.find((row) => row.sku === "RZ-XM-1313"), variants: rows.reduce((sum, row) => sum + row.variants.length, 0) }));
  if (!commit) return;
  const completed: unknown[] = [];
  for (const row of plan) {
   if (row.actualWeightKg != null) continue;
   const fields = { delivery_pricing_weight_kg: row.weightKg.toFixed(3), delivery_pricing_weight_source: row.source, delivery_pricing_reserve_pct: "10", delivery_pricing_rate_usd_per_kg: "25", delivery_pricing_approved_at: "2026-09-30", delivery_pricing_base_weight_kg: row.baseWeightKg.toFixed(3), delivery_pricing_confidence: row.confidence, delivery_pricing_analogues: json(row.analogues), delivery_pricing_dimensions_status: row.dimensionsUsable ? "usable_for_estimation" : "missing_or_implausible" };
   if (Object.entries(fields).every(([key, value]) => row.previousMetafields.find((field) => field.key === key)?.value === value)) continue;
   const result = await coordinateShopCatalogProductMutationWithClient(db, { productId: row.id, expectedCatalogVersion: row.version, changeDomains: ["PRICE", "CONTENT"], async mutateAndSnapshot(tx, version) {
    const current = await tx.shopProduct.findUniqueOrThrow({ where: { id: row.id }, select: { brand: true, sku: true } });
    if (current.brand !== "Revozport" || current.sku !== row.sku) throw new Error("Product identity changed");

    for (const [key, value] of Object.entries(fields)) {
     await tx.shopProductMetafield.deleteMany({ where: { productId: row.id, namespace: "revozport_logistics", key } });
     await tx.shopProductMetafield.create({ data: { productId: row.id, namespace: "revozport_logistics", key, value, valueType: "single_line_text_field" } });
    }
    return buildShopCatalogAdminSnapshot(tx, row.id, version, { type: "IMPORT", id: "revozport-delivery-analogue@system.local", reason: "revozport.approved-analogue-delivery-weight-with-10pct-reserve" });
   } });
   completed.push({ sku: row.sku, ...result });
   await writeFile(`${output}/completed.json`, json(completed));
   if (completed.length % 20 === 0) console.log(`Saved ${completed.length}/${plan.length}`);
  }
  console.log(json({ saved: completed.length, publication: "queued" }));
 } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
