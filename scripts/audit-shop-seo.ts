import { config as loadEnv } from "dotenv";
import {
  assessShopProductSeo,
  isPublishedActiveSitemapCandidate,
  normalizeSeoTitleKey,
  type ShopSeoIssue,
} from "../src/lib/shopSeoAudit";

const pricedVariantWhere = {
  OR: [
    { priceEur: { not: null } },
    { priceEurEurope: { not: null } },
    { priceUsd: { not: null } },
    { priceUah: { not: null } },
  ],
};

async function main() {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });

  // Local contributor environments often expose only DIRECT_URL. The audit is
  // read-only, but Prisma still requires its conventional DATABASE_URL name.
  if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const prisma = await importPrisma();
  const products = await prisma.shopProduct.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      slug: true,
      sku: true,
      brand: true,
      status: true,
      isPublished: true,
      titleUa: true,
      titleEn: true,
      categoryUa: true,
      categoryEn: true,
      shortDescUa: true,
      shortDescEn: true,
      longDescUa: true,
      longDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      image: true,
      priceEur: true,
      priceEurEurope: true,
      priceUsd: true,
      priceUah: true,
      variants: {
        where: pricedVariantWhere,
        select: { id: true },
        take: 1,
      },
    },
  });

  const issueCounts = new Map<ShopSeoIssue, number>();
  const issueSamples = new Map<ShopSeoIssue, string[]>();
  const duplicateTitleKeys = new Map<string, string[]>();
  const byBrand = new Map<
    string,
    { total: number; sitemapCandidates: number; qualityIssues: number }
  >();

  for (const row of products) {
    const product = { ...row, pricedVariants: row.variants };
    const issues = assessShopProductSeo(product);
    const brand = row.brand?.trim() || "Unknown";
    const brandStats = byBrand.get(brand) ?? { total: 0, sitemapCandidates: 0, qualityIssues: 0 };
    brandStats.total += 1;
    if (isPublishedActiveSitemapCandidate(product)) brandStats.sitemapCandidates += 1;
    if (issues.length > 0) brandStats.qualityIssues += 1;
    byBrand.set(brand, brandStats);

    for (const issue of issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      const samples = issueSamples.get(issue) ?? [];
      if (samples.length < 10) samples.push(row.slug);
      issueSamples.set(issue, samples);
    }

    const titleKey = `${brand.toLowerCase()}::${normalizeSeoTitleKey(row.titleEn)}`;
    if (titleKey.endsWith("::")) continue;
    const matchingSlugs = duplicateTitleKeys.get(titleKey) ?? [];
    matchingSlugs.push(row.slug);
    duplicateTitleKeys.set(titleKey, matchingSlugs);
  }

  const duplicateGroups = Array.from(duplicateTitleKeys.entries())
    .filter(([, slugs]) => slugs.length > 1)
    .map(([key, slugs]) => ({ key, count: slugs.length, slugs: slugs.slice(0, 10) }))
    .sort((left, right) => right.count - left.count);

  const sitemapCandidates = products.filter((row) =>
    isPublishedActiveSitemapCandidate({ ...row, pricedVariants: row.variants })
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    totals: {
      products: products.length,
      currentlyPublished: products.filter((row) => row.isPublished).length,
      publishedActiveSitemapCandidates: sitemapCandidates,
      publishedButInactive: products.filter((row) => row.isPublished && row.status !== "ACTIVE")
        .length,
      duplicateTitleGroups: duplicateGroups.length,
    },
    issues: Array.from(issueCounts, ([issue, count]) => ({
      issue,
      count,
      samples: issueSamples.get(issue) ?? [],
    })).sort((left, right) => right.count - left.count),
    topBrands: Array.from(byBrand, ([brand, counts]) => ({ brand, ...counts }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 50),
    duplicateTitleGroups: duplicateGroups.slice(0, 100),
  };

  console.log(JSON.stringify(report, null, 2));
}

let disconnectPrisma: (() => Promise<void>) | null = null;

async function importPrisma() {
  const { prisma } = await import("../src/lib/prisma");
  disconnectPrisma = () => prisma.$disconnect();
  return prisma;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma?.();
  });
