import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

const TAKE_PER_GROUP = 6;

function toNumber(value: unknown) {
  if (value == null) return 0;
  return Number(value);
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const query = request.nextUrl.searchParams.get('q')?.trim() || '';
    if (query.length < 2) {
      return NextResponse.json({
        query,
        total: 0,
        results: { orders: [], products: [], customers: [], turn14: [] },
      });
    }

    const [orders, products, customers, turn14] = await Promise.all([
      prisma.shopOrder.findMany({
        where: {
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: TAKE_PER_GROUP,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          email: true,
          status: true,
          paymentStatus: true,
          total: true,
          amountPaid: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.shopProduct.findMany({
        where: {
          OR: [
            { sku: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
            { vendor: { contains: query, mode: 'insensitive' } },
            { titleUa: { contains: query, mode: 'insensitive' } },
            { titleEn: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: TAKE_PER_GROUP,
        select: {
          id: true,
          slug: true,
          sku: true,
          brand: true,
          titleUa: true,
          titleEn: true,
          status: true,
          isPublished: true,
          stock: true,
        },
      }),
      prisma.shopCustomer.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { companyName: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: TAKE_PER_GROUP,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          group: true,
          isActive: true,
        },
      }),
      prisma.turn14CatalogItem.findMany({
        where: {
          OR: [
            { partNumber: { contains: query, mode: 'insensitive' } },
            { mfrPartNumber: { contains: query, mode: 'insensitive' } },
            { productName: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: TAKE_PER_GROUP,
        select: {
          id: true,
          partNumber: true,
          mfrPartNumber: true,
          productName: true,
          brand: true,
          dealerPrice: true,
          retailPrice: true,
          weight: true,
        },
      }),
    ]);

    return NextResponse.json({
      query,
      total: orders.length + products.length + customers.length + turn14.length,
      results: {
        orders: orders.map((order) => ({
          ...order,
          total: toNumber(order.total),
          amountPaid: toNumber(order.amountPaid),
          outstandingAmount: Math.max(0, toNumber(order.total) - toNumber(order.amountPaid)),
          createdAt: order.createdAt.toISOString(),
        })),
        products,
        customers,
        turn14,
      },
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin global search failed', error);
    return NextResponse.json({ error: 'Failed to search admin data' }, { status: 500 });
  }
}
