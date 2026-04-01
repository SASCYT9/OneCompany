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

import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const brand = searchParams.get('brand')?.trim() || 'ALL';
    const status = searchParams.get('status')?.trim() || 'ALL';

    const where: Prisma.ShopProductWhereInput = {};

    if (brand !== 'ALL') {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (status !== 'ALL') {
      // @ts-expect-error type checking against the Prisma schema status
      where.status = status;
    }

    if (search) {
      where.OR = [
        { slug: { contains: search, mode: 'insensitive' } },
        { titleEn: { contains: search, mode: 'insensitive' } },
        { titleUa: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [totalCount, products] = await prisma.$transaction([
      prisma.shopProduct.count({ where }),
      prisma.shopProduct.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: adminProductListSelect,
      }),
    ]);

    return NextResponse.json({
      products: products.map(serializeAdminProductListItem),
      metadata: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
    });
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
