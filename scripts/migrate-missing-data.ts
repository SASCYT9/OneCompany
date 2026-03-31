import { PrismaClient } from '@prisma/client';

async function migrate() {
  console.log('🚀 Зливаємо локальні дані у Supabase...\n');

  const supa = new PrismaClient(); // Supabase (from .env)
  const local = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:postgres@localhost:5433/onecompany' }
    }
  });

  try {
    // ----------------------------------------------------
    // 1. ShopCategory
    // ----------------------------------------------------
    const allCategories = await local.shopCategory.findMany();
    if (allCategories.length > 0) {
      console.log(`\n⏳ Переносимо Категорії (${allCategories.length})...`);
      let success = 0;
      for (const cat of allCategories) {
        try {
          await supa.shopCategory.create({ data: cat });
          success++;
        } catch (e: any) {
          if (e.code !== 'P2002') console.log(`Помилка категорії ${cat.slug}: ${e.message}`);
        }
      }
      console.log(`✅ Категорії перенесено: ${success}`);
    }

    // ----------------------------------------------------
    // 2. ShopCollection
    // ----------------------------------------------------
    const allCollections = await local.shopCollection.findMany();
    if (allCollections.length > 0) {
      console.log(`\n⏳ Переносимо Колекції (${allCollections.length})...`);
      let success = 0;
      for (const col of allCollections) {
        try {
          await supa.shopCollection.create({ data: col });
          success++;
        } catch (e: any) {
          if (e.code !== 'P2002') console.log(`Помилка колекції ${col.handle}: ${e.message}`);
        }
      }
      console.log(`✅ Колекції перенесено: ${success}`);
    }

    // ----------------------------------------------------
    // 3. Products (The missing ones)
    // ----------------------------------------------------
    console.log(`\n⏳ Збираємо товари...`);
    const existingSlugs = new Set((await supa.shopProduct.findMany({ select: { slug: true } })).map(p => p.slug));
    
    // Fetch raw products bypassing Prisma schema checks
    const rawProducts = await local.$queryRawUnsafe<any[]>('SELECT * FROM "ShopProduct"');
    const productsToMigrate = rawProducts.filter(p => !existingSlugs.has(p.slug));
    
    console.log(`❗ Знайдено відсутніх товарів для перенесення: ${productsToMigrate.length}`);

    let pSuccess = 0;
    const CHUNK_SIZE = 10;
    
    for (let i = 0; i < productsToMigrate.length; i += CHUNK_SIZE) {
      const chunk = productsToMigrate.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (data) => {
        try {
          const variants = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopProductVariant" WHERE "productId" = '${data.id}'`);
          const media = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopProductMedia" WHERE "productId" = '${data.id}'`);
          const options = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopProductOption" WHERE "productId" = '${data.id}'`);
          const collections = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopProductCollection" WHERE "productId" = '${data.id}'`);
          const metafields = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopProductMetafield" WHERE "productId" = '${data.id}'`);

          await supa.shopProduct.create({
            data: {
              ...data,
              gallery: data.gallery || undefined,
              highlights: data.highlights || undefined,
              variants: variants.length ? { create: variants.map(v => { const { productId, ...rest} = v; return rest; }) } : undefined,
              media: media.length ? { create: media.map(m => { const { productId, ...rest} = m; return rest; }) } : undefined,
              options: options.length ? { create: options.map(o => { const { productId, ...rest} = o; return rest; }) } : undefined,
              collections: collections.length ? { create: collections.map(c => ({ collectionId: c.collectionId, sortOrder: c.sortOrder })) } : undefined,
              metafields: metafields.length ? { create: metafields.map(m => { const { productId, ...rest} = m; return rest; }) } : undefined,
            }
          });
          pSuccess++;
          process.stdout.write(`\r✅ Перенесено товарів: ${pSuccess} / ${productsToMigrate.length}`);
        } catch (e: any) {
          if (e.code !== 'P2002') console.log(`\nПомилка товару ${data.slug}: ${e.message}`);
        }
      }));
    }
    console.log(`\n🎉 Усі відсутні товари перенесені! ${pSuccess}`);

    // ----------------------------------------------------
    // 4. ShopCustomer & related
    // ----------------------------------------------------
    const rawCustomers = await local.$queryRawUnsafe<any[]>('SELECT * FROM "ShopCustomer"');
    if (rawCustomers.length > 0) {
      console.log(`\n⏳ Переносимо Клієнтів (${rawCustomers.length})...`);
      let success = 0;
      for (const data of rawCustomers) {
        try {
          const exists = await supa.shopCustomer.findUnique({ where: { email: data.email } });
          if (!exists) {
            const accArr = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopCustomerAccount" WHERE "customerId" = '${data.id}'`);
            const addrArr = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopCustomerAddress" WHERE "customerId" = '${data.id}'`);
            
            let accountCreate;
            if (accArr.length > 0) {
               const { customerId, ...accData } = accArr[0];
               accountCreate = { create: accData };
            }

            await supa.shopCustomer.create({
              data: {
                ...data,
                account: accountCreate,
                addresses: addrArr.length ? { create: addrArr.map(a => { const { customerId, ...addrData } = a; return addrData; }) } : undefined,
              }
            });
            success++;
          }
        } catch (e: any) {
           if (e.code !== 'P2002') console.log(`Помилка клієнта ${data.email}: ${e.message}`);
        }
      }
      console.log(`✅ Нових клієнтів перенесено: ${success}`);
    }

    // ----------------------------------------------------
    // 5. ShopOrder & related
    // ----------------------------------------------------
    const rawOrders = await local.$queryRawUnsafe<any[]>('SELECT * FROM "ShopOrder"');
    if (rawOrders.length > 0) {
      console.log(`\n⏳ Переносимо Замовлення (${rawOrders.length})...`);
      let success = 0;
      for (const data of rawOrders) {
        try {
          const exists = await supa.shopOrder.findUnique({ where: { orderNumber: data.orderNumber } });
          if (!exists) {
            const items = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopOrderItem" WHERE "orderId" = '${data.id}'`);
            const events = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopOrderStatusEvent" WHERE "orderId" = '${data.id}'`);
            const shipments = await local.$queryRawUnsafe<any[]>(`SELECT * FROM "ShopShipment" WHERE "orderId" = '${data.id}'`);
            
            await supa.shopOrder.create({
              data: {
                ...data,
                shippingAddress: data.shippingAddress as any,
                pricingSnapshot: data.pricingSnapshot as any,
                items: items.length ? { create: items.map(i => { const { orderId, productId, variantId, ...rest } = i; return rest; }) } : undefined,
                events: events.length ? { create: events.map(e => { const { orderId, ...rest } = e; return rest; }) } : undefined,
                shipments: shipments.length ? { create: shipments.map(s => { const { orderId, ...rest } = s; return rest; }) } : undefined,
              }
            });
            success++;
          }
        } catch (e: any) {
           if (e.code !== 'P2002') console.log(`Помилка замовлення ${data.orderNumber}: ${e.message}`);
        }
      }
      console.log(`✅ Нових замовлень перенесено: ${success}`);
    }

  } catch (err) {
    console.error('Fatal Migration Error:', err);
  } finally {
    await supa.$disconnect();
    await local.$disconnect();
  }
}

migrate();
