import { NextRequest, NextResponse } from 'next/server';
import { searchTurn14Items } from '@/lib/turn14';
import { prisma } from '@/lib/prisma';

const DEFAULT_MARKUP_PCT = 25;

/**
 * GET /api/shop/stock/search
 * 
 * Unified stock search across Turn14 (live API) and local DB distributors (IND, etc.).
 * 
 * Query params:
 *   source   — "turn14" | "local" | "all" (default: "turn14" for backward compat)
 *   q        — search keyword
 *   brand    — brand filter
 *   category — category filter (local only)
 *   year, make, model, submodel — fitment filters (Turn14 only)
 *   page     — pagination
 *   distributor — filter by distributor name for local source (e.g., "IND")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = (searchParams.get('source') || 'turn14').toLowerCase();

  if (source === 'local') {
    return handleLocalSearch(searchParams);
  }

  if (source === 'all') {
    return handleCombinedSearch(searchParams);
  }

  // Default: Turn14 live API
  return handleTurn14Search(searchParams);
}

// ─── Turn14 live API search ───────────────────────────────────────

async function handleTurn14Search(searchParams: URLSearchParams) {
  try {
    const keyword = searchParams.get('q') || '';
    const brand = searchParams.get('brand') || '';
    const year = searchParams.get('year') || '';
    const make = searchParams.get('make') || '';
    const model = searchParams.get('model') || '';
    const submodel = searchParams.get('submodel') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);

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

    const sanitizedItems = items.map((item: any) => {
      const attrs = item.attributes || item;
      const itemBrand = attrs.brand_name || attrs.brand || 'Unknown';
      const markupPct = markupMap.get(itemBrand.toLowerCase()) ?? DEFAULT_MARKUP_PCT;
      const multiplier = 1 + markupPct / 100;

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
        source: 'turn14' as const,
      };
    });

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages: meta.total_pages || meta.last_page || 1,
        totalItems: meta.total || items.length,
        source: 'turn14',
      },
    });
  } catch (error: any) {
    console.error('[Turn14 Search Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Local DB search (IND, future distributors) ───────────────────

async function handleLocalSearch(searchParams: URLSearchParams) {
  try {
    const q = searchParams.get('q')?.trim() || '';
    const distributor = searchParams.get('distributor')?.trim().toUpperCase() || '';
    const brand = searchParams.get('brand')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = 24;

    const where: any = {};

    if (distributor) where.distributor = distributor;
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (category) where.category = { contains: category, mode: 'insensitive' };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { partNumber: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.stockProduct.findMany({
        where,
        orderBy: [{ inStock: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockProduct.count({ where }),
    ]);

    const sanitizedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      partNumber: item.partNumber,
      description: item.description,
      thumbnail: item.thumbnail,
      inStock: item.inStock,
      price: item.retailPrice || (item.price ? item.price * (1 + item.markupPct / 100) : null),
      basePrice: item.price || 0,
      markupPct: item.markupPct,
      turn14Id: '', // no turn14 id for local products
      source: 'local' as const,
      distributor: item.distributor,
      category: item.category,
    }));

    // Get available filter values
    const [brands, categories] = await Promise.all([
      prisma.stockProduct.findMany({
        where: distributor ? { distributor } : {},
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
      }),
      prisma.stockProduct.findMany({
        where: distributor ? { distributor } : {},
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        source: 'local',
      },
      filters: {
        brands: brands.map(b => b.brand).filter(Boolean),
        categories: categories.map(c => c.category).filter(Boolean),
      },
    });
  } catch (error: any) {
    console.error('[Local Stock Search Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Combined search (Turn14 + local) ─────────────────────────────

async function handleCombinedSearch(searchParams: URLSearchParams) {
  try {
    const [turn14Res, localRes] = await Promise.allSettled([
      handleTurn14Search(searchParams).then(r => r.json()),
      handleLocalSearch(searchParams).then(r => r.json()),
    ]);

    const turn14Data = turn14Res.status === 'fulfilled' ? turn14Res.value.data || [] : [];
    const localData = localRes.status === 'fulfilled' ? localRes.value.data || [] : [];

    // Local products first, then Turn14
    const combined = [...localData, ...turn14Data];

    return NextResponse.json({
      data: combined,
      meta: {
        page: 1,
        totalPages: 1,
        totalItems: combined.length,
        source: 'all',
        turn14Count: turn14Data.length,
        localCount: localData.length,
      },
    });
  } catch (error: any) {
    console.error('[Combined Search Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
