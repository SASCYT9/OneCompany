import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/crm/analytics
 * Rich analytics from local CRM data
 * 
 * Query params:
 * - type: 'dashboard' | 'monthly' | 'top-customers' | 'top-products'
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'dashboard';

  try {
    if (type === 'dashboard') {
      return NextResponse.json(await getDashboardData());
    }
    if (type === 'monthly') {
      return NextResponse.json(await getMonthlyData());
    }
    if (type === 'top-customers') {
      return NextResponse.json(await getTopCustomers());
    }
    if (type === 'top-products') {
      return NextResponse.json(await getTopProducts());
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getDashboardData() {
  const [
    totalCustomers,
    totalOrders,
    totalItems,
    orderAggregates,
    statusCounts,
    paymentStatusCounts,
    lastSync,
    recentOrders,
    debtors,
  ] = await Promise.all([
    prisma.crmCustomer.count(),
    prisma.crmOrder.count(),
    prisma.crmOrderItem.count(),
    prisma.crmOrder.aggregate({
      _sum: { clientTotal: true, profit: true, purchaseCost: true, fullCost: true, additionalCosts: true },
      _avg: { marginality: true },
    }),
    prisma.crmOrder.groupBy({ by: ['orderStatus'], _count: true }),
    prisma.crmOrder.groupBy({ by: ['paymentStatus'], _count: true }),
    prisma.crmOrder.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    prisma.crmOrder.findMany({
      orderBy: { orderDate: 'desc' },
      take: 10,
      include: { customer: { select: { name: true } } },
    }),
    prisma.crmCustomer.findMany({
      where: { balance: { lt: 0 } },
      orderBy: { balance: 'asc' },
      take: 10,
    }),
  ]);

  const sums = orderAggregates._sum;

  return {
    kpis: {
      totalCustomers,
      totalOrders,
      totalItems,
      totalRevenue: sums.clientTotal || 0,
      totalProfit: sums.profit || 0,
      totalCost: sums.purchaseCost || 0,
      totalFullCost: sums.fullCost || 0,
      totalAdditionalCosts: sums.additionalCosts || 0,
      avgMargin: Math.round((orderAggregates._avg.marginality || 0) * 1000) / 10,
    },
    statusDistribution: statusCounts.map(s => ({ status: s.orderStatus, count: s._count })),
    paymentDistribution: paymentStatusCounts.map(s => ({ status: s.paymentStatus, count: s._count })),
    lastSyncAt: lastSync?.syncedAt || null,
    recentOrders: recentOrders.map(o => ({
      id: o.id,
      airtableId: o.airtableId,
      number: o.number,
      name: o.name,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      clientTotal: o.clientTotal,
      profit: o.profit,
      orderDate: o.orderDate,
      customerName: o.customer?.name || null,
    })),
    debtors: debtors.map(d => ({
      id: d.id,
      airtableId: d.airtableId,
      name: d.name,
      balance: d.balance,
      totalSales: d.totalSales,
    })),
  };
}

async function getMonthlyData() {
  // Get all orders with dates, group by month
  const orders = await prisma.crmOrder.findMany({
    where: { orderDate: { not: null } },
    select: { orderDate: true, clientTotal: true, profit: true, purchaseCost: true },
    orderBy: { orderDate: 'asc' },
  });

  const monthly: Record<string, { revenue: number; profit: number; cost: number; count: number }> = {};

  for (const o of orders) {
    if (!o.orderDate) continue;
    const key = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { revenue: 0, profit: 0, cost: 0, count: 0 };
    monthly[key].revenue += o.clientTotal;
    monthly[key].profit += o.profit;
    monthly[key].cost += o.purchaseCost;
    monthly[key].count++;
  }

  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));
}

async function getTopCustomers() {
  const customers = await prisma.crmCustomer.findMany({
    orderBy: { totalSales: 'desc' },
    take: 15,
    include: { orders: { select: { id: true } } },
  });

  return customers.map(c => ({
    id: c.id,
    airtableId: c.airtableId,
    name: c.name,
    totalSales: c.totalSales,
    totalProfit: c.totalProfit,
    balance: c.balance,
    orderCount: c.orders.length,
    tags: c.tags,
  }));
}

async function getTopProducts() {
  // Aggregate order items by productName
  const items = await prisma.crmOrderItem.groupBy({
    by: ['productName'],
    _sum: { quantity: true, clientTotal: true, profitPerItem: true, purchaseTotal: true },
    _count: true,
    orderBy: { _sum: { clientTotal: 'desc' } },
    take: 20,
  });

  return items.map(i => ({
    productName: i.productName,
    totalQuantity: i._sum.quantity || 0,
    totalRevenue: i._sum.clientTotal || 0,
    totalProfit: i._sum.profitPerItem || 0,
    totalCost: i._sum.purchaseTotal || 0,
    orderCount: i._count,
  }));
}

export const runtime = 'nodejs';
