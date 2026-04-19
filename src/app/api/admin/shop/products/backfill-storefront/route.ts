import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { buildStorefrontBackfillPlan } from '@/lib/shopProductStorefront';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const products = await prisma.shopProduct.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        brand: true,
        vendor: true,
        tags: true,
        collections: {
          select: {
            collection: {
              select: {
                handle: true,
                brand: true,
                isUrban: true,
                titleEn: true,
                titleUa: true,
              },
            },
          },
        },
      },
    });

    const plan = buildStorefrontBackfillPlan(
      products.map((product) => ({
        id: product.id,
        slug: product.slug,
        brand: product.brand,
        vendor: product.vendor,
        tags: product.tags,
        collections: product.collections.map((entry) => ({
          handle: entry.collection.handle,
          brand: entry.collection.brand,
          isUrban: entry.collection.isUrban,
          title: {
            en: entry.collection.titleEn,
            ua: entry.collection.titleUa,
          },
        })),
      }))
    );

    const changedItems = plan.items.filter((item) => item.changed);

    await prisma.$transaction(async (tx) => {
      for (const item of changedItems) {
        await tx.shopProduct.update({
          where: { id: item.id },
          data: {
            tags: item.tags,
          },
        });
      }

      await writeAdminAuditLog(tx, session, {
        scope: 'shop',
        action: 'product.storefront-backfill',
        entityType: 'shop.product',
        metadata: {
          totalCount: products.length,
          updatedCount: plan.updatedCount,
          storefrontCounts: plan.storefrontCounts,
        },
      });
    });

    return NextResponse.json({
      success: true,
      totalCount: products.length,
      updatedCount: plan.updatedCount,
      storefrontCounts: plan.storefrontCounts,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('Storefront backfill error:', error);
    return NextResponse.json({ error: 'Failed to normalize storefront tags' }, { status: 500 });
  }
}
