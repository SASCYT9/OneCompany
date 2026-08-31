import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { flattenShopCatalogRawPayload } from "../src/lib/shopCatalogSourceCoverage";

type SnapshotProduct = {
  id: string;
  sku?: string | null;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[];
  variants?: Array<{ id?: string; sku?: string | null; isDefault?: boolean }>;
  [key: string]: unknown;
};

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  const repeated = [...counts].filter(([, count]) => count > 1);
  return {
    distinctValues: repeated.length,
    affectedRecords: repeated.reduce((sum, [, count]) => sum + count, 0),
    maximumMultiplicity: repeated.reduce((maximum, [, count]) => Math.max(maximum, count), 0),
  };
}

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    count: number;
    stores: Record<string, { file: string; count: number }>;
  };
  const reports = [];
  let accounted = 0;
  for (const [store, descriptor] of Object.entries(manifest.stores).sort(([left], [right]) => left.localeCompare(right))) {
    const shardPath = resolve(dirname(manifestPath), descriptor.file);
    const raw = await readFile(shardPath, "utf8");
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
    if (!descriptor.file.includes(`.${hash}.json`)) throw new Error(`${store} shard hash mismatch`);
    const allProducts = JSON.parse(raw) as SnapshotProduct[];
    if (allProducts.length !== descriptor.count) throw new Error(`${store} shard count mismatch`);
    const products = store === "generic"
      ? allProducts.filter((product) => product.brand?.trim().toLowerCase() !== "eventuri")
      : store === "adro" || store === "racechip" ? [] : allProducts;
    if (!products.length) continue;
    accounted += products.length;
    let rawLeaves = 0;
    let explicitVehicleTags = 0;
    let structuredFitTags = 0;
    let invalidDefaultVariants = 0;
    const brandCounts = new Map<string, number>();
    for (const product of products) {
      rawLeaves += flattenShopCatalogRawPayload(product).length;
      const tags = product.tags ?? [];
      if (tags.some((tag) => /^(?:car_|fits-|vehicle:|make:|model:|chassis:|engine:)/i.test(tag))) explicitVehicleTags += 1;
      if (tags.some((tag) => /^(?:fits-make|fits-model|fits-trim|car_make|car_model|car_engine):/i.test(tag))) structuredFitTags += 1;
      const defaults = (product.variants ?? []).filter((variant) => variant.isDefault && variant.id);
      if (defaults.length !== 1) invalidDefaultVariants += 1;
      const brand = product.brand?.trim() || product.vendor?.trim() || "(missing)";
      brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
    }
    reports.push({
      store,
      shard: descriptor.file,
      records: products.length,
      rawLeaves,
      brands: Object.fromEntries([...brandCounts].sort(([, left], [, right]) => right - left)),
      explicitVehicleTagRecords: explicitVehicleTags,
      structuredFitTagRecords: structuredFitTags,
      invalidDefaultVariants,
      duplicateProductSkus: duplicates(products.map((product) => product.sku?.trim() ?? "")),
      duplicateVariantSkus: duplicates(products.flatMap((product) => (product.variants ?? []).map((variant) => variant.sku?.trim() ?? ""))),
    });
  }
  const report = {
    version: 1,
    manifestCount: manifest.count,
    alreadyNormalized: { racechip: manifest.stores.racechip.count, adro: manifest.stores.adro.count, eventuri: 115 },
    remainingRecords: accounted,
    sources: reports,
    fingerprint: createHash("sha256").update(JSON.stringify(reports)).digest("hex"),
  };
  if (accounted + report.alreadyNormalized.racechip + report.alreadyNormalized.adro + report.alreadyNormalized.eventuri !== manifest.count) {
    throw new Error("Remaining-source inventory does not reconcile to manifest count");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
