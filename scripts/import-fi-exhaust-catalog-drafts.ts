import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import type { FiCanonicalDraft, FiSourceProduct } from "../src/lib/shopCatalogFiDraft";
import { ensureFiImportDependencies, insertFiDraftWithClient } from "../src/lib/shopCatalogFiImportWriter.server";

const ROOT = resolve("backups/shopify/fi-exhaust/2026-09-03");

async function main() {
  const commit = process.argv.includes("--commit-draft");
  const products = JSON.parse(await readFile(resolve(ROOT, "products.json"), "utf8")) as FiSourceProduct[];
  const drafts = JSON.parse(await readFile(resolve(ROOT, "canonical-drafts.json"), "utf8")) as FiCanonicalDraft[];
  if (products.length !== 223 || drafts.length !== products.length) throw new Error("Fi source/draft count gate failed");
  const blocked = drafts.filter((draft) => draft.issues.some((issue) => issue !== "images_missing"));
  if (blocked.length) throw new Error(`${blocked.length} Fi drafts have blocking issues`);
  if (!commit) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", products: drafts.length, variants: drafts.reduce((sum, draft) => sum + draft.variants.length, 0), media: drafts.reduce((sum, draft) => sum + draft.media.length, 0), published: 0 }, null, 2)}\n`);
    return;
  }
  const rawById = new Map(products.map((product) => [String(product.id), product]));
  const prisma = new PrismaClient();
  try {
    const dependencies = await ensureFiImportDependencies(prisma);
    let inserted = 0;
    let idempotent = 0;
    for (const draft of drafts) {
      const rawProduct = rawById.get(draft.source.externalProductId);
      if (!rawProduct) throw new Error(`Missing raw Fi product ${draft.source.externalProductId}`);
      const result = await insertFiDraftWithClient({ client: prisma, draft, rawProduct, dependencies });
      if (result.status === "inserted") inserted += 1; else idempotent += 1;
      if ((inserted + idempotent) % 25 === 0) process.stdout.write(`${JSON.stringify({ processed: inserted + idempotent, inserted, idempotent })}\n`);
    }
    process.stdout.write(`${JSON.stringify({ mode: "commit-draft", inserted, idempotent, published: 0 }, null, 2)}\n`);
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
