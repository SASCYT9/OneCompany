import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { parseAdminProductBulkStatusInput } from '@/lib/adminRouteValidation';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const body = await request.json();
    const { ids, status, isPublished, clearPublishedAt } = parseAdminProductBulkStatusInput(body);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.shopProduct.updateMany({
        where: {
          id: { in: ids },
        },
        data: {
          status,
          isPublished,
          publishedAt: clearPublishedAt ? null : new Date(),
        },
      });

      await writeAdminAuditLog(tx, session, {
        scope: 'shop',
        action: 'product.bulk-status',
        entityType: 'shop.product',
        metadata: {
          ids,
          status,
          updatedCount: result.count,
        },
      });

      return result;
    });

    return NextResponse.json({ success: true, count: updated.count });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (/required|invalid/i.test(String(error.message ?? ''))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Bulk Status Error:', error);
    return NextResponse.json({ error: 'Failed to update products' }, { status: 500 });
  }
}
