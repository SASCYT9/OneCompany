import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
// Run with: npx tsx scripts/cleanup-burger.ts

async function main() {
  console.log('🧹 Starting Burger Motorsports Cleanup...');

  const productsToDelete = await prisma.shopProduct.findMany({
    where: {
      brand: 'Burger Motorsports',
      OR: [
        { priceUsd: null },         // Without price
        { priceUsd: { lt: 200 } }   // Cheaper than $200
      ]
    },
    select: { id: true, titleEn: true, priceUsd: true }
  });

  console.log(`🚨 Found ${productsToDelete.length} products fitting the removal criteria (Null price or < $200).`);

  if (productsToDelete.length === 0) {
    console.log('✅ Nothing to delete!');
    return;
  }

  // Extract IDs
  const idsToDelete = productsToDelete.map(p => p.id);

  // Perform bulk delete
  const deleteResult = await prisma.shopProduct.deleteMany({
    where: {
      id: { in: idsToDelete }
    }
  });

  console.log(`🗑️ Successfully deleted ${deleteResult.count} products from the database.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
