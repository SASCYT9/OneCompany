import { NextRequest, NextResponse } from 'next/server';
import { searchTurn14Items, fetchTurn14ItemPricing } from '@/lib/turn14';
import { prisma } from '@/lib/prisma';

const DEFAULT_MARKUP_PCT = 25;

/**
 * GET /api/shop/stock/search
 * Live proxy to Turn14 catalog with markup pricing.
 * Query params: q, brand, year, make, model, submodel, page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('q') || '';
    const brand = searchParams.get('brand') || '';
    const year = searchParams.get('year') || '';
    const make = searchParams.get('make') || '';
    const model = searchParams.get('model') || '';
    const submodel = searchParams.get('submodel') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Search Turn14 with all filters
    const results = await searchTurn14Items(keyword, page, {
      brand: brand || undefined,
      year: year || undefined,
      make: make || undefined,
      model: model || undefined,
    });

    const items = results.data || [];
    const meta = results.meta || {};

    // Load all brand markups from DB for efficient lookup
    const markups = await prisma.turn14BrandMarkup.findMany();
    const markupMap = new Map(markups.map(m => [m.brandName.toLowerCase(), m.markupPct]));

    // Map items with applied markup pricing
    const sanitizedItems = items.map((item: any) => {
      const attrs = item.attributes || item;
      const itemBrand = attrs.brand_name || attrs.brand || 'Unknown';
      const markupPct = markupMap.get(itemBrand.toLowerCase()) ?? DEFAULT_MARKUP_PCT;
      const multiplier = 1 + markupPct / 100;

      // Try to extract a price from the item data
      const basePrice = parseFloat(attrs.retail_price || attrs.list_price || attrs.price || '0') || 0;
      const finalPrice = basePrice > 0 ? Math.round(basePrice * multiplier * 100) / 100 : null;

      return {
        id: item.id,
        name: attrs.product_name || attrs.item_name || attrs.name || 'Auto Part',
        brand: itemBrand,
        partNumber: attrs.part_number || attrs.mfr_part_number || '',
        description: attrs.part_description || attrs.description || '',
        thumbnail: attrs.thumbnail || attrs.primary_image || null,
        inStock: attrs.regular_stock > 0 || attrs.can_purchase === true,
        basePrice,
        price: finalPrice,
        markupPct,
        turn14Id: item.id,
      };
    });

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages: meta.total_pages || meta.last_page || 1,
        totalItems: meta.total || items.length,
      }
    });
  } catch (error: any) {
    console.error('[Stock Search Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
