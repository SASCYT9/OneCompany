import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { searchTurn14Items } from '@/lib/turn14';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q');
  
  if (!keyword || keyword.trim() === '') {
    return NextResponse.json({ items: [] });
  }

  const query = keyword.trim();

  try {
    // 0. Fetch live NBU exchange rates from Global Settings
    const settingsRec = await getOrCreateShopSettings(prisma);
    const settings = getShopSettingsRuntime(settingsRec);
    const EUR_TO_USD = settings.currencyRates.USD || 1.08;

    // 1. Search Local Database (`ShopProductVariant` + `ShopProduct`)
    // We search across SKU, Variant Title, Product Title, and Product Brand
    const localVariants = await prisma.shopProductVariant.findMany({
      where: {
        OR: [
          { sku: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { product: { titleEn: { contains: query, mode: 'insensitive' } } },
          { product: { titleUa: { contains: query, mode: 'insensitive' } } },
          { product: { brand: { contains: query, mode: 'insensitive' } } },
        ]
      },
      include: {
        product: true
      },
      take: 20 // limit to top 20 local results
    });

    const localItems = localVariants.map(v => {
      const priceUsd = v.priceUsd ? Number(v.priceUsd) : 0;
      const priceEur = v.priceEur ? Number(v.priceEur) : 0;
      const costPerItem = v.costPerItem ? Number(v.costPerItem) : 0;

      let retailPrice = priceUsd;
      if (retailPrice === 0 && priceEur > 0) retailPrice = priceEur * EUR_TO_USD;
      if (retailPrice === 0 && costPerItem > 0) retailPrice = costPerItem * EUR_TO_USD;
      if (retailPrice === 0) retailPrice = 0;
      
      // Round to 2 decimals
      retailPrice = Math.round(retailPrice * 100) / 100;
      
      return {
        source: 'local',
        id: v.id,
        productId: v.productId,
        product_name: v.product?.titleEn || v.product?.titleUa || v.title || '',
        part_number: v.sku || '',
        brand: v.product?.brand || '',
        weight: v.weight || 0, // In our custom shop, weight is usually defined as float
        primary_image: v.image || v.product?.image || '',
        
        // Pricing logic: We map retail price to baseCost so markup can be set to 0 later
        dealer_price: retailPrice, 
        
        // Full object dump for backup
        attributes: v,
      };
    });

    // 2. Search Turn14 Database (Local Postgres Cache)
    let turn14Items: any[] = [];
    
    try {
      const rawItems = await prisma.turn14CatalogItem.findMany({
        where: {
          OR: [
            { partNumber: { contains: query, mode: 'insensitive' } },
            { productName: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
          ]
        },
        take: 15
      });

      turn14Items = rawItems.map((item: any) => {
          const attrs = item.rawAttributes as any || {};
          return {
            source: 'turn14',
            id: item.id,
            product_name: item.productName,
            part_number: item.partNumber,
            brand: item.brand,
            weight: item.weight || attrs.weight || (attrs.dimensions?.[0]?.weight) || 0,
            primary_image: attrs.thumbnail || attrs.primary_image || '',
            dealer_price: item.retailPrice || item.dealerPrice || attrs.jobber_price || attrs.dealer_price || 0,
            attributes: attrs,
          };
      });
    } catch (e) {
      console.error('[API] Local Turn14 Search Error:', e);
    }

    // Combine results (Local first, then Turn14)
    const combinedItems = [...localItems, ...turn14Items];

    return NextResponse.json({
      items: combinedItems,
    });
  } catch (error) {
    console.error('[API] Search Items Error:', error);
    return NextResponse.json({ error: 'Failed to search items' }, { status: 500 });
  }
}
