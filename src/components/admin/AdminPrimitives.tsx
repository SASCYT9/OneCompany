import type { ReactNode } from 'react';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * "OneCompany Blue" — premium dark with single blue accent.
 * See src/lib/admin/adminTheme.ts for color tokens.
 *
 * Geometry: 12px card radius (rounded-xl), full pills for status badges.
 * Backgrounds are pure warm-black surfaces; no carbon weave.
 */

const SURFACE = 'bg-[#171717]';
const SURFACE_HOVER = 'hover:bg-[#1F1F1F]';
const BORDER = 'border-white/[0.05]';
const BORDER_HOVER = 'hover:border-white/[0.10]';

export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1640px] px-4 py-6 md:px-8 xl:px-10', className)}>{children}</div>;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-wrap items-start justify-between gap-4 pb-2 sm:gap-6', className)}>
      <div className="min-w-0 max-w-3xl flex-1 space-y-2">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-wider text-blue-400 sm:text-xs">{eyebrow}</div>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl md:text-[32px]">{title}</h1>
          {description ? <p className="max-w-2xl text-sm leading-6 text-zinc-400">{description}</p> : null}
        </div>
      </div>
      {actions ? (
        <div className="-mx-4 flex w-full items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

export function AdminActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-[#171717] px-4 py-3.5', BORDER, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </section>
  );
}

export function AdminEntityToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'sticky top-4 z-20 rounded-xl border border-white/[0.08] bg-[#171717]/95 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </section>
  );
}

export function AdminMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

/**
 * KPI card matching the reference design:
 *  - Small blue circular icon top-left
 *  - LABEL eyebrow
 *  - Big tabular number
 *  - Optional ↗ delta% vs prev period (colored)
 *  - Optional bottom line-area sparkline (blue gradient)
 */
export function AdminMetricCard({
  label,
  value,
  meta,
  tone = 'default',
  spark,
  icon,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: 'default' | 'accent';
  spark?: number[];
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-[#171717] px-5 pt-5 transition-all duration-200',
        tone === 'accent' ? 'border-blue-500/25' : BORDER,
        'hover:border-white/[0.12]',
        spark && spark.length > 0 ? 'pb-0' : 'pb-5'
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/15 text-blue-400 [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-500">{label}</div>
          <div className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-zinc-50">
            {value}
          </div>
          {meta ? <div className="mt-1.5 text-xs leading-5 text-zinc-500">{meta}</div> : null}
        </div>
      </div>

      {spark && spark.length > 0 ? (
        <div className="mt-4 -mx-5 -mb-px">
          <SparkLine data={spark} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Line + area sparkline matching the reference (blue stroke, blue gradient fill).
 */
function SparkLine({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 280;
  const h = 56;
  const max = Math.max(1, ...data.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0)));
  const min = Math.min(0, ...data.map((v) => (Number.isFinite(v) ? v : 0)));
  const range = max - min || 1;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => {
    const value = Number.isFinite(v) ? v : 0;
    const x = i * step;
    const y = h - ((value - min) / range) * h * 0.85 - h * 0.05;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend sparkline, ${data.length} periods`}
      className="block h-14 w-full"
    >
      <defs>
        <linearGradient id="oc-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#oc-spark-fill)" />
      <path d={linePath} fill="none" stroke="rgb(96 165 250)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-[#171717] px-4 py-3', BORDER, className)}>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function AdminTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-[#171717]', BORDER, className)}>
      {children}
    </div>
  );
}

export function AdminDashboardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">{title}</h2>
          {description ? <p className="text-sm leading-6 text-zinc-400">{description}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminInsightPanel({
  title,
  description,
  tone = 'default',
  children,
  className,
}: {
  title: string;
  description?: string;
  tone?: 'default' | 'warning' | 'success';
  children: ReactNode;
  className?: string;
}) {
  const toneBorder =
    tone === 'warning'
      ? 'border-amber-500/25'
      : tone === 'success'
        ? 'border-green-500/25'
        : BORDER;

  return (
    <section className={cn('rounded-xl border bg-[#171717] p-5 md:p-6', toneBorder, className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>
        {description ? <p className="text-xs leading-5 text-zinc-500">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function clampChartValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

/**
 * Bar chart matching the reference: vertical solid blue bars with subtle
 * top highlight. Optional secondary line overlay.
 */
export function AdminTrendChart({
  data,
  valueLabel = 'Revenue',
  secondaryLabel,
  className,
}: {
  data: Array<{ label: string; value: number; secondaryValue?: number }>;
  valueLabel?: string;
  secondaryLabel?: string;
  className?: string;
}) {
  const chartData = data.map((entry) => ({
    ...entry,
    value: clampChartValue(entry.value),
    secondaryValue: entry.secondaryValue == null ? undefined : clampChartValue(entry.secondaryValue),
  }));
  const width = 640;
  const height = 220;
  const paddingX = 24;
  const paddingTop = 16;
  const paddingBottom = 38;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...chartData.flatMap((entry) => [entry.value, entry.secondaryValue ?? 0]));

  if (!chartData.length) {
    return (
      <div className={cn('rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-4 py-12 text-sm text-zinc-500', className)}>
        No chart data available.
      </div>
    );
  }

  const slotWidth = (width - paddingX * 2) / chartData.length;
  const barWidth = Math.max(4, slotWidth * 0.62);
  const barGap = (slotWidth - barWidth) / 2;

  const linePath = (selector: (entry: (typeof chartData)[number]) => number | undefined) =>
    chartData
      .map((entry, index) => {
        const value = selector(entry);
        if (value == null) return '';
        const x = paddingX + index * slotWidth + slotWidth / 2;
        const y = paddingTop + plotHeight - (value / maxValue) * plotHeight;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  const secondaryPath = linePath((entry) => entry.secondaryValue);
  const hasSecondary = chartData.some((d) => d.secondaryValue != null);

  return (
    <div className={cn('rounded-xl border border-white/[0.05] bg-[#171717] p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
            <span className="font-medium">{valueLabel}</span>
          </span>
          {hasSecondary && secondaryLabel ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-[2px] w-3 bg-zinc-400" />
              <span className="font-medium">{secondaryLabel}</span>
            </span>
          ) : null}
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">Peak {formatCompactNumber(maxValue)}</div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${valueLabel} trend`} className="h-[220px] w-full">
        <defs>
          <linearGradient id="oc-bar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(96 165 250)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgb(37 99 235)" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((tick) => {
          const y = paddingTop + plotHeight * tick;
          return (
            <line
              key={tick}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          );
        })}
        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={paddingTop + plotHeight}
          y2={paddingTop + plotHeight}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {chartData.map((entry, index) => {
          const x = paddingX + index * slotWidth + barGap;
          const barH = (entry.value / maxValue) * plotHeight;
          const y = paddingTop + plotHeight - barH;
          const showLabel = index === 0 || index === chartData.length - 1 || chartData.length <= 6 || index % Math.ceil(chartData.length / 4) === 0;
          return (
            <g key={`${entry.label}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={Math.max(2, barH)} fill="url(#oc-bar)" rx="2" />
              {showLabel ? (
                <text x={x + barWidth / 2} y={height - 14} textAnchor="middle" fill="rgb(113 113 122)" fontSize="10" fontWeight="500">
                  {entry.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {secondaryPath ? (
          <path d={secondaryPath} fill="none" stroke="rgb(161 161 170)" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="1.5" opacity="0.7" />
        ) : null}
      </svg>
    </div>
  );
}

export function AdminBarList({
  data,
  valueFormatter = formatCompactNumber,
  className,
}: {
  data: Array<{ label: ReactNode; value: number; meta?: ReactNode; tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger' }>;
  valueFormatter?: (value: number) => ReactNode;
  className?: string;
}) {
  const normalized = data.map((entry) => ({ ...entry, value: clampChartValue(entry.value) }));
  const maxValue = Math.max(1, ...normalized.map((entry) => entry.value));
  const toneClass = (tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger') => {
    switch (tone) {
      case 'accent':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-amber-500';
      case 'danger':
        return 'bg-red-500';
      default:
        return 'bg-zinc-500';
    }
  };

  if (!normalized.length) {
    return <div className={cn('rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-sm text-zinc-500', className)}>No data available.</div>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {normalized.map((entry, index) => {
        const width = `${Math.max(4, (entry.value / maxValue) * 100)}%`;
        return (
          <div key={`${String(entry.label)}-${index}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-100">{entry.label}</div>
                {entry.meta ? <div className="mt-0.5 truncate text-xs text-zinc-500">{entry.meta}</div> : null}
              </div>
              <div className="shrink-0 text-sm font-semibold tabular-nums text-zinc-50">{valueFormatter(entry.value)}</div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div className={cn('h-full rounded-full transition-all duration-500', toneClass(entry.tone))} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminFunnelChart({
  data,
  className,
}: {
  data: Array<{ label: string; value: number; tone?: 'default' | 'success' | 'warning' | 'danger' }>;
  className?: string;
}) {
  return (
    <AdminBarList
      className={className}
      data={data.map((entry) => ({
        label: entry.label,
        value: entry.value,
        meta: 'orders',
        tone: entry.tone ?? 'default',
      }))}
    />
  );
}

export function AdminQuickActionGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-3', className)}>{children}</div>;
}

export function AdminQuickActionCard({
  href,
  eyebrow,
  title,
  description,
  className,
}: {
  href: string;
  eyebrow?: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-[#171717] px-5 py-5 transition-all duration-200',
        BORDER,
        'hover:border-blue-500/30 hover:bg-[#1A1A1A]',
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow ? <div className="text-xs font-medium uppercase tracking-wider text-blue-400">{eyebrow}</div> : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold tracking-tight text-zinc-50">{title}</div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-zinc-400 transition-all group-hover:bg-blue-600/15 group-hover:text-blue-400">
            <ArrowLeft className="h-4 w-4 rotate-180 transition-all motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AdminSettingsShell({
  navigation,
  content,
  sidebar,
  className,
}: {
  navigation: ReactNode;
  content: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_300px]', className)}>
      <aside className="xl:sticky xl:top-24 xl:self-start">{navigation}</aside>
      <div className="min-w-0 space-y-6">{content}</div>
      {sidebar ? <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">{sidebar}</aside> : null}
    </div>
  );
}

export function AdminSettingsNav({
  items,
  activeId,
  onChange,
  className,
}: {
  items: Array<{ id: string; label: string; description?: string }>;
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn('rounded-xl border bg-[#171717] p-2', BORDER, className)}>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'w-full rounded-lg px-3.5 py-2.5 text-left transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              {item.description ? <span className="mt-0.5 block text-xs leading-5 opacity-75">{item.description}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminStickyActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'sticky top-4 z-20 rounded-xl border border-white/[0.08] bg-[#171717]/95 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </section>
  );
}

export function AdminDangerZone({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-red-500/25 bg-red-950/20 p-5 md:p-6', className)}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight text-red-100">{title}</h3>
        <p className="text-sm leading-6 text-red-200/80">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminSplitDetailShell({
  main,
  sidebar,
  className,
}: {
  main: ReactNode;
  sidebar: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]', className)}>
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">{sidebar}</aside>
    </div>
  );
}

export function AdminInspectorCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-[#171717] p-5', BORDER, className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
        {description ? <p className="text-xs leading-5 text-zinc-500">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminKeyValueGrid({
  rows,
  className,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-1', className)}>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 rounded-lg bg-black/20 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{row.label}</dt>
          <dd className="text-sm font-medium text-zinc-100 [&_*]:tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminTimelineList({
  items,
  empty,
  className,
}: {
  items: Array<{
    id: string;
    title: ReactNode;
    meta?: ReactNode;
    body?: ReactNode;
    tone?: 'default' | 'success' | 'warning' | 'danger';
  }>;
  empty: ReactNode;
  className?: string;
}) {
  const toneClass = (tone?: 'default' | 'success' | 'warning' | 'danger') => {
    switch (tone) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-amber-500';
      case 'danger':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (!items.length) {
    return (
      <div className={cn('rounded-xl border border-dashed border-white/[0.08] bg-[#171717] px-4 py-10 text-sm text-zinc-500', className)}>
        {empty}
      </div>
    );
  }

  return (
    <ul className={cn('space-y-1.5 list-none', className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className={cn('rounded-xl border bg-[#171717] px-4 py-3 transition-colors', BORDER, BORDER_HOVER)}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1.5 h-2 w-2 rounded-full" aria-hidden="true">
              <div className={cn('h-full w-full rounded-full', toneClass(item.tone))} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-medium text-zinc-100">{item.title}</div>
              {item.meta ? <div className="text-xs text-zinc-500">{item.meta}</div> : null}
              {item.body ? <div className="pt-1 text-sm text-zinc-300">{item.body}</div> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminInlineAlert({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success' | 'warning';
  children: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/30 bg-red-950/30 text-red-100'
      : tone === 'success'
        ? 'border-green-500/30 bg-green-950/30 text-green-100'
        : 'border-amber-500/30 bg-amber-950/20 text-blue-300';

  const ariaLive = tone === 'error' ? 'assertive' : 'polite';
  const ariaRole = tone === 'error' ? 'alert' : 'status';
  const tonePrefix = tone === 'error' ? 'Error: ' : tone === 'success' ? 'Success: ' : 'Warning: ';

  return (
    <div role={ariaRole} aria-live={ariaLive} aria-atomic="true" className={cn('rounded-lg border px-4 py-3 text-sm', toneClass, className)}>
      <span className="sr-only">{tonePrefix}</span>
      {children}
    </div>
  );
}

/**
 * Pill-shaped status badge matching the reference (Shipped/Processing/Delivered).
 */
export function AdminStatusBadge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-green-500/25 bg-green-500/10 text-green-300'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
        : tone === 'danger'
          ? 'border-red-500/25 bg-red-500/10 text-red-300'
          : 'border-white/[0.08] bg-white/[0.04] text-zinc-300';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium', toneClass)}>
      {children}
    </span>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-dashed border-white/[0.08] bg-[#171717] px-6 py-16 text-center', className)}>
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/15">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
        <p className="text-sm leading-6 text-zinc-400">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export type AdminEditorNavSection = {
  id: string;
  label: string;
  description?: string;
};

export function AdminEditorShell({
  backHref,
  backLabel,
  title,
  description,
  sections,
  summary,
  children,
  className,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  sections: AdminEditorNavSection[];
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminPage className={className}>
      <div className="space-y-6">
        <div className="space-y-4">
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-blue-400">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <AdminPageHeader title={title} description={description} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">{children}</div>
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            {summary}
            <div className={cn('rounded-xl border bg-[#171717] p-4', BORDER)}>
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Editor map</div>
              <nav className="mt-3 space-y-0.5">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-start gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-zinc-50"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-600/15 text-[10px] font-semibold tabular-nums text-blue-400 transition-colors group-hover:bg-blue-600/25 group-hover:text-blue-300">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="space-y-0.5">
                      <span className="block font-medium">{section.label}</span>
                      {section.description ? <span className="block text-xs leading-5 text-zinc-500">{section.description}</span> : null}
                    </span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </AdminPage>
  );
}

export function AdminEditorSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-24 rounded-xl border bg-[#171717] p-5 md:p-6', BORDER, className)}>
      <div className="mb-5 max-w-2xl space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-50">{title}</h2>
        <p className="text-sm leading-6 text-zinc-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type AdminButtonSize = 'sm' | 'md' | 'lg';

export function AdminButton({
  children,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  href,
  onClick,
  disabled,
  loading,
  icon,
  className,
}: {
  children: ReactNode;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  type?: 'button' | 'submit' | 'reset';
  href?: string;
  onClick?: (event: React.MouseEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const sizeClass =
    size === 'sm'
      ? 'h-8 px-3 text-xs'
      : size === 'lg'
        ? 'h-11 px-5 text-sm'
        : 'h-9 px-4 text-[13px]';

  const variantClass =
    variant === 'primary'
      ? 'bg-blue-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-blue-500 motion-safe:active:translate-y-px'
      : variant === 'danger'
        ? 'border border-blue-500/30 bg-blue-950/30 text-red-100 hover:border-blue-500/50 hover:bg-red-950/50'
        : variant === 'ghost'
          ? 'text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-50'
          : 'border border-white/[0.1] bg-white/[0.03] text-zinc-100 hover:border-white/20 hover:bg-white/[0.06]';

  const baseClass = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    sizeClass,
    variantClass,
    className
  );

  const content = (
    <>
      {loading ? (
        <span className="h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : icon ? (
        <span className="flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={baseClass}>
      {content}
    </button>
  );
}

export function AdminCardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-[#171717] p-5 md:p-6', BORDER, className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-zinc-50">{title}</h3>
          {description ? <p className="text-sm leading-6 text-zinc-400">{description}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminSwitch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled && 'opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]',
          checked ? 'border-blue-500/50 bg-blue-600' : 'border-white/[0.1] bg-white/[0.05]'
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
      {label || description ? (
        <span className="space-y-0.5 text-sm">
          {label ? <span className="block font-medium text-zinc-100">{label}</span> : null}
          {description ? <span className="block text-xs leading-5 text-zinc-500">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
