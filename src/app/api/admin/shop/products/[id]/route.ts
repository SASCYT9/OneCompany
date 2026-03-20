import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  adminProductInclude,
  buildAdminProductUpdateData,
  normalizeAdminProductPayload,
  serializeAdminProduct,
} from '@/lib/shopAdminCatalog';
import { ensureDefaultShopStores } from '@/lib/shopStores';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    await ensureDefaultShopStores(prisma);
    const { id } = await params;
    const product = await prisma.shopProduct.findUnique({
      where: { id },
      include: adminProductInclude,
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(serializeAdminProduct(product));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to get product' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const { id } = await params;
    const body = await request.json();
    const { data, errors } = normalizeAdminProductPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    await ensureDefaultShopStores(prisma);
    if (data.categoryId) {
      const category = await prisma.shopCategory.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: 'Selected category not found' }, { status: 400 });
      }
    }
    if (data.slug) {
      const existing = await prisma.shopProduct.findFirst({
        where: { slug: data.slug, storeKey: data.storeKey, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Another product with this slug exists' }, { status: 409 });
      }
    }
    const product = await prisma.shopProduct.update({
      where: { id },
      data: buildAdminProductUpdateData(data),
      include: adminProductInclude,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'product.update',
      entityType: 'shop.product',
      entityId: product.id,
      metadata: {
        slug: product.slug,
        status: product.status,
      },
    });
    return NextResponse.json(serializeAdminProduct(product));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop product update', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const { id } = await params;
    const deleted = await prisma.shopProduct.delete({
      where: { id },
      select: { id: true, slug: true },
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'product.delete',
      entityType: 'shop.product',
      entityId: deleted.id,
      metadata: {
        slug: deleted.slug,
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
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
