import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  adminProductImportMergeSelect,
  buildAdminProductCreateData,
  buildAdminProductSnapshotMergeUpdateData,
  type AdminShopProductPayload,
} from "../src/lib/shopAdminCatalog";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductCreationWithClient,
  coordinateShopCatalogProductMutationWithClient,
} from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

type RevozportPayload = AdminShopProductPayload & {
  source?: {
    statusReason?: string;
  };
};

type PreviewFile = {
  schemaVersion: number;
  generatedAt: string;
  products: RevozportPayload[];
};

const sourceIndex = process.argv.indexOf("--source");
const previewPath = path.resolve(
  sourceIndex >= 0
    ? process.argv[sourceIndex + 1] || ".tmp/revozport-catalog-preview.json"
    : ".tmp/revozport-catalog-preview.json"
);
const commit = process.argv.includes("--commit");
const dryRun = !commit;
const outputDir = path.resolve("artifacts/revozport-import");
const changeDomains = [
  "CONTENT",
  "SEO",
  "MEDIA",
  "PRICE",
  "INVENTORY",
  "FITMENT",
  "TAXONOMY",
  "VISIBILITY",
] as const;

function fail(message: string): never {
  throw new Error(message);
}

function isReadyForPublication(product: RevozportPayload) {
  return (
    product.status === "ACTIVE" &&
    Boolean(product.priceUsd && product.priceUsd > 0) &&
    Boolean(product.image) &&
    Boolean(product.length && product.width && product.height) &&
    Boolean(product.weight && product.weight > 0)
  );
}

function normalizeProduct(product: RevozportPayload): RevozportPayload {
  if (product.brand !== "Revozport" || product.vendor !== "Revozport") {
    fail(`Unexpected brand/vendor for ${product.sku ?? product.slug}`);
  }
  if (!product.slug || !product.sku || !product.titleUa || !product.titleEn) {
    fail(`Required identity/content is missing for ${product.slug || product.sku || "unknown"}`);
  }
  if (!product.variants.length || product.variants.some((variant) => variant.sku !== product.sku)) {
    fail(`Variant identity mismatch for ${product.sku}`);
  }
  const ready = isReadyForPublication(product);
  return {
    ...product,
    status: ready ? "ACTIVE" : "DRAFT",
    isPublished: ready,
    publishedAt: ready ? new Date().toISOString() : null,
  };
}

function validatePreview(preview: PreviewFile) {
  if (preview.schemaVersion !== 1)
    fail(`Unsupported Revozport preview schema: ${preview.schemaVersion}`);
  if (!preview.products.length) fail("Revozport preview contains no products");
  const slugs = new Set<string>();
  const skus = new Set<string>();
  for (const product of preview.products) {
    if (slugs.has(product.slug)) fail(`Duplicate Revozport slug: ${product.slug}`);
    if (skus.has(product.sku ?? "")) fail(`Duplicate Revozport SKU: ${product.sku}`);
    slugs.add(product.slug);
    skus.add(product.sku ?? "");
  }
}

async function run() {
  const preview = JSON.parse(await readFile(previewPath, "utf8")) as PreviewFile;
  validatePreview(preview);
  const products = preview.products.map(normalizeProduct);
  const ready = products.filter(isReadyForPublication).length;
  const drafts = products.length - ready;

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          source: previewPath,
          generatedAt: preview.generatedAt,
          products: products.length,
          publishCandidates: ready,
          drafts,
          note: "No database writes were performed.",
        },
        null,
        2
      )
    );
    return;
  }

  const prisma = new PrismaClient();
  const created: string[] = [];
  const updated: string[] = [];
  const published: string[] = [];
  const draftSlugs: string[] = [];
  const outboxIds: string[] = [];

  try {
    for (const product of products) {
      const [bySlug, bySku] = await Promise.all([
        prisma.shopProduct.findUnique({
          where: { slug: product.slug },
          select: {
            ...adminProductImportMergeSelect,
            brand: true,
            catalogVersion: true,
          },
        }),
        prisma.shopProduct.findFirst({
          where: {
            OR: [{ sku: product.sku }, { variants: { some: { sku: product.sku } } }],
          },
          select: { id: true, slug: true, brand: true },
        }),
      ]);

      if (bySku && bySku.slug !== product.slug) {
        fail(`Revozport SKU ${product.sku} already belongs to ${bySku.slug}`);
      }
      if (bySlug && bySlug.brand !== "Revozport") {
        fail(`Revozport slug ${product.slug} already belongs to ${bySlug.brand ?? "(empty)"}`);
      }

      if (bySlug) {
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: bySlug.id,
          expectedCatalogVersion: bySlug.catalogVersion.toString(),
          changeDomains,
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({
              where: { id: bySlug.id },
              data: buildAdminProductSnapshotMergeUpdateData(product, bySlug),
            });
            return buildShopCatalogAdminSnapshot(tx, bySlug.id, nextCatalogVersion, {
              type: "IMPORT",
              id: "revozport-import@system.local",
              reason: "revozport.full-catalog-sync",
            });
          },
        });
        updated.push(product.slug);
        outboxIds.push(mutation.outboxId);
      } else {
        const mutation = await coordinateShopCatalogProductCreationWithClient(prisma, {
          changeDomains,
          async create(tx) {
            return (
              await tx.shopProduct.create({
                data: buildAdminProductCreateData(product),
                select: { id: true },
              })
            ).id;
          },
          snapshot(tx, productId, initialCatalogVersion) {
            return buildShopCatalogAdminSnapshot(tx, productId, initialCatalogVersion, {
              type: "IMPORT",
              id: "revozport-import@system.local",
              reason: "revozport.full-catalog-sync",
            });
          },
        });
        created.push(product.slug);
        outboxIds.push(mutation.outboxId);
      }

      if (product.isPublished) published.push(product.slug);
      else draftSlugs.push(product.slug);
    }

    const publication = await runShopCatalogOutboxRuntime({
      workerId: `revozport-import:${randomUUID()}`,
      limit: 50,
    });

    const report = {
      mode: "commit",
      source: previewPath,
      generatedAt: new Date().toISOString(),
      sourceGeneratedAt: preview.generatedAt,
      requested: products.length,
      created: created.length,
      updated: updated.length,
      published: published.length,
      drafts: draftSlugs.length,
      catalogOutboxIds: outboxIds,
      publication: {
        claimed: publication.claimed,
        completed: publication.completed,
        retried: publication.retried,
        deadLettered: publication.deadLettered,
      },
    };
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, `commit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
