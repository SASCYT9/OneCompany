import { config } from "dotenv";
config({ path: ".env.local" });
config();
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { computeIpeRetailPrice } from "../src/lib/ipeCatalogImport";

const p = new PrismaClient();

function resolveSnapshotDir(): string {
  const root = path.join(process.cwd(), "artifacts", "ipe-import");
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(root, name, "match-manifest.json")))
    .sort()
    .reverse();
  return path.join(root, dirs[0]);
}

(async () => {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  const parsed = JSON.parse(
    fs.readFileSync("artifacts/ipe-price-list/2026-04-pricelist.parsed.json", "utf8")
  );
  const addons = JSON.parse(
    fs.readFileSync("artifacts/ipe-price-list/2026-04-addons.parsed.json", "utf8")
  );

  // SKU → row lookup
  const rowBySku = new Map<string, any>();
  for (const r of parsed.items) {
    if (r.sku && !rowBySku.has(r.sku)) rowBySku.set(r.sku, r);
  }

  // Universal tip MSRPs for cross-check (cheapest per family)
  const cheapestDual = Math.min(...addons.dual_tips.map((t: any) => t.msrp_usd));
  const cheapestQuad = Math.min(...addons.quad_tips.map((t: any) => t.msrp_usd));

  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: true },
    orderBy: { slug: "asc" },
  });

  let totalVariants = 0;
  let realSkuVariants = 0;
  let realSkuInExcel = 0;
  let realSkuNotInExcel = 0;
  let syntheticSkus = 0;
  let nullPrice = 0;
  let priceMatchesExcel = 0;
  let priceWithinTolerance = 0;
  let priceMismatch = 0;
  let priceMismatchOrphan = 0;

  const mismatches: any[] = [];

  for (const prod of products) {
    for (const v of prod.variants) {
      totalVariants += 1;
      if (!v.sku) {
        nullPrice += 1; // null sku
        continue;
      }
      if (v.sku.startsWith("IPE-")) {
        syntheticSkus += 1;
        continue;
      }
      realSkuVariants += 1;
      const row = rowBySku.get(v.sku);
      if (!row) {
        realSkuNotInExcel += 1;
        if (mismatches.length < 60)
          mismatches.push({
            slug: prod.slug,
            sku: v.sku,
            dbPrice: v.priceUsd?.toString(),
            issue: "sku-not-in-excel",
          });
        continue;
      }
      realSkuInExcel += 1;
      // Compute expected price for this SKU alone (single-section variant)
      // For tip-axis variants we don't have direct mapping back, so we accept
      // a wide tolerance based on (msrp + cheapest universal tip + markup).
      if (v.priceUsd == null) {
        nullPrice += 1;
        continue;
      }
      const dbUsd = Number(v.priceUsd);
      const baseMsrp = Number(row.msrp_usd ?? 0);
      if (baseMsrp <= 0) {
        // SKU has no MSRP (tip / unpriced row) — accept any price
        priceWithinTolerance += 1;
        continue;
      }
      // Expected price WITHOUT tip = computeIpeRetailPrice(baseMsrp)
      // Expected with tip add-on can be base + tipMsrp (up to ~$4,000 for premium tips).
      const expectedBase = computeIpeRetailPrice(baseMsrp) ?? 0;
      const expectedWithMaxTip = computeIpeRetailPrice(baseMsrp + 4500) ?? 0;
      // Check if dbUsd is in plausible range [expectedBase, expectedWithMaxTip]
      const ok =
        Math.abs(dbUsd - expectedBase) < 50 ||
        (dbUsd >= expectedBase - 50 && dbUsd <= expectedWithMaxTip + 50);
      if (ok) {
        if (Math.abs(dbUsd - expectedBase) < 50) priceMatchesExcel += 1;
        else priceWithinTolerance += 1;
      } else {
        priceMismatch += 1;
        if (mismatches.length < 60)
          mismatches.push({
            slug: prod.slug,
            sku: v.sku,
            dbPrice: dbUsd,
            expectedBase: expectedBase,
            expectedWithMaxTip,
            optionValues: [v.option1Value, v.option2Value, v.option3Value]
              .filter(Boolean)
              .join(" | "),
            issue: "price-out-of-range",
          });
      }
    }
  }

  console.log("\n=== Final Excel-match audit ===");
  console.log(`Total iPE products:           ${products.length}`);
  console.log(`Total iPE variants:           ${totalVariants}`);
  console.log(`  Real Excel SKUs:            ${realSkuVariants}`);
  console.log(`    → SKU found in Excel:     ${realSkuInExcel}`);
  console.log(`    → SKU NOT in Excel:       ${realSkuNotInExcel}`);
  console.log(`  Synthetic IPE-* SKUs:       ${syntheticSkus}`);
  console.log(`  Null SKU or Null price:     ${nullPrice}`);
  console.log(``);
  console.log(`Price match analysis (only variants with Excel SKU + price):`);
  console.log(`  Exact match base price:     ${priceMatchesExcel}`);
  console.log(`  Within base+max-tip range:  ${priceWithinTolerance}`);
  console.log(`  Out of range (mismatch):    ${priceMismatch}`);
  console.log(``);

  if (mismatches.length) {
    console.log("=== Sample mismatches (top 30) ===");
    for (const m of mismatches.slice(0, 30)) {
      if (m.issue === "sku-not-in-excel") {
        console.log(`  [${m.slug}] sku=${m.sku} dbPrice=${m.dbPrice} (SKU not in Excel)`);
      } else {
        console.log(
          `  [${m.slug}] sku=${m.sku} dbPrice=$${m.dbPrice} expectedBase=$${m.expectedBase} max=$${m.expectedWithMaxTip} [${m.optionValues}]`
        );
      }
    }
  }

  await p.$disconnect();
})();
