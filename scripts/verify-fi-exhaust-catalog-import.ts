import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import type { FiCanonicalDraft } from "../src/lib/shopCatalogFiDraft";

const ROOT = resolve("backups/shopify/fi-exhaust/2026-09-03");

async function main() {
  const drafts = JSON.parse(await readFile(resolve(ROOT, "canonical-drafts.json"), "utf8")) as FiCanonicalDraft[];
  const expected = {
    products: drafts.length,
    variants: drafts.reduce((sum, draft) => sum + draft.variants.length, 0),
    images: drafts.reduce((sum, draft) => sum + draft.media.filter((media) => media.mediaType === "IMAGE").length, 0),
    videos: drafts.reduce((sum, draft) => sum + draft.media.filter((media) => media.mediaType === "EXTERNAL_VIDEO").length, 0),
    applications: drafts.reduce((sum, draft) => sum + draft.applications.length, 0),
  };
  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({ where: { key: "shopify-fi-exhaust" } });
    const brand = await prisma.shopBrand.findUniqueOrThrow({ where: { key: "fi-exhaust" } });
    const where = { brandId: brand.id };
    const [products, variants, images, videos, sourceRecords, productHeads, variantHeads, unpublished, texts, fitments, issueGroups] = await Promise.all([
      prisma.shopProduct.count({ where }),
      prisma.shopProductVariant.count({ where: { product: where } }),
      prisma.shopProductMedia.count({ where: { product: where, mediaType: "IMAGE" } }),
      prisma.shopProductMedia.count({ where: { product: where, mediaType: "EXTERNAL_VIDEO" } }),
      prisma.shopCatalogSourceRecord.count({ where: { sourceId: source.id } }),
      prisma.shopCatalogSourceBindingHead.count({ where: { sourceId: source.id, entityType: "PRODUCT" } }),
      prisma.shopCatalogSourceBindingHead.count({ where: { sourceId: source.id, entityType: "VARIANT" } }),
      prisma.shopProduct.count({ where: { ...where, isPublished: false } }),
      prisma.shopProduct.findMany({ where, select: { titleEn: true, bodyHtmlEn: true, sku: true, priceUah: true } }),
      prisma.shopProductMetafield.findMany({ where: { product: where, namespace: "onecompany", key: "normalized_fitment" }, select: { value: true } }),
      prisma.shopCatalogNormalizationIssue.groupBy({ by: ["code"], where: { sourceRecord: { sourceId: source.id } }, _count: true }),
    ]);
    const actualApplications = fitments.reduce((sum, field) => sum + (((JSON.parse(field.value) as { applications?: unknown[] }).applications?.length) ?? 0), 0);
    const checks = {
      exactEntities: products === expected.products && variants === expected.variants,
      exactMedia: images === expected.images && videos === expected.videos,
      exactOwnership: sourceRecords === expected.products && productHeads === expected.products && variantHeads === expected.variants,
      draftOnly: unpublished === expected.products,
      exactFitment: fitments.length === expected.products && actualApplications === expected.applications,
      englishComplete: texts.every((row) => row.titleEn.trim() && row.bodyHtmlEn?.trim() && !/[\u0400-\u04ff]/u.test(`${row.titleEn} ${row.bodyHtmlEn}`)),
      commerceComplete: texts.every((row) => row.sku?.trim() && row.priceUah !== null),
      noNormalizationIssues: issueGroups.length === 0,
    };
    const report = { expected, actual: { products, variants, images, videos, applications: actualApplications }, ownership: { sourceRecords, productHeads, variantHeads }, unpublished, issueCounts: Object.fromEntries(issueGroups.map((group) => [group.code, group._count])), checks, passed: Object.values(checks).every(Boolean) };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.passed) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
