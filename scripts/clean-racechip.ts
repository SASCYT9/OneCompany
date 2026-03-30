import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  console.log('Fetching all RaceChip products...');
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'RaceChip' },
    select: { id: true, longDescUa: true, longDescEn: true },
  });

  console.log(`Found ${products.length} products to check.`);

  let updatedCount = 0;

  for (const product of products) {
    if (!product.longDescUa || !product.longDescEn) continue;

    const oldUa = product.longDescUa;
    const oldEn = product.longDescEn;

    const newUa = oldUa
      .replace(/  <li>2-річна гарантія на двигун \(до €5,000\)<\/li>\n/g, '')
      .replace(/  <li>1x безкоштовне перепрограмування при зміні авто<\/li>\n/g, '')
      .replace(/ 30 днів на повернення\./g, '');

    const newEn = oldEn
      .replace(/  <li>2-year engine warranty \(up to €5,000\)<\/li>\n/g, '')
      .replace(/  <li>1x free re-programming if you change your car<\/li>\n/g, '')
      .replace(/ 30-day return policy\./g, '');

    if (newUa !== oldUa || newEn !== oldEn) {
      await prisma.shopProduct.update({
        where: { id: product.id },
        data: {
          longDescUa: newUa,
          longDescEn: newEn,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully cleaned ${updatedCount} products!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
