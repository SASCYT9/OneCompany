import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  buildIpeVariantCandidates,
  resolveIpeVariantPricing,
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

  let totalResolveFailed = 0;
  const sampleFails: Array<{
    handle: string;
    dbSig: string;
    dbSku: string | null;
    candidateSigs: string[];
    oldPrice: number | null;
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
      if (!skuOk && !sigOk) {
        totalResolveFailed += 1;
        if (sampleFails.length < 30) {
          sampleFails.push({
            handle: product.handle,
            dbSig: sig,
            dbSku: v.sku,
            candidateSigs: Array.from(sigSet),
            oldPrice: v.priceUsd != null ? Number(v.priceUsd) : null,
          });
        }
      }
    }
  }

  console.log(`\nTotal resolve-failed variants: ${totalResolveFailed}\n`);
  console.log("=== Sample of 30 resolve-failed variants ===");
  for (const f of sampleFails) {
    console.log(`\n[${f.handle}] dbPrice=$${f.oldPrice} dbSku=${f.dbSku}`);
    console.log(`  DB variant sig:    "${f.dbSig}"`);
    console.log(
      `  Candidate sigs:    ${f.candidateSigs
        .slice(0, 3)
        .map((s) => `"${s}"`)
        .join(", ")}${f.candidateSigs.length > 3 ? "..." : ""}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
