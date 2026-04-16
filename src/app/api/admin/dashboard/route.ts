import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    // Assuming anyone with admin access can see the dashboard overview for now.
    assertAdminRequest(cookieStore);

    // 1. Total Revenue (sum of all orders that are not canceled)
    // Note: We sum amountPaid instead of total to get actual cash physically received.
    const revenueAgg = await prisma.shopOrder.aggregate({
      _sum: { amountPaid: true },
      where: {
        status: { notIn: ['CANCELLED'] }
      }
    });
    const totalRevenue = revenueAgg._sum?.amountPaid || 0;

    // 2. Active Orders
    const activeOrders = await prisma.shopOrder.count({
      where: {
        status: { notIn: ['CANCELLED', 'DELIVERED', 'REFUNDED'] }
      }
    });

    // 3. Unpaid B2B Debt - Removed as balance field is deleted.
    const totalDebt = 0;

    // 4. Recent Orders
    const recentOrders = await prisma.shopOrder.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
      }
    });

    // 5. Total Customers
    const totalCustomers = await prisma.shopCustomer.count();

    // 6. Turn14 Stats
    const turn14Brands = await prisma.turn14BrandMarkup.findMany({
      select: {
        syncStatus: true,
        updatedAt: true,
        brandName: true
      }
    });

    const turn14Stats = {
      total: turn14Brands.length,
      syncing: turn14Brands.filter(b => b.syncStatus === 'syncing').length,
      idle: turn14Brands.filter(b => b.syncStatus === 'idle').length,
      latestSync: turn14Brands.length > 0 ? new Date(Math.max(...turn14Brands.map(b => b.updatedAt.getTime()))).toISOString() : null
    };

    return NextResponse.json({
      totalRevenue,
      activeOrders,
      totalDebt,
      totalCustomers,
      turn14Stats,
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        displayId: o.orderNumber,
        total: o.total,
        currency: o.currency,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        customerName: o.customer?.firstName ? `${o.customer.firstName} ${o.customer.lastName || ''}`.trim() : 'Гість'
      }))
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
