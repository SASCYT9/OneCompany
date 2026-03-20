import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_SHOP_STORE_KEY,
  normalizeShopStoreInput,
  updateShopStore,
} from '@/lib/shopStores';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const { key } = await params;
    const existing = await prisma.shopStore.findUnique({
      where: { key },
      select: {
        key: true,
        name: true,
        description: true,
        isActive: true,
        sortOrder: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const data = normalizeShopStoreInput(body, key);

    if (!data.name) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
    }
    if (key === DEFAULT_SHOP_STORE_KEY && data.isActive === false) {
      return NextResponse.json({ error: 'Default store cannot be disabled' }, { status: 400 });
    }

    const store = await updateShopStore(prisma, key, {
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'store.update',
      entityType: 'shop.store',
      entityId: store.key,
      metadata: {
        before: existing,
        after: {
          name: store.name,
          description: store.description,
          isActive: store.isActive,
          sortOrder: store.sortOrder,
        },
      },
    });
    return NextResponse.json(store);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop store update', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
