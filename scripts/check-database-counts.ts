import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllData() {
  console.log('📊 Supabase Database Row Counts:\n');

  try {
    const counts = {
      ShopProduct: await prisma.shopProduct.count(),
      ShopProductVariant: await prisma.shopProductVariant.count(),
      ShopProductMedia: await prisma.shopProductMedia.count(),
      ShopCategory: await prisma.shopCategory.count(),
      ShopCollection: await prisma.shopCollection.count(),
      AdminUser: await prisma.adminUser.count(),
      Message: await prisma.message.count(),
      TelegramUser: await prisma.telegramUser.count(),
      ShopCustomer: await prisma.shopCustomer.count(),
      ShopOrder: await prisma.shopOrder.count(),
    };

    for (const [table, count] of Object.entries(counts)) {
      console.log(`- ${table.padEnd(25)}: ${count} rows`);
    }

    console.log('\n🔍 Brand Breakdown (ShopProduct):');
    const brands = await prisma.shopProduct.groupBy({
      by: ['brand'],
      _count: true,
      orderBy: { _count: { brand: 'desc' } },
    });

    for (const b of brands) {
      console.log(`  - ${b.brand || '(no brand)'}: ${b._count}`);
    }

  } catch (error) {
    console.error('Error counting rows:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllData();
