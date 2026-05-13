import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  buildIpeVariantCandidates,
  computeIpeRetailPrice,
  type IpeOfficialSnapshot,
  type IpeOfficialProductSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from "../src/lib/ipeCatalogImport";

function variantSignature(values: ReadonlyArray<string | null | undefined>) {
  return values
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function resolveSnapshotDir(): string {
  const root = path.join(process.cwd(), "artifacts", "ipe-import");
  const dirs = require("node:fs")
    .readdirSync(root, { withFileTypes: true })
    .filter((d: any) => d.isDirectory())
    .map((d: any) => d.name)
    .filter((name: string) =>
      require("node:fs").existsSync(path.join(root, name, "match-manifest.json"))
    )
    .sort()
    .reverse();
  return path.join(root, dirs[0]);
}

const prisma = new PrismaClient();

async function main() {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  const [snap, manifest, parsed] = await Promise.all([
    fs
      .readFile(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8")
      .then(JSON.parse) as Promise<IpeOfficialSnapshot>,
    fs.readFile(path.join(SNAPSHOT_DIR, "match-manifest.json"), "utf8").then(JSON.parse),
    fs
      .readFile("artifacts/ipe-price-list/2026-04-pricelist.parsed.json", "utf8")
      .then(JSON.parse) as Promise<IpeParsedPriceList>,
  ]);

  const rowsByHandle = new Map<string, any[]>();
  for (const r of manifest.rows) {
    if (!r.officialHandle) continue;
    const list = rowsByHandle.get(r.officialHandle) ?? [];
    list.push(r);
    rowsByHandle.set(r.officialHandle, list);
  }

  // Build SKU → parsed row lookup for fast access
  const rowBySku = new Map<string, IpeParsedPriceListRow>();
  for (const row of parsed.items) {
    if (row.sku && !rowBySku.has(row.sku)) rowBySku.set(row.sku, row);
  }

  let resolveFailedWithGoodSku = 0;
  let resolveFailedWithCorrectPrice = 0;
  let resolveFailedWithWrongPrice = 0;
  let resolveFailedWithMissingSku = 0;
  const wrongList: Array<{
    handle: string;
    sku: string;
    sig: string;
    oldPrice: number;
    expectedPrice: number;
    diff: number;
  }> = [];

  for (const product of snap.products) {
    const manifestRows = rowsByHandle.get(product.handle);
    if (!manifestRows || !manifestRows.length) continue;
    const priceRows: IpeParsedPriceListRow[] = [];
    for (const m of manifestRows) {
      const row = parsed.items[m.rowIndex];
      if (row) priceRows.push(row);
    }
    if (!priceRows.length) continue;

    const dbProduct = await prisma.shopProduct.findFirst({
      where: { slug: { in: [product.handle, `ipe-${product.handle}`] } },
      include: { variants: true },
    });
    if (!dbProduct) continue;

    const candidates = buildIpeVariantCandidates(product as IpeOfficialProductSnapshot, priceRows);
    const sigSet = new Set(candidates.map((c) => variantSignature(c.optionValues)));
    const skuSet = new Set(candidates.map((c) => c.baseRow?.sku).filter(Boolean) as string[]);

    for (const v of dbProduct.variants) {
      const sig = variantSignature([v.option1Value, v.option2Value, v.option3Value]);
      const skuOk = v.sku && !v.sku.startsWith("IPE-") && skuSet.has(v.sku);
      const sigOk = sig && sigSet.has(sig);
      if (skuOk || sigOk) continue;

      // resolve-failed
      if (!v.sku || v.sku.startsWith("IPE-")) {
        resolveFailedWithMissingSku += 1;
        continue;
      }
      const row = rowBySku.get(v.sku);
      if (!row) {
        resolveFailedWithMissingSku += 1;
        continue;
      }
      resolveFailedWithGoodSku += 1;
      // Compute expected price from SKU alone (single-axis variant)
      const expected = computeIpeRetailPrice(row.msrp_usd);
      const oldPrice = v.priceUsd != null ? Number(v.priceUsd) : 0;
      if (expected == null) continue;
      if (Math.abs(oldPrice - expected) < 1) {
        resolveFailedWithCorrectPrice += 1;
      } else {
        resolveFailedWithWrongPrice += 1;
        if (wrongList.length < 30) {
          wrongList.push({
            handle: product.handle,
            sku: v.sku,
            sig,
            oldPrice,
            expectedPrice: expected,
            diff: expected - oldPrice,
          });
        }
      }
    }
  }

  console.log(`\nResolve-failed breakdown:`);
  console.log(`  with good SKU in price list: ${resolveFailedWithGoodSku}`);
  console.log(`    of those, CURRENT price = expected: ${resolveFailedWithCorrectPrice}`);
  console.log(`    of those, CURRENT price ≠ expected: ${resolveFailedWithWrongPrice}`);
  console.log(`  with missing/synthetic SKU:  ${resolveFailedWithMissingSku}`);

  console.log(`\n=== Wrong-priced resolve-failed (would update if fixed): ===`);
  for (const w of wrongList) {
    const pct = w.oldPrice ? ((w.diff / w.oldPrice) * 100).toFixed(0) : "n/a";
    console.log(`  [${w.handle}] sku=${w.sku}`);
    console.log(`    sig="${w.sig}"`);
    console.log(
      `    $${w.oldPrice} -> $${w.expectedPrice} (Δ ${w.diff > 0 ? "+" : ""}${w.diff}, ${pct}%)`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
