import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { flattenShopCatalogRawPayload } from "../src/lib/shopCatalogSourceCoverage";

const directSources = [
  "adro",
  "akrapovic",
  "brabus",
  "burger",
  "csf",
  "do88",
  "girodisc",
  "ilmberger",
  "ipe",
  "ohlins",
  "racechip",
  "urban",
] as const;

const sourceOwnership = {
  adro: { adapter: "Adro", command: "adro" },
  akrapovic: { adapter: "Akrapovic", command: "akrapovic" },
  bootmod3: { adapter: "Supplemental", command: "supplemental" },
  brabus: { adapter: "Brabus", command: "brabus" },
  burger: { adapter: "Burger", command: "burger" },
  csf: { adapter: "Csf", command: "csf" },
  do88: { adapter: "Do88", command: "do88" },
  eventuri: { adapter: "Eventuri", command: "eventuri" },
  "fi-exhaust": { adapter: "Supplemental", command: "supplemental" },
  girodisc: { adapter: "Girodisc", command: "girodisc" },
  "g-sport": { adapter: "Supplemental", command: "supplemental" },
  ilmberger: { adapter: "Ilmberger", command: "ilmberger" },
  ipe: { adapter: "Ipe", command: "ipe" },
  "kw-suspensions": { adapter: "Supplemental", command: "supplemental" },
  ohlins: { adapter: "Ohlins", command: "ohlins" },
  racechip: { adapter: "RaceChip", command: "racechip" },
  remus: { adapter: "Remus", command: "remus" },
  urban: { adapter: "Urban", command: "urban" },
} as const;

const genericBrandSources = new Map<string, keyof typeof sourceOwnership>([
  ["bootmod3", "bootmod3"],
  ["eventuri", "eventuri"],
  ["fi exhaust", "fi-exhaust"],
  ["g-sport by gesi", "g-sport"],
  ["kw suspensions", "kw-suspensions"],
  ["remus", "remus"],
]);

type Product = { id: string; brand?: string; [key: string]: unknown };

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const stores = manifest.stores ?? {};
  const expectedStores = [...directSources, "generic"].sort();
  if (JSON.stringify(Object.keys(stores).sort()) !== JSON.stringify(expectedStores)) {
    throw new Error("Catalog manifest source set changed without an ownership adapter");
  }
  const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const owned: Array<{ source: string; product: Product }> = [];
  const shardReports: Array<{ source: string; records: number; rawLeaves: number }> = [];

  for (const source of expectedStores) {
    const descriptor = stores[source];
    if (!descriptor?.file || !descriptor.count) {
      throw new Error(`${source} shard descriptor is incomplete`);
    }
    const raw = await readFile(resolve(dirname(manifestPath), descriptor.file), "utf8");
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
    if (!descriptor.file.includes(`.${hash}.json`))
      throw new Error(`${source} shard hash mismatch`);
    const products = JSON.parse(raw) as Product[];
    if (products.length !== descriptor.count) throw new Error(`${source} shard count mismatch`);

    const partitions = new Map<keyof typeof sourceOwnership, Product[]>();
    for (const product of products) {
      const owner =
        source === "generic"
          ? genericBrandSources.get(product.brand?.trim().toLowerCase() ?? "")
          : (source as keyof typeof sourceOwnership);
      if (!owner) throw new Error(`${source} contains unowned record ${product.id}`);
      const partition = partitions.get(owner) ?? [];
      partition.push(product);
      partitions.set(owner, partition);
    }

    for (const [partition, partitionProducts] of partitions) {
      const owner = sourceOwnership[partition];
      if (!partitionProducts.length) throw new Error(`${partition} ownership adapter is empty`);
      await access(resolve(`src/lib/shopCatalog${owner.adapter}Normalization.ts`));
      await access(resolve(`scripts/audit-catalog-v2-${owner.command}.ts`));
      await access(resolve(`scripts/backfill-catalog-v2-${owner.command}.ts`));
      for (const command of [
        `shop:catalog:v2:${owner.command}:audit`,
        `shop:catalog:v2:${owner.command}:backfill`,
      ]) {
        if (!packageJson.scripts?.[command])
          throw new Error(`${command} package command is missing`);
      }
      for (const product of partitionProducts) owned.push({ source: partition, product });
      shardReports.push({
        source: partition,
        records: partitionProducts.length,
        rawLeaves: partitionProducts.reduce(
          (sum, product) => sum + flattenShopCatalogRawPayload(product).length,
          0
        ),
      });
    }
  }

  const ids = new Set<string>();
  for (const entry of owned) {
    if (!entry.product.id || ids.has(entry.product.id)) {
      throw new Error(`Duplicate or empty catalog product identity: ${entry.product.id}`);
    }
    ids.add(entry.product.id);
  }
  const report = {
    version: 2,
    manifestStores: expectedStores.length,
    ownedSources: shardReports.length,
    records: owned.length,
    uniqueProductIds: ids.size,
    rawLeaves: shardReports.reduce((sum, entry) => sum + entry.rawLeaves, 0),
    sources: shardReports.sort((left, right) => left.source.localeCompare(right.source)),
    fingerprint: createHash("sha256")
      .update(
        owned
          .map((entry) => `${entry.source}:${entry.product.id}`)
          .sort()
          .join("\n")
      )
      .digest("hex"),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
