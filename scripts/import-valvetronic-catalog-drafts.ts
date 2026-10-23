/**
 * Valvetronic Designs catalogue → DRAFT products (never published here).
 *
 *   npx tsx --conditions=react-server scripts/import-valvetronic-catalog-drafts.ts            # dry run
 *   npx tsx --conditions=react-server scripts/import-valvetronic-catalog-drafts.ts --commit-draft
 *
 * Reads data/valvetronic/source.json (valvetronic.com, USD), data/valvetronic/copy.json
 * (reviewed UA/EN copy), overrides.json (manual copy fixes) and weights.json (shipping
 * weights in kg by Valvetronic SKU, when the feed has none). Price in USD, as Ігор set it:
 * regular price (not the sale price) × 1.15 + $12 per kg, rounded up to $1.
 * Products with a variant that has no shipping weight are held back (listed as `held`).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

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
import {
  applySupplierCopyOverride,
  type SupplierCopy,
  type SupplierCopyOverride,
} from "../src/lib/supplierCatalogCopy";
import {
  VALVETRONIC_BRAND,
  buildValvetronicProductPayload,
  buildValvetronicSlug,
  valvetronicVariantsWithoutWeight,
  type ValvetronicSourceProduct,
  type ValvetronicWeightOverrides,
} from "../src/lib/valvetronicCatalog";
import { valvetronicCopySourceHash } from "./valvetronic/valvetronic-copy-source.mjs";

const SOURCE_PATH = path.resolve("data/valvetronic/source.json");
const COPY_PATH = path.resolve("data/valvetronic/copy.json");
const OVERRIDES_PATH = path.resolve("data/valvetronic/overrides.json");
const WEIGHTS_PATH = path.resolve("data/valvetronic/weights.json");
const ACTOR = "valvetronic-import@system.local";
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

type SourceFile = {
  schemaVersion: number;
  generatedAt: string;
  products: ValvetronicSourceProduct[];
};
type CopyEntry = SupplierCopy & {
  issues?: string[];
  model?: string;
  generatedAt?: string;
  sourceHash?: string;
};
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
  throw new Error("Valvetronic import retry loop exhausted");
}

const readJson = async <T>(file: string, fallback: T) =>
  JSON.parse(await readFile(file, "utf8").catch(() => JSON.stringify(fallback))) as T;

/**
 * Source products and their reviewed copy, plus every reason one is not ready to import;
 * `held` products only wait for a shipping weight.
 */
export async function loadValvetronicImport() {
  const source = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as SourceFile;
  const copy = await readJson<CopyFile>(COPY_PATH, { products: {} });
  const overrides = await readJson<Record<string, SupplierCopyOverride>>(OVERRIDES_PATH, {});
  const weights = await readJson<ValvetronicWeightOverrides>(WEIGHTS_PATH, {});
  const problems: string[] = [];
  const held: string[] = [];
  const slugs = new Map<string, string>();
  const payloads: AdminShopProductPayload[] = [];
  for (const product of source.products) {
    const id = String(product.id);
    const entry = copy.products[id];
    const productProblems: string[] = [];
    if (!entry) productProblems.push("no reviewed copy");
    else if (entry.issues?.length) productProblems.push(`copy issues ${entry.issues.join("; ")}`);
    else if (entry.sourceHash !== valvetronicCopySourceHash(product)) {
      // The copy was written for an older SOURCE: regenerate or re-validate it first.
      productProblems.push("copy is for an older source (run generate-valvetronic-copy.mjs)");
    }
    if (!product.images.length) productProblems.push("no photos");
    if (!product.variants.length) productProblems.push("no variant to sell");
    const slug = buildValvetronicSlug(product);
    const previous = slugs.get(slug);
    if (previous) productProblems.push(`slug ${slug} already used by ${previous}`);
    slugs.set(slug, id);
    if (productProblems.length || !entry) {
      problems.push(`${id} ${product.title}: ${productProblems.join("; ")}`);
      continue;
    }
    const missingWeight = valvetronicVariantsWithoutWeight(product, weights);
    if (missingWeight.length === product.variants.length) {
      held.push(`${id} ${product.title}: no shipping weight for ${missingWeight.join(", ")}`);
      continue;
    }
    // Variants without a weight cannot be priced: sell the others until weights.json has them.
    const priced = missingWeight.length
      ? {
          ...product,
          variants: product.variants.filter(
            (variant) => !missingWeight.includes(variant.sku ?? variant.title)
          ),
        }
      : product;
    if (missingWeight.length) {
      held.push(`${id} ${product.title}: variants held without weight ${missingWeight.join(", ")}`);
    }
    payloads.push(
      buildValvetronicProductPayload(
        priced,
        applySupplierCopyOverride(entry, overrides[id]),
        source.generatedAt,
        weights
      )
    );
  }
  return { source, payloads, problems, held };
}

async function main() {
  const commit = process.argv.includes("--commit-draft");
  // --only=<sku>,<sku>: import just these products (for example the review sample).
  const only = process.argv
    .find((arg) => arg.startsWith("--only="))
    ?.slice(7)
    .split(",")
    .filter(Boolean);
  const loaded = await loadValvetronicImport();
  const { source, problems, held } = loaded;
  const payloads = only
    ? loaded.payloads.filter((payload) => only.includes(payload.sku ?? ""))
    : loaded.payloads;
  // With --only, products outside the selection may still be waiting for copy.
  const blocking = only
    ? problems.filter((problem) =>
        only.some((sku) => problem.startsWith(`${sku.replace(/^VTD-/, "")} `))
      )
    : problems;
  if (blocking.length) {
    throw new Error(
      `Valvetronic source is not ready (${blocking.length}):\n${blocking.slice(0, 40).join("\n")}`
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
          videos: payloads.reduce(
            (sum, payload) =>
              sum +
              (payload.media ?? []).filter((item) => item.mediaType === "EXTERNAL_VIDEO").length,
            0
          ),
          byType: payloads.reduce<Record<string, number>>((acc, payload) => {
            acc[payload.productType ?? ""] = (acc[payload.productType ?? ""] ?? 0) + 1;
            return acc;
          }, {}),
          priceUsd: {
            min: prices[0],
            median: prices[Math.floor(prices.length / 2)],
            max: prices[prices.length - 1],
          },
          held,
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
        throw new Error(`Valvetronic SKU ${product.sku} already belongs to ${bySku.slug}`);
      }
      if (bySlug && bySlug.brand !== VALVETRONIC_BRAND) {
        throw new Error(`Slug ${product.slug} belongs to brand ${bySlug.brand ?? "(empty)"}`);
      }
      if (bySlug?.isPublished || bySlug?.status === "ACTIVE") {
        throw new Error(
          `Refusing to overwrite active Valvetronic product ${product.slug} with a draft`
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
                reason: "valvetronic.draft-update",
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
                reason: "valvetronic.draft-create",
              });
            },
          })
        );
        outboxIds.push(mutation.outboxId);
        created += 1;
      }
      if ((created + updated) % 25 === 0) {
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
        held: held.length,
        published: 0,
        catalogOutboxIds: outboxIds.length,
      },
      null,
      2
    )}\n`
  );
}

if (process.argv[1] && /import-valvetronic-catalog-drafts/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
