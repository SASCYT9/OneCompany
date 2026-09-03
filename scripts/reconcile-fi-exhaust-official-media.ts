import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import type { FiCanonicalDraft } from "../src/lib/shopCatalogFiDraft";

async function main() {
  const commit = process.argv.includes("--commit");
  const drafts = JSON.parse(await readFile(resolve("backups/shopify/fi-exhaust/2026-09-03/canonical-drafts.json"), "utf8")) as FiCanonicalDraft[];
  const targets = drafts.filter((draft) => draft.metafields.some((field) => field.key === "official_media_source"));
  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({ where: { key: "shopify-fi-exhaust" } });
    let inserted = 0;
    for (const draft of targets) {
      const head = await prisma.shopCatalogSourceBindingHead.findUniqueOrThrow({
        where: { sourceId_entityType_externalKey: { sourceId: source.id, entityType: "PRODUCT", externalKey: draft.source.externalProductId } },
        select: { currentBinding: { select: { productId: true } } },
      });
      const productId = head.currentBinding.productId;
      if (!productId) throw new Error(`Missing product binding ${draft.source.externalProductId}`);
      const media = draft.media.filter((entry) => entry.mediaType === "IMAGE");
      if (!commit) { inserted += media.length; continue; }
      await prisma.$transaction(async (tx) => {
        for (const entry of media) {
          const exists = await tx.shopProductMedia.findFirst({ where: { productId, src: entry.src }, select: { id: true } });
          if (!exists) {
            await tx.shopProductMedia.create({ data: { productId, mediaType: "IMAGE", src: entry.src, altText: entry.altText, position: entry.position } });
            inserted += 1;
          }
        }
        await tx.shopProduct.update({ where: { id: productId }, data: { image: media[0]?.src ?? null, gallery: media.map((entry) => entry.src) } });
        const sourceField = draft.metafields.find((field) => field.key === "official_media_source")!;
        await tx.shopProductMetafield.upsert({
          where: { productId_namespace_key: { productId, namespace: sourceField.namespace, key: sourceField.key } },
          create: { productId, namespace: sourceField.namespace, key: sourceField.key, value: sourceField.value, valueType: sourceField.valueType },
          update: { value: sourceField.value, valueType: sourceField.valueType },
        });
        await tx.shopCatalogNormalizationIssue.deleteMany({ where: { productId, code: "IMAGES_MISSING" } });
      });
    }
    process.stdout.write(`${JSON.stringify({ mode: commit ? "commit" : "dry-run", products: targets.length, officialImages: inserted }, null, 2)}\n`);
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
