import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    // Find products where SEO metadata is completely null or empty
    const products = await prisma.shopProduct.findMany({
      where: {
        OR: [
          { seoDescriptionUa: null },
          { seoDescriptionUa: '' },
          { seoTitleUa: null },
          { seoTitleUa: '' }
        ]
      },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleUa: true,
        brand: true,
        categoryEn: true,
        scope: true,
        updatedAt: true
      },
      take: 100, // Process in batches of 100
      orderBy: { updatedAt: 'desc' }
    });

    const totalMissing = await prisma.shopProduct.count({
      where: {
        OR: [
          { seoDescriptionUa: null },
          { seoDescriptionUa: '' },
          { seoTitleUa: null },
          { seoTitleUa: '' }
        ]
      }
    });

    return NextResponse.json({ products, totalMissing });

  } catch (error: any) {
    console.error('Admin Fetch SEO Missing Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
