import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminCollectionInclude,
  buildAdminCollectionUpdateData,
  normalizeAdminCollectionPayload,
  serializeAdminCollection,
} from '@/lib/shopAdminCollections';

const prisma = new PrismaClient();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ);
    const { id } = await params;
    const collection = await prisma.shopCollection.findUnique({
      where: { id },
      include: adminCollectionInclude,
    });
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    return NextResponse.json(serializeAdminCollection(collection));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop collection get', error);
    return NextResponse.json({ error: 'Failed to get collection' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_WRITE);
    const { id } = await params;
    const body = await request.json();
    const { data, errors } = normalizeAdminCollectionPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    const existing = await prisma.shopCollection.findFirst({
      where: { handle: data.handle, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Another collection with this handle exists' }, { status: 409 });
    }
    const collection = await prisma.shopCollection.update({
      where: { id },
      data: buildAdminCollectionUpdateData(data),
      include: adminCollectionInclude,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'collection.update',
      entityType: 'shop.collection',
      entityId: collection.id,
      metadata: {
        handle: collection.handle,
        isUrban: collection.isUrban,
      },
    });
    return NextResponse.json(serializeAdminCollection(collection));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop collection update', error);
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_WRITE);
    const { id } = await params;
    const deleted = await prisma.shopCollection.delete({
      where: { id },
      select: { id: true, handle: true },
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'collection.delete',
      entityType: 'shop.collection',
      entityId: deleted.id,
      metadata: {
        handle: deleted.handle,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop collection delete', error);
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
  }
}
