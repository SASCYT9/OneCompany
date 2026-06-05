import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const gpVariantsPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-variants.json');
  if (!fs.existsSync(gpVariantsPath)) {
    console.error('gp-portal-variants.json not found!');
    return;
  }

  const gpVariants = JSON.parse(fs.readFileSync(gpVariantsPath, 'utf8'));
  console.log(`Loaded ${gpVariants.length} products from gp-portal-variants.json`);

  const comparison: any[] = [];

  for (const gp of gpVariants) {
    const gpSku = gp.sku;
    const gpTitle = gp.product.title;
    let gpImg = gp.image?.src;
    if (gpImg && gpImg.startsWith('//')) {
      gpImg = 'https:' + gpImg;
    }

    // Try to find product in DB by SKU (exact or prefix match since sometimes V1/V2/V3 can differ)
    // E.g., DB might have URB-LOG-25353014-V1 and GP has URB-LOG-25353014-V3
    const skuBase = gpSku ? gpSku.replace(/-V\d+$/i, '') : null;

    let dbProduct = null;
    if (gpSku) {
      dbProduct = await prisma.shopProduct.findFirst({
        where: {
          OR: [
            { sku: gpSku },
            { sku: { startsWith: skuBase || gpSku } },
            { slug: gp.product.handle }
          ]
        }
      });
    }

    if (!dbProduct) {
      // Try finding by English title
      dbProduct = await prisma.shopProduct.findFirst({
        where: {
          OR: [
            { titleEn: gpTitle },
            { titleEn: { contains: gpTitle } }
          ]
        }
      });
    }

    comparison.push({
      gpSku,
      gpTitle,
      gpImage: gpImg || null,
      dbSku: dbProduct?.sku || null,
      dbTitle: dbProduct?.titleEn || null,
      dbImage: dbProduct?.image || null,
      dbId: dbProduct?.id || null
    });
  }

  console.log('Comparison results:');
  console.log(JSON.stringify(comparison, null, 2));

  fs.writeFileSync(
    path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'image-comparison.json'),
    JSON.stringify(comparison, null, 2)
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
