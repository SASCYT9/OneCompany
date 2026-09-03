import { Prisma, PrismaClient } from "@prisma/client";

import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

const CHANGE_DOMAINS = ["CONTENT", "SEO", "MEDIA", "PRICE", "INVENTORY", "FITMENT", "TAXONOMY", "VISIBILITY"] as const;

async function main() {
  const commit = process.argv.includes("--commit");
  if (commit && process.env.FI_CATALOG_ACTIVATION_ACK !== "1") throw new Error("Set FI_CATALOG_ACTIVATION_ACK=1 to activate Fi EXHAUST products");
  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({ where: { key: "shopify-fi-exhaust" } });
    const heads = await prisma.shopCatalogSourceBindingHead.findMany({
      where: { sourceId: source.id, entityType: "PRODUCT" }, orderBy: { externalKey: "asc" },
      select: { currentBinding: { select: { productId: true, sourceRecordId: true, product: { select: { catalogVersion: true, isPublished: true } } } } },
    });
    const owned = heads.flatMap((head) => head.currentBinding.productId && head.currentBinding.sourceRecordId && head.currentBinding.product ? [{ productId: head.currentBinding.productId, sourceRecordId: head.currentBinding.sourceRecordId, product: head.currentBinding.product }] : []);
    const [fitments, issues, incompleteEnglish, missingCommerce, imageCount, videoCount] = await Promise.all([
      prisma.shopProductMetafield.count({ where: { productId: { in: owned.map((entry) => entry.productId) }, namespace: "onecompany", key: "normalized_fitment" } }),
      prisma.shopCatalogNormalizationIssue.count({ where: { sourceRecord: { sourceId: source.id } } }),
      prisma.shopProduct.count({ where: { id: { in: owned.map((entry) => entry.productId) }, OR: [{ titleEn: "" }, { bodyHtmlEn: null }, { bodyHtmlEn: "" }] } }),
      prisma.shopProduct.count({ where: { id: { in: owned.map((entry) => entry.productId) }, OR: [{ sku: null }, { sku: "" }, { priceUah: null }, { image: null }] } }),
      prisma.shopProductMedia.count({ where: { productId: { in: owned.map((entry) => entry.productId) }, mediaType: "IMAGE" } }),
      prisma.shopProductMedia.count({ where: { productId: { in: owned.map((entry) => entry.productId) }, mediaType: "EXTERNAL_VIDEO" } }),
    ]);
    const report = { mode: commit ? "commit" : "dry-run", products: owned.length, fitments, issues, incompleteEnglish, missingCommerce, imageCount, videoCount, alreadyPublished: owned.filter((entry) => entry.product.isPublished).length, ready: owned.length === 223 && fitments === 223 && issues === 0 && incompleteEnglish === 0 && missingCommerce === 0 && imageCount === 898 && videoCount === 153 };
    if (!report.ready) throw new Error(`Fi activation preflight failed: ${JSON.stringify(report)}`);
    if (!commit) { process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); return; }
    let activated = 0;
    let idempotent = 0;
    for (const entry of owned) {
      if (entry.product.isPublished) { idempotent += 1; continue; }
      await prisma.$transaction((tx) => coordinateShopCatalogProductMutationInTransaction(tx, {
        productId: entry.productId, expectedCatalogVersion: entry.product.catalogVersion.toString(), changeDomains: CHANGE_DOMAINS,
        async mutateAndSnapshot(transaction, nextCatalogVersion) {
          await transaction.shopProduct.update({ where: { id: entry.productId }, data: { isPublished: true, status: "ACTIVE", publishedAt: new Date() } });
          const snapshot = await buildShopCatalogAdminSnapshot(transaction, entry.productId, nextCatalogVersion, { type: "IMPORT", id: "fi-shopify-import@system.local", reason: "fi.initial-activation" });
          return { ...snapshot, sourceRecordId: entry.sourceRecordId };
        },
      }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
      activated += 1;
      if ((activated + idempotent) % 25 === 0) process.stdout.write(`${JSON.stringify({ processed: activated + idempotent, activated, idempotent })}\n`);
    }
    let publicationCompleted = 0;
    for (;;) {
      const publication = await runShopCatalogOutboxRuntime({ workerId: `fi-activation-cli:${process.pid}`, limit: 10 });
      publicationCompleted += publication.completed;
      if (!publication.claimed) break;
      if (publication.retried || publication.deadLettered) throw new Error(`Fi publication failed: ${JSON.stringify(publication)}`);
    }
    process.stdout.write(`${JSON.stringify({ ...report, activated, idempotent, publicationCompleted }, null, 2)}\n`);
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
