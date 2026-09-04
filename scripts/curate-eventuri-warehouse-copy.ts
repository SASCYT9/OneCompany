#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

import {
  EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG,
  EVENTURI_WAREHOUSE_EDITORIAL_SLUGS,
} from "../src/lib/eventuriWarehouseEditorialCopy";
import {
  EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS,
  EVENTURI_SHARED_V8_INTAKE_SKU,
} from "../src/lib/eventuriSharedIntake";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

dotenv.config({ path: ".env.local", override: true });
const prisma = new PrismaClient();
const COMMIT = process.argv.includes("--commit");

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      slug: {
        in: [...EVENTURI_WAREHOUSE_EDITORIAL_SLUGS, ...EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS],
      },
    },
    select: {
      id: true, slug: true, vendor: true, titleUa: true, titleEn: true,
      shortDescUa: true, shortDescEn: true, longDescUa: true, longDescEn: true,
      seoTitleUa: true, seoTitleEn: true, seoDescriptionUa: true, seoDescriptionEn: true,
      catalogVersion: true, variants: { select: { sku: true } },
      status: true, isPublished: true,
    },
    orderBy: { slug: "asc" },
  });

  const found = new Set(rows.map((row) => row.slug));
  const missing = EVENTURI_WAREHOUSE_EDITORIAL_SLUGS.filter((slug) => !found.has(slug));
  if (missing.length) throw new Error(`Missing Eventuri products: ${missing.join(", ")}`);

  const editorialRows = rows.filter((row) => EVENTURI_WAREHOUSE_EDITORIAL_SLUGS.includes(
    row.slug as (typeof EVENTURI_WAREHOUSE_EDITORIAL_SLUGS)[number]
  ));
  const legacySharedRows = rows.filter((row) =>
    EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS.includes(
      row.slug as (typeof EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS)[number]
    )
  );
  for (const row of legacySharedRows) {
    const actualSkus = row.variants.map((variant) => variant.sku?.trim().toUpperCase()).filter(Boolean);
    if (!actualSkus.includes(EVENTURI_SHARED_V8_INTAKE_SKU)) {
      throw new Error(`Identity mismatch for legacy shared intake ${row.slug}: ${actualSkus.join(", ")}`);
    }
  }

  const updates = editorialRows.map((row) => {
    const copy = EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG[row.slug as keyof typeof EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG];
    const actualSkus = row.variants.map((variant) => variant.sku?.trim().toUpperCase()).filter(Boolean);
    if (!actualSkus.includes(copy.sku) || !/eventuri/i.test(row.vendor ?? "")) {
      throw new Error(`Identity mismatch for ${row.slug}: expected ${copy.sku}, got ${actualSkus.join(", ")}`);
    }
    const data = {
      titleUa: copy.titleUa, titleEn: copy.titleEn,
      shortDescUa: copy.shortDescUa, shortDescEn: copy.shortDescEn,
      longDescUa: copy.longDescUa, longDescEn: copy.longDescEn,
      seoTitleUa: copy.titleUa, seoTitleEn: copy.titleEn,
      seoDescriptionUa: copy.shortDescUa, seoDescriptionEn: copy.shortDescEn,
    };
    const changed = Object.entries(data).filter(([key, value]) => row[key as keyof typeof row] !== value).map(([key]) => key);
    return { ...row, data, changed };
  }).filter((row) => row.changed.length > 0);

  const archives = legacySharedRows.filter((row) => row.status !== "ARCHIVED" || row.isPublished);
  console.log(JSON.stringify({ mode: COMMIT ? "commit" : "dry-run", matched: rows.length, updates: updates.length, archives: archives.length, products: updates.map(({ slug, changed }) => ({ slug, changed })), legacyProducts: archives.map(({ slug }) => slug) }, null, 2));
  if (!COMMIT) return;

  for (const entry of updates) {
    await coordinateShopCatalogProductMutationWithClient(prisma, {
      productId: entry.id,
      expectedCatalogVersion: entry.catalogVersion.toString(),
      changeDomains: ["CONTENT", "SEO"],
      async mutateAndSnapshot(tx, nextCatalogVersion) {
        await tx.shopProduct.update({ where: { id: entry.id }, data: entry.data });
        return buildShopCatalogAdminSnapshot(tx, entry.id, nextCatalogVersion, {
          type: "IMPORT", id: "eventuri-warehouse-copy@system.local", reason: "eventuri.warehouse-copy.curate",
        });
      },
    });
    console.log(`[updated] ${entry.slug}`);
  }

  for (const entry of archives) {
    await coordinateShopCatalogProductMutationWithClient(prisma, {
      productId: entry.id,
      expectedCatalogVersion: entry.catalogVersion.toString(),
      changeDomains: ["VISIBILITY"],
      async mutateAndSnapshot(tx, nextCatalogVersion) {
        await tx.shopProduct.update({
          where: { id: entry.id },
          data: { status: "ARCHIVED", isPublished: false, publishedAt: null },
        });
        return buildShopCatalogAdminSnapshot(tx, entry.id, nextCatalogVersion, {
          type: "IMPORT", id: "eventuri-warehouse-copy@system.local", reason: "eventuri.shared-intake.archive-duplicate",
        });
      },
    });
    console.log(`[archived] ${entry.slug}`);
  }

  let published = 0;
  const mutationCount = updates.length + archives.length;
  for (let pass = 0; pass < 5 && published < mutationCount; pass += 1) {
    const result = await runShopCatalogOutboxRuntime({ workerId: `eventuri-copy-cli:${process.pid}`, limit: Math.max(20, mutationCount) });
    published += result.completed;
    if (result.claimed === 0) break;
  }
  console.log(JSON.stringify({ updated: updates.length, archived: archives.length, published }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
