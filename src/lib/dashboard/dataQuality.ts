import { prisma } from '@/lib/prisma';

export interface DataQualityReport {
  ordersWithoutCustomer: number;
  ordersWithZeroTotal: number;
  crmOrdersWithoutDate: number;
  totalShopOrders: number;
  totalCrmOrders: number;
  /** 0-100 health score */
  score: number;
}

/**
 * Calculates data quality metrics across Shop and CRM orders.
 * Used by the dashboard to surface data integrity issues.
 */
export async function getDashboardDataQuality(): Promise<DataQualityReport> {
  const [
    ordersWithoutCustomer,
    ordersWithZeroTotal,
    crmOrdersWithoutDate,
    totalShopOrders,
    totalCrmOrders,
  ] = await Promise.all([
    prisma.shopOrder.count({ where: { customerId: null } }),
    prisma.shopOrder.count({ where: { total: { equals: 0 } } }),
    prisma.crmOrder.count({ where: { orderDate: null } }),
    prisma.shopOrder.count(),
    prisma.crmOrder.count(),
  ]);

  const totalIssues = ordersWithoutCustomer + ordersWithZeroTotal;
  const score = totalShopOrders > 0
    ? Math.round(((totalShopOrders - totalIssues) / totalShopOrders) * 100)
    : 100;

  return {
    ordersWithoutCustomer,
    ordersWithZeroTotal,
    crmOrdersWithoutDate,
    totalShopOrders,
    totalCrmOrders,
    score: Math.max(0, Math.min(100, score)),
  };
}
