import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "node:fs/promises";
import path from "node:path";
import {
  buildIpeVariantCandidates,
  resolveIpeVariantPricing,
  type IpeOfficialSnapshot,
  type IpeOfficialProductSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from "../src/lib/ipeCatalogImport";

const ART = "artifacts/ipe-import/2026-05-02T14-44-33-838Z";
const HANDLE = process.argv[2] || "mercedes-benz-amg-g63-w465-exhaust-system";

async function main() {
  const [snap, manifest, oldList, newList] = await Promise.all([
    fs.readFile(path.join(ART, "official-snapshot.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(ART, "match-manifest.json"), "utf8").then(JSON.parse),
    fs.readFile("artifacts/ipe-price-list/2025-price-list.parsed.json", "utf8").then(JSON.parse),
    fs.readFile("artifacts/ipe-price-list/2026-04-pricelist.parsed.json", "utf8").then(JSON.parse),
  ]);

  console.log("=== Snapshot handles count ===", snap.products.length);
  console.log("=== Manifest rows count ===", manifest.rows.length);

  const product = snap.products.find((p: any) => p.handle === HANDLE);
  console.log("\n=== Product in snapshot ===", !!product);
  if (!product) {
    console.log(
      "Closest handles:",
      snap.products
        .filter((p: any) => p.handle.includes("g63") || p.handle.includes("w465"))
        .map((p: any) => p.handle)
    );
    return;
  }
  console.log("Title:", product.title);
  console.log("Variants:", product.variants.length);
  console.log(
    "Options:",
    product.options.map((o: any) => `${o.name}=[${o.values.join("|")}]`)
  );

  const rowsForHandle = manifest.rows.filter((r: any) => r.officialHandle === HANDLE);
  console.log("\n=== Manifest rows for W465 ===", rowsForHandle.length);
  for (const r of rowsForHandle) {
    const old = oldList.items[r.rowIndex];
    console.log(
      `  rowIdx=${r.rowIndex} sku=${r.sku} brand=${r.brand} priceKind=${r.priceKind} oldMsrp=$${old?.msrp_usd ?? "?"} oldRetail=$${old?.retail_usd ?? "?"}`
    );
  }

  // Build priceRows using NEW list directly (matching updater fix)
  const priceRows: IpeParsedPriceListRow[] = [];
  for (const m of rowsForHandle) {
    const row = newList.items[m.rowIndex];
    if (!row) continue;
    priceRows.push(row);
  }
  console.log("\n=== Final price rows used for resolver ===");
  for (const r of priceRows) {
    console.log(
      `  sku=${r.sku} section=${r.section} price_kind=${r.price_kind} msrp=$${r.msrp_usd} retail=$${r.retail_usd}`
    );
  }

  console.log("\n=== Candidates from buildIpeVariantCandidates ===");
  const candidates = buildIpeVariantCandidates(product as IpeOfficialProductSnapshot, priceRows);
  for (const c of candidates) {
    console.log(
      `  source=${c.source} title="${c.title}" optionValues=[${c.optionValues.join("|")}]`
    );
  }

  console.log("\n=== Pricing for each candidate ===");
  for (const c of candidates) {
    const pricing = resolveIpeVariantPricing(product as IpeOfficialProductSnapshot, c, priceRows);
    console.log(`  ${c.optionValues.join(" / ")}`);
    console.log(`    priceUsd=$${pricing.priceUsd}`);
    console.log(
      `    base: sku=${pricing.baseRow?.sku} section=${pricing.baseRow?.section} retail=$${pricing.baseRow?.retail_usd}`
    );
    console.log(
      `    deltas: ${pricing.deltaRows.map((r) => `${r.sku}=$${r.retail_usd ?? r.msrp_usd}`).join(", ") || "—"}`
    );
    console.log(
      `    review: [${pricing.reviewReasons.join(",")}]  confidence=${pricing.confidence}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
