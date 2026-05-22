"use client";

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import type { MockData } from "./page";

const MONO = { fontFamily: "var(--font-mono)" } as const;
const DISPLAY = { fontFamily: "var(--font-display)" } as const;

/**
 * Variant B — Editorial Console
 *
 * Aesthetic: magazine + automotive coffee-table book. Generous whitespace,
 * massive display headlines, a single hero metric that breaks the grid. Less
 * info-density, more confidence. Hairlines, asymmetric layout, longer
 * pull-quote-like KPI captions.
 */
export function EditorialDashboard({ data }: { data: MockData }) {
  return (
    <div className="relative bg-[#080808] px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
      {/* Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[700px]"
        style={{
          background:
            "radial-gradient(ellipse 900px 500px at 30% 0%, rgba(59,130,246,0.05), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] space-y-10 sm:space-y-14">
        {/* Editorial masthead */}
        <header className="grid gap-4 border-b border-white/8 pb-8 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-blue-500" aria-hidden="true" />
              <span
                className="text-[10px] font-medium uppercase tracking-[0.32em] text-blue-400"
                style={MONO}
              >
                №42 · травень 2026
              </span>
            </div>
            <h1
              className="text-4xl font-light leading-[0.95] tracking-tight text-zinc-50 sm:text-6xl"
              style={DISPLAY}
            >
              Огляд
              <br />
              <span className="font-semibold">бізнесу</span>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400" style={DISPLAY}>
              Стан магазину та CRM за останні 30 днів. Преміум-дистрибуція автокомпонентів для
              серйозних дилерів.
            </p>
          </div>
          <div className="flex flex-row gap-6 text-right sm:flex-col sm:gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={MONO}>
                Дата
              </div>
              <div className="text-xs tabular-nums text-zinc-300" style={MONO}>
                2026-05-15 · 12:42
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={MONO}>
                Період
              </div>
              <div className="text-xs tabular-nums text-zinc-300" style={MONO}>
                Останні 30 днів
              </div>
            </div>
          </div>
        </header>

        {/* HERO metric — breaks the grid */}
        <section className="grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-12">
          <article className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500" style={MONO}>
                Revenue · UAH · period
              </span>
              <DeltaBadge current={data.revenue} previous={data.revenuePrev} />
            </div>
            <div
              className="text-[80px] font-light leading-[0.92] tracking-tighter text-zinc-50 tabular-nums sm:text-[120px]"
              style={DISPLAY}
            >
              <span className="text-blue-400">₴</span>
              {formatLong(data.revenue)}
            </div>
            <div
              className="grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-400"
              style={DISPLAY}
            >
              <div>
                <span className="text-zinc-600">AOV ·</span> ₴{data.aov.toLocaleString("uk-UA")}
              </div>
              <div>
                <span className="text-zinc-600">Замовлень ·</span> {data.orders}
              </div>
              <div>
                <span className="text-zinc-600">Магазин ·</span> {data.shopActive} активних
              </div>
              <div>
                <span className="text-zinc-600">CRM ·</span> {data.crmActive} активних
              </div>
            </div>
          </article>

          <aside className="grid grid-cols-2 gap-4 self-end lg:grid-cols-1 lg:gap-6">
            <EditorialKpi
              label="Прибуток CRM"
              value={`$${formatShort(data.profit)}`}
              current={data.profit}
              previous={data.profitPrev}
              meta={`Маржа ${data.marginPct}%`}
            />
            <EditorialKpi
              label="Заборгованість"
              value={`$${formatShort(data.debt)}`}
              meta={`${data.debtors} боржників`}
              invertDelta
            />
          </aside>
        </section>

        {/* Sales chart — editorial styling */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-3">
            <h2 className="text-2xl font-light tracking-tight text-zinc-50" style={DISPLAY}>
              Динаміка <span className="font-semibold">продажів</span>
            </h2>
            <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={MONO}>
              6 місяців · uah
            </span>
          </div>
          <EditorialChart data={data.sales} />
        </section>

        {/* Pipeline — typographic, less grid-y */}
        <section className="space-y-4">
          <h2 className="text-2xl font-light tracking-tight text-zinc-50" style={DISPLAY}>
            Воронка <span className="font-semibold">замовлень</span>
          </h2>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.pipeline.map((stage) => {
              const warn = stage.oldestDays != null && stage.oldestDays > 7;
              return (
                <div
                  key={stage.status}
                  className="group flex items-baseline gap-4 border-b border-white/6 py-4 transition-colors hover:border-blue-500/30"
                >
                  <div
                    className="w-16 text-5xl font-light leading-none tabular-nums text-zinc-50 sm:w-20 sm:text-6xl"
                    style={DISPLAY}
                  >
                    {stage.count}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200" style={DISPLAY}>
                      {stage.label}
                    </div>
                    <div
                      className={`mt-0.5 text-[10px] uppercase tracking-wider ${
                        warn ? "text-amber-400" : "text-zinc-500"
                      }`}
                      style={MONO}
                    >
                      {stage.oldestDays != null && stage.count > 0
                        ? `найстаріше · ${stage.oldestDays}d${warn ? " · потребує уваги" : ""}`
                        : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent orders + Top brands */}
        <section className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-12">
          <article className="space-y-5">
            <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-3">
              <h2 className="text-2xl font-light tracking-tight text-zinc-50" style={DISPLAY}>
                Останні <span className="font-semibold">замовлення</span>
              </h2>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                style={MONO}
              >
                всі
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            <ul className="divide-y divide-white/8">
              {data.recentOrders.map((o) => (
                <li
                  key={o.id}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[auto_1fr_auto_auto]"
                >
                  <span className="font-medium text-blue-400 tabular-nums" style={MONO}>
                    #{o.id.replace("OC-", "")}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-zinc-100" style={DISPLAY}>
                      {o.customer}
                    </div>
                    <div
                      className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-zinc-500"
                      style={MONO}
                    >
                      {o.brand} · {o.items} pcs · {o.date}
                    </div>
                  </div>
                  <span
                    className="hidden text-right text-base font-medium tabular-nums text-zinc-100 sm:block"
                    style={DISPLAY}
                  >
                    {o.total}
                  </span>
                  <EditorialStatusPill status={o.status} />
                </li>
              ))}
            </ul>
          </article>

          <aside className="space-y-5">
            <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-3">
              <h2 className="text-xl font-light tracking-tight text-zinc-50" style={DISPLAY}>
                Топ <span className="font-semibold">бренди</span>
              </h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500" style={MONO}>
                за SKU
              </span>
            </div>
            <ul className="space-y-3">
              {data.topBrands.map((b, i) => {
                const max = data.topBrands[0].count;
                const pct = (b.count / max) * 100;
                return (
                  <li
                    key={b.name}
                    className="group relative grid grid-cols-[2ch_1fr_auto] items-center gap-3"
                  >
                    <span className="text-xs text-zinc-600 tabular-nums" style={MONO}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="relative h-7 overflow-hidden border-b border-white/6">
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 bg-blue-500/15 transition-all group-hover:bg-blue-500/25"
                        style={{ width: `${pct}%` }}
                      />
                      <span
                        className="relative flex h-full items-center px-2 text-sm font-medium text-zinc-100"
                        style={DISPLAY}
                      >
                        {b.name}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-zinc-400" style={MONO}>
                      {b.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </aside>
        </section>

        {/* Editorial footer */}
        <footer className="border-t border-white/8 pt-6 text-center">
          <div className="text-[10px] uppercase tracking-[0.32em] text-zinc-600" style={MONO}>
            OneCompany · Premium Automotive Distribution · since 2019
          </div>
        </footer>
      </div>
    </div>
  );
}

function EditorialKpi({
  label,
  value,
  current,
  previous,
  meta,
  invertDelta,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  meta?: string;
  invertDelta?: boolean;
}) {
  return (
    <div className="border-l border-white/12 pl-5">
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500"
        style={MONO}
      >
        {label}
        {current != null && previous != null ? (
          <DeltaBadge current={current} previous={previous} invert={invertDelta} mini />
        ) : null}
      </div>
      <div
        className="mt-2 text-4xl font-light leading-none tracking-tight text-zinc-50 tabular-nums sm:text-5xl"
        style={DISPLAY}
      >
        {value}
      </div>
      {meta ? (
        <div className="mt-2 text-xs text-zinc-500" style={DISPLAY}>
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function DeltaBadge({
  current,
  previous,
  invert,
  mini,
}: {
  current: number;
  previous: number;
  invert?: boolean;
  mini?: boolean;
}) {
  if (!previous) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${mini ? "text-[10px]" : "text-xs"} tabular-nums ${
        good ? "text-green-400" : "text-red-400"
      }`}
      style={MONO}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function EditorialStatusPill({
  status,
}: {
  status: "shipped" | "processing" | "delivered" | "pending" | "cancelled";
}) {
  const map = {
    shipped: "Відправлено",
    processing: "В обробці",
    delivered: "Доставлено",
    pending: "Очікує",
    cancelled: "Скасовано",
  } as const;
  const tone = {
    shipped: "text-blue-300",
    processing: "text-amber-300",
    delivered: "text-green-300",
    pending: "text-zinc-400",
    cancelled: "text-red-300",
  } as const;
  return (
    <span className={`text-[11px] uppercase tracking-wider ${tone[status]}`} style={MONO}>
      {map[status]}
    </span>
  );
}

function EditorialChart({
  data,
}: {
  data: Array<{ month: string; revenue: number; orders: number }>;
}) {
  const w = 900;
  const h = 280;
  const padX = 60;
  const padTop = 20;
  const padBot = 40;
  const plotH = h - padTop - padBot;
  const plotW = w - padX * 2;
  const max = Math.max(...data.map((d) => d.revenue));
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padX + i * step,
    y: padTop + plotH - (d.revenue / max) * plotH * 0.85,
    raw: d.revenue,
    label: d.month,
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full sm:h-72">
      <defs>
        <linearGradient id="ed-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ed-area)" />
      <path d={path} fill="none" stroke="rgb(96 165 250)" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#080808" stroke="rgb(96 165 250)" strokeWidth="2" />
          <text
            x={p.x}
            y={p.y - 14}
            textAnchor="middle"
            fill="rgb(228 228 231)"
            fontSize="13"
            fontFamily="var(--font-display)"
            fontWeight="300"
          >
            ₴{formatShort(p.raw)}
          </text>
          <text
            x={p.x}
            y={h - 14}
            textAnchor="middle"
            fill="rgb(113 113 122)"
            fontSize="10"
            fontFamily="var(--font-mono)"
            letterSpacing="0.16em"
          >
            {p.label.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}

function formatLong(n: number): string {
  return n.toLocaleString("uk-UA").replace(/ /g, " ");
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("uk-UA");
}
