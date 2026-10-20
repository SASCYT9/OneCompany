/**
 * Publishes the reviewed CT Carbon drafts (owner approval required).
 *
 *   npx tsx --conditions=react-server scripts/activate-ct-carbon-catalog.ts            # preflight
 *   CT_CARBON_CATALOG_ACTIVATION_ACK=1 npx tsx --conditions=react-server scripts/activate-ct-carbon-catalog.ts --commit
 *
 * Photos must already be copied to Vercel Blob (scripts/migrate-shop-product-media-to-blob.ts
 * --brand="CT Carbon" --allow-partial --commit); --allow-remote-images skips that check.
 */
import { Prisma, PrismaClient } from "@prisma/client";

import { CT_CARBON_BRAND } from "../src/lib/ctCarbonCatalog";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";
import { parseSupplierFitmentContract } from "../src/lib/shopImportFitment";
import { loadCtCarbonImport } from "./import-ct-carbon-catalog-drafts";

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

const isBlobUrl = (value: string | null | undefined) =>
  Boolean(value && value.includes(".public.blob.vercel-storage.com/"));

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
  throw new Error("CT Carbon activation retry loop exhausted");
}

function assertActivationAuthorization() {
  if (process.env.CT_CARBON_CATALOG_ACTIVATION_ACK !== "1") {
    throw new Error("Set CT_CARBON_CATALOG_ACTIVATION_ACK=1 to publish CT Carbon products");
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
}

async function main() {
  const commit = process.argv.includes("--commit");
  const requireBlob = !process.argv.includes("--allow-remote-images");
  if (commit) assertActivationAuthorization();
  const { payloads, problems } = await loadCtCarbonImport();
  if (problems.length) {
    throw new Error(
      `CT Carbon source is not ready (${problems.length}):\n${problems.slice(0, 40).join("\n")}`
    );
  }
  const expectedSkus = new Set(payloads.map((payload) => payload.sku));
  const reviewed = new Map(payloads.map((payload) => [payload.sku, payload]));

  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: CT_CARBON_BRAND },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        status: true,
        isPublished: true,
        catalogVersion: true,
        stock: true,
        titleEn: true,
        priceUsd: true,
        priceSourceCurrency: true,
        image: true,
        media: { where: { mediaType: "IMAGE" }, select: { src: true } },
        variants: { select: { sku: true, priceUsd: true } },
        metafields: {
          where: {
            OR: [
              { namespace: "onecompany", key: "supplier_fitment" },
              { namespace: "ct_carbon_import", key: "official_url" },
              { namespace: "ct_carbon_import", key: "pricing" },
            ],
          },
          select: { namespace: true, key: true, value: true },
        },
      },
    });

    const invalid = products.flatMap((product) => {
      const issues: string[] = [];
      if (!product.sku || !expectedSkus.has(product.sku)) issues.push("not in the reviewed source");
      // The draft must be the reviewed payload as it stands now (re-import after any change).
      const payload = reviewed.get(product.sku);
      if (payload) {
        const priceOf = (value: unknown) => Number(value ?? 0).toFixed(2);
        const storedVariants = product.variants
          .map((variant) => `${variant.sku}=${priceOf(variant.priceUsd)}`)
          .sort();
        const reviewedVariants = payload.variants
          .map((variant) => `${variant.sku}=${priceOf(variant.priceUsd)}`)
          .sort();
        if (priceOf(product.priceUsd) !== priceOf(payload.priceUsd)) {
          issues.push("price differs from the reviewed source");
        }
        if (storedVariants.join() !== reviewedVariants.join()) {
          issues.push("variants differ from the reviewed source");
        }
        if (product.titleEn !== payload.titleEn)
          issues.push("title differs from the reviewed source");
      }
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
      if (
        requireBlob &&
        (!isBlobUrl(product.image) || product.media.some((item) => !isBlobUrl(item.src)))
      ) {
        issues.push("photos are not in Vercel Blob yet");
      }
      if (!product.metafields.some((item) => item.key === "official_url")) {
        issues.push("missing CT Carbon provenance");
      }
      if (!product.metafields.some((item) => item.key === "pricing"))
        issues.push("missing price decision");
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
      invalid: invalid.length,
      invalidSample: invalid.slice(0, 20),
      ready: products.length === expectedSkus.size && invalid.length === 0,
    };
    if (!report.ready) {
      throw new Error(`CT Carbon activation preflight failed: ${JSON.stringify(report)}`);
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
                  id: "ct-carbon-import@system.local",
                  reason: "ct-carbon.initial-activation",
                });
              },
            }),
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }
        )
      );
      activated += 1;
      if (activated % 100 === 0) process.stderr.write(`activated ${activated}\n`);
    }

    // Publish the catalogue projections of CT Carbon jobs only: the activations and the
    // older draft/media jobs of the same products (no-ops once a newer version is
    // published, but they would otherwise queue ahead of other brands in the cron).
    // A write conflict with another worker only reschedules a job (status RETRY), so it
    // is counted and left for the next run.
    const pendingJobs = await prisma.shopCatalogOutbox.findMany({
      where: {
        productId: { in: products.map((product) => product.id) },
        status: { in: ["PENDING", "RETRY", "PROCESSING"] },
      },
      select: { id: true },
    });
    const jobIds = pendingJobs.map((job) => job.id);
    let publicationCompleted = 0;
    let publicationRetried = 0;
    for (let offset = 0; offset < jobIds.length; offset += 500) {
      const outboxIds = jobIds.slice(offset, offset + 500);
      for (;;) {
        const publication = await runShopCatalogOutboxRuntime({
          workerId: `ct-carbon-activation-cli:${process.pid}`,
          limit: 10,
          outboxIds,
        });
        publicationCompleted += publication.completed;
        publicationRetried += publication.retried;
        if (publication.deadLettered) {
          throw new Error(`CT Carbon publication failed: ${JSON.stringify(publication)}`);
        }
        if (!publication.claimed) break;
      }
      process.stderr.write(`published ${Math.min(offset + 500, jobIds.length)}/${jobIds.length}\n`);
    }
    // A rerun skips products that are already active, so a projection job that failed for
    // good in an earlier run must still fail this one.
    const deadLettered = await prisma.shopCatalogOutbox.count({
      where: {
        productId: { in: products.map((product) => product.id) },
        status: "DEAD_LETTER",
      },
    });
    if (deadLettered) {
      throw new Error(
        `CT Carbon publication: ${deadLettered} catalog job(s) are dead-lettered; repair them before treating the release as published`
      );
    }

    process.stdout.write(
      `${JSON.stringify(
        { ...report, activated, idempotent, publicationCompleted, publicationRetried },
        null,
        2
      )}\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
