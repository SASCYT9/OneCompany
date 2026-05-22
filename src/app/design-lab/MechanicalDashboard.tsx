"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import type { MockData } from "./page";

const MONO = { fontFamily: "var(--font-mono)" } as const;
const DISPLAY = { fontFamily: "var(--font-display)" } as const;
const CONDENSED = { fontFamily: "var(--font-condensed)" } as const;

/**
 * Variant A — Mechanical Operator
 *
 * Aesthetic: Bloomberg terminal × cockpit instrumentation × Pirelli pro tools.
 * Huge condensed display digits feel like fuel/RPM gauges. Mono labels look
 * like vehicle data readouts. Hairline grid background reads as blueprint /
 * technical drawing. Info-dense — minimum chrome, maximum signal.
 */
export function MechanicalDashboard({ data }: { data: MockData }) {
  return (
    <div
      className="relative px-4 py-4 sm:px-6 sm:py-6 lg:px-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      {/* Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[400px]"
        style={{
          background:
            "radial-gradient(ellipse 600px 400px at 50% 0%, rgba(59,130,246,0.06), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-7xl space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 sm:space-y-5">
        {/* Header — instrument label style */}
        <header className="flex flex-col gap-1.5 border-b border-white/8 pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inset-0 bg-blue-500 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 bg-blue-500" />
            </span>
            <span className="text-[12px] font-medium text-blue-400" style={DISPLAY}>
              Операційна консоль · live
            </span>
          </div>
          <h1
            className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl"
            style={DISPLAY}
          >
            Дашборд
          </h1>
          <div className="text-[13px] text-zinc-400 tabular-nums" style={DISPLAY}>
            Останні 30 днів · 15 кві → 15 тра 2026
          </div>
        </header>

        {/* KPI strip — gauge-style readouts */}
        <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <MechKpi
            primary
            label="Дохід, ₴"
            value={data.revenue}
            previous={data.revenuePrev}
            suffix="₴"
            meta={`Середній чек ${formatUah(data.aov)}`}
          />
          <MechKpi
            label="Замовлення"
            value={data.orders}
            previous={data.ordersPrev}
            meta={`${data.shopActive} магазин · ${data.crmActive} CRM`}
          />
          <MechKpi
            tone="accent"
            label="Прибуток, $"
            value={data.profit}
            previous={data.profitPrev}
            suffix="$"
            meta={`Маржа ${data.marginPct}%`}
          />
          <MechKpi
            label="Заборгованість, $"
            value={data.debt}
            invertDelta
            suffix="$"
            meta={`${data.debtors} боржників · ${data.unpaidCount} неоплачено`}
          />
        </section>

        {/* Sales chart — minimal hairline */}
        <section className="border border-white/8 bg-black/40">
          <header className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-zinc-200" style={DISPLAY}>
                Продажі · 6 місяців
              </span>
              <span className="hidden h-3 w-px bg-white/10 sm:inline-block" aria-hidden="true" />
              <span className="hidden text-[12px] text-zinc-500 sm:inline" style={DISPLAY}>
                в гривні
              </span>
            </div>
            <span className="text-[12px] font-medium tabular-nums text-blue-400" style={DISPLAY}>
              +13.8% vs попередній
            </span>
          </header>
          <div className="p-4 sm:p-5">
            <MechHairlineChart data={data.sales} />
          </div>
        </section>

        {/* Pipeline grid — instrument cluster */}
        <section className="border border-white/8 bg-black/40">
          <header className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-5">
            <span className="text-[13px] font-medium text-zinc-200" style={DISPLAY}>
              Воронка замовлень
            </span>
            <span className="text-[12px] tabular-nums text-zinc-400" style={DISPLAY}>
              {data.pipeline.reduce((s, p) => s + p.count, 0)} всього
            </span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-y divide-white/8 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            {data.pipeline.map((stage) => {
              const warn = stage.oldestDays != null && stage.oldestDays > 7;
              return (
                <div
                  key={stage.status}
                  className="group relative px-4 py-3.5 transition-colors hover:bg-white/[0.025] sm:px-5"
                >
                  {warn ? (
                    <span
                      className="absolute inset-y-0 left-0 w-px bg-amber-400/70"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="truncate text-[13px] font-medium tracking-tight text-zinc-300"
                      style={DISPLAY}
                    >
                      {stage.label}
                    </span>
                    {warn ? (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <div
                    className="mt-2 text-[28px] font-normal leading-none text-zinc-50 tabular-nums sm:text-[32px]"
                    style={CONDENSED}
                  >
                    {stage.count}
                  </div>
                  {stage.oldestDays != null && stage.count > 0 ? (
                    <div
                      className={`mt-1.5 text-[12px] leading-tight ${warn ? "font-medium text-amber-300" : "text-zinc-400"}`}
                      style={DISPLAY}
                    >
                      <span className="text-zinc-500">найстаріше</span>{" "}
                      <span className="tabular-nums">{stage.oldestDays} дн</span>
                      {warn ? " · потребує уваги" : ""}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[12px] text-zinc-700" style={DISPLAY}>
                      завершено
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent orders + top brands */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section className="border border-white/8 bg-black/40">
            <header className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-5">
              <span className="text-[13px] font-medium text-zinc-200" style={DISPLAY}>
                Останні замовлення
              </span>
              <span className="text-[12px] text-zinc-400" style={DISPLAY}>
                {data.recentOrders.length} нових
              </span>
            </header>
            <ul className="divide-y divide-white/6">
              {data.recentOrders.map((o) => (
                <li
                  key={o.id}
                  className="group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025] sm:grid-cols-[auto_1fr_auto_auto_auto] sm:gap-4 sm:px-5"
                >
                  <span className="text-[12px] font-medium tabular-nums text-blue-400" style={MONO}>
                    {o.id}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block truncate text-[14px] font-medium text-zinc-100"
                      style={DISPLAY}
                    >
                      {o.customer}
                    </span>
                    <span className="block truncate text-[12px] text-zinc-400" style={DISPLAY}>
                      {o.brand} · {o.items} поз.
                    </span>
                  </span>
                  <span
                    className="hidden text-right text-[14px] font-semibold tabular-nums text-zinc-100 sm:block"
                    style={DISPLAY}
                  >
                    {o.total}
                  </span>
                  <span className="hidden sm:block">
                    <StatusIndicator status={o.status} />
                  </span>
                  <span className="text-[12px] tabular-nums text-zinc-500" style={DISPLAY}>
                    {o.date}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-white/8 bg-black/40">
            <header className="border-b border-white/8 px-4 py-3 sm:px-5">
              <span className="text-[13px] font-medium text-zinc-200" style={DISPLAY}>
                Топ бренди
              </span>
            </header>
            <ul className="divide-y divide-white/6">
              {data.topBrands.map((b, i) => (
                <li
                  key={b.name}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] sm:px-5"
                >
                  <span className="w-5 text-[12px] tabular-nums text-zinc-500" style={DISPLAY}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="flex-1 truncate text-[14px] font-medium text-zinc-100"
                    style={DISPLAY}
                  >
                    {b.name}
                  </span>
                  <span className="text-[12px] tabular-nums text-zinc-400" style={DISPLAY}>
                    {b.count} артикулів
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Footer — instrument-style stripe */}
        <footer className="flex items-center justify-between border-t border-white/8 pt-4">
          <span className="text-[12px] text-zinc-500" style={DISPLAY}>
            Демо · мок-дані · 15 травня 2026
          </span>
          <span
            className="flex items-center gap-2 text-[12px] tabular-nums text-zinc-400"
            style={DISPLAY}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
            Синхронізовано 12:42
          </span>
        </footer>
      </div>
    </div>
  );
}

function MechKpi({
  label,
  value,
  previous,
  suffix,
  meta,
  tone,
  invertDelta,
  primary,
}: {
  label: string;
  value: number;
  previous?: number;
  suffix?: string;
  meta?: string;
  tone?: "default" | "accent";
  invertDelta?: boolean;
  /** Marks this card as the dashboard's hero metric — adds a top accent stripe. */
  primary?: boolean;
}) {
  const hasDelta = previous != null && previous !== 0;
  const deltaPct = hasDelta ? ((value - previous) / Math.abs(previous)) * 100 : null;
  const deltaUp = deltaPct != null && deltaPct > 0;
  const deltaGood = invertDelta ? !deltaUp : deltaUp;

  return (
    <div
      className={`group relative border bg-black/40 transition-colors hover:border-white/16 ${
        tone === "accent" ? "border-blue-500/40 bg-blue-500/3" : "border-white/8"
      }`}
    >
      {primary ? (
        <span
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400 to-transparent"
          aria-hidden="true"
        />
      ) : null}
      <div className="border-b border-white/6 px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-zinc-300" style={DISPLAY}>
            {label}
          </span>
          {hasDelta && deltaPct != null ? (
            <span
              className={`flex items-center gap-0.5 text-[12px] font-medium tabular-nums ${
                deltaGood ? "text-green-400" : "text-red-400"
              }`}
              style={DISPLAY}
            >
              {deltaUp ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {Math.abs(deltaPct).toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        <div
          className="flex items-baseline gap-1 text-[32px] font-normal leading-none text-zinc-50 tabular-nums sm:text-[40px]"
          style={CONDENSED}
        >
          {suffix === "₴" ? <span className="text-blue-400">{suffix}</span> : null}
          <span>{formatShort(value)}</span>
          {suffix && suffix !== "₴" ? (
            <span className="text-lg text-zinc-500 sm:text-xl">{suffix}</span>
          ) : null}
        </div>
        {meta ? (
          <div className="mt-2 text-[12px] leading-tight text-zinc-400" style={DISPLAY}>
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusIndicator({
  status,
}: {
  status: "shipped" | "processing" | "delivered" | "pending" | "cancelled";
}) {
  const map = {
    shipped: { dot: "bg-blue-500", text: "text-blue-300", label: "Відправлено" },
    processing: { dot: "bg-amber-400", text: "text-amber-300", label: "В обробці" },
    delivered: { dot: "bg-green-500", text: "text-green-300", label: "Доставлено" },
    pending: { dot: "bg-zinc-500", text: "text-zinc-300", label: "Очікує" },
    cancelled: { dot: "bg-red-500", text: "text-red-300", label: "Скасовано" },
  } as const;
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
      <span className={`text-[12px] font-medium ${m.text}`} style={DISPLAY}>
        {m.label}
      </span>
    </span>
  );
}

function MechHairlineChart({
  data,
}: {
  data: Array<{ month: string; revenue: number; orders: number }>;
}) {
  const w = 720;
  const h = 240;
  const padX = 28;
  const padTop = 36; // room for value labels above peaks
  const padBot = 36;
  const plotH = h - padTop - padBot;
  const plotW = w - padX * 2;

  const max = Math.max(...data.map((d) => d.revenue));
  const min = Math.min(...data.map((d) => d.revenue));
  const range = Math.max(1, max - min);
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padX + i * step,
    // Map value to plot, with 12% headroom and 8% bottom padding for visual breathing room
    y: padTop + plotH - ((d.revenue - min) / range) * plotH * 0.78 - plotH * 0.08,
    raw: d.revenue,
    label: d.month,
    orders: d.orders,
  }));

  const lastIdx = points.length - 1;

  // Smooth Catmull–Rom → cubic bezier path (tension 0.5).
  // Avoids the jagged-polyline look without overshooting like cubic spline.
  function smoothPath(pts: typeof points): string {
    if (pts.length < 2) return "";
    let path = `M ${pts[0].x} ${pts[0].y}`;
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

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[lastIdx].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`;

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Динаміка продажів за 6 місяців"
        className="block h-52 w-full sm:h-60"
      >
        <defs>
          <linearGradient id="mech-chart-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.32" />
            <stop offset="55%" stopColor="rgb(59 130 246)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mech-chart-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(96 165 250)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(147 197 253)" stopOpacity="1" />
          </linearGradient>
          <filter id="mech-chart-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Max reference — hairline at the top of the plot */}
        <line
          x1={padX}
          x2={w - padX}
          y1={padTop}
          y2={padTop}
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="2 4"
        />
        {/* Baseline — slightly stronger */}
        <line
          x1={padX}
          x2={w - padX}
          y1={padTop + plotH}
          y2={padTop + plotH}
          stroke="rgba(255,255,255,0.08)"
        />

        {/* Area fill */}
        <path d={areaPath} fill="url(#mech-chart-area)" />
        {/* Smooth line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#mech-chart-line)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Floating value labels above each point */}
        {points.map((p, i) => {
          const isLatest = i === lastIdx;
          return (
            <text
              key={`val-${i}`}
              x={p.x}
              y={p.y - 14}
              textAnchor="middle"
              fill={isLatest ? "rgb(147 197 253)" : "rgb(228 228 231)"}
              fontSize={isLatest ? "14" : "12"}
              fontWeight={isLatest ? "500" : "400"}
              fontFamily="var(--font-condensed)"
              letterSpacing="0.04em"
            >
              ₴{formatShort(p.raw)}
            </text>
          );
        })}

        {/* Pulsing glow halo behind latest point — communicates "you are here, live" */}
        <circle
          cx={points[lastIdx].x}
          cy={points[lastIdx].y}
          r="9"
          fill="rgb(96 165 250)"
          fillOpacity="0.18"
          filter="url(#mech-chart-glow)"
          className="motion-safe:animate-pulse"
        />

        {/* Data points */}
        {points.map((p, i) => {
          const isLatest = i === lastIdx;
          return (
            <circle
              key={`pt-${i}`}
              cx={p.x}
              cy={p.y}
              r={isLatest ? 4.5 : 2.5}
              fill={isLatest ? "rgb(147 197 253)" : "#0A0A0A"}
              stroke={isLatest ? "rgb(147 197 253)" : "rgb(82 82 91)"}
              strokeWidth={isLatest ? 0 : 1.5}
            />
          );
        })}

        {/* Month labels at bottom */}
        {points.map((p, i) => {
          const isLatest = i === lastIdx;
          return (
            <text
              key={`m-${i}`}
              x={p.x}
              y={h - 16}
              textAnchor="middle"
              fill={isLatest ? "rgb(147 197 253)" : "rgb(113 113 122)"}
              fontSize="10"
              fontFamily="var(--font-mono)"
              letterSpacing="0.18em"
              fontWeight={isLatest ? "500" : "400"}
            >
              {p.label.toUpperCase()}
            </text>
          );
        })}
      </svg>

      {/* Footer chips */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-zinc-400"
        style={DISPLAY}
      >
        <span>
          Максимум ·{" "}
          <span className="font-medium tabular-nums text-zinc-200">₴{formatShort(max)}</span>
        </span>
        <span>
          Замовлень за період ·{" "}
          <span className="font-medium tabular-nums text-zinc-200">{data[lastIdx].orders}</span>
        </span>
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("uk-UA");
}

function formatUah(n: number): string {
  return `₴${n.toLocaleString("uk-UA")}`;
}
