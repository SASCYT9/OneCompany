const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Inventory Migration ---');
  
  // 1. Ensure at least one Location (Warehouse) exists
  let mainLocation = await prisma.shopWarehouse.findFirst({
    where: { code: 'MAIN_WH' }
  });

  if (!mainLocation) {
    mainLocation = await prisma.shopWarehouse.create({
      data: {
        code: 'MAIN_WH',
        name: 'Main Warehouse',
        nameUa: 'Головний Склад',
        country: 'UA'
      }
    });
    console.log('Created Main Warehouse:', mainLocation.id);
  } else {
    console.log('Main Warehouse exists:', mainLocation.id);
  }

  // 2. Find all variants that have legacy inventoryQty > 0
  const variants = await prisma.shopProductVariant.findMany({
    where: { inventoryQty: { gt: 0 } },
    select: { id: true, inventoryQty: true }
  });

  console.log(`Found ${variants.length} variants with legacy inventory.`);

  let created = 0;
  for (const variant of variants) {
    // Check if level already exists
    const existing = await prisma.shopInventoryLevel.findFirst({
      where: { variantId: variant.id, locationId: mainLocation.id }
    });

    if (!existing) {
      await prisma.shopInventoryLevel.create({
        data: {
          variantId: variant.id,
          locationId: mainLocation.id,
          stockedQuantity: variant.inventoryQty,
        }
      });
      created++;
    }
  }

  console.log(`Migrated ${created} variants to InventoryLevel.`);
  console.log('--- Migration Complete ---');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
