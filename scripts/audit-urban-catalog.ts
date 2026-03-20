import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(process.cwd(), '.env.local') });
loadEnv();

const prisma = new PrismaClient();

const STORE_KEY = 'urban';
const SHOPIFY_CDN_RE = /https?:\/\/[^/\s]*cdn\.shopify\.com\//i;
const CYRILLIC_RE = /[А-Яа-яІіЇїЄєҐґ]/;

type SafeProductFix = {
  id: string;
  slug: string;
  updates: {
    categoryEn?: null;
    shortDescEn?: null;
    longDescEn?: null;
    bodyHtmlEn?: null;
    leadTimeEn?: null;
    seoTitleEn?: null;
    seoDescriptionEn?: null;
  };
};

function hasShopifyUrl(value: string | null | undefined) {
  return Boolean(value && SHOPIFY_CDN_RE.test(value));
}

function isDuplicateLocalizedField(ua: string | null | undefined, en: string | null | undefined) {
  const uaValue = String(ua ?? '').trim();
  const enValue = String(en ?? '').trim();
  if (!uaValue || !enValue) return false;
  return uaValue === enValue;
}

function isUnsafeFakeEnglish(ua: string | null | undefined, en: string | null | undefined) {
  return isDuplicateLocalizedField(ua, en) && CYRILLIC_RE.test(String(en ?? ''));
}

async function main() {
  const applySafeFixes = process.argv.includes('--apply-safe-fixes');

  const products = await prisma.shopProduct.findMany({
    where: { storeKey: STORE_KEY },
    select: {
      id: true,
      slug: true,
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
      leadTimeUa: true,
      leadTimeEn: true,
      seoTitleUa: true,
      seoTitleEn: true,
      seoDescriptionUa: true,
      seoDescriptionEn: true,
      image: true,
      media: {
        select: {
          id: true,
          src: true,
        },
      },
      variants: {
        select: {
          id: true,
          image: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    storeKey: STORE_KEY,
    totals: {
      products: products.length,
      productsWithShopifyImage: 0,
      variantsWithShopifyImage: 0,
      mediaWithShopifyImage: 0,
      productsWithFakeEnglishTitle: 0,
      productsWithSafeFakeEnglishFields: 0,
      productsEligibleForSafeFix: 0,
      productsFixed: 0,
    },
    shopifyImageProducts: [] as Array<{
      slug: string;
      productImage: string | null;
      media: string[];
      variantImages: string[];
    }>,
    fakeEnglishTitles: [] as Array<{
      slug: string;
      titleUa: string;
      titleEn: string;
    }>,
    safeFieldFixes: [] as Array<{
      slug: string;
      fields: string[];
    }>,
  };

  const safeFixes: SafeProductFix[] = [];

  for (const product of products) {
    const mediaShopifyUrls = product.media.map((item) => item.src).filter(hasShopifyUrl);
    const variantShopifyUrls = product.variants.map((item) => item.image).filter(hasShopifyUrl) as string[];
    const productImageIsShopify = hasShopifyUrl(product.image);

    if (productImageIsShopify || mediaShopifyUrls.length || variantShopifyUrls.length) {
      report.totals.productsWithShopifyImage += productImageIsShopify ? 1 : 0;
      report.totals.mediaWithShopifyImage += mediaShopifyUrls.length;
      report.totals.variantsWithShopifyImage += variantShopifyUrls.length;
      report.shopifyImageProducts.push({
        slug: product.slug,
        productImage: product.image,
        media: mediaShopifyUrls,
        variantImages: variantShopifyUrls,
      });
    }

    if (isUnsafeFakeEnglish(product.titleUa, product.titleEn)) {
      report.totals.productsWithFakeEnglishTitle += 1;
      report.fakeEnglishTitles.push({
        slug: product.slug,
        titleUa: product.titleUa,
        titleEn: product.titleEn,
      });
    }

    const updates: SafeProductFix['updates'] = {};
    const changedFields: string[] = [];

    if (isUnsafeFakeEnglish(product.categoryUa, product.categoryEn)) {
      updates.categoryEn = null;
      changedFields.push('categoryEn');
    }
    if (isUnsafeFakeEnglish(product.shortDescUa, product.shortDescEn)) {
      updates.shortDescEn = null;
      changedFields.push('shortDescEn');
    }
    if (isUnsafeFakeEnglish(product.longDescUa, product.longDescEn)) {
      updates.longDescEn = null;
      changedFields.push('longDescEn');
    }
    if (isUnsafeFakeEnglish(product.bodyHtmlUa, product.bodyHtmlEn)) {
      updates.bodyHtmlEn = null;
      changedFields.push('bodyHtmlEn');
    }
    if (isUnsafeFakeEnglish(product.leadTimeUa, product.leadTimeEn)) {
      updates.leadTimeEn = null;
      changedFields.push('leadTimeEn');
    }
    if (isUnsafeFakeEnglish(product.seoTitleUa, product.seoTitleEn)) {
      updates.seoTitleEn = null;
      changedFields.push('seoTitleEn');
    }
    if (isUnsafeFakeEnglish(product.seoDescriptionUa, product.seoDescriptionEn)) {
      updates.seoDescriptionEn = null;
      changedFields.push('seoDescriptionEn');
    }

    if (changedFields.length) {
      report.totals.productsWithSafeFakeEnglishFields += 1;
      report.totals.productsEligibleForSafeFix += 1;
      report.safeFieldFixes.push({
        slug: product.slug,
        fields: changedFields,
      });
      safeFixes.push({
        id: product.id,
        slug: product.slug,
        updates,
      });
    }
  }

  if (applySafeFixes) {
    for (const fix of safeFixes) {
      await prisma.shopProduct.update({
        where: { id: fix.id },
        data: fix.updates,
      });
      report.totals.productsFixed += 1;
    }
  }

  const outputDir = join(process.cwd(), 'scripts', 'dist');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'urban-catalog-audit.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nAudit report saved to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
