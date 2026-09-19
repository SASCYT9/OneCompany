import { Prisma, PrismaClient } from "@prisma/client";

import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";
import { parseSupplierFitmentContract } from "../src/lib/shopImportFitment";

const CHANGE_DOMAINS = [
  "CONTENT",
  "SEO",
  "MEDIA",
  "PRICE",
  "INVENTORY",
  "FITMENT",
  "TAXONOMY",
  "VISIBILITY",
] as const;

async function retryTransient<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (!(code === "P1017" || code === "P2024" || code === "P2034") || attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw new Error("MST activation retry loop exhausted");
}

function assertActivationAuthorization() {
  if (process.env.MST_CATALOG_ACTIVATION_ACK !== "1") {
    throw new Error("Set MST_CATALOG_ACTIVATION_ACK=1 to activate MST products");
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
}

async function main() {
  const commit = process.argv.includes("--commit");
  if (commit) assertActivationAuthorization();

  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: "MST Performance" },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        status: true,
        isPublished: true,
        publishedAt: true,
        catalogVersion: true,
        stock: true,
        priceUsd: true,
        image: true,
        media: { where: { mediaType: "IMAGE" }, select: { id: true } },
        variants: { select: { priceUsd: true, inventoryQty: true } },
        metafields: {
          where: {
            OR: [
              { namespace: "onecompany", key: "supplier_fitment" },
              { namespace: "mst_import", key: "sendit_url" },
              { namespace: "mst_import", key: "sendit_sku" },
            ],
          },
          select: { namespace: true, key: true, value: true },
        },
      },
    });

    const invalid = products.flatMap((product) => {
      const issues: string[] = [];
      const fitmentRaw = product.metafields.find(
        (item) => item.namespace === "onecompany" && item.key === "supplier_fitment"
      )?.value;
      const fitment = parseSupplierFitmentContract(fitmentRaw);
      if (!fitment) issues.push("invalid supplier fitment contract");
      if (!product.priceUsd || product.priceUsd <= 0) issues.push("missing USD price");
      if (product.variants.some((variant) => !variant.priceUsd || variant.priceUsd <= 0)) {
        issues.push("missing variant USD price");
      }
      if (!product.media.length || !product.image) issues.push("missing product image");
      if (
        !product.metafields.some(
          (item) => item.namespace === "mst_import" && item.key === "sendit_url"
        ) ||
        !product.metafields.some(
          (item) => item.namespace === "mst_import" && item.key === "sendit_sku"
        )
      ) {
        issues.push("missing Sendit provenance");
      }
      if (product.stock !== "preOrder") issues.push("stock is not preOrder");
      return issues.length ? [{ sku: product.sku, issues }] : [];
    });

    const report = {
      mode: commit ? "commit" : "dry-run",
      products: products.length,
      alreadyPublished: products.filter((product) => product.isPublished).length,
      drafts: products.filter((product) => product.status === "DRAFT" && !product.isPublished)
        .length,
      preOrder: products.filter((product) => product.stock === "preOrder").length,
      zeroInventory: products.filter((product) =>
        product.variants.every((variant) => (variant.inventoryQty ?? 0) === 0)
      ).length,
      invalid,
      ready: products.length === 52 && invalid.length === 0,
    };

    if (!report.ready)
      throw new Error(`MST activation preflight failed: ${JSON.stringify(report)}`);
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    let activated = 0;
    let idempotent = 0;
    for (const product of products) {
      if (product.isPublished && product.status === "ACTIVE") {
        idempotent += 1;
        continue;
      }
      await retryTransient(() =>
        prisma.$transaction(
          (tx) =>
            coordinateShopCatalogProductMutationInTransaction(tx, {
              productId: product.id,
              expectedCatalogVersion: product.catalogVersion.toString(),
              changeDomains: CHANGE_DOMAINS,
              async mutateAndSnapshot(transaction, nextCatalogVersion) {
                await transaction.shopProduct.update({
                  where: { id: product.id },
                  data: { isPublished: true, status: "ACTIVE", publishedAt: new Date() },
                });
                return buildShopCatalogAdminSnapshot(transaction, product.id, nextCatalogVersion, {
                  type: "IMPORT",
                  id: "mst-import@system.local",
                  reason: "mst.initial-activation",
                });
              },
            }),
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }
        )
      );
      activated += 1;
    }

    let publicationCompleted = 0;
    for (;;) {
      const publication = await runShopCatalogOutboxRuntime({
        workerId: `mst-activation-cli:${process.pid}`,
        limit: 1,
      });
      publicationCompleted += publication.completed;
      if (publication.retried || publication.deadLettered) {
        throw new Error(`MST publication failed: ${JSON.stringify(publication)}`);
      }
      if (!publication.claimed) break;
    }

    process.stdout.write(
      `${JSON.stringify({ ...report, activated, idempotent, publicationCompleted }, null, 2)}\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
