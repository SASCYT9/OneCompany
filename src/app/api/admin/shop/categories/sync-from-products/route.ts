import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { syncCatalogCategories } from '@/lib/shopAdminCategories';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE);
    const result = await syncCatalogCategories(prisma);
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'category.sync_from_products',
      entityType: 'shop.category',
      metadata: result,
    });
    return NextResponse.json(result);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop category sync', error);
    return NextResponse.json({ error: 'Failed to sync categories from products' }, { status: 500 });
  }
}
