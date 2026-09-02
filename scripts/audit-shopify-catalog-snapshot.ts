import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { auditShopifySnapshot, parseShopifyProductJsonl } from "../src/lib/shopifyCatalogSnapshot";

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    throw new TypeError("Usage: tsx scripts/audit-shopify-catalog-snapshot.ts <snapshot.jsonl> [report.json]");
  }
  const outputPath = process.argv[3] ?? `${sourcePath}.audit.json`;
  const products = parseShopifyProductJsonl(await readFile(resolve(sourcePath), "utf8"));
  const report = auditShopifySnapshot(products, "shopify-kw-suspensions");
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
