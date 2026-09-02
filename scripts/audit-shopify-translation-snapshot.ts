import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { auditShopifyProductTranslations } from "../src/lib/shopifyCatalogSnapshot";

async function main() {
  const sourcePath = process.argv[2];
  const locale = process.argv[3];
  if (!sourcePath || !locale) {
    throw new TypeError("Usage: tsx scripts/audit-shopify-translation-snapshot.ts <snapshot.jsonl> <locale> [report.json]");
  }
  const outputPath = process.argv[4] ?? `${sourcePath}.${locale}.audit.json`;
  const report = auditShopifyProductTranslations(await readFile(resolve(sourcePath), "utf8"), locale);
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
