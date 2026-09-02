import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { buildKwCanonicalProductDraft } from "../src/lib/shopCatalogKwDraft";
import { ensureKwImportDependencies, insertKwDraftWithClient } from "../src/lib/shopCatalogKwImportWriter.server";
import { buildKwVehicleMakeEvidence, normalizeKwShopifyProduct } from "../src/lib/shopCatalogKwNormalization";
import { parseShopifyProductJsonl, parseShopifyProductTranslationMap, selectKwShopifyProducts } from "../src/lib/shopifyCatalogSnapshot";

async function insertWithRetry(input: Parameters<typeof insertKwDraftWithClient>[0]) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await insertKwDraftWithClient(input);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
      if (code !== "P2034" || attempt === 5) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 100));
    }
  }
  throw new Error("KW import retry loop exhausted");
}

async function main() {
  const commit = process.argv.includes("--commit-draft");
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice(8)) : Number.POSITIVE_INFINITY;
  const concurrencyArg = process.argv.find((value) => value.startsWith("--concurrency="));
  const concurrency = concurrencyArg ? Number(concurrencyArg.slice(14)) : 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new TypeError("--concurrency must be between 1 and 8");
  const productsPath = resolve("backups/shopify/kw-suspensions/2026-09-02/products.jsonl");
  const translationsPath = resolve("backups/shopify/kw-suspensions/2026-09-02/translations-en.jsonl");
  const products = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(productsPath, "utf8")));
  const translations = parseShopifyProductTranslationMap(await readFile(translationsPath, "utf8"));
  const evidence = buildKwVehicleMakeEvidence(products);
  const prepared = products.map((product) => ({ product, draft: buildKwCanonicalProductDraft({ product, normalization: normalizeKwShopifyProduct(product, evidence), enTranslations: translations.get(product.id) }) }));
  if (!commit) {
    console.log(JSON.stringify({ mode: "dry-run", prepared: prepared.length, selected: Math.min(prepared.length, limit), published: 0 }, null, 2));
    return;
  }
  const prisma = new PrismaClient();
  try {
    const dependencies = await ensureKwImportDependencies(prisma);
    let inserted = 0;
    let idempotent = 0;
    const selected = prepared.slice(0, limit);
    for (let offset = 0; offset < selected.length; offset += concurrency) {
      const results = await Promise.all(selected.slice(offset, offset + concurrency).map((entry) => insertWithRetry({
        client: prisma,
        rawProduct: entry.product,
        draft: entry.draft,
        dependencies,
      })));
      for (const result of results) {
        if (result.status === "inserted") inserted += 1;
        else idempotent += 1;
      }
      if ((inserted + idempotent) % 100 === 0) console.log(JSON.stringify({ processed: inserted + idempotent, inserted, idempotent }));
    }
    console.log(JSON.stringify({ mode: "commit-draft", inserted, idempotent, published: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
