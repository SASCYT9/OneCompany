import { NextResponse } from 'next/server';
import { searchTurn14Items, findTurn14BrandIdByName } from '@/lib/turn14';

/**
 * GET /api/admin/shop/turn14?q=keyword&page=1
 *
 * Admin Turn14 search — flattens JSON:API attributes for easier frontend usage.
 * 
 * NOTE: Turn14 pricing endpoint (/items/{id}/data/pricing) returns 404 with current
 * credentials. Pricing is NOT available from the API. The admin page shows "dealer_price"
 * field as 0 — actual pricing must be managed through our markup system.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1', 10);

  if (!keyword) {
    return NextResponse.json({ data: [], meta: { current_page: 1, total_pages: 1 } });
  }

  try {
    const results = await searchTurn14Items(keyword, page);
    const rawItems = results.data || [];

    // Flatten JSON:API attributes for frontend convenience
    const enriched = rawItems.slice(0, 15).map((item: any) => {
      const attrs = item.attributes || {};

      return {
        id: item.id,
        type: item.type,
        product_name: attrs.product_name || attrs.item_name || '',
        part_number: attrs.part_number || '',
        internal_part_number: attrs.internal_part_number || attrs.mfr_part_number || '',
        brand: attrs.brand_short_description || attrs.brand || '',
        brand_id: attrs.brand_id || '',
        weight: attrs.weight || (attrs.dimensions?.[0]?.weight) || null,
        // Pricing not available from Turn14 API with current credentials
        dealer_price: null,
        jobber_price: null,
        retail_price: null,
        map_price: null,
        // Media
        primary_image: attrs.thumbnail || attrs.primary_image || '',
        // Category
        category: attrs.category || '',
        subcategory: attrs.subcategory || '',
        // Raw attributes backup
        attributes: attrs,
      };
    });

    return NextResponse.json({
      data: enriched,
      meta: results.meta || {},
    });
  } catch (error) {
    console.error('[API] Turn14 Search Error:', error);
    return NextResponse.json({ error: 'Failed to search Turn14 catalog. Please verify your API credentials.' }, { status: 500 });
  }
}
