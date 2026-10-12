export const DASHBOARD_WINDOW_DAYS = 30;

export const DASHBOARD_ORDER_STATUS: Record<string, string> = {
  PENDING_REVIEW: "На перевірці",
  PENDING_PAYMENT: "Очікує оплату",
  CONFIRMED: "Підтверджено",
  PROCESSING: "В обробці",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено",
};

export type DashboardMoneyTotals = {
  ordered: number;
  paid: number;
  orders: number;
};

export type DashboardOverview = {
  updatedAt: string;
  windowStart: string;
  windowDays: number;
  /** What needs a person today — every number links to the matching list. */
  attention: {
    newOrders: number;
    awaitingPayment: number;
    toFulfil: number;
    /** Part of toFulfil still waiting to be started — decides which list tab to open. */
    confirmed: number;
    inTransit: number;
    stale: number;
    b2bPending: number;
    returnsOpen: number;
  };
  /** Last 30 days vs the 30 before, in UAH at the shop's sale rates. */
  money: {
    current: DashboardMoneyTotals & { averageOrder: number };
    previous: DashboardMoneyTotals;
    outstanding: number;
    byCurrency: Array<DashboardMoneyTotals & { currency: string }>;
    daily: Array<DashboardMoneyTotals & { date: string }>;
    unconverted: string[];
  };
  orders: {
    counts: Record<string, number>;
    olderOpen: number;
    recent: Array<{
      id: string;
      number: string;
      customer: string;
      status: string;
      total: number;
      currency: string;
      paymentStatus: string;
      createdAt: string;
      itemCount: number;
    }>;
  };
  customers: {
    pendingCount: number;
    pending: Array<{ id: string; name: string; company: string | null; createdAt: string }>;
  };
  catalog: {
    published: number;
    unpublished: number;
    recent: Array<{
      id: string;
      title: string;
      brand: string | null;
      updatedAt: string;
      published: boolean;
    }>;
  };
};

type MoneyOrder = {
  createdAt: Date;
  currency: string;
  total: number;
  amountPaid: number;
};

const KYIV_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function kyivDay(date: Date) {
  return KYIV_DAY.format(date);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Money summary for the overview. `toUah` converts at the shop's sale rates and returns
 * null for a currency it cannot price, which is then reported instead of guessed.
 */
export function summarizeDashboardMoney(input: {
  now: Date;
  windowDays: number;
  orders: MoneyOrder[];
  openOrders: Array<Pick<MoneyOrder, "currency" | "total" | "amountPaid">>;
  toUah: (amount: number, currency: string) => number | null;
}): DashboardOverview["money"] {
  const dayMs = 86_400_000;
  const currentStart = input.now.getTime() - input.windowDays * dayMs;
  const previousStart = currentStart - input.windowDays * dayMs;
  const current: DashboardMoneyTotals = { ordered: 0, paid: 0, orders: 0 };
  const previous: DashboardMoneyTotals = { ordered: 0, paid: 0, orders: 0 };
  const byCurrency = new Map<string, DashboardMoneyTotals>();
  const unconverted = new Set<string>();

  const days = new Map<string, DashboardMoneyTotals>();
  for (let index = input.windowDays - 1; index >= 0; index--) {
    days.set(kyivDay(new Date(input.now.getTime() - index * dayMs)), { ordered: 0, paid: 0, orders: 0 });
  }

  for (const order of input.orders) {
    const time = order.createdAt.getTime();
    if (time < previousStart) continue;
    const ordered = input.toUah(order.total, order.currency);
    const paid = input.toUah(order.amountPaid, order.currency);
    const isCurrent = time >= currentStart;
    if (isCurrent) {
      const raw = byCurrency.get(order.currency) ?? { ordered: 0, paid: 0, orders: 0 };
      raw.ordered += order.total;
      raw.paid += order.amountPaid;
      raw.orders += 1;
      byCurrency.set(order.currency, raw);
    }
    if (ordered === null || paid === null) {
      unconverted.add(order.currency);
      continue;
    }
    const bucket = isCurrent ? current : previous;
    bucket.ordered += ordered;
    bucket.paid += paid;
    bucket.orders += 1;
    if (isCurrent) {
      const day = days.get(kyivDay(order.createdAt));
      if (day) {
        day.ordered += ordered;
        day.paid += paid;
        day.orders += 1;
      }
    }
  }

  let outstanding = 0;
  for (const order of input.openOrders) {
    const remainder = input.toUah(Math.max(0, order.total - order.amountPaid), order.currency);
    if (remainder === null) unconverted.add(order.currency);
    else outstanding += remainder;
  }

  return {
    current: {
      ordered: round(current.ordered),
      paid: round(current.paid),
      orders: current.orders,
      averageOrder: current.orders ? round(current.ordered / current.orders) : 0,
    },
    previous: {
      ordered: round(previous.ordered),
      paid: round(previous.paid),
      orders: previous.orders,
    },
    outstanding: round(outstanding),
    byCurrency: [...byCurrency.entries()]
      .map(([currency, totals]) => ({
        currency,
        ordered: round(totals.ordered),
        paid: round(totals.paid),
        orders: totals.orders,
      }))
      .sort((left, right) => right.orders - left.orders),
    daily: [...days.entries()].map(([date, totals]) => ({
      date,
      ordered: round(totals.ordered),
      paid: round(totals.paid),
      orders: totals.orders,
    })),
    unconverted: [...unconverted],
  };
}

/** «+12%» against the previous period; null when there is nothing to compare with. */
export function dashboardTrend(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
