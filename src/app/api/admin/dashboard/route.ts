import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { getCatalogQualityReport } from '@/lib/admin/catalogQuality';
import { getDashboardDataQuality } from '@/lib/dashboard/dataQuality';
import { getGa4Metrics } from '@/lib/dashboard/ga4';
import { OrderStatus } from '@prisma/client';

type RevenuePeriod = 'monthly' | 'weekly' | 'daily';

const PERIOD_TO_DAYS: Record<RevenuePeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as RevenuePeriod) || 'monthly';

    const [shop, crm, system, analytics] = await Promise.all([
      getShopMetrics(period),
      getCrmMetrics(period),
      getSystemMetrics(),
      getGa4Metrics(PERIOD_TO_DAYS[period]),
    ]);

    return NextResponse.json({ shop, crm, system, analytics, period });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// ═══════════════════════════════
// SHOP METRICS (UAH)
// ═══════════════════════════════

async function getShopMetrics(period: RevenuePeriod) {
  const nonCancelledFilter = { status: { notIn: [OrderStatus.CANCELLED] } };
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    revenueAgg,
    totalOrders,
    activeOrders,
    totalCustomers,
    statusCounts,
    statusValueSums,
    statusOldest,
    recentOrders,
    lowStockItems,
    unpaidOrders,
    stuckPendingPayment,
    topShopBrands,
    topShopProducts,
    ordersForRegions,
    customerGroupCounts,
  ] = await Promise.all([
    prisma.shopOrder.aggregate({
      _sum: { amountPaid: true, total: true },
      _count: true,
      where: nonCancelledFilter,
    }),
    prisma.shopOrder.count({ where: nonCancelledFilter }),
    prisma.shopOrder.count({
      where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.REFUNDED] } },
    }),
    prisma.shopCustomer.count(),

    // Pipeline stage counts
    prisma.shopOrder.groupBy({ by: ['status'], _count: true }),

    // Pipeline stage value sums (uses total since amountPaid not relevant for unpaid stages)
    prisma.shopOrder.groupBy({ by: ['status'], _sum: { total: true } }),

    // Oldest order per status — for stuck-detection
    prisma.shopOrder.groupBy({ by: ['status'], _min: { createdAt: true } }),

    prisma.shopOrder.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        items: {
          take: 1,
          include: {
            product: { select: { brand: true } },
          },
        },
      },
    }),

    prisma.shopProductVariant.findMany({
      where: {
        inventoryTracker: { not: null },
        inventoryQty: { lt: 5 },
      },
      take: 10,
      orderBy: { inventoryQty: 'asc' },
      include: { product: { select: { titleUa: true, titleEn: true, brand: true } } },
    }),

    // Unpaid orders — total value and oldest
    prisma.shopOrder.findMany({
      where: {
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        paymentStatus: { not: 'PAID' },
      },
      select: { id: true, total: true, amountPaid: true, createdAt: true, orderNumber: true },
      orderBy: { createdAt: 'asc' },
    }),

    // Stuck PENDING_PAYMENT >7 days
    prisma.shopOrder.count({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { lt: sevenDaysAgo },
      },
    }),

    // Top brands by product count (real catalog data)
    prisma.shopProduct.groupBy({
      by: ['brand'],
      where: { brand: { not: null }, isPublished: true },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),

    // Top published products with images (real catalog)
    prisma.shopProduct.findMany({
      where: { isPublished: true, image: { not: null } },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleUa: true,
        brand: true,
        image: true,
        priceEur: true,
        priceUsd: true,
        priceUah: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),

    // Orders with shipping addresses for regional aggregation
    prisma.shopOrder.findMany({
      where: nonCancelledFilter,
      select: { shippingAddress: true, amountPaid: true, total: true },
    }),

    // B2C / B2B split (lifetime — cheap aggregation)
    prisma.shopOrder.groupBy({
      by: ['customerGroupSnapshot'],
      _count: true,
      where: nonCancelledFilter,
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

  // Build pipeline stages — merge count/sum/oldest by status
  const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count]));
  const sumByStatus = new Map(statusValueSums.map((s) => [s.status, Number(s._sum.total || 0)]));
  const oldestByStatus = new Map(statusOldest.map((s) => [s.status, s._min.createdAt]));
  const now = Date.now();
  const ageDays = (d: Date | null | undefined) =>
    d ? Math.floor((now - new Date(d).getTime()) / (24 * 60 * 60 * 1000)) : null;

  const PIPELINE_STAGES: OrderStatus[] = [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PENDING_REVIEW,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ];

  const pendingByStage = PIPELINE_STAGES.map((status) => ({
    status,
    count: countByStatus.get(status) || 0,
    valueSum: sumByStatus.get(status) || 0,
    oldestAgeDays: ageDays(oldestByStatus.get(status)),
  }));

  // Unpaid totals
  const unpaidTotal = unpaidOrders.reduce(
    (sum, o) => sum + (Number(o.total) - o.amountPaid),
    0
  );
  const unpaidCount = unpaidOrders.length;
  const oldestUnpaid = unpaidOrders[0]
    ? {
        id: unpaidOrders[0].id,
        orderNumber: unpaidOrders[0].orderNumber,
        ageDays: ageDays(unpaidOrders[0].createdAt) ?? 0,
      }
    : null;

  // Period-aware totals: last vs prev bucket
  const sortedBuckets = Object.entries(monthlyRevenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const lastBucket = sortedBuckets[sortedBuckets.length - 1];
  const prevBucket = sortedBuckets[sortedBuckets.length - 2];
  const totalRevenuePeriod = lastBucket?.paid || 0;
  const totalRevenuePrevPeriod = prevBucket?.paid || 0;
  const ordersCountPeriod = lastBucket?.orders || 0;
  const ordersCountPrevPeriod = prevBucket?.orders || 0;

  // Cancellation rate within period window (from periodOrders + cancelled orders in same window)
  const cancelledInPeriod = await prisma.shopOrder.count({
    where: {
      createdAt: { gte: periodStart },
      status: { in: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    },
  });
  const totalInPeriod = periodOrders.length + cancelledInPeriod;
  const cancellationRate = totalInPeriod > 0 ? Math.round((cancelledInPeriod / totalInPeriod) * 1000) / 10 : 0;

  // Real Sales by Region — aggregate from shippingAddress.country
  const regionTotals: Record<string, { revenue: number; count: number }> = {
    Europe: { revenue: 0, count: 0 },
    'North America': { revenue: 0, count: 0 },
    'Middle East': { revenue: 0, count: 0 },
    'Asia Pacific': { revenue: 0, count: 0 },
    'South America': { revenue: 0, count: 0 },
    Other: { revenue: 0, count: 0 },
  };
  let unknownCountryCount = 0;
  for (const o of ordersForRegions) {
    const addr = (o.shippingAddress ?? {}) as { country?: string };
    const country = (addr.country ?? '').trim();
    const region = countryToRegion(country);
    if (region === null) {
      unknownCountryCount++;
      continue;
    }
    regionTotals[region].revenue += Number(o.total);
    regionTotals[region].count++;
  }
  const totalRegionRevenue = Object.values(regionTotals).reduce((s, r) => s + r.revenue, 0);
  const salesByRegion = Object.entries(regionTotals)
    .filter(([, r]) => r.revenue > 0 || r.count > 0)
    .map(([name, r]) => ({
      name,
      revenue: r.revenue,
      count: r.count,
      pct: totalRegionRevenue > 0 ? Math.round((r.revenue / totalRegionRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // B2C / B2B split
  const groupCounts = new Map(customerGroupCounts.map((g) => [g.customerGroupSnapshot, g._count]));
  const b2cOrdersCount = (groupCounts.get('B2C') || 0) + (groupCounts.get('B2C_PROMO' as any) || 0);
  const b2bOrdersCount =
    (groupCounts.get('B2B' as any) || 0) +
    (groupCounts.get('B2B_PRO' as any) || 0) +
    (groupCounts.get('B2B_PENDING' as any) || 0);

  return {
    totalRevenue,
    totalInvoiced,
    activeOrders,
    totalCustomers,
    aov,
    totalOrders,

    // Period-aware aggregates
    totalRevenuePeriod,
    totalRevenuePrevPeriod,
    ordersCountPeriod,
    ordersCountPrevPeriod,

    // Pipeline + operational
    pendingByStage,
    unpaidTotal,
    unpaidCount,
    oldestUnpaid,
    stuckPendingPayment,
    cancellationRate,
    b2cOrdersCount,
    b2bOrdersCount,

    conversionFunnel: statusCounts.map((s) => ({
      status: s.status,
      count: s._count,
    })),

    monthlyRevenue: sortedBuckets,

    recentOrders: recentOrders.map((o) => {
      const itemBrand = o.items?.[0]?.product?.brand ?? null;
      return {
        id: o.id,
        displayId: o.orderNumber,
        total: Number(o.total),
        currency: o.currency,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        amountPaid: o.amountPaid,
        customerGroup: o.customerGroupSnapshot,
        itemCount: o.items?.length ?? 1,
        brand: itemBrand,
        brandLogo: itemBrand ? brandLogoPath(itemBrand) : null,
        customerName: resolveCustomerName(
          o.customer?.firstName,
          o.customer?.lastName,
          o.customerName,
          o.email
        ),
      };
    }),

    topProducts: topShopProducts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.titleEn || p.titleUa || 'Untitled',
      brand: p.brand,
      image: p.image,
      priceEur: p.priceEur ? Number(p.priceEur) : null,
      priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      priceUah: p.priceUah ? Number(p.priceUah) : null,
    })),

    topBrands: topShopBrands.map((b) => ({
      brand: b.brand!,
      productCount: b._count,
      logo: brandLogoPath(b.brand!),
    })),

    salesByRegion,
    unknownCountryCount,

    lowStockItems: lowStockItems.map((item) => ({
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
    debtors,
    brandBreakdown,
    statusCounts,
  ] = await Promise.all([
    prisma.crmOrder.aggregate({
      _sum: { clientTotal: true, profit: true, purchaseCost: true },
    }),

    prisma.crmCustomer.count(),
    prisma.crmOrder.count(),

    prisma.crmOrder.count({
      where: { orderStatus: { notIn: ['Выполнен', 'Отменен'] } },
    }),

    prisma.crmOrder.findMany({
      orderBy: { orderDate: 'desc' },
      take: 8,
      include: { customer: { select: { name: true, email: true } } },
    }),

    prisma.crmCustomer.findMany({
      where: { balance: { lt: 0 } },
      orderBy: { balance: 'asc' },
      take: 10,
    }),

    prisma.crmOrderItem.findMany({
      where: { clientTotal: { gt: 0 } },
      select: { productName: true, brand: true, clientTotal: true, profitPerItem: true },
    }),

    prisma.crmOrder.groupBy({ by: ['orderStatus'], _count: true }),
  ]);

  const crmPeriodStart = new Date();
  if (period === 'daily') crmPeriodStart.setDate(crmPeriodStart.getDate() - 30);
  else if (period === 'weekly') crmPeriodStart.setDate(crmPeriodStart.getDate() - 90);
  else crmPeriodStart.setMonth(crmPeriodStart.getMonth() - 12);

  const crmPeriodOrders = await prisma.crmOrder.findMany({
    where: { orderDate: { not: null, gte: crmPeriodStart } },
    select: { orderDate: true, clientTotal: true, profit: true },
    orderBy: { orderDate: 'asc' },
  });

  const monthlyMap: Record<string, { revenue: number; profit: number; orders: number }> = {};
  for (const o of crmPeriodOrders) {
    if (!o.orderDate) continue;
    const key = getDateKey(o.orderDate, period);
    if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, profit: 0, orders: 0 };
    monthlyMap[key].revenue += o.clientTotal;
    monthlyMap[key].profit += o.profit;
    monthlyMap[key].orders++;
  }

  const monthlyRevenue = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  // Margin per period
  const marginByPeriod = monthlyRevenue.map((b) => ({
    month: b.month,
    marginPct: b.revenue > 0 ? Math.round((b.profit / b.revenue) * 1000) / 10 : 0,
  }));

  // Period-aware totals: last vs prev bucket
  const lastBucket = monthlyRevenue[monthlyRevenue.length - 1];
  const prevBucket = monthlyRevenue[monthlyRevenue.length - 2];
  const totalProfitPeriod = lastBucket?.profit || 0;
  const totalProfitPrevPeriod = prevBucket?.profit || 0;
  const totalRevenuePeriod = lastBucket?.revenue || 0;
  const totalRevenuePrevPeriod = prevBucket?.revenue || 0;

  const sums = orderAgg._sum;
  const totalRevenue = sums?.clientTotal || 0;
  const totalProfit = sums?.profit || 0;
  const totalDebt = debtors.reduce((s, d) => s + Math.abs(d.balance), 0);
  const oldestDebtor = debtors[0]
    ? {
        id: debtors[0].id,
        name: debtors[0].name,
        balance: debtors[0].balance,
      }
    : null;

  return {
    totalRevenue,
    totalProfit,
    totalCost: sums?.purchaseCost || 0,
    avgMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
    totalCustomers,
    totalOrders,
    activeOrders,
    totalDebt,
    oldestDebtor,

    // Period-aware
    totalProfitPeriod,
    totalProfitPrevPeriod,
    totalRevenuePeriod,
    totalRevenuePrevPeriod,

    statusDistribution: statusCounts.map((s) => ({
      status: s.orderStatus,
      count: s._count,
    })),

    monthlyRevenue,
    marginByPeriod,

    brandBreakdown: aggregateBrandBreakdown(brandBreakdown as any[]),

    recentOrders: recentOrders.map((o) => ({
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

    debtors: debtors.map((d) => ({
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
  const [turn14Brands, lastSync, dataQuality, catalogQuality, failedImports, pendingB2B, highValueUnpaid, lastImportJob] = await Promise.all([
    prisma.turn14BrandMarkup.findMany({
      select: { syncStatus: true, syncMessage: true, updatedAt: true, brandName: true },
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
    prisma.shopImportJob.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const turn14Errors = turn14Brands.filter(
    (b) => b.syncStatus === 'error' || b.syncStatus === 'failed'
  ).length;
  const turn14Syncing = turn14Brands.filter((b) => b.syncStatus === 'syncing').length;

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

  // Operations health lights — green/amber/red
  const pipelineHealth: 'green' | 'amber' | 'red' =
    highValueUnpaid > 5 ? 'red' : highValueUnpaid > 0 ? 'amber' : 'green';
  const syncHealth: 'green' | 'amber' | 'red' =
    turn14Errors > 0 ? 'red' : turn14Syncing > 0 ? 'amber' : 'green';
  const stockHealth: 'green' | 'amber' | 'red' =
    catalogQuality.issueCounts.ACTIVE_WITHOUT_STOCK > 10
      ? 'red'
      : catalogQuality.issueCounts.ACTIVE_WITHOUT_STOCK > 0
        ? 'amber'
        : 'green';
  const catalogHealth: 'green' | 'amber' | 'red' =
    catalogQuality.score < 75 ? 'red' : catalogQuality.score < 90 ? 'amber' : 'green';
  const dataHealthLight: 'green' | 'amber' | 'red' =
    dataQuality.score < 75 ? 'red' : dataQuality.score < 90 ? 'amber' : 'green';
  const importsHealth: 'green' | 'amber' | 'red' =
    failedImports > 0 ? 'red' : 'green';

  return {
    turn14Stats: {
      total: turn14Brands.length,
      syncing: turn14Syncing,
      idle: turn14Brands.filter((b) => b.syncStatus === 'idle').length,
      errors: turn14Errors,
      latestSync: turn14Brands.length > 0
        ? new Date(Math.max(...turn14Brands.map((b) => b.updatedAt.getTime()))).toISOString()
        : null,
    },
    lastCrmSyncAt: lastSync?.syncedAt?.toISOString() || null,
    lastImportAt: lastImportJob?.createdAt?.toISOString() || null,
    dataQuality,
    catalogQuality: {
      score: catalogQuality.score,
      totalProducts: catalogQuality.totalProducts,
      issueProducts: catalogQuality.issueProducts,
      issueCounts: catalogQuality.issueCounts,
    },
    operationalRisks,
    operations: {
      pipelineHealth,
      syncHealth,
      stockHealth,
      catalogHealth,
      dataHealth: dataHealthLight,
      importsHealth,
    },
  };
}

// ═══════════════════════════════
// HELPERS
// ═══════════════════════════════

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

function extractBrandFromProduct(productName: string): string {
  const pLower = productName.toLowerCase();
  const sorted = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    if (pLower.includes(brand.toLowerCase())) return brand;
  }
  const firstWord = productName.split(/[\s\-–—_/|,\(]/)[0].trim();
  if (firstWord && firstWord.length > 2 && !/^rec[a-zA-Z0-9]{10,}/.test(firstWord)) {
    return firstWord;
  }
  return 'Інше';
}

function aggregateBrandBreakdown(
  items: { productName: string; brand: string; clientTotal: number; profitPerItem: number }[]
): { brand: string; revenue: number; profit: number; marginPct: number; count: number }[] {
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
    .map(([brand, data]) => ({
      brand,
      ...data,
      marginPct: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);
}

function getDateKey(date: Date, period: RevenuePeriod): string {
  if (period === 'daily') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (period === 'weekly') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
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

/**
 * Country → region mapping. Uses both English and Cyrillic names to handle
 * mixed-locale data in the DB.
 */
function countryToRegion(country: string): string | null {
  if (!country) return null;
  const c = country.toLowerCase().trim();

  // Europe (most shop traffic)
  const europe = [
    'ukraine', 'україна', 'украина', 'uk', 'united kingdom', 'england', 'великобритания', 'великобританія',
    'germany', 'германия', 'німеччина', 'france', 'франція', 'франция', 'italy', 'италия', 'італія',
    'spain', 'испания', 'іспанія', 'poland', 'польща', 'польша', 'czechia', 'czech republic', 'чехія', 'чехия',
    'austria', 'австрія', 'австрия', 'switzerland', 'швейцарія', 'швейцария', 'netherlands', 'нідерланди', 'нидерланды',
    'belgium', 'бельгія', 'бельгия', 'sweden', 'швеція', 'швеция', 'norway', 'норвегія', 'норвегия',
    'denmark', 'данія', 'дания', 'finland', 'фінляндія', 'финляндия', 'portugal', 'португалія', 'португалия',
    'greece', 'греція', 'греция', 'ireland', 'ірландія', 'ирландия', 'romania', 'румунія', 'румыния',
    'hungary', 'угорщина', 'венгрия', 'slovakia', 'словаччина', 'словакия', 'bulgaria', 'болгарія', 'болгария',
    'serbia', 'сербія', 'сербия', 'croatia', 'хорватія', 'хорватия', 'lithuania', 'литва', 'latvia', 'латвія', 'латвия',
    'estonia', 'естонія', 'эстония', 'cyprus', 'кіпр', 'кипр',
  ];
  if (europe.some((x) => c.includes(x))) return 'Europe';

  const northAmerica = [
    'usa', 'united states', 'us', 'сша', 'америка', 'canada', 'канада', 'mexico', 'мексика',
  ];
  if (northAmerica.some((x) => c === x || c.includes(x))) return 'North America';

  const middleEast = [
    'uae', 'united arab emirates', 'оае', 'еміраті', 'эмираты', 'дубай', 'dubai',
    'saudi arabia', 'саудівська', 'саудовская', 'lebanon', 'ліван', 'ливан',
    'israel', 'ізраїль', 'израиль', 'qatar', 'катар', 'kuwait', 'кувейт', 'jordan', 'йорданія', 'иордания',
    'oman', 'оман', 'bahrain', 'бахрейн',
  ];
  if (middleEast.some((x) => c.includes(x))) return 'Middle East';

  const asiaPacific = [
    'japan', 'японія', 'япония', 'china', 'китай', 'singapore', 'сінгапур', 'сингапур',
    'australia', 'австралія', 'австралия', 'new zealand', 'нова зеландія', 'новая зеландия',
    'south korea', 'korea', 'південна корея', 'южная корея', 'thailand', 'таїланд', 'тайланд',
    'vietnam', 'вʼєтнам', 'вьетнам', 'malaysia', 'малайзія', 'малайзия', 'indonesia', 'індонезія', 'индонезия',
    'philippines', 'філіппіни', 'филиппины', 'india', 'індія', 'индия', 'hong kong', 'гонконг',
  ];
  if (asiaPacific.some((x) => c.includes(x))) return 'Asia Pacific';

  const southAmerica = [
    'brazil', 'бразилія', 'бразилия', 'argentina', 'аргентина', 'chile', 'чилі', 'чили',
    'colombia', 'колумбія', 'колумбия', 'peru', 'перу', 'venezuela', 'венесуела', 'венесуэла',
  ];
  if (southAmerica.some((x) => c.includes(x))) return 'South America';

  return 'Other';
}

/**
 * Resolve a brand name to a public logo path.
 * Manually curated map for brands we have logos for in /public/logos/.
 * Returns null if no logo — caller can render text-mark fallback.
 */
function brandLogoPath(brand: string): string | null {
  const key = brand.toLowerCase().trim().replace(/\s+/g, '-');
  const map: Record<string, string> = {
    'racechip': '/logos/racechip.png',
    'brabus': '/logos/brabus.svg',
    'do88': '/logos/do88.png',
    'girodisc': '/logos/girodisc.webp',
    'burger-motorsports': '/logos/burger-motorsport.svg',
    'burger-motorsport': '/logos/burger-motorsport.svg',
    'ohlins': '/logos/ohlins.svg',
    'akrapovic': '/logos/akrapovic.svg',
    'csf': '/logos/csf.png',
    'adro': '/logos/adro.svg',
    'eventuri': '/brands/eventuri-logo.svg',
    'fi-exhaust': '/logos/fi-exhaust.svg',
    'ipe-exhaust': '/logos/fi-exhaust.svg',
    'kw': '/logos/kw.svg',
    'kw-suspensions': '/logos/kw-suspensions.svg',
    'kw-suspension': '/logos/kw-suspension.svg',
    'novitec': '/logos/novitec.svg',
    'borla': '/logos/borla.svg',
    'brembo': '/logos/brembo.png',
    'hre-wheels': '/logos/hre-wheels.png',
    'hre': '/logos/hre-wheels.png',
    'apr': '/logos/apr.png',
    'abt': '/logos/abt.png',
    'ac-schnitzer': '/logos/ac-schnitzer.png',
    '3d-design': '/logos/3d-design.png',
    'land-rover': '/logos/landrover.svg',
    'landrover': '/logos/landrover.svg',
  };
  return map[key] ?? null;
}
