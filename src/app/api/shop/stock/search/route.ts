import { NextRequest, NextResponse } from 'next/server';
import { searchTurn14Items, findTurn14BrandIdByName } from '@/lib/turn14';
import { prisma } from '@/lib/prisma';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { calcItemPrice } from '@/lib/shippingCalc';

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
  
  const session = await getCurrentShopCustomerSession();
  const b2bDiscountPercent = session ? Number(session.b2bDiscountPercent || 0) : 0;

  if (source === 'local') {
    return handleLocalSearch(searchParams, b2bDiscountPercent);
  }

  if (source === 'all') {
    return handleCombinedSearch(searchParams, b2bDiscountPercent);
  }

  // Default: Turn14 live API
  return handleTurn14Search(searchParams, b2bDiscountPercent);
}

// ─── Turn14 live API search ───────────────────────────────────────

async function handleTurn14Search(searchParams: URLSearchParams, b2bDiscountPercent: number) {
  try {
    const keyword = searchParams.get('q') || '';
    const brand = searchParams.get('brand') || '';
    const year = searchParams.get('year') || '';
    const make = searchParams.get('make') || '';
    const model = searchParams.get('model') || '';
    const submodel = searchParams.get('submodel') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 24;

    const where: any = {};

    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    
    // Fitment filter across the relation
    if (year || make || model || submodel) {
      where.fitments = {
        some: {
          ...(year && { year }),
          ...(make && { make }),
          ...(model && { model }),
          ...(submodel && { submodel }),
        }
      };
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { partNumber: { contains: keyword, mode: 'insensitive' } },
        { brand: { contains: keyword, mode: 'insensitive' } },
        { category: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    let items: any[] = [];
    let total = 0;

    try {
      [items, total] = await Promise.all([
        prisma.turn14Item.findMany({
          where,
          orderBy: [{ inStock: 'desc' }, { name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.turn14Item.count({ where }),
      ]);
    } catch (dbErr) {
      console.warn('[Turn14 Local Search] DB query failed', dbErr);
    }

    // Load available brand markups for the pricing scaler
    let markupMap = new Map<string, number>();
    try {
      const markups = await prisma.turn14BrandMarkup.findMany();
      markupMap = new Map(markups.map(m => [m.brandName.toLowerCase(), m.markupPct]));
    } catch (dbErr) {
      console.warn('[Turn14 Search] DB unreachable for brand markups');
    }

    const sanitizedItems = items.map((item: any) => {
      const attrs = item.attributes || {};
      const itemBrand = item.brand || attrs.brand || 'Unknown';
      const markupPct = markupMap.get(itemBrand.toLowerCase()) ?? DEFAULT_MARKUP_PCT;
      const multiplier = 1 + markupPct / 100;

      const basePrice = parseFloat(item.price || attrs.retail_price || attrs.list_price || attrs.price || '0') || 0;
      
      let finalPrice: number | null = null;
      let originalPrice: number | null = null;

      if (basePrice > 0) {
        const priceRes = calcItemPrice({
          baseCostUsd: basePrice,
          markupPct,
          discountPct: b2bDiscountPercent,
          quantity: 1
        });
        originalPrice = priceRes.markedUpPrice;
        finalPrice = priceRes.unitPrice;
      }

      return {
        id: item.id,
        name: item.name || attrs.product_name || attrs.item_name || attrs.name || 'Auto Part',
        brand: itemBrand,
        partNumber: item.partNumber || attrs.part_number || attrs.mfr_part_number || '',
        category: item.category || attrs.category || null,
        description: attrs.part_description || attrs.description || '',
        thumbnail: item.thumbnail || attrs.thumbnail || attrs.primary_image || null,
        inStock: item.inStock || attrs.regular_stock > 0 || attrs.can_purchase === true,
        basePrice,
        price: finalPrice,
        originalPrice: b2bDiscountPercent > 0 ? originalPrice : null,
        markupPct,
        turn14Id: item.id,
        source: 'turn14' as const,
      };
    });

    let distinctCategories: any[] = [];
    try {
      distinctCategories = await prisma.turn14Item.findMany({
        where: brand ? { brand: { contains: brand, mode: 'insensitive' } } : {},
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      });
    } catch {}

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages,
        totalItems: total,
        source: 'turn14',
      },
      filters: {
        categories: distinctCategories.map(c => c.category).filter(Boolean),
      }
    });

  } catch (error: any) {
    console.error('[Turn14 Local Search Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Local DB search (IND, future distributors) ───────────────────

async function handleLocalSearch(searchParams: URLSearchParams, b2bDiscountPercent: number) {
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

    let items: any[] = [];
    let total = 0;
    try {
      [items, total] = await Promise.all([
        prisma.stockProduct.findMany({
          where,
          orderBy: [{ inStock: 'desc' }, { name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.stockProduct.count({ where }),
      ]);
    } catch (dbErr) {
      console.warn('[Local Stock] DB unreachable, returning empty results', dbErr instanceof Error ? dbErr.message : dbErr);
      return NextResponse.json({
        data: [],
        meta: { page, totalPages: 0, totalItems: 0, source: 'local' },
        filters: { brands: [], categories: [] },
      });
    }

    const sanitizedItems = items.map(item => {
      let finalPrice: number | null = null;
      let originalPrice: number | null = null;

      if (item.retailPrice) {
        // If it has a hardcoded retail price, use it as marked up
        originalPrice = item.retailPrice;
        finalPrice = item.retailPrice;
        if (finalPrice !== null && b2bDiscountPercent > 0) {
          finalPrice = Math.round(finalPrice * (1 - b2bDiscountPercent / 100) * 100) / 100;
        }
      } else if (item.price) {
        // Calculate dynamic markup
        const priceRes = calcItemPrice({
          baseCostUsd: item.price,
          markupPct: item.markupPct,
          discountPct: b2bDiscountPercent,
          quantity: 1
        });
        originalPrice = priceRes.markedUpPrice;
        finalPrice = priceRes.unitPrice;
      }

      return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        partNumber: item.partNumber,
        description: item.description,
        thumbnail: item.thumbnail,
        inStock: item.inStock,
        price: finalPrice,
        originalPrice: b2bDiscountPercent > 0 ? originalPrice : null,
        basePrice: item.price || 0,
        markupPct: item.markupPct,
        turn14Id: '', // no turn14 id for local products
        source: 'local' as const,
        distributor: item.distributor,
        category: item.category,
      };
    });

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

async function handleCombinedSearch(searchParams: URLSearchParams, b2bDiscountPercent: number) {
  try {
    const [turn14Res, localRes] = await Promise.allSettled([
      handleTurn14Search(searchParams, b2bDiscountPercent).then(r => r.json()),
      handleLocalSearch(searchParams, b2bDiscountPercent).then(r => r.json()),
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
