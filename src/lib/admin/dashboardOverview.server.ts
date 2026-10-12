import "server-only";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY_RATES, normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";
import { convertShopCurrencyAmount, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { ORDER_STALE_DAYS, ORDER_STALE_STATUSES } from "./orderWorkflow";
import {
  DASHBOARD_WINDOW_DAYS,
  summarizeDashboardMoney,
  type DashboardOverview,
} from "./dashboardOverview";

const OPEN_STATUSES = [
  OrderStatus.PENDING_REVIEW,
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
];

const PRICED_CURRENCIES = new Set(["EUR", "USD", "UAH"]);

/** Bounded, read-only home overview: counts, two months of orders and short lists. */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - DASHBOARD_WINDOW_DAYS * 86_400_000);
  const moneyStart = new Date(now.getTime() - 2 * DASHBOARD_WINDOW_DAYS * 86_400_000);
  const staleBefore = new Date(now.getTime() - ORDER_STALE_DAYS * 86_400_000);
  const orderWhere = { isDraft: false, createdAt: { gte: windowStart } };
  const pendingWhere = { group: "B2B_PENDING" as const, archivedAt: null, isActive: true };
  const [
    statusCounts,
    windowCounts,
    olderOpen,
    stale,
    returnsOpen,
    moneyOrders,
    openOrders,
    settings,
    recent,
    pendingCount,
    pending,
    published,
    unpublished,
    products,
  ] = await Promise.all([
    prisma.shopOrder.groupBy({
      by: ["status"],
      where: { isDraft: false, status: { in: OPEN_STATUSES } },
      _count: true,
    }),
    prisma.shopOrder.groupBy({ by: ["status"], where: orderWhere, _count: true }),
    prisma.shopOrder.count({
      where: { isDraft: false, createdAt: { lt: windowStart }, status: { in: OPEN_STATUSES } },
    }),
    prisma.shopOrder.count({
      where: {
        isDraft: false,
        status: { in: ORDER_STALE_STATUSES },
        createdAt: { lt: staleBefore },
      },
    }),
    prisma.shopOrderReturn.count({ where: { status: "REQUESTED" } }),
    prisma.shopOrder.findMany({
      where: {
        isDraft: false,
        createdAt: { gte: moneyStart },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { createdAt: true, currency: true, total: true, amountPaid: true },
    }),
    prisma.shopOrder.findMany({
      where: {
        isDraft: false,
        status: { in: OPEN_STATUSES },
        paymentStatus: { not: "PAID" },
      },
      select: { currency: true, total: true, amountPaid: true },
    }),
    prisma.shopSettings.findUnique({ where: { key: "shop" }, select: { currencyRates: true } }),
    prisma.shopOrder.findMany({
      where: { isDraft: false },
      take: 8,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        total: true,
        currency: true,
        paymentStatus: true,
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

  const rates = normalizeShopCurrencyRates(settings?.currencyRates ?? DEFAULT_CURRENCY_RATES);
  const toUah = (amount: number, currency: string) => {
    const code = currency.toUpperCase();
    if (!PRICED_CURRENCIES.has(code)) return null;
    return convertShopCurrencyAmount(amount, code as ShopCurrencyCode, "UAH", rates, 2);
  };
  const open = Object.fromEntries(statusCounts.map((row) => [row.status, row._count])) as Partial<
    Record<OrderStatus, number>
  >;

  return {
    updatedAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowDays: DASHBOARD_WINDOW_DAYS,
    attention: {
      newOrders: open.PENDING_REVIEW ?? 0,
      awaitingPayment: open.PENDING_PAYMENT ?? 0,
      toFulfil: (open.CONFIRMED ?? 0) + (open.PROCESSING ?? 0),
      confirmed: open.CONFIRMED ?? 0,
      inTransit: open.SHIPPED ?? 0,
      stale,
      b2bPending: pendingCount,
      returnsOpen,
    },
    money: summarizeDashboardMoney({
      now,
      windowDays: DASHBOARD_WINDOW_DAYS,
      orders: moneyOrders.map((row) => ({
        createdAt: row.createdAt,
        currency: row.currency,
        total: Number(row.total),
        amountPaid: row.amountPaid,
      })),
      openOrders: openOrders.map((row) => ({
        currency: row.currency,
        total: Number(row.total),
        amountPaid: row.amountPaid,
      })),
      toUah,
    }),
    orders: {
      counts: Object.fromEntries(windowCounts.map((row) => [row.status, row._count])),
      olderOpen,
      recent: recent.map((row) => ({
        id: row.id,
        number: row.orderNumber,
        customer: row.customerName,
        status: row.status,
        total: Number(row.total),
        currency: row.currency,
        paymentStatus: row.paymentStatus,
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
