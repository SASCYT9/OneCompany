import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { adminProductInclude } from '@/lib/shopAdminCatalog';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    await ensureDefaultShopStores(prisma);

    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));
    const products = await prisma.shopProduct.findMany({
      where: { storeKey },
      orderBy: [{ updatedAt: 'desc' }],
      include: adminProductInclude,
    });

    const header = [
      'storeKey',
      'slug',
      'sku',
      'titleEn',
      'titleUa',
      'brand',
      'vendor',
      'status',
      'scope',
      'priceEur',
      'priceUsd',
      'priceUah',
      'image',
      'collections',
      'updatedAt',
    ];

    const rows = products.map((product) => [
      product.storeKey,
      product.slug,
      product.sku ?? '',
      product.titleEn,
      product.titleUa,
      product.brand ?? '',
      product.vendor ?? '',
      product.status,
      product.scope,
      product.priceEur ?? '',
      product.priceUsd ?? '',
      product.priceUah ?? '',
      product.image ?? '',
      product.collections.map((entry) => entry.collection.handle).join('|'),
      product.updatedAt.toISOString(),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shop-products-${storeKey}.csv"`,
      },
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop product export', error);
    return NextResponse.json({ error: 'Failed to export products' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
