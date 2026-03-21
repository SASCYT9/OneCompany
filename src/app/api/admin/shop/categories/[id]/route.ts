import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminCategoryInclude,
  buildAdminCategoryUpdateData,
  normalizeAdminCategoryPayload,
  serializeAdminCategory,
} from '@/lib/shopAdminCategories';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ);
    const { id } = await params;
    const category = await prisma.shopCategory.findUnique({
      where: { id },
      include: adminCategoryInclude,
    });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json(serializeAdminCategory(category));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop category get', error);
    return NextResponse.json({ error: 'Failed to get category' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE);
    const { id } = await params;
    const body = await request.json();
    const { data, errors } = normalizeAdminCategoryPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    if (data.parentId === id) {
      return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 });
    }
    const existing = await prisma.shopCategory.findFirst({
      where: { slug: data.slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Another category with this slug exists' }, { status: 409 });
    }
    if (data.parentId) {
      const parent = await prisma.shopCategory.findUnique({ where: { id: data.parentId }, select: { id: true } });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }
    }
    const category = await prisma.shopCategory.update({
      where: { id },
      data: buildAdminCategoryUpdateData(data),
      include: adminCategoryInclude,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'category.update',
      entityType: 'shop.category',
      entityId: category.id,
      metadata: {
        slug: category.slug,
      },
    });
    return NextResponse.json(serializeAdminCategory(category));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop category update', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE);
    const { id } = await params;
    const linked = await prisma.shopCategory.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
    if (!linked) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    if (linked._count.products > 0 || linked._count.children > 0) {
      return NextResponse.json(
        {
          error: 'Category has linked products or child categories and cannot be deleted',
          productsCount: linked._count.products,
          childrenCount: linked._count.children,
        },
        { status: 409 }
      );
    }
    await prisma.shopCategory.delete({
      where: { id },
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'category.delete',
      entityType: 'shop.category',
      entityId: linked.id,
      metadata: {
        slug: linked.slug,
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
    console.error('Admin shop category delete', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
