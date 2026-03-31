import { PrismaClient } from '@prisma/client';

async function compareDatabases() {
  console.log('🔄 Comparing Local DB vs Supabase DB...\n');

  // Supabase (Current Production)
  const supabasePrisma = new PrismaClient();
  
  // Local (Old Postgres)
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:postgres@localhost:5433/onecompany'
      }
    }
  });

  try {
    // 1. Compare ShopProduct Brands
    const sbBrands = await supabasePrisma.shopProduct.groupBy({ by: ['brand'], _count: true });
    const localBrands = await localPrisma.shopProduct.groupBy({ by: ['brand'], _count: true });

    console.log('=== 📦 БРЕНДИ (ShopProduct) ===');
    const allBrands = new Set([...sbBrands.map(b => b.brand), ...localBrands.map(b => b.brand)]);
    for (const brand of allBrands) {
      const sbCount = sbBrands.find(b => b.brand === brand)?._count || 0;
      const localCount = localBrands.find(b => b.brand === brand)?._count || 0;
      
      let status = '';
      if (sbCount === 0 && localCount > 0) status = '❌ ВТРАЧЕНО (є тільки локально)';
      else if (sbCount > 0 && localCount === 0) status = '✅ НОВЕ (є тільки в Supabase)';
      else if (sbCount < localCount) status = `⚠️ ЧАСТКОВО ВТРАЧЕНО (-${localCount - sbCount})`;
      else if (sbCount > localCount) status = `📈 БІЛЬШЕ В SUPABASE (+${sbCount - localCount})`;
      else status = '✨ ОДНАКОВО';

      console.log(`${(brand || 'Без бренду').padEnd(25)} | Local: ${localCount.toString().padEnd(5)} | Supabase: ${sbCount.toString().padEnd(5)} | ${status}`);
    }

    // 2. Compare other key tables
    console.log('\n=== 📊 ІНШІ ТАБЛИЦІ ===');
    const tables = ['ShopOrder', 'ShopCustomer', 'ShopCategory', 'ShopCollection', 'AdminUser'];
    
    for (const table of tables) {
      // @ts-ignore
      const localCount = await localPrisma[table.charAt(0).toLowerCase() + table.slice(1)].count();
      // @ts-ignore
      const sbCount = await supabasePrisma[table.charAt(0).toLowerCase() + table.slice(1)].count();
      
      let status = '';
      if (sbCount === 0 && localCount > 0) status = `❌ ВТРАЧЕНО ${localCount} записів`;
      else if (sbCount > 0 && localCount === 0) status = `✅ СТВОРЕНО ${sbCount} нових записів`;
      else if (sbCount === localCount) status = '✨ ОДНАКОВО';
      else status = `Змінилось: Local ${localCount} -> Supabase ${sbCount}`;

      console.log(`${table.padEnd(25)} | Local: ${localCount.toString().padEnd(5)} | Supabase: ${sbCount.toString().padEnd(5)} | ${status}`);
    }

    // 3. Compare ShopProduct variants & media
    const localVariants = await localPrisma.shopProductVariant.count();
    const sbVariants = await supabasePrisma.shopProductVariant.count();
    console.log(`\nShopProductVariant        | Local: ${localVariants.toString().padEnd(5)} | Supabase: ${sbVariants.toString().padEnd(5)}`);

    const localMedia = await localPrisma.shopProductMedia.count();
    const sbMedia = await supabasePrisma.shopProductMedia.count();
    console.log(`ShopProductMedia          | Local: ${localMedia.toString().padEnd(5)} | Supabase: ${sbMedia.toString().padEnd(5)}`);


  } catch (error) {
    console.error('Error comparing databases:', error);
  } finally {
    await supabasePrisma.$disconnect();
    await localPrisma.$disconnect();
  }
}

compareDatabases();
