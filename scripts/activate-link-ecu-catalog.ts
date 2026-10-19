/**
 * Publishes the reviewed Link ECU drafts (owner approval required).
 *
 *   npx tsx --conditions=react-server scripts/activate-link-ecu-catalog.ts            # preflight
 *   LINK_ECU_CATALOG_ACTIVATION_ACK=1 npx tsx --conditions=react-server scripts/activate-link-ecu-catalog.ts --commit
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import { LINK_ECU_BRAND, type LinkEcuSourceProduct } from "../src/lib/linkEcuCatalog";
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
  throw new Error("Link ECU activation retry loop exhausted");
}

function assertActivationAuthorization() {
  if (process.env.LINK_ECU_CATALOG_ACTIVATION_ACK !== "1") {
    throw new Error("Set LINK_ECU_CATALOG_ACTIVATION_ACK=1 to publish Link ECU products");
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
}

async function main() {
  const commit = process.argv.includes("--commit");
  if (commit) assertActivationAuthorization();
  const source = JSON.parse(await readFile(path.resolve("data/link-ecu/source.json"), "utf8")) as {
    products: LinkEcuSourceProduct[];
  };
  const expectedSkus = new Set(source.products.map((product) => product.sku));

  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: LINK_ECU_BRAND },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        status: true,
        isPublished: true,
        catalogVersion: true,
        stock: true,
        priceEur: true,
        priceSourceCurrency: true,
        image: true,
        media: { where: { mediaType: "IMAGE" }, select: { id: true } },
        variants: { select: { priceEur: true } },
        metafields: {
          where: {
            OR: [
              { namespace: "onecompany", key: "supplier_fitment" },
              { namespace: "link_ecu_import", key: "official_url" },
              { namespace: "link_ecu_import", key: "rrp_eur" },
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
      if (product.priceSourceCurrency !== "EUR") issues.push("price source is not EUR");
      if (!product.priceEur || Number(product.priceEur) <= 0) issues.push("missing EUR price");
      if (product.variants.some((variant) => !variant.priceEur || Number(variant.priceEur) <= 0)) {
        issues.push("missing variant EUR price");
      }
      if (!product.media.length || !product.image) issues.push("missing product image");
      if (!product.metafields.some((item) => item.key === "official_url")) {
        issues.push("missing Link provenance");
      }
      if (product.stock !== "preOrder") issues.push("stock is not preOrder");
      return issues.length ? [{ sku: product.sku, issues }] : [];
    });

    const report = {
      mode: commit ? "commit" : "dry-run",
      expected: expectedSkus.size,
      products: products.length,
      alreadyPublished: products.filter((product) => product.isPublished).length,
      drafts: products.filter((product) => product.status === "DRAFT" && !product.isPublished)
        .length,
      invalid,
      ready: products.length === expectedSkus.size && invalid.length === 0,
    };
    if (!report.ready)
      throw new Error(`Link ECU activation preflight failed: ${JSON.stringify(report)}`);
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
                  id: "link-ecu-import@system.local",
                  reason: "link-ecu.initial-activation",
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
        workerId: `link-ecu-activation-cli:${process.pid}`,
        limit: 1,
      });
      publicationCompleted += publication.completed;
      if (publication.retried || publication.deadLettered) {
        throw new Error(`Link ECU publication failed: ${JSON.stringify(publication)}`);
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
