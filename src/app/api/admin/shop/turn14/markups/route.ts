import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

const DEFAULT_MARKUP = 25; // 25% default markup for brands without a specific entry

/**
 * GET /api/admin/shop/turn14/markups
 * Returns all brand markups.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const markups = await prisma.turn14BrandMarkup.findMany({
      orderBy: { brandName: 'asc' }
    });
    return NextResponse.json({ data: markups, defaultMarkup: DEFAULT_MARKUP });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/shop/turn14/markups
 * Upsert a brand markup: { brandId, brandName, markupPct }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const body = await request.json();
    const { brandId, brandName, markupPct } = body;

    if (!brandId || !brandName) {
      return NextResponse.json({ error: 'brandId and brandName are required' }, { status: 400 });
    }

    const markup = await prisma.turn14BrandMarkup.upsert({
      where: { brandId: String(brandId) },
      update: {
        brandName,
        markupPct: parseFloat(markupPct) || DEFAULT_MARKUP,
      },
      create: {
        brandId: String(brandId),
        brandName,
        markupPct: parseFloat(markupPct) || DEFAULT_MARKUP,
      }
    });

    return NextResponse.json({ success: true, data: markup });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/shop/turn14/markups
 * Bulk update: { markups: [{ brandId, brandName, markupPct }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { markups } = body;

    if (!Array.isArray(markups)) {
      return NextResponse.json({ error: 'markups array is required' }, { status: 400 });
    }

    const results = [];
    for (const m of markups) {
      const result = await prisma.turn14BrandMarkup.upsert({
        where: { brandId: String(m.brandId) },
        update: { markupPct: parseFloat(m.markupPct) || DEFAULT_MARKUP },
        create: {
          brandId: String(m.brandId),
          brandName: m.brandName,
          markupPct: parseFloat(m.markupPct) || DEFAULT_MARKUP,
        }
      });
      results.push(result);
    }

    return NextResponse.json({ success: true, updated: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
