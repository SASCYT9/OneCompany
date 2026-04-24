import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { getCatalogQualityReport } from '@/lib/admin/catalogQuality';
import { getDashboardDataQuality } from '@/lib/dashboard/dataQuality';
import { OrderStatus } from '@prisma/client';

type RevenuePeriod = 'monthly' | 'weekly' | 'daily';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as RevenuePeriod) || 'monthly';

    const [shop, crm, system] = await Promise.all([
      getShopMetrics(period),
      getCrmMetrics(period),
      getSystemMetrics(),
    ]);

    return NextResponse.json({ shop, crm, system, period });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// ═══════════════════════════════
// SHOP METRICS (EUR)
// ═══════════════════════════════

async function getShopMetrics(period: RevenuePeriod) {
  const nonCancelledFilter = { status: { notIn: [OrderStatus.CANCELLED] } };

  const [
    revenueAgg,
    totalOrders,
    activeOrders,
    totalCustomers,
    statusCounts,
    paymentMethodCounts,
    recentOrders,
    topProducts,
    lowStockItems,
  ] = await Promise.all([
    // Total revenue (amountPaid = actual cash received)
    prisma.shopOrder.aggregate({
      _sum: { amountPaid: true, total: true },
      _count: true,
      where: nonCancelledFilter,
    }),

    // Total order count (non-cancelled)
    prisma.shopOrder.count({ where: nonCancelledFilter }),

    // Active orders
    prisma.shopOrder.count({
      where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.REFUNDED] } },
    }),

    // Total customers
    prisma.shopCustomer.count(),

    // Conversion funnel — orders by status
    prisma.shopOrder.groupBy({
      by: ['status'],
      _count: true,
    }),

    // Payment method distribution
    prisma.shopOrder.groupBy({
      by: ['paymentMethod'],
      _count: true,
      _sum: { amountPaid: true },
      where: nonCancelledFilter,
    }),

    // Recent orders (with customer attribution fix)
    prisma.shopOrder.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    }),

    // Top products by revenue
    prisma.shopOrderItem.groupBy({
      by: ['title'],
      _sum: { total: true, quantity: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    }),

    // Low stock items
    prisma.shopProductVariant.findMany({
      where: {
        inventoryTracker: { not: null },
        inventoryQty: { lt: 5 },
      },
      take: 10,
      orderBy: { inventoryQty: 'asc' },
      include: { product: { select: { titleUa: true, titleEn: true, brand: true } } },
    }),
  ]);

  // Revenue trend (period-based)
  const periodStart = new Date();
  if (period === 'daily') periodStart.setDate(periodStart.getDate() - 30);
  else if (period === 'weekly') periodStart.setDate(periodStart.getDate() - 90);
  else periodStart.setMonth(periodStart.getMonth() - 12);

  const periodOrders = await prisma.shopOrder.findMany({
    where: {
      createdAt: { gte: periodStart },
      status: { notIn: [OrderStatus.CANCELLED] },
    },
    select: { createdAt: true, total: true, amountPaid: true },
    orderBy: { createdAt: 'asc' },
  });

  const monthlyRevenue: Record<string, { revenue: number; paid: number; orders: number }> = {};
  for (const o of periodOrders) {
    const key = getDateKey(o.createdAt, period);
    if (!monthlyRevenue[key]) monthlyRevenue[key] = { revenue: 0, paid: 0, orders: 0 };
    monthlyRevenue[key].revenue += Number(o.total);
    monthlyRevenue[key].paid += o.amountPaid;
    monthlyRevenue[key].orders++;
  }

  const totalRevenue = revenueAgg._sum?.amountPaid || 0;
  const totalInvoiced = Number(revenueAgg._sum?.total || 0);
  const orderCount = typeof revenueAgg._count === 'number' ? revenueAgg._count : 0;
  const aov = orderCount > 0 ? Math.round((totalInvoiced / orderCount) * 100) / 100 : 0;

  return {
    totalRevenue,
    totalInvoiced,
    activeOrders,
    totalCustomers,
    aov,
    totalOrders,

    conversionFunnel: statusCounts.map(s => ({
      status: s.status,
      count: s._count,
    })),

    monthlyRevenue: Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data })),

    paymentMethods: paymentMethodCounts.map(p => ({
      method: p.paymentMethod,
      count: p._count,
      revenue: p._sum?.amountPaid || 0,
    })),

    recentOrders: recentOrders.map(o => ({
      id: o.id,
      displayId: o.orderNumber,
      total: Number(o.total),
      currency: o.currency,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      amountPaid: o.amountPaid,
      // Customer attribution: always show a name, fallback to email
      customerName: resolveCustomerName(
        o.customer?.firstName,
        o.customer?.lastName,
        o.customerName,
        o.email
      ),
    })),

    topProducts: topProducts.map(p => ({
      title: p.title,
      revenue: Number(p._sum.total || 0),
      quantity: Number(p._sum.quantity || 0),
      orderCount: p._count,
    })),

    lowStockItems: lowStockItems.map(item => ({
      id: item.id,
      sku: item.sku || '',
      title: item.product?.titleUa || item.title || '',
      brand: item.product?.brand || 'Інше',
      stock: item.inventoryQty,
    })),
  };
}

// ═══════════════════════════════
// CRM METRICS (USD)
// ═══════════════════════════════

async function getCrmMetrics(period: RevenuePeriod) {
  const [
    orderAgg,
    totalCustomers,
    totalOrders,
    activeOrders,
    recentOrders,
    topCustomers,
    debtors,
    brandBreakdown,
    statusCounts,
  ] = await Promise.all([
    // Aggregated KPIs
    prisma.crmOrder.aggregate({
      _sum: { clientTotal: true, profit: true, purchaseCost: true },
    }),

    prisma.crmCustomer.count(),
    prisma.crmOrder.count(),

    // Active (not completed/cancelled)
    prisma.crmOrder.count({
      where: { orderStatus: { notIn: ['Выполнен', 'Отменен'] } },
    }),

    // Recent orders with customer
    prisma.crmOrder.findMany({
      orderBy: { orderDate: 'desc' },
      take: 8,
      include: { customer: { select: { name: true, email: true } } },
    }),

    // Top customers by sales
    prisma.crmCustomer.findMany({
      orderBy: { totalSales: 'desc' },
      take: 8,
      include: { orders: { select: { id: true } } },
    }),

    // Debtors
    prisma.crmCustomer.findMany({
      where: { balance: { lt: 0 } },
      orderBy: { balance: 'asc' },
      take: 10,
    }),

    // Brand breakdown — fetch raw items (brand field has Airtable IDs, so we extract from productName)
    prisma.crmOrderItem.findMany({
      where: { clientTotal: { gt: 0 } },
      select: { productName: true, brand: true, clientTotal: true, profitPerItem: true },
    }),

    // Status distribution
    prisma.crmOrder.groupBy({ by: ['orderStatus'], _count: true }),
  ]);

  // CRM Revenue trend (period-based)
  const crmPeriodStart = new Date();
  if (period === 'daily') crmPeriodStart.setDate(crmPeriodStart.getDate() - 30);
  else if (period === 'weekly') crmPeriodStart.setDate(crmPeriodStart.getDate() - 90);
  else crmPeriodStart.setMonth(crmPeriodStart.getMonth() - 12);

  const crmPeriodOrders = await prisma.crmOrder.findMany({
    where: { orderDate: { not: null, gte: crmPeriodStart } },
    select: { orderDate: true, clientTotal: true, profit: true },
    orderBy: { orderDate: 'asc' },
  });

  const monthlyRevenue: Record<string, { revenue: number; profit: number; orders: number }> = {};
  for (const o of crmPeriodOrders) {
    if (!o.orderDate) continue;
    const key = getDateKey(o.orderDate, period);
    if (!monthlyRevenue[key]) monthlyRevenue[key] = { revenue: 0, profit: 0, orders: 0 };
    monthlyRevenue[key].revenue += o.clientTotal;
    monthlyRevenue[key].profit += o.profit;
    monthlyRevenue[key].orders++;
  }

  const sums = orderAgg._sum;
  const totalRevenue = sums?.clientTotal || 0;
  const totalProfit = sums?.profit || 0;
  const totalDebt = debtors.reduce((s, d) => s + Math.abs(d.balance), 0);

  return {
    totalRevenue,
    totalProfit,
    totalCost: sums?.purchaseCost || 0,
    avgMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
    totalCustomers,
    totalOrders,
    activeOrders,
    totalDebt,

    statusDistribution: statusCounts.map(s => ({
      status: s.orderStatus,
      count: s._count,
    })),

    monthlyRevenue: Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data })),

    brandBreakdown: aggregateBrandBreakdown(brandBreakdown as any[]),

    recentOrders: recentOrders.map(o => ({
      id: o.id,
      number: o.number,
      name: o.name,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      clientTotal: o.clientTotal,
      profit: o.profit,
      orderDate: o.orderDate,
      customerName: o.customer?.name || o.name || '—',
    })),

    topCustomers: topCustomers.map(c => ({
      id: c.id,
      name: c.name,
      totalSales: c.totalSales,
      totalProfit: c.totalProfit,
      balance: c.balance,
      orderCount: c.orders.length,
      tags: c.tags,
    })),

    debtors: debtors.map(d => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      totalSales: d.totalSales,
    })),
  };
}

// ═══════════════════════════════
// SYSTEM METRICS
// ═══════════════════════════════

async function getSystemMetrics() {
  const [turn14Brands, lastSync, dataQuality, catalogQuality, failedImports, pendingB2B, highValueUnpaid] = await Promise.all([
    prisma.turn14BrandMarkup.findMany({
      select: { syncStatus: true, updatedAt: true, brandName: true },
    }),
    prisma.crmOrder.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    }),
    getDashboardDataQuality(),
    getCatalogQualityReport(prisma),
    prisma.shopImportJob.count({
      where: { status: 'FAILED' },
    }),
    prisma.shopCustomer.count({
      where: { group: 'B2B_PENDING', isActive: true },
    }),
    prisma.shopOrder.count({
      where: {
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        paymentStatus: { not: 'PAID' },
        total: { gte: 1000 },
      },
    }),
  ]);

  const operationalRisks = [
    {
      id: 'unpaid-high-value',
      label: 'Unpaid high-value orders',
      count: highValueUnpaid,
      severity: highValueUnpaid > 0 ? 'danger' : 'success',
      href: '/admin/shop/orders',
      description: 'Orders above 1,000 with outstanding payment.',
    },
    {
      id: 'catalog-no-image',
      label: 'Products without image',
      count: catalogQuality.issueCounts.NO_IMAGE,
      severity: catalogQuality.issueCounts.NO_IMAGE > 0 ? 'warning' : 'success',
      href: '/admin/shop/quality',
      description: 'Catalog entries that weaken storefront trust and distributor feeds.',
    },
    {
      id: 'catalog-bad-seo',
      label: 'Bad SEO fields',
      count: catalogQuality.issueCounts.BAD_SEO,
      severity: catalogQuality.issueCounts.BAD_SEO > 0 ? 'warning' : 'success',
      href: '/admin/shop/quality',
      description: 'UA/EN SEO titles or descriptions need cleanup.',
    },
    {
      id: 'failed-imports',
      label: 'Failed imports',
      count: failedImports,
      severity: failedImports > 0 ? 'danger' : 'success',
      href: '/admin/shop/import',
      description: 'Import jobs that require review before the next catalog update.',
    },
    {
      id: 'b2b-pending',
      label: 'B2B approvals pending',
      count: pendingB2B,
      severity: pendingB2B > 0 ? 'warning' : 'success',
      href: '/admin/shop/customers',
      description: 'B2B accounts waiting for approval or rejection.',
    },
  ];

  return {
    turn14Stats: {
      total: turn14Brands.length,
      syncing: turn14Brands.filter(b => b.syncStatus === 'syncing').length,
      idle: turn14Brands.filter(b => b.syncStatus === 'idle').length,
      latestSync: turn14Brands.length > 0
        ? new Date(Math.max(...turn14Brands.map(b => b.updatedAt.getTime()))).toISOString()
        : null,
    },
    lastCrmSyncAt: lastSync?.syncedAt?.toISOString() || null,
    dataQuality,
    catalogQuality: {
      score: catalogQuality.score,
      totalProducts: catalogQuality.totalProducts,
      issueProducts: catalogQuality.issueProducts,
      issueCounts: catalogQuality.issueCounts,
    },
    operationalRisks,
  };
}

// ═══════════════════════════════
// HELPERS
// ═══════════════════════════════

/** Known brand keywords for extraction from product names */
const KNOWN_BRANDS = [
  'Akrapovic', 'Brabus', 'Mansory', 'Startech', 'Urban Automotive',
  'Vorsteiner', 'Novitec', 'Lumma', 'Hamann', 'Keyvany', 'Renntech',
  'DMC', 'Topcar', 'Kelleners', 'AC Schnitzer', 'RevoZport', 'Prior Design',
  'Capristo', 'iPE', 'Eventuri', 'Wagner Tuning', 'Milltek', 'Remus',
  'Borla', 'MagnaFlow', 'HRE', 'Vossen', 'Forgiato', 'ADV.1', 'BBS',
  'OZ Racing', 'Rotiform', 'Brixton', 'Anrky', 'TWL Carbon',
  '3DDesign', 'RKP', 'Sterckenn', 'IND', 'Dinan', 'Eisenmann',
  'Öhlins', 'KW', 'H&R', 'Eibach', 'Bilstein', 'ST Suspensions',
  'Brembo', 'AP Racing', 'DO88', 'CSF', 'XPEL', 'WeatherTech',
  'Lorinser', 'Carlsson', 'TechArt', 'SpeedArt', 'Caractere', 'ABT',
  'MTR Design', 'Larte Design', 'Wald', 'Liberty Walk', 'RDB LA',
  'Dawson', 'Forge Motorsport', 'GruppeM', 'Armytrix', 'FI Exhaust',
  'Valvetronic', 'Frequency Intelligence',
];

/** Extract brand name from productName using known brands list */
function extractBrandFromProduct(productName: string): string {
  const pLower = productName.toLowerCase();
  // Try to match known brands (longest first for multi-word brands)
  const sorted = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    if (pLower.includes(brand.toLowerCase())) return brand;
  }
  // Fallback: first word of product name (often is the brand)
  const firstWord = productName.split(/[\s\-–—_/|,\(]/)[0].trim();
  if (firstWord && firstWord.length > 2 && !/^rec[a-zA-Z0-9]{10,}/.test(firstWord)) {
    return firstWord;
  }
  return 'Інше';
}

/** Aggregate CrmOrderItems into brand breakdown by extracting brand from productName */
function aggregateBrandBreakdown(items: { productName: string; brand: string; clientTotal: number; profitPerItem: number }[]): { brand: string; revenue: number; profit: number; count: number }[] {
  const map = new Map<string, { revenue: number; profit: number; count: number }>();
  
  for (const item of items) {
    const brandName = extractBrandFromProduct(item.productName);
    const existing = map.get(brandName) || { revenue: 0, profit: 0, count: 0 };
    existing.revenue += item.clientTotal;
    existing.profit += item.profitPerItem;
    existing.count++;
    map.set(brandName, existing);
  }
  
  return Array.from(map.entries())
    .map(([brand, data]) => ({ brand, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
}

/** Get date key for period-based aggregation */
function getDateKey(date: Date, period: RevenuePeriod): string {
  if (period === 'daily') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (period === 'weekly') {
    // ISO week: Monday-based
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Move to Monday
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // monthly
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function resolveCustomerName(
  firstName?: string | null,
  lastName?: string | null,
  orderCustomerName?: string,
  email?: string
): string {
  if (firstName) {
    return `${firstName} ${lastName || ''}`.trim();
  }
  if (orderCustomerName && orderCustomerName !== 'Гість' && orderCustomerName.trim()) {
    return orderCustomerName;
  }
  if (email) {
    return email.split('@')[0];
  }
  return 'Гість';
}
