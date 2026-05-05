import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { sanitizeRichTextHtml } from '../src/lib/sanitizeRichTextHtml';
// Run: npx tsx scripts/import-burger-single-product.ts <source-slug>
//
// Imports a single Burger product from data/burger-products.json into the DB.
// Mirrors the field mapping used by reimport-burger.ts. Aborts if the slug
// already exists. UA fields fall back to English (translate later via
// translate-burger-* scripts).

type SourceProduct = {
  title: string;
  slug: string;
  sku?: string;
  shopifyProductId: number;
  descriptionEn?: string;
  descriptionUa?: string;
  priceUsd: number | null;
  tags?: string[];
  productType?: string;
  vendor?: string;
  selectedVariant?: string;
  media?: { url: string; alt?: string }[];
};

async function main() {
  const sourceSlug = process.argv[2];
  if (!sourceSlug) {
    console.error('Usage: npx tsx scripts/import-burger-single-product.ts <source-slug>');
    process.exit(1);
  }

  const filePath = path.join(process.cwd(), 'data', 'burger-products.json');
  const all: SourceProduct[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const p = all.find((x) => x.slug === sourceSlug);
  if (!p) {
    console.error(`❌ No product with slug "${sourceSlug}" in JSON.`);
    process.exit(1);
  }

  const dbSlug = `burger-${p.slug}`;
  const sku = p.sku || `BURGER-${p.shopifyProductId}`;
  const priceEur = p.priceUsd ? Math.round(p.priceUsd * 0.92 * 100) / 100 : null;

  const existing = await prisma.shopProduct.findUnique({ where: { slug: dbSlug } });
  if (existing) {
    console.error(`❌ Already in DB: ${dbSlug} (id=${existing.id}). Use update scripts instead.`);
    process.exit(1);
  }

  const product = await prisma.shopProduct.create({
    data: {
      titleEn: p.title,
      titleUa: p.title,
      slug: dbSlug,
      sku,
      brand: 'Burger Motorsports',
      bodyHtmlEn: sanitizeRichTextHtml(p.descriptionEn || ''),
      bodyHtmlUa: sanitizeRichTextHtml(p.descriptionUa || ''),
      priceEur,
      priceUsd: p.priceUsd,
      tags: p.tags || [],
      isPublished: true,
      image: p.media?.[0]?.url || null,
      gallery: p.media?.map((m) => m.url) || [],
      productType: p.productType || null,
      vendor: p.vendor || 'Burger Motorsports Inc',
    },
  });

  if (p.media && p.media.length > 0) {
    await prisma.shopProductMedia.createMany({
      data: p.media.map((m, i) => ({
        productId: product.id,
        src: m.url,
        altText: m.alt || p.title,
        position: i,
        mediaType: 'IMAGE' as const,
      })),
    });
  }

  await prisma.shopProductVariant.create({
    data: {
      productId: product.id,
      title: p.selectedVariant || 'Default',
      sku,
      priceEur,
      priceUsd: p.priceUsd,
      inventoryQty: 999,
      position: 0,
    },
  });

  console.log(`✅ Created Burger product:`);
  console.log(`   Title:    ${product.titleEn}`);
  console.log(`   Slug:     ${dbSlug}`);
  console.log(`   priceUsd: $${p.priceUsd?.toFixed(2)}`);
  console.log(`   priceEur: €${priceEur?.toFixed(2)}`);
  console.log(`   Media:    ${p.media?.length || 0} images`);
  console.log(`   Type:     ${p.productType}`);
  console.log('');
  console.log(`   ⚠️  titleUa/bodyHtmlUa fall back to English. Translate via translate-burger-*.mjs when needed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
