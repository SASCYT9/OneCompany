"use client";

import { useState } from "react";
import Link from "next/link";

import { MechanicalDashboard } from "./MechanicalDashboard";
import { EditorialDashboard } from "./EditorialDashboard";

type Variant = "mechanical" | "editorial";

const MOCK = {
  revenue: 1_842_350,
  revenuePrev: 1_618_220,
  orders: 142,
  ordersPrev: 119,
  profit: 38_420,
  profitPrev: 31_580,
  debt: 12_840,
  marginPct: 27.4,
  aov: 12_975,
  debtors: 4,
  unpaidCount: 3,
  shopActive: 38,
  crmActive: 104,
  recentOrders: [
    {
      id: "OC-24015",
      customer: "Atelier Munich GmbH",
      brand: "Brabus",
      items: 4,
      total: "€18,400",
      status: "shipped" as const,
      date: "12 May",
    },
    {
      id: "OC-24014",
      customer: "Forrest Imports Dubai",
      brand: "Akrapovic",
      items: 2,
      total: "$9,800",
      status: "processing" as const,
      date: "12 May",
    },
    {
      id: "OC-24013",
      customer: "Sports Mafia LA",
      brand: "HRE Wheels",
      items: 1,
      total: "$14,200",
      status: "pending" as const,
      date: "11 May",
    },
    {
      id: "OC-24012",
      customer: "Hamilton Performance UK",
      brand: "Eventuri",
      items: 3,
      total: "£6,420",
      status: "delivered" as const,
      date: "11 May",
    },
    {
      id: "OC-24011",
      customer: "Beirut Customs",
      brand: "KW Suspensions",
      items: 6,
      total: "€22,800",
      status: "shipped" as const,
      date: "10 May",
    },
  ],
  topBrands: [
    { name: "Brabus", count: 184 },
    { name: "Akrapovič", count: 142 },
    { name: "KW", count: 128 },
    { name: "Eventuri", count: 96 },
    { name: "HRE", count: 74 },
    { name: "Vorsteiner", count: 62 },
  ],
  pipeline: [
    { status: "PENDING_PAYMENT", label: "Очікує оплату", count: 12, oldestDays: 8 },
    { status: "PENDING_REVIEW", label: "На перевірці", count: 4, oldestDays: 2 },
    { status: "CONFIRMED", label: "Підтверджено", count: 9, oldestDays: 1 },
    { status: "PROCESSING", label: "В обробці", count: 18, oldestDays: 3 },
    { status: "SHIPPED", label: "Відправлено", count: 23, oldestDays: 5 },
    { status: "DELIVERED", label: "Доставлено", count: 76, oldestDays: null },
  ],
  sales: [
    { month: "Гру", revenue: 980_000, orders: 64 },
    { month: "Січ", revenue: 1_120_000, orders: 72 },
    { month: "Лют", revenue: 1_240_000, orders: 81 },
    { month: "Бер", revenue: 1_380_000, orders: 96 },
    { month: "Кві", revenue: 1_618_000, orders: 119 },
    { month: "Тра", revenue: 1_842_000, orders: 142 },
  ],
};

export default function DesignLabPage() {
  const [variant, setVariant] = useState<Variant>("mechanical");

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/admin"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-300"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ← admin
            </Link>
            <span className="h-3 w-px bg-white/10" aria-hidden="true" />
            <div className="min-w-0">
              <div
                className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-400"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Design Lab
              </div>
              <div
                className="truncate text-sm font-semibold tracking-tight text-zinc-50 sm:text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Dashboard direction · 2 variants
              </div>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Виберіть варіант"
            className="flex shrink-0 items-stretch overflow-hidden border border-white/10 bg-black/40"
          >
            <button
              type="button"
              role="tab"
              aria-selected={variant === "mechanical"}
              onClick={() => setVariant("mechanical")}
              className={`px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition sm:px-4 ${
                variant === "mechanical"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-white/4 hover:text-zinc-200"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              A · Mechanical
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={variant === "editorial"}
              onClick={() => setVariant("editorial")}
              className={`border-l border-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition sm:px-4 ${
                variant === "editorial"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-white/4 hover:text-zinc-200"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              B · Editorial
            </button>
          </div>
        </div>
      </header>

      <main>
        {variant === "mechanical" ? (
          <MechanicalDashboard data={MOCK} />
        ) : (
          <EditorialDashboard data={MOCK} />
        )}
      </main>
    </div>
  );
}

export type MockData = typeof MOCK;
