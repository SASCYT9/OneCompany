import { config } from "dotenv";
config({ path: ".env.local" });
config();
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

const p = new PrismaClient();
(async () => {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  const snap = JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8")
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT_DIR, "match-manifest.json"), "utf8")
  );
  const parsed = JSON.parse(
    fs.readFileSync("artifacts/ipe-price-list/2026-04-pricelist.parsed.json", "utf8")
  );

  const snapHandles = new Set(snap.products.map((p: any) => p.handle));
  const manifestHandles = new Set(manifest.rows.map((r: any) => r.officialHandle).filter(Boolean));
  // Excel rows by SKU
  const skuToParsed = new Map<string, any>();
  for (const r of parsed.items) {
    if (r.sku && !skuToParsed.has(r.sku)) skuToParsed.set(r.sku, r);
  }

  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: true, options: true },
    orderBy: { slug: "asc" },
  });

  // Categories
  let synthSkuOnlyProducts = 0;
  let synthSkuTotalVariants = 0;
  let realSkuVariants = 0;
  let inExcelByVariantSku = 0;

  const syntheticOnly: any[] = [];
  const orphanButInExcel: any[] = [];
  const trueOrphans: any[] = [];

  for (const prod of products) {
    let hasSynth = false;
    let hasReal = false;
    let realSkusFoundInExcel = false;
    for (const v of prod.variants) {
      if (!v.sku) continue;
      if (v.sku.startsWith("IPE-")) {
        synthSkuTotalVariants += 1;
        hasSynth = true;
      } else {
        realSkuVariants += 1;
        hasReal = true;
        if (skuToParsed.has(v.sku)) realSkusFoundInExcel = true;
      }
    }
    if (hasSynth && !hasReal) {
      synthSkuOnlyProducts += 1;
      syntheticOnly.push({
        slug: prod.slug,
        variantCount: prod.variants.length,
        published: prod.isPublished,
      });
    }
    if (realSkusFoundInExcel) inExcelByVariantSku += 1;

    // Orphan classification
    const handle = prod.slug.replace(/^ipe-/, "");
    const inSnapshot = snapHandles.has(handle);
    const inManifest = manifestHandles.has(handle);
    if (!inSnapshot && !inManifest) {
      if (realSkusFoundInExcel) {
        orphanButInExcel.push({
          slug: prod.slug,
          published: prod.isPublished,
          variantSkus: prod.variants.map((v) => v.sku),
        });
      } else {
        trueOrphans.push({ slug: prod.slug, published: prod.isPublished });
      }
    }
  }

  console.log(`Total iPE products: ${products.length}`);
  console.log(`\nSKU breakdown across all iPE variants:`);
  console.log(`  Variants with synthetic IPE-* SKU: ${synthSkuTotalVariants}`);
  console.log(`  Variants with real Excel-shaped SKU: ${realSkuVariants}`);
  console.log(
    `\nProducts with ONLY synthetic SKUs (no real SKU on any variant): ${synthSkuOnlyProducts}`
  );
  console.log(
    `Products with at least one variant SKU found in Excel parsed list: ${inExcelByVariantSku}`
  );
  console.log(`\nOrphan re-classification (not in snapshot AND not in manifest):`);
  console.log(
    `  Orphan BUT some variant SKU exists in Excel (was-mistakenly-hidden candidates): ${orphanButInExcel.length}`
  );
  console.log(`  True orphans (no Excel evidence either): ${trueOrphans.length}`);

  console.log(`\nSample synthetic-SKU-only products (first 12):`);
  for (const s of syntheticOnly.slice(0, 12)) {
    console.log(`  ${s.slug.padEnd(60)} variants=${s.variantCount} published=${s.published}`);
  }

  console.log(`\nOrphan-but-in-Excel products (re-evaluate publishing):`);
  for (const o of orphanButInExcel) {
    console.log(
      `  ${o.slug.padEnd(60)} published=${o.published} skus=${o.variantSkus.slice(0, 3).join(",")}`
    );
  }

  console.log(`\nTrue orphans:`);
  for (const o of trueOrphans) {
    console.log(`  ${o.slug.padEnd(60)} published=${o.published}`);
  }

  await p.$disconnect();
})();
