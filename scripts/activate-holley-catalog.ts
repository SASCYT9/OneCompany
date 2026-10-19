/**
 * Publishes the reviewed Dinan / APR drafts (owner approval required).
 *
 *   npx tsx --conditions=react-server scripts/activate-holley-catalog.ts --brand=dinan            # preflight
 *   HOLLEY_CATALOG_ACTIVATION_ACK=1 npx tsx --conditions=react-server scripts/activate-holley-catalog.ts --brand=dinan --commit
 */
import { Prisma, PrismaClient } from "@prisma/client";

import { HOLLEY_BRANDS, type HolleyBrandKey } from "../src/lib/holleyBrandCatalog";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";
import { parseSupplierFitmentContract } from "../src/lib/shopImportFitment";
import { loadHolleyImport } from "./import-holley-catalog-drafts";

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
  throw new Error("Holley activation retry loop exhausted");
}

function assertActivationAuthorization() {
  if (process.env.HOLLEY_CATALOG_ACTIVATION_ACK !== "1") {
    throw new Error("Set HOLLEY_CATALOG_ACTIVATION_ACK=1 to publish Dinan / APR products");
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
}

async function main() {
  const brand = process.argv.find((value) => value.startsWith("--brand="))?.split("=")[1] as
    | HolleyBrandKey
    | undefined;
  if (brand !== "dinan" && brand !== "apr") throw new Error("--brand=dinan|apr is required");
  const commit = process.argv.includes("--commit");
  if (commit) assertActivationAuthorization();
  const meta = HOLLEY_BRANDS[brand];
  const { payloads } = await loadHolleyImport(brand);
  const expectedSkus = new Set(payloads.map((payload) => payload.sku));

  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: meta.brand },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        status: true,
        isPublished: true,
        catalogVersion: true,
        stock: true,
        priceUsd: true,
        priceSourceCurrency: true,
        image: true,
        media: { where: { mediaType: "IMAGE" }, select: { id: true } },
        variants: { select: { priceUsd: true } },
        metafields: {
          where: {
            OR: [
              { namespace: "onecompany", key: "supplier_fitment" },
              { namespace: meta.namespace, key: "official_url" },
              { namespace: meta.namespace, key: "pricing" },
            ],
          },
          select: { namespace: true, key: true, value: true },
        },
      },
    });

    const invalid = products.flatMap((product) => {
      const issues: string[] = [];
      if (!product.sku || !expectedSkus.has(product.sku)) issues.push("not in the reviewed source");
      const fitment = parseSupplierFitmentContract(
        product.metafields.find((item) => item.key === "supplier_fitment")?.value
      );
      if (!fitment) issues.push("invalid supplier fitment contract");
      if (product.priceSourceCurrency !== "USD") issues.push("price source is not USD");
      if (!product.priceUsd || Number(product.priceUsd) <= 0) issues.push("missing USD price");
      if (product.variants.some((variant) => !variant.priceUsd || Number(variant.priceUsd) <= 0)) {
        issues.push("missing variant USD price");
      }
      if (!product.media.length || !product.image) issues.push("missing product image");
      if (!product.metafields.some((item) => item.key === "official_url")) {
        issues.push(`missing ${meta.brand} provenance`);
      }
      if (!product.metafields.some((item) => item.key === "pricing")) {
        issues.push("missing price decision");
      }
      if (product.stock !== "preOrder") issues.push("stock is not preOrder");
      return issues.length ? [{ sku: product.sku, issues }] : [];
    });

    const report = {
      mode: commit ? "commit" : "dry-run",
      brand: meta.brand,
      expected: expectedSkus.size,
      products: products.length,
      alreadyPublished: products.filter((product) => product.isPublished).length,
      drafts: products.filter((product) => product.status === "DRAFT" && !product.isPublished)
        .length,
      invalid,
      ready: products.length === expectedSkus.size && invalid.length === 0,
    };
    if (!report.ready) {
      throw new Error(`${meta.brand} activation preflight failed: ${JSON.stringify(report)}`);
    }
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
                  id: `${brand}-import@system.local`,
                  reason: `${brand}.initial-activation`,
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
        workerId: `${brand}-activation-cli:${process.pid}`,
        limit: 1,
      });
      publicationCompleted += publication.completed;
      if (publication.retried || publication.deadLettered) {
        throw new Error(`${meta.brand} publication failed: ${JSON.stringify(publication)}`);
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
