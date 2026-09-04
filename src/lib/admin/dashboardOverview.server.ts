import "server-only";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_WINDOW_DAYS, type DashboardOverview } from "./dashboardOverview";

/** Bounded, read-only home overview. Historical analytics are intentionally separate. */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - DASHBOARD_WINDOW_DAYS * 86_400_000);
  const orderWhere = { isDraft: false, createdAt: { gte: windowStart } };
  const pendingWhere = { group: "B2B_PENDING" as const, archivedAt: null, isActive: true };
  const [counts, olderOpen, recent, pendingCount, pending, published, unpublished, products] =
    await Promise.all([
      prisma.shopOrder.groupBy({ by: ["status"], where: orderWhere, _count: true }),
      prisma.shopOrder.count({
        where: {
          isDraft: false,
          createdAt: { lt: windowStart },
          status: {
            in: [
              OrderStatus.PENDING_REVIEW,
              OrderStatus.PENDING_PAYMENT,
              OrderStatus.CONFIRMED,
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPED,
            ],
          },
        },
      }),
      prisma.shopOrder.findMany({
        where: orderWhere,
        take: 8,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.shopCustomer.count({ where: pendingWhere }),
      prisma.shopCustomer.findMany({
        where: pendingWhere,
        take: 4,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, firstName: true, lastName: true, companyName: true, createdAt: true },
      }),
      prisma.shopProduct.count({ where: { isPublished: true, status: "ACTIVE" } }),
      prisma.shopProduct.count({ where: { isPublished: false, status: { not: "ARCHIVED" } } }),
      prisma.shopProduct.findMany({
        where: { status: { not: "ARCHIVED" } },
        take: 4,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          titleUa: true,
          titleEn: true,
          brand: true,
          updatedAt: true,
          isPublished: true,
          status: true,
        },
      }),
    ]);
  return {
    updatedAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowDays: DASHBOARD_WINDOW_DAYS,
    orders: {
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
      olderOpen,
      recent: recent.map((row) => ({
        id: row.id,
        number: row.orderNumber,
        customer: row.customerName,
        status: row.status,
        total: Number(row.total),
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
        itemCount: row._count.items,
      })),
    },
    customers: {
      pendingCount,
      pending: pending.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        company: row.companyName,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    catalog: {
      published,
      unpublished,
      recent: products.map((row) => ({
        id: row.id,
        title: row.titleUa || row.titleEn,
        brand: row.brand,
        updatedAt: row.updatedAt.toISOString(),
        published: row.isPublished && row.status === "ACTIVE",
      })),
    },
  };
}
