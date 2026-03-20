import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  adminCollectionInclude,
  buildAdminCollectionUpdateData,
  normalizeAdminCollectionPayload,
  serializeAdminCollection,
} from '@/lib/shopAdminCollections';
import { ensureDefaultShopStores } from '@/lib/shopStores';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ);
    await ensureDefaultShopStores(prisma);
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
    await ensureDefaultShopStores(prisma);
    const { id } = await params;
    const body = await request.json();
    const productAssignments = Array.isArray(body.productAssignments)
      ? (body.productAssignments as Array<{ id?: string; sortOrder?: number }>)
          .filter((entry) => typeof entry?.id === 'string')
          .map((entry, index) => ({
            id: String(entry.id),
            sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Math.trunc(Number(entry.sortOrder)) : index,
          }))
      : null;
    const { data, errors } = normalizeAdminCollectionPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    const existing = await prisma.shopCollection.findFirst({
      where: { handle: data.handle, storeKey: data.storeKey, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Another collection with this handle exists' }, { status: 409 });
    }
    const collection = await prisma.$transaction(async (tx) => {
      const updatedCollection = await tx.shopCollection.update({
        where: { id },
        data: buildAdminCollectionUpdateData(data),
        include: adminCollectionInclude,
      });

      if (productAssignments) {
        await Promise.all(
          productAssignments.map((entry) =>
            tx.shopProductCollection.update({
              where: {
                productId_collectionId: {
                  productId: entry.id,
                  collectionId: id,
                },
              },
              data: {
                sortOrder: entry.sortOrder,
              },
            })
          )
        );

        return tx.shopCollection.findUniqueOrThrow({
          where: { id },
          include: adminCollectionInclude,
        });
      }

      return updatedCollection;
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: productAssignments ? 'collection.update_with_product_order' : 'collection.update',
      entityType: 'shop.collection',
      entityId: collection.id,
      metadata: {
        storeKey: collection.storeKey,
        handle: collection.handle,
        isUrban: collection.isUrban,
        productAssignmentsCount: productAssignments?.length ?? 0,
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
    await ensureDefaultShopStores(prisma);
    const { id } = await params;
    const deleted = await prisma.shopCollection.delete({
      where: { id },
      select: { id: true, storeKey: true, handle: true },
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'collection.delete',
      entityType: 'shop.collection',
      entityId: deleted.id,
      metadata: {
        storeKey: deleted.storeKey,
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
