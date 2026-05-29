"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, PackageX, RefreshCcw, RotateCw, Search } from "lucide-react";

import {
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from "@/components/admin/AdminSkeleton";

type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSPECTED"
  | "REFUNDED"
  | "REJECTED";

type ReturnRow = {
  id: string;
  rmaNumber: string;
  orderId: string;
  status: ReturnStatus;
  reason: string;
  refundMethod: string;
  refundAmount: number;
  currency: string;
  itemsCount: number;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  order: {
    orderNumber: string;
    email: string;
    customerName: string;
    currency: string;
    total: number;
  };
};

function statusTone(status: ReturnStatus): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "REQUESTED":
      return "warning";
    case "APPROVED":
    case "IN_TRANSIT":
    case "RECEIVED":
    case "INSPECTED":
      return "warning";
    case "REFUNDED":
      return "success";
    case "REJECTED":
      return "danger";
    default:
      return "default";
  }
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);

        const response = await fetch(`/api/admin/shop/returns?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || "Failed to load returns");
          return;
        }
        setReturns(data.returns || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, statusFilter, reloadKey]);

  const stats = useMemo(() => {
    return {
      total: returns.length,
      pending: returns.filter((r) => ["REQUESTED", "APPROVED", "IN_TRANSIT"].includes(r.status))
        .length,
      atWarehouse: returns.filter((r) => ["RECEIVED", "INSPECTED"].includes(r.status)).length,
      refunded: returns.filter((r) => r.status === "REFUNDED").length,
      totalRefundValue: returns
        .filter((r) => r.status === "REFUNDED")
        .reduce((sum, r) => sum + r.refundAmount, 0),
    };
  }, [returns]);

  if (loading) {
    return (
      <AdminPage className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження повернень…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-3.5 w-96 motion-safe:animate-pulse rounded-none bg-white/4" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-none bg-white/4" />
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonTable rows={6} cols={6} />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Операції"
        title="Повернення / RMA"
        description="Запити на повернення, відстеження RMA, автоматичне поповнення складу, фіксація повернень. B2C → Stripe-повернення; B2B → магазинний кредит або банківський переказ."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard
          label="Активні RMA"
          value={stats.pending}
          meta="Чекають отримання або огляду"
          tone="accent"
        />
        <AdminMetricCard label="На складі" value={stats.atWarehouse} meta="Отримані / на огляді" />
        <AdminMetricCard label="Повернено" value={stats.refunded} meta="Закриті кейси" />
        <AdminMetricCard
          label="Всього повернень"
          value={
            returns.length > 0
              ? formatMoney(stats.totalRefundValue, returns[0]?.currency || "EUR")
              : "—"
          }
          meta="По всіх валютах (валюта першого рядка для показу)"
        />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 md:min-w-[280px]">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за RMA-номером, номером замовлення або email"
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
        </label>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-hidden"
        >
          <option value="">Усі статуси</option>
          <option value="REQUESTED">Запит</option>
          <option value="APPROVED">Затверджено</option>
          <option value="IN_TRANSIT">У дорозі</option>
          <option value="RECEIVED">Отримано</option>
          <option value="INSPECTED">Оглянуто</option>
          <option value="REFUNDED">Повернено</option>
          <option value="REJECTED">Відхилено</option>
        </select>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {returns.length === 0 ? (
        <AdminEmptyState
          title="Поки немає повернень"
          description="Коли клієнт запитає повернення, воно з'явиться тут. Також ви можете створити RMA зі сторінки будь-якого замовлення."
        />
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-4 font-medium">RMA</th>
                  <th className="px-4 py-4 font-medium">Замовлення</th>
                  <th className="px-4 py-4 font-medium">Статус</th>
                  <th className="px-4 py-4 font-medium">Причина</th>
                  <th className="px-4 py-4 font-medium">Сума</th>
                  <th className="px-4 py-4 font-medium">Позицій</th>
                  <th className="px-4 py-4 font-medium">Створено</th>
                  <th className="px-4 py-4 font-medium">Відкрити</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {returns.map((r) => (
                  <tr key={r.id} className="align-top transition hover:bg-white/3">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <PackageX className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                        <span className="font-mono text-xs font-bold tracking-wide text-zinc-100">
                          {r.rmaNumber}
                        </span>
                      </div>
                      {r.refundMethod !== "NONE" ? (
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
                          {r.refundMethod.replace(/_/g, " ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/orders/${r.orderId}`}
                        className="font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"
                      >
                        {r.order.orderNumber}
                      </Link>
                      <div className="mt-1 text-sm text-zinc-200">{r.order.customerName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{r.order.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <AdminStatusBadge tone={statusTone(r.status)}>
                        {r.status.replace(/_/g, " ")}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-4 text-xs text-zinc-300">
                      {r.reason.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-4 py-4">
                      <div
                        className={`font-medium tabular-nums ${r.status === "REFUNDED" ? "text-emerald-300" : "text-zinc-100"}`}
                      >
                        {formatMoney(r.refundAmount, r.currency)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">{r.itemsCount}</td>
                    <td className="px-4 py-4 text-xs text-zinc-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/returns/${r.id}`}
                        className="inline-flex items-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/6"
                      >
                        Керувати
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}
