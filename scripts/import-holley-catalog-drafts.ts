/**
 * Dinan / APR catalogue → DRAFT products (never published here).
 *
 *   npx tsx --conditions=react-server scripts/import-holley-catalog-drafts.ts --brand=dinan            # dry run
 *   npx tsx --conditions=react-server scripts/import-holley-catalog-drafts.ts --brand=dinan --commit-draft
 *
 * Reads data/<brand>/source.json (price list + brand pages + competitor prices) and
 * data/<brand>/copy.json + overrides.json (reviewed UA/EN copy). Products with
 * selectable versions are imported with variants; prices are USD-sourced.
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
  HOLLEY_BRANDS,
  buildHolleyProductPayload,
  type HolleyBrandKey,
  type HolleyProductGroup,
} from "../src/lib/holleyBrandCatalog";
import {
  applySupplierCopyOverride,
  type SupplierCopy,
  type SupplierCopyOverride,
} from "../src/lib/supplierCatalogCopy";

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

type CopyEntry = SupplierCopy & { issues?: string[] };

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
  throw new Error("Holley import retry loop exhausted");
}

export async function loadHolleyImport(brand: HolleyBrandKey) {
  const dir = path.resolve("data", brand);
  const source = JSON.parse(await readFile(path.join(dir, "source.json"), "utf8")) as {
    generatedAt: string;
    groups: HolleyProductGroup[];
  };
  const copy = JSON.parse(await readFile(path.join(dir, "copy.json"), "utf8")) as {
    products: Record<string, CopyEntry>;
  };
  const overrides = JSON.parse(
    await readFile(path.join(dir, "overrides.json"), "utf8").catch(() => "{}")
  ) as Record<string, SupplierCopyOverride>;
  const problems: string[] = [];
  const payloads = [];
  const slugs = new Set<string>();
  const titles = new Map<string, string>();
  for (const group of source.groups) {
    const entry = copy.products[group.id];
    if (!entry) {
      problems.push(`${group.id}: no reviewed copy`);
      continue;
    }
    if (entry.issues?.length) {
      problems.push(`${group.id}: copy issues ${entry.issues.join("; ")}`);
      continue;
    }
    if (!group.variants.some((variant) => variant.page)) {
      problems.push(`${group.id}: no brand page (no photos or description)`);
      continue;
    }
    const payload = buildHolleyProductPayload(
      group,
      applySupplierCopyOverride(entry, overrides[group.id]),
      source.generatedAt
    );
    if (slugs.has(payload.slug)) problems.push(`${group.id}: duplicate slug ${payload.slug}`);
    slugs.add(payload.slug);
    // Two products with one name cannot be told apart in the catalogue.
    for (const title of [payload.titleUa, payload.titleEn]) {
      const key = title.trim().toLowerCase();
      const owner = titles.get(key);
      if (owner && owner !== group.id)
        problems.push(`${group.id}: same title as ${owner}: ${title}`);
      else titles.set(key, group.id);
    }
    if (!payload.image) problems.push(`${group.id}: no image`);
    payloads.push(payload);
  }
  return { source, payloads, problems };
}

async function main() {
  const brand = process.argv.find((value) => value.startsWith("--brand="))?.split("=")[1] as
    | HolleyBrandKey
    | undefined;
  if (brand !== "dinan" && brand !== "apr") throw new Error("--brand=dinan|apr is required");
  const commit = process.argv.includes("--commit-draft");
  const { source, payloads, problems } = await loadHolleyImport(brand);
  if (!commit) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry-run",
          brand,
          sourceGeneratedAt: source.generatedAt,
          groups: source.groups.length,
          importable: payloads.length,
          variants: payloads.reduce((sum, payload) => sum + payload.variants.length, 0),
          problems: problems.slice(0, 40),
          problemCount: problems.length,
          published: 0,
        },
        null,
        2
      )}\n`
    );
    return;
  }
  if (problems.length) {
    throw new Error(`${brand} import is not ready:\n${problems.join("\n")}`);
  }
  const brandName = HOLLEY_BRANDS[brand].brand;
  const actor = `${brand}-import@system.local`;
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
        throw new Error(`${brandName} SKU ${product.sku} already belongs to ${bySku.slug}`);
      }
      if (bySlug && bySlug.brand !== brandName) {
        throw new Error(`Slug ${product.slug} belongs to brand ${bySlug.brand ?? "(empty)"}`);
      }
      if (bySlug?.isPublished || bySlug?.status === "ACTIVE") {
        throw new Error(
          `Refusing to overwrite active ${brandName} product ${product.slug} with a draft`
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
                id: actor,
                reason: `${brand}.draft-update`,
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
                id: actor,
                reason: `${brand}.draft-create`,
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
    `${JSON.stringify({ mode: "commit-draft", brand, products: payloads.length, created, updated, published: 0, catalogOutboxIds: outboxIds }, null, 2)}\n`
  );
}

if (process.argv[1] && /import-holley-catalog-drafts/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
