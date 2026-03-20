import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  adminCollectionInclude,
  adminCollectionListSelect,
  buildAdminCollectionCreateData,
  normalizeAdminCollectionPayload,
  serializeAdminCollectionListItem,
} from '@/lib/shopAdminCollections';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ);
    await ensureDefaultShopStores(prisma);
    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));
    const collections = await prisma.shopCollection.findMany({
      where: { storeKey },
      orderBy: [{ isUrban: 'desc' }, { sortOrder: 'asc' }, { titleEn: 'asc' }],
      select: adminCollectionListSelect,
    });
    return NextResponse.json(collections.map(serializeAdminCollectionListItem));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop collections list', error);
    return NextResponse.json({ error: 'Failed to list collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_WRITE);
    await ensureDefaultShopStores(prisma);
    const body = await request.json();
    const { data, errors } = normalizeAdminCollectionPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    const existing = await prisma.shopCollection.findFirst({
      where: { storeKey: data.storeKey, handle: data.handle },
    });
    if (existing) {
      return NextResponse.json({ error: 'Collection with this handle already exists' }, { status: 409 });
    }
    const collection = await prisma.shopCollection.create({
      data: buildAdminCollectionCreateData(data),
      include: adminCollectionInclude,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'collection.create',
      entityType: 'shop.collection',
      entityId: collection.id,
      metadata: {
        storeKey: collection.storeKey,
        handle: collection.handle,
        isUrban: collection.isUrban,
      },
    });
    return NextResponse.json(serializeAdminCollectionListItem(collection));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop collection create', error);
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
}
