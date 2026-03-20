import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  createShopStore,
  listShopStores,
  normalizeShopStoreInput,
  sanitizeShopStoreKeyInput,
} from '@/lib/shopStores';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    return NextResponse.json(await listShopStores(prisma));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop stores list', error);
    return NextResponse.json({ error: 'Failed to list stores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const body = await request.json().catch(() => ({}));
    const data = normalizeShopStoreInput(body);

    if (!data.key) {
      return NextResponse.json({ error: 'Store key is required' }, { status: 400 });
    }
    if (data.key !== sanitizeShopStoreKeyInput(data.key)) {
      return NextResponse.json({ error: 'Store key contains unsupported characters' }, { status: 400 });
    }
    if (!data.name) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
    }

    const existing = await prisma.shopStore.findUnique({ where: { key: data.key }, select: { key: true } });
    if (existing) {
      return NextResponse.json({ error: 'Store with this key already exists' }, { status: 409 });
    }

    const store = await createShopStore(prisma, data);
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'store.create',
      entityType: 'shop.store',
      entityId: store.key,
      metadata: {
        key: store.key,
        name: store.name,
        isActive: store.isActive,
        sortOrder: store.sortOrder,
      },
    });
    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop store create', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
