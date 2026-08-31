import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { flattenShopCatalogRawPayload } from "../src/lib/shopCatalogSourceCoverage";

const directSources = ["adro", "akrapovic", "brabus", "burger", "csf", "do88", "girodisc", "ilmberger", "ipe", "ohlins", "racechip", "urban"] as const;
const adapters: Record<string, string> = { adro: "Adro", akrapovic: "Akrapovic", brabus: "Brabus", burger: "Burger", csf: "Csf", do88: "Do88", eventuri: "Eventuri", girodisc: "Girodisc", ilmberger: "Ilmberger", ipe: "Ipe", ohlins: "Ohlins", racechip: "RaceChip", remus: "Remus", urban: "Urban" };
type Product = { id: string; brand?: string; [key: string]: unknown };
async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json"), manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { stores?: Record<string, { file?: string; count?: number }> }, stores = manifest.stores ?? {};
  const expectedStores = [...directSources, "generic"].sort(); if (JSON.stringify(Object.keys(stores).sort()) !== JSON.stringify(expectedStores)) throw new Error("Catalog manifest source set changed without an ownership adapter");
  const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as { scripts?: Record<string, string> }, owned: Array<{ source: string; product: Product }> = [], shardReports = [];
  for (const source of expectedStores) { const descriptor = stores[source]; if (!descriptor?.file || !descriptor.count) throw new Error(`${source} shard descriptor is incomplete`); const raw = await readFile(resolve(dirname(manifestPath), descriptor.file), "utf8"), hash = createHash("sha256").update(raw).digest("hex").slice(0, 12); if (!descriptor.file.includes(`.${hash}.json`)) throw new Error(`${source} shard hash mismatch`); const products = JSON.parse(raw) as Product[]; if (products.length !== descriptor.count) throw new Error(`${source} shard count mismatch`);
    const partitions = source === "generic" ? [{ name: "eventuri", products: products.filter((product) => product.brand?.toLowerCase() === "eventuri") }, { name: "remus", products: products.filter((product) => product.brand?.toLowerCase() === "remus") }] : [{ name: source, products }];
    if (partitions.reduce((sum, partition) => sum + partition.products.length, 0) !== products.length) throw new Error(`${source} contains unowned records`);
    for (const partition of partitions) { const adapter = adapters[partition.name]; if (!adapter || !partition.products.length) throw new Error(`${partition.name} ownership adapter is missing`); for (const suffix of [`src/lib/shopCatalog${adapter}Normalization.ts`, `scripts/audit-catalog-v2-${partition.name}.ts`, `scripts/backfill-catalog-v2-${partition.name}.ts`]) await access(resolve(suffix)); for (const command of [`shop:catalog:v2:${partition.name}:audit`, `shop:catalog:v2:${partition.name}:backfill`]) if (!packageJson.scripts?.[command]) throw new Error(`${command} package command is missing`); for (const product of partition.products) owned.push({ source: partition.name, product });
      shardReports.push({ source: partition.name, records: partition.products.length, rawLeaves: partition.products.reduce((sum, product) => sum + flattenShopCatalogRawPayload(product).length, 0) }); }
  }
  const ids = new Set<string>(); for (const entry of owned) { if (!entry.product.id || ids.has(entry.product.id)) throw new Error(`Duplicate or empty catalog product identity: ${entry.product.id}`); ids.add(entry.product.id); }
  const report = { version: 1, manifestStores: expectedStores.length, ownedSources: shardReports.length, records: owned.length, uniqueProductIds: ids.size, rawLeaves: shardReports.reduce((sum, entry) => sum + entry.rawLeaves, 0), sources: shardReports, fingerprint: createHash("sha256").update(owned.map((entry) => `${entry.source}:${entry.product.id}`).sort().join("\n")).digest("hex") };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
