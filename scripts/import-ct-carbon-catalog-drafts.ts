/**
 * CT Carbon catalogue → DRAFT products (never published here).
 *
 *   npx tsx --conditions=react-server scripts/import-ct-carbon-catalog-drafts.ts            # dry run
 *   npx tsx --conditions=react-server scripts/import-ct-carbon-catalog-drafts.ts --commit-draft
 *
 * Reads data/ct-carbon/source.json (ctcarbon.co, GBP) and data/ct-carbon/copy.json
 * (reviewed UA/EN copy). Price in USD, as @OneCompany1_bot quotes CT Carbon at retail:
 * (site £ with VAT × 1.15 + delivery to Medyka £) × GBP/USD + delivery to Ukraine $,
 * rounded up to $5; a kit adds up the delivery of its parts.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  CT_CARBON_BRAND,
  buildCtCarbonProductPayload,
  buildCtCarbonSlug,
  type CtCarbonSourceProduct,
} from "../src/lib/ctCarbonCatalog";
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
import {
  applySupplierCopyOverride,
  type SupplierCopy,
  type SupplierCopyOverride,
} from "../src/lib/supplierCatalogCopy";

const SOURCE_PATH = path.resolve("data/ct-carbon/source.json");
const COPY_PATH = path.resolve("data/ct-carbon/copy.json");
const OVERRIDES_PATH = path.resolve("data/ct-carbon/overrides.json");
const ACTOR = "ct-carbon-import@system.local";
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

type SourceFile = { schemaVersion: number; generatedAt: string; products: CtCarbonSourceProduct[] };
type CopyEntry = SupplierCopy & { issues?: string[]; model?: string; generatedAt?: string };
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
  throw new Error("CT Carbon import retry loop exhausted");
}

/** Source products and their reviewed copy, plus every reason one is not ready to import. */
export async function loadCtCarbonImport() {
  const source = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as SourceFile;
  const copy = JSON.parse(await readFile(COPY_PATH, "utf8")) as CopyFile;
  const overrides = JSON.parse(await readFile(OVERRIDES_PATH, "utf8").catch(() => "{}")) as Record<
    string,
    SupplierCopyOverride
  >;
  const problems: string[] = [];
  const slugs = new Map<string, string>();
  const payloads: AdminShopProductPayload[] = [];
  for (const product of source.products) {
    const id = String(product.id);
    const entry = copy.products[id];
    const productProblems: string[] = [];
    if (!entry) productProblems.push("no reviewed copy");
    else if (entry.issues?.length) productProblems.push(`copy issues ${entry.issues.join("; ")}`);
    if (!product.images.length) productProblems.push("no photos");
    if (!product.variants.length) productProblems.push("no variant to sell");
    const slug = buildCtCarbonSlug(product);
    const previous = slugs.get(slug);
    if (previous) productProblems.push(`slug ${slug} already used by ${previous}`);
    slugs.set(slug, id);
    if (productProblems.length || !entry) {
      problems.push(`${id} ${product.title}: ${productProblems.join("; ")}`);
      continue;
    }
    payloads.push(
      buildCtCarbonProductPayload(
        product,
        applySupplierCopyOverride(entry, overrides[id]),
        source.generatedAt
      )
    );
  }
  return { source, payloads, problems };
}

async function main() {
  const commit = process.argv.includes("--commit-draft");
  // --only=<sku>,<sku>: re-import just these products (for example after a price fix).
  const only = process.argv
    .find((arg) => arg.startsWith("--only="))
    ?.slice(7)
    .split(",")
    .filter(Boolean);
  const loaded = await loadCtCarbonImport();
  const { source, problems } = loaded;
  const payloads = only
    ? loaded.payloads.filter((payload) => only.includes(payload.sku ?? ""))
    : loaded.payloads;
  if (problems.length) {
    throw new Error(
      `CT Carbon source is not ready (${problems.length}):\n${problems.slice(0, 40).join("\n")}`
    );
  }
  if (!commit) {
    const prices = payloads.map((payload) => payload.priceUsd ?? 0).sort((a, b) => a - b);
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry-run",
          sourceGeneratedAt: source.generatedAt,
          products: payloads.length,
          variants: payloads.reduce((sum, payload) => sum + payload.variants.length, 0),
          byCategory: payloads.reduce<Record<string, number>>((acc, payload) => {
            acc[payload.categoryUa ?? ""] = (acc[payload.categoryUa ?? ""] ?? 0) + 1;
            return acc;
          }, {}),
          priceUsd: {
            min: prices[0],
            median: prices[Math.floor(prices.length / 2)],
            max: prices[prices.length - 1],
          },
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
        throw new Error(`CT Carbon SKU ${product.sku} already belongs to ${bySku.slug}`);
      }
      if (bySlug && bySlug.brand !== CT_CARBON_BRAND) {
        throw new Error(`Slug ${product.slug} belongs to brand ${bySlug.brand ?? "(empty)"}`);
      }
      if (bySlug?.isPublished || bySlug?.status === "ACTIVE") {
        throw new Error(
          `Refusing to overwrite active CT Carbon product ${product.slug} with a draft`
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
                reason: "ct-carbon.draft-update",
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
                reason: "ct-carbon.draft-create",
              });
            },
          })
        );
        outboxIds.push(mutation.outboxId);
        created += 1;
      }
      if ((created + updated) % 100 === 0) {
        process.stderr.write(`${created + updated}/${payloads.length}\n`);
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
        catalogOutboxIds: outboxIds.length,
      },
      null,
      2
    )}\n`
  );
}

if (process.argv[1] && /import-ct-carbon-catalog-drafts/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
