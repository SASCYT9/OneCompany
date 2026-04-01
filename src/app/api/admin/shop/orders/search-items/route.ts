import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchTurn14Items } from '@/lib/turn14';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q');
  
  if (!keyword || keyword.trim() === '') {
    return NextResponse.json({ items: [] });
  }

  const query = keyword.trim();
  const lowerQuery = query.toLowerCase();

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

    // 2. Search Turn14 Database
    let turn14Items: any[] = [];
    const EXCLUDED_BRANDS = ['burger motorsports', 'brabus', 'racechip', 'bms', 'race chip', 'do88', 'urban', 'eventuri'];
    
    // Turn14 wholesale API often ignores query filters if the brand isn't authorized for the dealer
    const qLower = query.toLowerCase();
    const shouldSkipTurn14 = EXCLUDED_BRANDS.some(b => qLower.includes(b));

    if (!shouldSkipTurn14) {
      try {
        // Try to see if the user is searching for a Brand (e.g. "CSF")
        // Because Turn14 wholesale API ignores "keyword" parameter most of the time!
        const { findTurn14BrandIdByName } = await import('@/lib/turn14');
        const brandId = await findTurn14BrandIdByName(query);
        
        let results;
        if (brandId) {
            results = await searchTurn14Items('', 1, { brandId });
        } else {
            // Fallback (might return random items due to Turn14 weird rules)
            results = await searchTurn14Items(query, 1, {});
        }
        
        const rawItems = results.data || [];
        
        turn14Items = rawItems
          .filter((item: any) => {
            const b = (item.attributes?.brand_short_description || item.attributes?.brand || '').toLowerCase();
            return !EXCLUDED_BRANDS.includes(b);
          })
          .slice(0, 15).map((item: any) => { // Increased to 15 to give more Turn14 results
            const attrs = item.attributes || {};
            return {
              source: 'turn14',
              id: item.id,
              product_name: attrs.product_name || attrs.item_name || '',
              part_number: attrs.internal_part_number || attrs.mfr_part_number || attrs.part_number || '',
              brand: attrs.brand_short_description || attrs.brand || '',
              weight: attrs.weight || (attrs.dimensions?.[0]?.weight) || 0,
              primary_image: attrs.thumbnail || attrs.primary_image || '',
              dealer_price: attrs.dealer_price || attrs.jobber_price || 0,
              attributes: attrs,
            };
          });
      } catch (e) {
        console.error('[API] Turn14 Background Search Error:', e);
      }
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
