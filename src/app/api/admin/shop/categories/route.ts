import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  adminCategoryInclude,
  adminCategoryListSelect,
  buildAdminCategoryCreateData,
  normalizeAdminCategoryPayload,
  serializeAdminCategoryListItem,
} from '@/lib/shopAdminCategories';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ);
    await ensureDefaultShopStores(prisma);
    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));
    const categories = await prisma.shopCategory.findMany({
      where: { storeKey },
      orderBy: [{ sortOrder: 'asc' }, { titleEn: 'asc' }],
      select: adminCategoryListSelect,
    });
    return NextResponse.json(categories.map(serializeAdminCategoryListItem));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop categories list', error);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE);
    await ensureDefaultShopStores(prisma);
    const body = await request.json();
    const { data, errors } = normalizeAdminCategoryPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    const existing = await prisma.shopCategory.findFirst({
      where: { storeKey: data.storeKey, slug: data.slug },
    });
    if (existing) {
      return NextResponse.json({ error: 'Category with this slug already exists' }, { status: 409 });
    }
    if (data.parentId) {
      const parent = await prisma.shopCategory.findUnique({
        where: { id: data.parentId },
        select: { id: true, storeKey: true },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }
      if (parent.storeKey !== data.storeKey) {
        return NextResponse.json({ error: 'Parent category must belong to the same store' }, { status: 400 });
      }
    }
    const category = await prisma.shopCategory.create({
      data: buildAdminCategoryCreateData(data),
      include: adminCategoryInclude,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'category.create',
      entityType: 'shop.category',
      entityId: category.id,
      metadata: {
        storeKey: category.storeKey,
        slug: category.slug,
      },
    });
    return NextResponse.json(serializeAdminCategoryListItem(category));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop category create', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
