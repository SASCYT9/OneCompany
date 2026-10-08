/**
 * Read-only check before rebuilding projections for the product-group facet.
 * Builds every published ACTIVE product's projection from its current
 * immutable revision (what `backfill-catalog-v2-production-projection.ts
 * --from-revisions` would write) and compares it with the stored rows.
 * Writes nothing.
 *
 *   DATABASE_URL=... npx tsx scripts/compare-category-group-projection.ts [--brand=NAME]
 *
 * Expected result: the only differing columns are `categoryGroupKey` and
 * `contentHash`. Anything else means a rebuild would also change that data.
 */
import { PrismaClient } from "@prisma/client";

import { adminProductInclude } from "../src/lib/shopAdminCatalog";
import { buildShopCatalogProjection } from "../src/lib/shopCatalogProjection.server";
import { planShopCatalogProjectionPersistence } from "../src/lib/shopCatalogProjectionPersistence.server";
import { projectionSourceFromRevision } from "../src/lib/shopCatalogProjectionSource.server";

const PAGE_SIZE = 50;
const EXPECTED_DIFFS = new Set(["categoryGroupKey", "contentHash"]);

function assertTarget() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const url = new URL(databaseUrl);
  if (url.hostname !== "db.prisma.io" || url.pathname !== "/postgres") {
    throw new Error("Target must be the approved Prisma production database");
  }
}

function plain(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint" || typeof value === "number") return value.toString();
  if (typeof value === "object" && typeof (value as { toString?: unknown }).toString === "function") {
    const text = String(value);
    if (text !== "[object Object]") return text;
  }
  return value;
}

async function main() {
  assertTarget();
  const brand =
    process.argv.find((argument) => argument.startsWith("--brand="))?.slice("--brand=".length).trim() ||
    null;
  const client = new PrismaClient();
  const diffColumns = new Map<string, number>();
  const diffSamples = new Map<string, string[]>();
  const groups = new Map<string, number>();
  let products = 0;
  let identical = 0;
  let missingRows = 0;
  let noRevision = 0;
  const unreadable: string[] = [];
  let afterId: string | undefined;
  try {
    for (;;) {
      const query = {
        where: { isPublished: true, status: "ACTIVE" as const, ...(brand ? { brand } : {}) },
        orderBy: { id: "asc" as const },
        include: adminProductInclude,
      };
      let fellBack = false;
      let page: Awaited<ReturnType<typeof client.shopProduct.findMany<typeof query>>>;
      try {
        page = await client.shopProduct.findMany({
          ...query,
          take: PAGE_SIZE,
          ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
        });
      } catch {
        // A single unreadable row fails the whole page: walk it one by one.
        const ids = await client.shopProduct.findMany({
          where: query.where,
          orderBy: query.orderBy,
          select: { id: true },
          take: PAGE_SIZE,
          ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
        });
        fellBack = true;
        page = [];
        for (const { id } of ids) {
          try {
            const one = await client.shopProduct.findUnique({ where: { id }, include: adminProductInclude });
            if (one) page.push(one);
          } catch {
            unreadable.push(id);
          }
        }
        if (!page.length && ids.length) {
          afterId = ids.at(-1)!.id;
          continue;
        }
        if (ids.length) afterId = ids.at(-1)!.id;
      }
      if (!page.length) break;
      if (!fellBack) afterId = page.at(-1)!.id;
      const stored: Array<Record<string, unknown> & { productId: string; locale: string }> = [];
      const revisions: Array<{ id: string; productId: string; version: number; contentHash: string; createdAt: Date; snapshot: unknown }> = [];
      const load = async (ids: string[]) => {
        stored.push(...(await client.shopCatalogProjection.findMany({ where: { productId: { in: ids } } })));
        revisions.push(
          ...(await client.shopCatalogProductRevision.findMany({
            where: { productId: { in: ids } },
            select: { id: true, productId: true, version: true, contentHash: true, createdAt: true, snapshot: true },
          }))
        );
      };
      const pageIds = page.map((product) => product.id);
      try {
        await load(pageIds);
      } catch {
        stored.length = 0;
        revisions.length = 0;
        for (const id of pageIds) {
          try {
            await load([id]);
          } catch {
            unreadable.push(id);
          }
        }
      }
      const storedByKey = new Map(stored.map((row) => [`${row.productId}:${row.locale}`, row]));
      const revisionByProduct = new Map(revisions.map((revision) => [`${revision.productId}:${revision.version}`, revision]));
      for (const product of page) {
        if (unreadable.includes(product.id)) continue;
        products += 1;
        const revision = revisionByProduct.get(`${product.id}:${product.catalogVersion}`);
        if (!revision) {
          noRevision += 1;
          continue;
        }
        const source = projectionSourceFromRevision({
          productId: product.id,
          catalogVersion: product.catalogVersion,
          revisionId: revision.id,
          revisionVersion: revision.version,
          contentHash: revision.contentHash,
          createdAt: revision.createdAt,
          snapshot: revision.snapshot,
        });
        const plan = planShopCatalogProjectionPersistence([], buildShopCatalogProjection(source));
        let productIdentical = true;
        for (const expected of plan.projectionRows as Array<Record<string, unknown>>) {
          const key = `${expected.productId}:${expected.locale}`;
          const actual = storedByKey.get(key) as Record<string, unknown> | undefined;
          if (!actual) {
            missingRows += 1;
            productIdentical = false;
            continue;
          }
          if (expected.locale === "ua") {
            const group = String(expected.categoryGroupKey ?? "null");
            groups.set(group, (groups.get(group) ?? 0) + 1);
          }
          for (const column of Object.keys(expected)) {
            if (JSON.stringify(plain(expected[column])) === JSON.stringify(plain(actual[column]))) continue;
            diffColumns.set(column, (diffColumns.get(column) ?? 0) + 1);
            if (!EXPECTED_DIFFS.has(column)) productIdentical = false;
            const samples = diffSamples.get(column) ?? [];
            if (samples.length < 3) {
              samples.push(
                `${key} stored=${JSON.stringify(plain(actual[column]))?.slice(0, 80)} expected=${JSON.stringify(plain(expected[column]))?.slice(0, 80)}`
              );
              diffSamples.set(column, samples);
            }
          }
        }
        if (productIdentical) identical += 1;
      }
      process.stdout.write(`\r${products} products checked`);
    }
  } finally {
    await client.$disconnect();
  }
  console.log(`\n\nproducts: ${products}`);
  console.log(`unchanged except categoryGroupKey/contentHash: ${identical}`);
  console.log(`missing stored rows: ${missingRows}`);
  console.log(`products without a current revision: ${noRevision}`);
  console.log(`unreadable products (skipped): ${unreadable.length} ${unreadable.slice(0, 10).join(", ")}`);
  console.log("differing columns (rows):");
  for (const [column, count] of [...diffColumns].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${column}${EXPECTED_DIFFS.has(column) ? " (expected)" : " (UNEXPECTED)"}: ${count}`);
    for (const sample of diffSamples.get(column) ?? []) console.log(`      ${sample}`);
  }
  console.log("new group distribution (ua rows):");
  for (const [group, count] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`  ${group}: ${count}`);
  process.exitCode = identical === products - noRevision && !missingRows && !noRevision && !unreadable.length ? 0 : 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
