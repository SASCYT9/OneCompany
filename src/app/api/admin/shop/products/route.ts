import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminProductInclude,
  adminProductListSelect,
  buildAdminProductCreateData,
  normalizeAdminProductPayload,
  serializeAdminProductListItem,
} from '@/lib/shopAdminCatalog';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const products = await prisma.shopProduct.findMany({
      orderBy: { updatedAt: 'desc' },
      select: adminProductListSelect,
    });
    return NextResponse.json(products.map(serializeAdminProductListItem));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop products list', error);
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const body = await request.json();
    const { data, errors } = normalizeAdminProductPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    if (data.categoryId) {
      const category = await prisma.shopCategory.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: 'Selected category not found' }, { status: 400 });
      }
    }
    const existing = await prisma.shopProduct.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json({ error: 'Product with this slug already exists' }, { status: 409 });
    }
    const product = await prisma.shopProduct.create({
      data: buildAdminProductCreateData(data),
      include: adminProductInclude,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'product.create',
      entityType: 'shop.product',
      entityId: product.id,
      metadata: {
        slug: product.slug,
        status: product.status,
      },
    });
    return NextResponse.json(serializeAdminProductListItem(product));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop product create', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
