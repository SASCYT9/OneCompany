"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Facebook,
  Instagram,
  Mail,
  Youtube,
  AlertTriangle,
  CheckCircle2,
  Package as PackageIcon,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   SHARED CARD WRAPPER
═══════════════════════════════════════════════════════════════ */

export function WidgetCard({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("rounded-none border border-white/5 bg-[#171717]", className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3 border-b border-white/4 px-5 py-3.5">
          {title ? (
            <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>
          ) : (
            <span />
          )}
          {action ? <div className="text-xs">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function ViewAllLink({ href, label = "Усі" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 transition hover:text-blue-300"
    >
      {label}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. SALES ANALYTICS — Line chart with primary + secondary
═══════════════════════════════════════════════════════════════ */

export function DashboardSalesChart({
  data,
  primaryLabel = "Дохід",
  secondaryLabel = "Замовлення",
  currencySymbol = "₴",
}: {
  data: Array<{ label: string; primary: number; secondary?: number }>;
  primaryLabel?: string;
  secondaryLabel?: string;
  currencySymbol?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="h-72 rounded-none bg-black/20 px-4 py-12 text-center text-sm text-zinc-500">
        Немає даних
      </div>
    );
  }

  const w = 720;
  const h = 280;
  const padX = 50;
  const padTop = 20;
  const padBottom = 36;
  const plotH = h - padTop - padBottom;
  const plotW = w - padX * 2;

  const primaryMax = Math.max(...data.map((d) => d.primary), 1);
  const secondaryMax = Math.max(...data.map((d) => d.secondary ?? 0), 1);
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;

  const primaryPoints = data.map((d, i) => ({
    x: padX + i * step,
    y: padTop + plotH - (d.primary / primaryMax) * plotH * 0.9 - plotH * 0.05,
    raw: d.primary,
    label: d.label,
  }));
  const secondaryPoints = data.map((d, i) => ({
    x: padX + i * step,
    y: padTop + plotH - ((d.secondary ?? 0) / secondaryMax) * plotH * 0.9 - plotH * 0.05,
    raw: d.secondary ?? 0,
  }));

  const primaryPath = primaryPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const secondaryPath = secondaryPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-2 text-zinc-300">
          <span className="h-0.5 w-4 rounded-full bg-blue-500" />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-zinc-300">
          <span className="h-0.5 w-4 rounded-full bg-zinc-300" />
          {secondaryLabel}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label="Аналітика продажів"
          className="h-72 w-full"
          onMouseLeave={() => setHoveredIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xRel = ((e.clientX - rect.left) / rect.width) * w;
            // Find nearest data point
            let closest = 0;
            let minDist = Infinity;
            primaryPoints.forEach((p, i) => {
              const dist = Math.abs(p.x - xRel);
              if (dist < minDist) {
                minDist = dist;
                closest = i;
              }
            });
            setHoveredIdx(closest);
          }}
        >
          <defs>
            <linearGradient id="oc-area-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yAxisTicks.map((t, i) => {
            const y = padTop + plotH * t;
            const value = primaryMax * (1 - t);
            return (
              <g key={i}>
                <line
                  x1={padX}
                  x2={w - padX}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.04)"
                  strokeDasharray="3 4"
                />
                <text x={padX - 8} y={y + 3} textAnchor="end" fill="rgb(113 113 122)" fontSize="10">
                  {currencySymbol}
                  {formatShort(value)}
                </text>
              </g>
            );
          })}

          {yAxisTicks.map((t, i) => {
            const y = padTop + plotH * t;
            const value = secondaryMax * (1 - t);
            return (
              <text
                key={i}
                x={w - padX + 8}
                y={y + 3}
                textAnchor="start"
                fill="rgb(113 113 122)"
                fontSize="10"
              >
                {Math.round(value)}
              </text>
            );
          })}

          <path
            d={`${primaryPath} L ${primaryPoints[primaryPoints.length - 1].x} ${padTop + plotH} L ${primaryPoints[0].x} ${padTop + plotH} Z`}
            fill="url(#oc-area-fill)"
          />

          <path
            d={secondaryPath}
            fill="none"
            stroke="rgb(228 228 231)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
          <path
            d={primaryPath}
            fill="none"
            stroke="rgb(59 130 246)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Crosshair line at hovered position */}
          {hoveredIdx !== null && primaryPoints[hoveredIdx] ? (
            <line
              x1={primaryPoints[hoveredIdx].x}
              x2={primaryPoints[hoveredIdx].x}
              y1={padTop}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ) : null}

          {primaryPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 5 : 3.5}
              fill="#0A0A0A"
              stroke="rgb(59 130 246)"
              strokeWidth="2"
            />
          ))}

          {/* Value labels above each primary point — when ≤8 data points show always */}
          {data.length <= 8
            ? primaryPoints.map((p, i) => (
                <text
                  key={`v-${i}`}
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  fill="rgb(228 228 231)"
                  fontSize="11"
                  fontWeight="600"
                >
                  {currencySymbol}
                  {formatShort(p.raw)}
                </text>
              ))
            : null}

          {data.map((d, i) => {
            if (data.length > 12 && i % 2 !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={i}
                x={padX + i * step}
                y={h - 14}
                textAnchor="middle"
                fill="rgb(113 113 122)"
                fontSize="10"
              >
                {d.label}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] ? (
          <div
            className="pointer-events-none absolute z-10 rounded-none border border-white/8 bg-[#0F0F0F] px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm"
            style={{
              left: `${(primaryPoints[hoveredIdx].x / w) * 100}%`,
              top: `${(primaryPoints[hoveredIdx].y / h) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {data[hoveredIdx].label}
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-zinc-400">{primaryLabel}</span>
              <span className="font-semibold tabular-nums text-zinc-50">
                {currencySymbol}
                {formatShort(data[hoveredIdx].primary)}
              </span>
            </div>
            {data[hoveredIdx].secondary != null ? (
              <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                <span className="text-zinc-400">{secondaryLabel}</span>
                <span className="font-semibold tabular-nums text-zinc-50">
                  {data[hoveredIdx].secondary}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
}

/* ═══════════════════════════════════════════════════════════════
   2. REVENUE OVERVIEW — Vertical solid bars
═══════════════════════════════════════════════════════════════ */

export function DashboardRevenueBars({
  data,
  currencySymbol = "₴",
}: {
  data: Array<{ label: string; value: number }>;
  currencySymbol?: string;
}) {
  if (!data.length) {
    return (
      <div className="h-72 rounded-none bg-black/20 px-4 py-12 text-center text-sm text-zinc-500">
        Немає даних
      </div>
    );
  }

  const w = 520;
  const h = 280;
  const padX = 52;
  const padTop = 24;
  const padBottom = 36;
  const plotH = h - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slotW = (w - padX * 2) / data.length;
  const barW = Math.max(4, slotW * 0.7);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Огляд доходу" className="h-72 w-full">
      <defs>
        <linearGradient id="oc-rev-bar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(96 165 250)" />
          <stop offset="100%" stopColor="rgb(37 99 235)" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => {
        const y = padTop + plotH * t;
        const value = max * (1 - t);
        return (
          <g key={i}>
            <line
              x1={padX}
              x2={w - padX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="3 4"
            />
            <text x={padX - 8} y={y + 3} textAnchor="end" fill="rgb(113 113 122)" fontSize="10">
              {currencySymbol}
              {formatShort(value)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barH = (d.value / max) * plotH * 0.95;
        const x = padX + i * slotW + (slotW - barW) / 2;
        const y = padTop + plotH - barH;
        const showLabel =
          data.length <= 8 ||
          i === 0 ||
          i === data.length - 1 ||
          i % Math.ceil(data.length / 6) === 0;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(2, barH)}
              fill="url(#oc-rev-bar)"
              rx="2"
            />
            {/* Value label above bar (only when ≤12 to avoid clutter) */}
            {data.length <= 12 ? (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fill="rgb(228 228 231)"
                fontSize="10"
                fontWeight="600"
              >
                {currencySymbol}
                {formatShort(d.value)}
              </text>
            ) : null}
            {showLabel ? (
              <text
                x={x + barW / 2}
                y={h - 14}
                textAnchor="middle"
                fill="rgb(113 113 122)"
                fontSize="10"
              >
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. SALES BY REGION — Donut chart with breakdown list
═══════════════════════════════════════════════════════════════ */

export function DashboardRegionsDonut({
  data,
  totalLabel = "Total Revenue",
  totalValue,
  footnote,
}: {
  data: Array<{ region: string; pct: number; value: string }>;
  totalLabel?: string;
  totalValue: string;
  footnote?: string;
}) {
  const colors = [
    "rgb(59 130 246)", // blue-500
    "rgb(96 165 250)", // blue-400
    "rgb(147 197 253)", // blue-300
    "rgb(191 219 254)", // blue-200
    "rgb(37 99 235)", // blue-600
    "rgb(29 78 216)", // blue-700
  ];

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="space-y-4">
      {/* Donut centered on top */}
      <div className="relative mx-auto flex h-[140px] w-[140px] items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Sales by region">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="18"
          />
          {data.map((d, i) => {
            const len = (d.pct / 100) * circumference;
            const offset = circumference - cumulative;
            cumulative += len;
            return (
              <circle
                key={i}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="18"
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={offset}
                transform="rotate(-90 70 70)"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="truncate max-w-full text-sm font-bold tabular-nums text-zinc-50">
            {totalValue}
          </div>
          <div className="mt-0.5 truncate max-w-full text-[9px] font-medium uppercase tracking-wider text-zinc-500">
            {totalLabel}
          </div>
        </div>
      </div>
      {/* Region rows below — full width, no truncation */}
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={d.region} className="flex items-center gap-2 text-xs">
            <span
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-white/12 bg-white/4"
              aria-hidden="true"
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ background: colors[i % colors.length] }}
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-zinc-300">{d.region}</span>
            <span className="w-9 shrink-0 text-right font-medium tabular-nums text-zinc-100">
              {d.pct}%
            </span>
            <span className="w-20 shrink-0 truncate text-right tabular-nums text-zinc-500">
              {d.value}
            </span>
          </div>
        ))}
      </div>
      {footnote ? (
        <div className="border-t border-white/4 pt-2 text-[10px] text-zinc-600">{footnote}</div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. RECENT ORDERS TABLE — with brand cells
═══════════════════════════════════════════════════════════════ */

export type RichOrderRow = {
  id: string;
  displayId: string;
  customer: string;
  brand: string;
  brandLogo?: string;
  items: number;
  total: string;
  status: "shipped" | "processing" | "delivered" | "pending" | "cancelled";
  date: string;
};

export function DashboardRecentOrdersTable({ orders }: { orders: RichOrderRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="border-b border-white/4 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-5 py-2.5 whitespace-nowrap">№ замовлення</th>
            <th className="px-3 py-2.5">Клієнт</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Бренд</th>
            <th className="px-3 py-2.5 whitespace-nowrap text-center">Позицій</th>
            <th className="px-3 py-2.5 whitespace-nowrap text-right">Сума</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Статус</th>
            <th className="px-5 py-2.5 whitespace-nowrap">Дата</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              className="border-b border-white/3 last:border-0 transition hover:bg-white/2"
            >
              <td className="px-5 py-3.5 whitespace-nowrap">
                <Link
                  href={`/admin/shop/orders/${o.id}`}
                  className="font-mono text-xs text-blue-400 hover:underline"
                >
                  #{o.displayId}
                </Link>
              </td>
              <td className="max-w-[180px] px-3 py-3.5 text-sm text-zinc-200">
                <span className="block truncate">{o.customer}</span>
              </td>
              <td className="max-w-[140px] px-3 py-3.5">
                <BrandCell brand={o.brand} logo={o.brandLogo} />
              </td>
              <td className="px-3 py-3.5 text-center text-sm tabular-nums text-zinc-300">
                {o.items}
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-right text-sm font-semibold tabular-nums text-zinc-100">
                {o.total}
              </td>
              <td className="px-3 py-3.5">
                <OrderStatusPill status={o.status} />
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-xs text-zinc-500">{o.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrandCell({ brand, logo }: { brand: string; logo?: string }) {
  if (logo) {
    return (
      <div className="flex h-6 items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={brand}
          loading="lazy"
          className="h-5 max-h-5 w-auto max-w-[110px] object-contain opacity-90"
        />
      </div>
    );
  }
  return (
    <span className="block truncate font-mono text-[11px] font-bold uppercase tracking-wide text-zinc-200">
      {brand}
    </span>
  );
}

function OrderStatusPill({ status }: { status: RichOrderRow["status"] }) {
  const map = {
    shipped: { label: "Відправлено", cls: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
    processing: { label: "В обробці", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    delivered: { label: "Доставлено", cls: "border-green-500/30 bg-green-500/10 text-green-300" },
    pending: { label: "Очікує", cls: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
    cancelled: { label: "Скасовано", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        m.cls
      )}
    >
      {m.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. TOP BRANDS — Numbered list with brand text/logo
═══════════════════════════════════════════════════════════════ */

export function DashboardTopBrands({
  brands,
}: {
  brands: Array<{ name: string; logo?: string; revenue: string }>;
}) {
  return (
    <ul className="space-y-0.5">
      {brands.map((b, i) => (
        <li
          key={b.name}
          className="flex items-center gap-2.5 rounded-none px-2 py-2 transition hover:bg-white/2.5"
        >
          <span className="w-4 shrink-0 text-center text-xs font-medium tabular-nums text-zinc-500">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            {b.logo ? (
              <div className="flex h-5 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.logo}
                  alt={b.name}
                  loading="lazy"
                  className="h-5 max-h-5 w-auto max-w-full object-contain opacity-90"
                />
              </div>
            ) : (
              <span className="block truncate font-mono text-[11px] font-bold uppercase tracking-wide text-zinc-100">
                {b.name}
              </span>
            )}
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-zinc-300">
            {b.revenue}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. RECENT DEALER INQUIRIES — list with country flags
═══════════════════════════════════════════════════════════════ */

export function DashboardDealerInquiries({
  inquiries,
}: {
  inquiries: Array<{ id: string; dealer: string; location: string; flag: string; ago: string }>;
}) {
  return (
    <ul className="space-y-2.5">
      {inquiries.map((q) => (
        <li key={q.id} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-zinc-800/60 text-sm">
            {q.flag}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-tight text-zinc-100">
              {q.dealer}
            </div>
            <div className="truncate text-[11px] text-zinc-500">{q.location}</div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-[11px] text-zinc-500">{q.ago}</div>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. GLOBAL SALES OVERVIEW — World map + region stat row
═══════════════════════════════════════════════════════════════ */

export function DashboardWorldMap({
  regions,
  compact = false,
}: {
  regions: Array<{ name: string; value: string; pct: number }>;
  compact?: boolean;
}) {
  // Geographic dot positions (% of width/height) for major business hubs
  const hubs = [
    { name: "London", x: 47.5, y: 30, intensity: "high" },
    { name: "Berlin", x: 50, y: 31, intensity: "high" },
    { name: "Dubai", x: 57, y: 44, intensity: "high" },
    { name: "New York", x: 28, y: 38, intensity: "medium" },
    { name: "Los Angeles", x: 18, y: 41, intensity: "medium" },
    { name: "Tokyo", x: 84, y: 38, intensity: "medium" },
    { name: "Sydney", x: 86, y: 78, intensity: "medium" },
    { name: "São Paulo", x: 35, y: 73, intensity: "low" },
    { name: "Singapore", x: 76, y: 60, intensity: "low" },
    { name: "Beirut", x: 55, y: 40, intensity: "low" },
  ];

  return (
    <div className="space-y-4">
      <div className="relative aspect-16/8 w-full overflow-hidden rounded-none bg-[#0F0F0F]">
        {/* Real Wikimedia world map — sits as background, tinted to blend with dark theme */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/world-map.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.18] filter-[invert(1)_brightness(0.7)]"
        />

        {/* Blue gradient haze on top */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-600/5 via-transparent to-blue-500/3" />

        {/* Highlight dots */}
        <svg
          viewBox="0 0 100 50"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {hubs.map((h) => {
            const r = h.intensity === "high" ? 0.7 : h.intensity === "medium" ? 0.5 : 0.4;
            const opacity = h.intensity === "high" ? 1 : h.intensity === "medium" ? 0.85 : 0.65;
            return (
              <g key={h.name}>
                <circle
                  cx={h.x}
                  cy={h.y / 2}
                  r={r * 1.6}
                  fill="rgb(59 130 246)"
                  opacity={opacity * 0.18}
                >
                  {h.intensity === "high" ? (
                    <animate
                      attributeName="r"
                      values={`${r * 1.5};${r * 2.4};${r * 1.5}`}
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  ) : null}
                </circle>
                <circle cx={h.x} cy={h.y / 2} r={r} fill="rgb(96 165 250)" opacity={opacity} />
              </g>
            );
          })}
        </svg>
      </div>

      {compact ? (
        <div className="space-y-1.5">
          {regions.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-zinc-300">{r.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium tabular-nums text-zinc-100">{r.pct}%</span>
                <span className="w-14 truncate text-right tabular-nums text-zinc-500">
                  {r.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
          {regions.map((r) => (
            <div
              key={r.name}
              className="rounded-none border border-white/4 bg-black/30 px-3 py-2.5 text-center"
            >
              <div className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {r.name}
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-100">{r.value}</div>
              <div className="text-[10px] tabular-nums text-zinc-500">{r.pct}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. TOP PRODUCTS — 5 cards with images
═══════════════════════════════════════════════════════════════ */

export function DashboardTopProducts({
  products,
}: {
  products: Array<{
    id: string;
    name: string;
    brand?: string | null;
    price: string;
    sold?: number;
    image?: string;
    href?: string;
  }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
      {products.map((p) => {
        const inner = (
          <>
            <div className="aspect-square overflow-hidden rounded-none bg-linear-to-br from-zinc-900 to-black">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition motion-safe:group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <PackageIcon className="h-8 w-8 text-zinc-700" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="mt-2.5 space-y-0.5 px-1">
              {p.brand ? (
                <div className="truncate text-[10px] font-medium uppercase tracking-wider text-blue-400">
                  {p.brand}
                </div>
              ) : null}
              <div className="line-clamp-2 text-xs font-medium leading-tight text-zinc-100">
                {p.name}
              </div>
              <div className="text-sm font-semibold tabular-nums text-zinc-50">{p.price}</div>
              {p.sold && p.sold > 0 ? (
                <div className="text-[10px] text-zinc-500">{p.sold} sold</div>
              ) : null}
            </div>
          </>
        );
        const className = "group block rounded-none p-1 transition hover:bg-white/2";
        return p.href ? (
          <Link key={p.id} href={p.href} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={p.id} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   9. MARKETING PERFORMANCE — Campaigns table with social icons
═══════════════════════════════════════════════════════════════ */

const CHANNEL_ICONS: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  instagram: { icon: Instagram, color: "text-pink-400" },
  facebook: { icon: Facebook, color: "text-blue-400" },
  youtube: { icon: Youtube, color: "text-red-400" },
  email: { icon: Mail, color: "text-zinc-300" },
};

export function DashboardMarketingPerformance({
  campaigns,
}: {
  campaigns: Array<{
    id: string;
    name: string;
    channel: "instagram" | "facebook" | "youtube" | "email";
    reach: string;
    engagement: string;
    ctr: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>Campaign</span>
        <span className="w-14 text-right">Reach</span>
        <span className="w-16 text-right">Engagement</span>
        <span className="w-12 text-right">CTR</span>
      </div>
      {campaigns.map((c) => {
        const Channel = CHANNEL_ICONS[c.channel];
        const Icon = Channel.icon;
        return (
          <div
            key={c.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-none px-2 py-2 transition hover:bg-white/2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800/60",
                  Channel.color
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="truncate text-sm text-zinc-100">{c.name}</span>
            </div>
            <span className="w-14 text-right text-sm tabular-nums text-zinc-300">{c.reach}</span>
            <span className="w-16 text-right text-sm tabular-nums text-zinc-300">
              {c.engagement}
            </span>
            <span className="w-12 text-right text-sm font-semibold tabular-nums text-blue-400">
              {c.ctr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   10. INVENTORY SNAPSHOT — 4 stat cards + warehouse car image
═══════════════════════════════════════════════════════════════ */

export function DashboardInventorySnapshot({
  totalSkus,
  inStock,
  lowStock,
  outOfStock,
  totalLabel = "Total SKUs",
  imageUrl,
}: {
  totalSkus: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalLabel?: string;
  imageUrl?: string;
}) {
  const total = totalSkus || inStock + lowStock + outOfStock;
  const inStockPct = total > 0 ? Math.round((inStock / total) * 100) : 0;
  const lowStockPct = total > 0 ? Math.round((lowStock / total) * 100) : 0;
  const outPct = total > 0 ? Math.round((outOfStock / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <InvCell
          icon={<PackageIcon className="text-zinc-300" />}
          label={totalLabel}
          value={totalSkus.toLocaleString()}
        />
        <InvCell
          icon={<CheckCircle2 className="text-green-400" />}
          label="In Stock"
          value={inStock.toLocaleString()}
          sub={`(${inStockPct}%)`}
        />
        <InvCell
          icon={<AlertTriangle className="text-amber-400" />}
          label="Low Stock"
          value={lowStock.toLocaleString()}
          sub={`(${lowStockPct}%)`}
        />
        <InvCell
          icon={<XCircle className="text-red-400" />}
          label="Out of Stock"
          value={outOfStock.toLocaleString()}
          sub={`(${outPct}%)`}
        />
      </div>
      <div className="aspect-16/7 overflow-hidden rounded-none bg-linear-to-br from-zinc-900 to-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl ?? "/images/hero-moto.jpg"}
          alt="Warehouse and workshop"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

function InvCell({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-none border border-white/4 bg-black/30 px-3 py-4 text-center">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/4 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-zinc-100">{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] tabular-nums text-zinc-500">{sub}</div> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11. WAREHOUSE / SIDEBAR CAR SILHOUETTE
═══════════════════════════════════════════════════════════════ */

export function WarehouseCarSilhouette({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 90%, rgba(59,130,246,0.18), transparent 60%)",
        }}
      />
      <svg
        viewBox="0 0 200 110"
        className="absolute bottom-0 h-full w-full"
        preserveAspectRatio="xMidYEnd meet"
      >
        <defs>
          <linearGradient id="oc-car-body" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#27272A" />
            <stop offset="60%" stopColor="#18181B" />
            <stop offset="100%" stopColor="#09090B" />
          </linearGradient>
          <linearGradient id="oc-car-window" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Ground reflection glow */}
        <ellipse cx="100" cy="100" rx="70" ry="4" fill="rgb(59 130 246)" opacity="0.18" />

        {/* Body */}
        <path
          d="M30 80 L35 75 L55 60 Q70 48 95 45 L130 45 Q145 47 158 58 L175 75 L180 82 L180 92 L165 95 Q140 98 100 98 Q60 98 50 95 L30 92 Z"
          fill="url(#oc-car-body)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Roof / windshield */}
        <path
          d="M70 60 Q85 50 100 48 L130 48 Q140 52 150 60 L142 65 L80 65 Z"
          fill="url(#oc-car-window)"
        />

        {/* Front wheel arch shadow */}
        <ellipse cx="55" cy="92" rx="14" ry="6" fill="#000" />
        {/* Rear wheel arch shadow */}
        <ellipse cx="148" cy="92" rx="14" ry="6" fill="#000" />

        {/* Wheels */}
        <circle
          cx="55"
          cy="92"
          r="9"
          fill="#0A0A0A"
          stroke="rgba(96,165,250,0.4)"
          strokeWidth="1"
        />
        <circle cx="55" cy="92" r="4" fill="#1F1F1F" />
        <circle
          cx="148"
          cy="92"
          r="9"
          fill="#0A0A0A"
          stroke="rgba(96,165,250,0.4)"
          strokeWidth="1"
        />
        <circle cx="148" cy="92" r="4" fill="#1F1F1F" />

        {/* Headlight glow */}
        <circle cx="172" cy="76" r="3" fill="rgb(96 165 250)" opacity="0.75" />
        <circle cx="172" cy="76" r="6" fill="rgb(96 165 250)" opacity="0.2" />

        {/* Hood line */}
        <line x1="70" y1="65" x2="148" y2="65" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   12. DATE RANGE BADGE — Top right of dashboard
═══════════════════════════════════════════════════════════════ */

export function DashboardDateRange({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-none border border-white/6 bg-[#171717] px-3 py-2 text-xs font-medium text-zinc-200">
      <Calendar className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
      {label}
    </div>
  );
}
