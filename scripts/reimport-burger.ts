import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { sanitizeRichTextHtml } from '../src/lib/sanitizeRichTextHtml';
// Run with: npx tsx scripts/reimport-burger.ts
//
// Mirrors src/app/api/import-burger/route.ts but without admin-auth gating
// so it can run from CLI. Uses findUnique by slug only — see commit
// "shop: match Burger products by slug only on import" for context.

type SourceProduct = {
  title: string;
  slug: string;
  sku?: string;
  shopifyProductId: number;
  descriptionEn?: string;
  descriptionUa?: string;
  priceUsd: number;
  tags: string[];
  productType?: string;
  vendor?: string;
  selectedVariant?: string;
  media?: { url: string; alt?: string }[];
};

async function main() {
  const filePath = path.join(process.cwd(), 'data', 'burger-products.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${filePath} not found. Run scrape-burger first.`);
    process.exit(1);
  }

  const products: SourceProduct[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`📦 Source: ${products.length} products`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of products) {
    try {
      const slug = `burger-${p.slug}`;
      const sku = p.sku || `BURGER-${p.shopifyProductId}`;

      // Match by slug only — slug is unique. SKU is non-unique in Burger source.
      const existing = await prisma.shopProduct.findUnique({ where: { slug } });

      const priceEur = Math.round(p.priceUsd * 0.92 * 100) / 100;

      const data = {
        titleEn: p.title,
        titleUa: p.title,
        slug,
        sku,
        brand: 'Burger Motorsports',
        bodyHtmlEn: sanitizeRichTextHtml(p.descriptionEn || ''),
        bodyHtmlUa: sanitizeRichTextHtml(p.descriptionUa || ''),
        priceEur,
        priceUsd: p.priceUsd,
        tags: p.tags,
        isPublished: true,
        image: p.media?.[0]?.url || null,
        gallery: p.media?.map((m) => m.url) || [],
        productType: p.productType || null,
        vendor: p.vendor || 'Burger Motorsports Inc',
      };

      let productId: string;

      if (existing) {
        await prisma.shopProduct.update({ where: { id: existing.id }, data });
        productId = existing.id;
        updated++;
      } else {
        const product = await prisma.shopProduct.create({ data });
        productId = product.id;
        created++;
      }

      await prisma.shopProductMedia.deleteMany({ where: { productId } });
      if (p.media && p.media.length > 0) {
        await prisma.shopProductMedia.createMany({
          data: p.media.map((m, i) => ({
            productId,
            src: m.url,
            altText: m.alt || p.title,
            position: i,
            mediaType: 'IMAGE' as const,
          })),
        });
      }

      await prisma.shopProductVariant.deleteMany({ where: { productId } });
      await prisma.shopProductVariant.create({
        data: {
          productId,
          title: p.selectedVariant || 'Default',
          sku,
          priceEur,
          priceUsd: p.priceUsd,
          inventoryQty: 999,
          position: 0,
        },
      });

      const total = created + updated + skipped;
      if (total % 50 === 0) {
        process.stdout.write(`\r  Progress: ${total}/${products.length} (created=${created}, updated=${updated})`);
      }
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      errors.push(`[${p.slug}] ${p.title}: ${msg.slice(0, 200)}`);
      skipped++;
    }
  }

  console.log(`\n✅ Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`\n❌ Errors (first 10):`);
    errors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
