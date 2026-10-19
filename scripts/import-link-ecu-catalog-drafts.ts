/**
 * Link ECU catalogue → DRAFT products (never published here).
 *
 *   npx tsx --conditions=react-server scripts/import-link-ecu-catalog-drafts.ts            # dry run
 *   npx tsx --conditions=react-server scripts/import-link-ecu-catalog-drafts.ts --commit-draft
 *
 * Reads data/link-ecu/source.json (linkecu.com, EUR RRP) and data/link-ecu/copy.json
 * (reviewed UA/EN copy). Price: RRP × 1.20 rounded up to €1, priceSourceCurrency EUR.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  adminProductImportMergeSelect,
  buildAdminProductCreateData,
  buildAdminProductSnapshotMergeUpdateData,
} from "../src/lib/shopAdminCatalog";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductCreationWithClient,
  coordinateShopCatalogProductMutationWithClient,
} from "../src/lib/shopCatalogMutationCoordinator.server";
import {
  LINK_ECU_BRAND,
  applyLinkEcuCopyOverride,
  buildLinkEcuProductPayload,
  buildLinkEcuSlug,
  type LinkEcuCopy,
  type LinkEcuCopyOverride,
  type LinkEcuSourceProduct,
} from "../src/lib/linkEcuCatalog";

const SOURCE_PATH = path.resolve("data/link-ecu/source.json");
const COPY_PATH = path.resolve("data/link-ecu/copy.json");
const OVERRIDES_PATH = path.resolve("data/link-ecu/overrides.json");
const ACTOR = "link-ecu-import@system.local";
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

type SourceFile = { schemaVersion: number; generatedAt: string; products: LinkEcuSourceProduct[] };
type CopyEntry = LinkEcuCopy & { issues?: string[]; model?: string; generatedAt?: string };
type CopyFile = { products: Record<string, CopyEntry> };

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
  throw new Error("Link ECU import retry loop exhausted");
}

function validate(source: SourceFile, copy: CopyFile) {
  const problems: string[] = [];
  const slugs = new Set<string>();
  const skus = new Set<string>();
  for (const product of source.products) {
    const entry = copy.products[product.sku];
    if (!entry) problems.push(`${product.sku}: no reviewed copy`);
    else if (entry.issues?.length)
      problems.push(`${product.sku}: copy issues ${entry.issues.join("; ")}`);
    if (!product.images.length) problems.push(`${product.sku}: no images`);
    if (!(product.rrpEur > 0)) problems.push(`${product.sku}: no EUR RRP`);
    const slug = buildLinkEcuSlug(product);
    if (slugs.has(slug)) problems.push(`${product.sku}: duplicate slug ${slug}`);
    if (skus.has(product.sku)) problems.push(`${product.sku}: duplicate SKU`);
    slugs.add(slug);
    skus.add(product.sku);
  }
  return problems;
}

async function main() {
  const commit = process.argv.includes("--commit-draft");
  const source = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as SourceFile;
  const copy = JSON.parse(await readFile(COPY_PATH, "utf8")) as CopyFile;
  const overrides = JSON.parse(await readFile(OVERRIDES_PATH, "utf8").catch(() => "{}")) as Record<
    string,
    LinkEcuCopyOverride
  >;
  const problems = validate(source, copy);
  if (problems.length) {
    throw new Error(`Link ECU source is not ready:\n${problems.join("\n")}`);
  }
  const payloads = source.products.map((product) =>
    buildLinkEcuProductPayload(
      product,
      applyLinkEcuCopyOverride(copy.products[product.sku], overrides[product.sku]),
      source.generatedAt
    )
  );
  if (!commit) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry-run",
          sourceGeneratedAt: source.generatedAt,
          products: payloads.length,
          byCollection: payloads.reduce<Record<string, number>>((acc, payload) => {
            acc[payload.collectionEn ?? ""] = (acc[payload.collectionEn ?? ""] ?? 0) + 1;
            return acc;
          }, {}),
          prices: payloads.map((payload) => `${payload.sku} €${payload.priceEur}`),
          published: 0,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  const outboxIds: string[] = [];
  try {
    for (const product of payloads) {
      const [bySlug, bySku] = await Promise.all([
        prisma.shopProduct.findUnique({
          where: { slug: product.slug },
          select: {
            ...adminProductImportMergeSelect,
            brand: true,
            status: true,
            isPublished: true,
            catalogVersion: true,
          },
        }),
        prisma.shopProduct.findFirst({
          where: { sku: product.sku },
          select: { id: true, slug: true, brand: true },
        }),
      ]);
      if (bySku && bySku.slug !== product.slug) {
        throw new Error(`Link ECU SKU ${product.sku} already belongs to ${bySku.slug}`);
      }
      if (bySlug && bySlug.brand !== LINK_ECU_BRAND) {
        throw new Error(`Slug ${product.slug} belongs to brand ${bySlug.brand ?? "(empty)"}`);
      }
      if (bySlug?.isPublished || bySlug?.status === "ACTIVE") {
        throw new Error(
          `Refusing to overwrite active Link ECU product ${product.slug} with a draft`
        );
      }
      if (bySlug) {
        const mutation = await retryTransient(() =>
          coordinateShopCatalogProductMutationWithClient(prisma, {
            productId: bySlug.id,
            expectedCatalogVersion: bySlug.catalogVersion.toString(),
            changeDomains: CHANGE_DOMAINS,
            async mutateAndSnapshot(tx, nextCatalogVersion) {
              await tx.shopProduct.update({
                where: { id: bySlug.id },
                data: buildAdminProductSnapshotMergeUpdateData(product, bySlug),
              });
              return buildShopCatalogAdminSnapshot(tx, bySlug.id, nextCatalogVersion, {
                type: "IMPORT",
                id: ACTOR,
                reason: "link-ecu.draft-update",
              });
            },
          })
        );
        outboxIds.push(mutation.outboxId);
        updated += 1;
      } else {
        const createData = buildAdminProductCreateData(product);
        const mutation = await retryTransient(() =>
          coordinateShopCatalogProductCreationWithClient(prisma, {
            changeDomains: CHANGE_DOMAINS,
            async create(tx) {
              return (await tx.shopProduct.create({ data: createData, select: { id: true } })).id;
            },
            snapshot(tx, productId, initialCatalogVersion) {
              return buildShopCatalogAdminSnapshot(tx, productId, initialCatalogVersion, {
                type: "IMPORT",
                id: ACTOR,
                reason: "link-ecu.draft-create",
              });
            },
          })
        );
        outboxIds.push(mutation.outboxId);
        created += 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "commit-draft",
        products: payloads.length,
        created,
        updated,
        published: 0,
        catalogOutboxIds: outboxIds,
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
