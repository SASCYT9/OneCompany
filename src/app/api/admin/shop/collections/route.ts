import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminCollectionInclude,
  adminCollectionListSelect,
  buildAdminCollectionCreateData,
  normalizeAdminCollectionPayload,
  serializeAdminCollectionListItem,
} from '@/lib/shopAdminCollections';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ);
    const collections = await prisma.shopCollection.findMany({
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
    const body = await request.json();
    const { data, errors } = normalizeAdminCollectionPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    const existing = await prisma.shopCollection.findUnique({ where: { handle: data.handle } });
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
