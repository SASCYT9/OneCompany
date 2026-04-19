import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/shop/turn14/stock-check
 * Accepts an array of part numbers and returns which ones exist in local DB.
 * Body: { partNumbers: string[] }
 * Response: { inStock: Record<string, { productId: string; slug: string; title: string; sku: string }> }
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const { partNumbers } = await request.json();

    if (!Array.isArray(partNumbers) || partNumbers.length === 0) {
      return NextResponse.json({ inStock: {} });
    }

    // Normalize part numbers for matching (trim, uppercase)
    const normalizedParts = partNumbers.map((pn: string) => pn?.trim()).filter(Boolean);

    // Check products by SKU
    const products = await prisma.shopProduct.findMany({
      where: {
        sku: { in: normalizedParts },
      },
      select: {
        id: true,
        slug: true,
        sku: true,
        titleUa: true,
        status: true,
      },
    });

    // Also check by variant SKU
    const variants = await prisma.shopProductVariant.findMany({
      where: {
        sku: { in: normalizedParts },
      },
      select: {
        id: true,
        sku: true,
        product: {
          select: {
            id: true,
            slug: true,
            titleUa: true,
            status: true,
          },
        },
      },
    });

    // Build lookup map: partNumber -> product info
    const inStock: Record<string, { productId: string; slug: string; title: string; sku: string }> = {};

    for (const p of products) {
      if (p.sku) {
        inStock[p.sku] = {
          productId: p.id,
          slug: p.slug,
          title: p.titleUa,
          sku: p.sku,
        };
      }
    }

    for (const v of variants) {
      if (v.sku && !inStock[v.sku]) {
        inStock[v.sku] = {
          productId: v.product.id,
          slug: v.product.slug,
          title: v.product.titleUa,
          sku: v.sku,
        };
      }
    }

    return NextResponse.json({ inStock, count: Object.keys(inStock).length });
  } catch (error) {
    console.error('[stock-check] Error:', error);
    return NextResponse.json({ error: 'Failed to check stock' }, { status: 500 });
  }
}
