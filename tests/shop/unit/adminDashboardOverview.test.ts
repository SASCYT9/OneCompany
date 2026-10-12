import test from "node:test";
import assert from "node:assert/strict";

import { dashboardTrend, summarizeDashboardMoney } from "../../../src/lib/admin/dashboardOverview";

const NOW = new Date("2026-10-13T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const RATES: Record<string, number> = { UAH: 1, EUR: 51.5, USD: 45.5 };
const toUah = (amount: number, currency: string) =>
  RATES[currency] ? Math.round(amount * RATES[currency] * 100) / 100 : null;

test("money is summed in UAH per 30-day window and never mixes raw currencies", () => {
  const money = summarizeDashboardMoney({
    now: NOW,
    windowDays: 30,
    orders: [
      { createdAt: daysAgo(1), currency: "UAH", total: 10_000, amountPaid: 10_000 },
      { createdAt: daysAgo(2), currency: "EUR", total: 100, amountPaid: 0 },
      { createdAt: daysAgo(40), currency: "UAH", total: 5_000, amountPaid: 5_000 },
      { createdAt: daysAgo(90), currency: "UAH", total: 999_999, amountPaid: 0 },
    ],
    openOrders: [
      { currency: "EUR", total: 100, amountPaid: 0 },
      { currency: "UAH", total: 3_000, amountPaid: 1_000 },
    ],
    toUah,
  });
  assert.deepEqual(money.current, { ordered: 15_150, paid: 10_000, orders: 2, averageOrder: 7_575 });
  assert.deepEqual(money.previous, { ordered: 5_000, paid: 5_000, orders: 1 });
  assert.equal(money.outstanding, 5_150 + 2_000);
  assert.deepEqual(
    money.byCurrency.map((entry) => [entry.currency, entry.ordered]),
    [
      ["UAH", 10_000],
      ["EUR", 100],
    ]
  );
  assert.equal(money.daily.length, 30);
  assert.equal(money.daily.at(-1)?.date, "2026-10-13");
  assert.equal(money.daily.reduce((sum, day) => sum + day.ordered, 0), 15_150);
  assert.deepEqual(money.unconverted, []);
});

test("an unknown currency is reported instead of being added as if it were hryvnia", () => {
  const money = summarizeDashboardMoney({
    now: NOW,
    windowDays: 30,
    orders: [{ createdAt: daysAgo(3), currency: "PLN", total: 400, amountPaid: 0 }],
    openOrders: [],
    toUah,
  });
  assert.equal(money.current.ordered, 0);
  assert.deepEqual(money.unconverted, ["PLN"]);
  assert.equal(money.byCurrency[0].currency, "PLN");
});

test("trend compares with the previous period only when there is one", () => {
  assert.equal(dashboardTrend(150, 100), 50);
  assert.equal(dashboardTrend(50, 100), -50);
  assert.equal(dashboardTrend(10, 0), null);
});
