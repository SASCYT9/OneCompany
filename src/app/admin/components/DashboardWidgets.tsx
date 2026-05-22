"use client";

import { useState } from "react";

import Link from "next/link";
import { ArrowRight, Package as PackageIcon } from "lucide-react";

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
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
          {title ? (
            <h3 className="font-display text-[13px] font-semibold tracking-tight text-zinc-100">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action ? <div className="font-display text-xs">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function ViewAllLink({ href, label = "Усі" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="font-display inline-flex items-center gap-1 text-[12px] font-medium text-blue-400 transition hover:text-blue-300"
    >
      {label}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SALES CHART — Line + secondary line with tooltip
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
      <div className="h-56 rounded-none bg-black/20 px-4 py-12 text-center text-sm text-zinc-500 sm:h-72">
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

  // Smooth Catmull–Rom → cubic bezier (tension 0.5). No jagged polyline edges.
  function smoothPath(pts: Array<{ x: number; y: number }>): string {
    if (pts.length < 2) return "";
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const t = 0.5;
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * t;
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * t;
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  }

  const primaryPath = smoothPath(primaryPoints);
  const secondaryPath = smoothPath(secondaryPoints);
  const lastIdx = primaryPoints.length - 1;

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-hidden">
      <div className="font-display mb-3 flex flex-wrap items-center gap-4 text-[12px]">
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
          className="h-56 w-full sm:h-72"
          onMouseLeave={() => setHoveredIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xRel = ((e.clientX - rect.left) / rect.width) * w;
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
          onTouchStart={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const xRel = ((touch.clientX - rect.left) / rect.width) * w;
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
              <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.32" />
              <stop offset="55%" stopColor="rgb(59 130 246)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="oc-line-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgb(96 165 250)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="rgb(147 197 253)" stopOpacity="1" />
            </linearGradient>
            <filter id="oc-chart-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
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
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
          />
          <path
            d={primaryPath}
            fill="none"
            stroke="url(#oc-line-grad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

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

          {/* Pulsing glow halo behind latest point */}
          {primaryPoints[lastIdx] ? (
            <circle
              cx={primaryPoints[lastIdx].x}
              cy={primaryPoints[lastIdx].y}
              r="9"
              fill="rgb(96 165 250)"
              fillOpacity="0.18"
              filter="url(#oc-chart-glow)"
              className="motion-safe:animate-pulse"
            />
          ) : null}

          {primaryPoints.map((p, i) => {
            const isLatest = i === lastIdx;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 5 : isLatest ? 4.5 : 3}
                fill={isLatest ? "rgb(147 197 253)" : "#0A0A0A"}
                stroke={isLatest ? "rgb(147 197 253)" : "rgb(96 165 250)"}
                strokeWidth={isLatest ? 0 : 1.75}
              />
            );
          })}

          {/* Floating value labels above each peak — Bebas Neue numbers */}
          {data.length <= 14
            ? primaryPoints.map((p, i) => {
                const isLatest = i === lastIdx;
                return (
                  <text
                    key={`v-${i}`}
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    fill={isLatest ? "rgb(147 197 253)" : "rgb(228 228 231)"}
                    fontSize={isLatest ? "14" : "12"}
                    fontWeight={isLatest ? "500" : "400"}
                    fontFamily="var(--font-condensed)"
                    letterSpacing="0.04em"
                  >
                    {currencySymbol}
                    {formatShort(p.raw)}
                  </text>
                );
              })
            : null}

          {data.map((d, i) => {
            if (data.length > 12 && i % 2 !== 0 && i !== data.length - 1) return null;
            const isLatest = i === lastIdx;
            return (
              <text
                key={i}
                x={padX + i * step}
                y={h - 14}
                textAnchor="middle"
                fill={isLatest ? "rgb(147 197 253)" : "rgb(113 113 122)"}
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight={isLatest ? "500" : "400"}
                letterSpacing="0.12em"
              >
                {d.label.toUpperCase()}
              </text>
            );
          })}
        </svg>

        {hoveredIdx !== null && data[hoveredIdx] ? (
          <div
            className="font-display pointer-events-none absolute z-10 rounded-none border border-white/8 bg-[#0F0F0F] px-3 py-2 text-xs"
            style={{
              left: `${(primaryPoints[hoveredIdx].x / w) * 100}%`,
              top: `${(primaryPoints[hoveredIdx].y / h) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div className="font-mono mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
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
   RECENT ORDERS — table on desktop, card list on mobile
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
  if (orders.length === 0) {
    return <div className="px-5 py-8 text-center text-sm text-zinc-500">Поки немає замовлень</div>;
  }

  return (
    <>
      {/* Mobile: card list */}
      <ul className="divide-y divide-white/5 sm:hidden">
        {orders.map((o) => (
          <li key={o.id} className="px-4 py-3 transition-colors hover:bg-white/[0.025]">
            <Link
              href={`/admin/shop/orders/${o.id}`}
              className="flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-medium tabular-nums text-blue-400">
                    #{o.displayId}
                  </span>
                  <span className="font-display text-[11px] text-zinc-500">{o.date}</span>
                </div>
                <div className="font-display mt-0.5 truncate text-[14px] font-medium text-zinc-100">
                  {o.customer}
                </div>
                <div className="font-display mt-0.5 truncate text-[12px] text-zinc-400">
                  {o.brand} · {o.items} поз.
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="font-display whitespace-nowrap text-[14px] font-semibold tabular-nums text-zinc-100">
                  {o.total}
                </span>
                <OrderStatusPill status={o.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="font-display border-b border-white/5 text-left text-[11px] font-semibold text-zinc-500">
              <th className="px-5 py-3 whitespace-nowrap">№</th>
              <th className="px-3 py-3">Клієнт</th>
              <th className="px-3 py-3 whitespace-nowrap">Бренд</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Поз.</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Сума</th>
              <th className="px-3 py-3 whitespace-nowrap">Статус</th>
              <th className="px-5 py-3 whitespace-nowrap">Дата</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.025]"
              >
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <Link
                    href={`/admin/shop/orders/${o.id}`}
                    className="font-mono text-[12px] font-medium tabular-nums text-blue-400 hover:underline"
                  >
                    #{o.displayId}
                  </Link>
                </td>
                <td className="font-display max-w-[180px] px-3 py-3.5 text-[14px] font-medium text-zinc-100">
                  <span className="block truncate">{o.customer}</span>
                </td>
                <td className="max-w-[140px] px-3 py-3.5">
                  <BrandCell brand={o.brand} logo={o.brandLogo} />
                </td>
                <td className="font-display px-3 py-3.5 text-center text-[13px] tabular-nums text-zinc-300">
                  {o.items}
                </td>
                <td className="font-display whitespace-nowrap px-3 py-3.5 text-right text-[14px] font-semibold tabular-nums text-zinc-100">
                  {o.total}
                </td>
                <td className="px-3 py-3.5">
                  <OrderStatusPill status={o.status} />
                </td>
                <td className="font-display whitespace-nowrap px-5 py-3.5 text-[12px] tabular-nums text-zinc-500">
                  {o.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
    <span className="font-display block truncate text-[12px] font-medium text-zinc-200">
      {brand}
    </span>
  );
}

function OrderStatusPill({ status }: { status: RichOrderRow["status"] }) {
  const map = {
    shipped: { label: "Відправлено", dot: "bg-blue-500", text: "text-blue-300" },
    processing: { label: "В обробці", dot: "bg-amber-400", text: "text-amber-300" },
    delivered: { label: "Доставлено", dot: "bg-green-500", text: "text-green-300" },
    pending: { label: "Очікує", dot: "bg-zinc-500", text: "text-zinc-300" },
    cancelled: { label: "Скасовано", dot: "bg-red-500", text: "text-red-300" },
  };
  const m = map[status];
  return (
    <span className="font-display inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium">
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden="true" />
      <span className={m.text}>{m.label}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP BRANDS — Numbered list with brand text/logo
═══════════════════════════════════════════════════════════════ */

export function DashboardTopBrands({
  brands,
}: {
  brands: Array<{ name: string; logo?: string; revenue: string }>;
}) {
  if (brands.length === 0) {
    return <div className="font-display px-1 py-3 text-sm text-zinc-500">Поки немає даних</div>;
  }
  return (
    <ul className="space-y-0.5">
      {brands.map((b, i) => (
        <li
          key={b.name}
          className="flex items-center gap-3 rounded-none px-2 py-2 transition-colors hover:bg-white/[0.025]"
        >
          <span className="font-display w-5 shrink-0 text-center text-[12px] font-medium tabular-nums text-zinc-500">
            {String(i + 1).padStart(2, "0")}
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
              <span className="font-display block truncate text-[13px] font-medium text-zinc-100">
                {b.name}
              </span>
            )}
          </div>
          <span className="font-display shrink-0 whitespace-nowrap text-[12px] tabular-nums text-zinc-400">
            {b.revenue}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP PRODUCTS — Compact vertical list (fits narrow column)
═══════════════════════════════════════════════════════════════ */

export function DashboardTopProducts({
  products,
}: {
  products: Array<{
    id: string;
    name: string;
    brand?: string | null;
    price: string;
    image?: string;
    href?: string;
  }>;
}) {
  if (products.length === 0) {
    return <div className="font-display px-1 py-3 text-sm text-zinc-500">Поки немає даних</div>;
  }
  return (
    <ul className="space-y-1">
      {products.map((p) => {
        const inner = (
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-none bg-zinc-900">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <PackageIcon className="h-4 w-4 text-zinc-700" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              {p.brand ? (
                <span className="font-display block truncate text-[11px] font-medium text-blue-400">
                  {p.brand}
                </span>
              ) : null}
              <span className="font-display block truncate text-[13px] font-medium text-zinc-100">
                {p.name}
              </span>
            </span>
            <span className="font-display shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-zinc-200">
              {p.price}
            </span>
          </span>
        );
        const className =
          "group flex w-full rounded-none px-2 py-1.5 transition-colors hover:bg-white/[0.025]";
        return (
          <li key={p.id}>
            {p.href ? (
              <Link href={p.href} className={className}>
                {inner}
              </Link>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
