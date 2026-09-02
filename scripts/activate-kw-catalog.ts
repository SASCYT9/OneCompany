import { Prisma, PrismaClient } from "@prisma/client";

import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

const CHANGE_DOMAINS = ["CONTENT", "SEO", "MEDIA", "PRICE", "INVENTORY", "FITMENT", "TAXONOMY", "VISIBILITY"] as const;

async function retryTransient<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (!["P1017", "P2024", "P2034"].includes(code) || attempt === 5) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 250));
    }
  }
  throw new Error("KW activation retry loop exhausted");
}

function assertProductionAuthorization() {
  if (process.env.KW_CATALOG_ACTIVATION_ACK !== "1") throw new Error("Set KW_CATALOG_ACTIVATION_ACK=1 to activate KW products");
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const url = new URL(databaseUrl);
  if (url.hostname !== "db.prisma.io" || url.pathname !== "/postgres") throw new Error("KW activation target must be the approved production database");
}

async function main() {
  const commit = process.argv.includes("--commit");
  const concurrency = 8;
  if (commit) assertProductionAuthorization();
  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({ where: { key: "shopify-kw-suspensions" } });
    const heads = await prisma.shopCatalogSourceBindingHead.findMany({
      where: { sourceId: source.id, entityType: "PRODUCT" },
      orderBy: { externalKey: "asc" },
      select: { currentBinding: { select: { productId: true, sourceRecordId: true, product: { select: { catalogVersion: true, isPublished: true, status: true } } } } },
    });
    const owned = heads.flatMap((head) => head.currentBinding.productId && head.currentBinding.sourceRecordId && head.currentBinding.product
      ? [{ productId: head.currentBinding.productId, sourceRecordId: head.currentBinding.sourceRecordId, product: head.currentBinding.product }]
      : []);
    const fitments = await prisma.shopProductMetafield.findMany({
      where: { productId: { in: owned.map((entry) => entry.productId) }, namespace: "onecompany", key: "normalized_fitment" },
      select: { productId: true, value: true },
    });
    const blocked = fitments.filter((field) => (JSON.parse(field.value) as { status?: string }).status === "needs_review").map((field) => field.productId);
    const report = {
      mode: commit ? "commit" : "dry-run",
      ownedProducts: owned.length,
      fitments: fitments.length,
      blockedFitments: blocked.length,
      unpublishedVersionZero: owned.filter((entry) => !entry.product.isPublished && entry.product.catalogVersion === BigInt(0)).length,
      alreadyPublished: owned.filter((entry) => entry.product.isPublished).length,
      ready: owned.length === 1_999 && fitments.length === 1_999 && blocked.length === 0,
    };
    if (!report.ready) throw new Error(`KW activation preflight failed: ${JSON.stringify(report)}`);
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    let activated = 0;
    let idempotent = 0;
    for (let offset = 0; offset < owned.length; offset += concurrency) {
      const results = await Promise.all(owned.slice(offset, offset + concurrency).map(async (entry) => {
        if (entry.product.isPublished) return "idempotent" as const;
        await retryTransient(() => prisma.$transaction((tx) => coordinateShopCatalogProductMutationInTransaction(tx, {
        productId: entry.productId,
        expectedCatalogVersion: entry.product.catalogVersion.toString(),
        changeDomains: CHANGE_DOMAINS,
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          await tx.shopProduct.update({ where: { id: entry.productId }, data: { isPublished: true, status: "ACTIVE", publishedAt: new Date() } });
          const snapshot = await buildShopCatalogAdminSnapshot(tx, entry.productId, nextCatalogVersion, { type: "IMPORT", id: "kw-shopify-import@system.local", reason: "kw.initial-activation" });
          return { ...snapshot, sourceRecordId: entry.sourceRecordId };
        },
        }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }));
        return "activated" as const;
      }));
      activated += results.filter((result) => result === "activated").length;
      idempotent += results.filter((result) => result === "idempotent").length;
      if ((activated + idempotent) % 100 === 0) process.stdout.write(`${JSON.stringify({ processed: activated + idempotent, activated, idempotent })}\n`);
    }
    let publicationCompleted = 0;
    for (;;) {
      const publication = await runShopCatalogOutboxRuntime({ workerId: `kw-activation-cli:${process.pid}`, limit: 10 });
      publicationCompleted += publication.completed;
      if (!publication.claimed) break;
      if (publication.retried || publication.deadLettered) throw new Error(`KW publication failed: ${JSON.stringify(publication)}`);
    }
    process.stdout.write(`${JSON.stringify({ ...report, activated, idempotent, publicationCompleted }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
