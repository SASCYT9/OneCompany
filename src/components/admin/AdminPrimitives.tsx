import type { ReactNode } from 'react';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

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
    <section className={cn('flex flex-wrap items-start justify-between gap-5', className)}>
      <div className="max-w-3xl space-y-3">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100/55">{eyebrow}</div>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 md:text-4xl">{title}</h1>
          {description ? <p className="max-w-2xl text-sm leading-6 text-stone-400">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}

export function AdminActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </section>
  );
}

export function AdminEntityToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'sticky top-4 z-20 rounded-[24px] border border-white/10 bg-[#121212]/95 px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </section>
  );
}

export function AdminMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function AdminMetricCard({
  label,
  value,
  meta,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border bg-[#101010] px-4 py-4',
        tone === 'accent' ? 'border-amber-100/15 shadow-[0_0_0_1px_rgba(245,240,232,0.03)]' : 'border-white/8'
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-stone-50">{value}</div>
      {meta ? <div className="mt-2 text-xs text-stone-500">{meta}</div> : null}
    </div>
  );
}

export function AdminFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[24px] border border-white/10 bg-[#101010] px-4 py-4', className)}>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function AdminTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0b]', className)}>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-stone-100">{title}</h2>
          {description ? <p className="text-sm leading-6 text-stone-400">{description}</p> : null}
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
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200/15'
      : tone === 'success'
        ? 'border-emerald-400/15'
        : 'border-white/10';

  return (
    <section className={cn('rounded-[28px] border bg-[#101010] p-5 md:p-6', toneClass, className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-stone-100">{title}</h3>
        {description ? <p className="text-xs leading-5 text-stone-500">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function clampChartValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

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
  const paddingX = 34;
  const paddingTop = 24;
  const paddingBottom = 42;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...chartData.flatMap((entry) => [entry.value, entry.secondaryValue ?? 0]));

  const pointFor = (value: number, index: number) => {
    const x =
      chartData.length <= 1
        ? width / 2
        : paddingX + (index / (chartData.length - 1)) * (width - paddingX * 2);
    const y = paddingTop + plotHeight - (value / maxValue) * plotHeight;
    return { x, y };
  };

  const linePath = (selector: (entry: (typeof chartData)[number]) => number | undefined) =>
    chartData
      .map((entry, index) => {
        const value = selector(entry);
        if (value == null) {
          return '';
        }
        const point = pointFor(value, index);
        return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  const primaryPath = linePath((entry) => entry.value);
  const areaPath = primaryPath
    ? `${primaryPath} L ${pointFor(chartData[chartData.length - 1]?.value ?? 0, chartData.length - 1).x.toFixed(1)} ${height - paddingBottom} L ${pointFor(chartData[0]?.value ?? 0, 0).x.toFixed(1)} ${height - paddingBottom} Z`
    : '';
  const secondaryPath = linePath((entry) => entry.secondaryValue);

  if (!chartData.length) {
    return (
      <div className={cn('rounded-[24px] border border-dashed border-white/10 bg-black/20 px-4 py-12 text-sm text-stone-500', className)}>
        No chart data available.
      </div>
    );
  }

  return (
    <div className={cn('rounded-[24px] border border-white/10 bg-black/20 p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-200" />
            {valueLabel}
          </span>
          {secondaryPath && secondaryLabel ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-stone-400" />
              {secondaryLabel}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-stone-500">Peak {formatCompactNumber(maxValue)}</div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${valueLabel} trend`} className="h-[220px] w-full">
        <defs>
          <linearGradient id="admin-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(253 230 138)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="rgb(253 230 138)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = paddingTop + plotHeight * tick;
          return (
            <line
              key={tick}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}
        {areaPath ? <path d={areaPath} fill="url(#admin-trend-fill)" /> : null}
        {primaryPath ? <path d={primaryPath} fill="none" stroke="rgb(253 230 138)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
        {secondaryPath ? (
          <path d={secondaryPath} fill="none" stroke="rgb(168 162 158)" strokeDasharray="7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        ) : null}
        {chartData.map((entry, index) => {
          const point = pointFor(entry.value, index);
          const showLabel = index === 0 || index === chartData.length - 1 || chartData.length <= 6 || index % Math.ceil(chartData.length / 4) === 0;
          return (
            <g key={`${entry.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r="3.5" fill="rgb(253 230 138)" />
              {showLabel ? (
                <text x={point.x} y={height - 16} textAnchor="middle" fill="rgb(120 113 108)" fontSize="12">
                  {entry.label}
                </text>
              ) : null}
            </g>
          );
        })}
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
        return 'bg-amber-200';
      case 'success':
        return 'bg-emerald-300';
      case 'warning':
        return 'bg-amber-300';
      case 'danger':
        return 'bg-red-300';
      default:
        return 'bg-stone-400';
    }
  };

  if (!normalized.length) {
    return <div className={cn('rounded-[24px] border border-dashed border-white/10 px-4 py-10 text-sm text-stone-500', className)}>No data available.</div>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {normalized.map((entry, index) => {
        const width = `${Math.max(4, (entry.value / maxValue) * 100)}%`;
        return (
          <div key={`${String(entry.label)}-${index}`} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-stone-200">{entry.label}</div>
                {entry.meta ? <div className="mt-0.5 truncate text-xs text-stone-500">{entry.meta}</div> : null}
              </div>
              <div className="shrink-0 text-sm font-medium text-stone-100">{valueFormatter(entry.value)}</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={cn('h-full rounded-full', toneClass(entry.tone))} style={{ width }} />
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
        'group rounded-[24px] border border-white/10 bg-[#101010] px-5 py-5 transition hover:border-amber-100/15 hover:bg-white/[0.03]',
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow ? <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/55">{eyebrow}</div> : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold tracking-tight text-stone-50">{title}</div>
            <p className="mt-1 text-sm leading-6 text-stone-400">{description}</p>
          </div>
          <ArrowLeft className="h-4 w-4 rotate-180 text-stone-500 transition group-hover:text-stone-100" />
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
    <nav className={cn('rounded-[28px] border border-white/10 bg-[#101010] p-3', className)}>
      <div className="space-y-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'w-full rounded-2xl border px-3 py-3 text-left transition',
                active
                  ? 'border-amber-100/15 bg-amber-100/[0.06] text-stone-50'
                  : 'border-transparent text-stone-400 hover:border-white/10 hover:bg-white/[0.03] hover:text-stone-100'
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              {item.description ? <span className="mt-1 block text-xs leading-5 text-stone-500">{item.description}</span> : null}
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
        'sticky top-4 z-20 rounded-[24px] border border-white/10 bg-[#121212]/95 px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur',
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
    <section className={cn('rounded-[28px] border border-red-500/20 bg-red-950/20 p-5 md:p-6', className)}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight text-red-100">{title}</h3>
        <p className="text-sm leading-6 text-red-100/75">{description}</p>
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
    <section className={cn('rounded-[24px] border border-white/10 bg-[#101010] p-5', className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-stone-100">{title}</h2>
        {description ? <p className="text-xs leading-5 text-stone-500">{description}</p> : null}
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
    <dl className={cn('grid gap-3', className)}>
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 rounded-2xl border border-white/8 bg-black/25 px-3 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">{row.label}</dt>
          <dd className="text-sm text-stone-200">{row.value}</dd>
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
        return 'bg-emerald-400';
      case 'warning':
        return 'bg-amber-300';
      case 'danger':
        return 'bg-red-400';
      default:
        return 'bg-stone-500';
    }
  };

  if (!items.length) {
    return (
      <div className={cn('rounded-[24px] border border-dashed border-white/10 bg-[#101010] px-4 py-10 text-sm text-stone-500', className)}>
        {empty}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => (
        <div key={item.id} className="rounded-[24px] border border-white/10 bg-[#101010] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full border border-white/20 bg-black/40">
              <div className={cn('h-full w-full rounded-full', toneClass(item.tone))} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-medium text-stone-100">{item.title}</div>
              {item.meta ? <div className="text-xs text-stone-500">{item.meta}</div> : null}
              {item.body ? <div className="pt-1 text-sm text-stone-300">{item.body}</div> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
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
      ? 'border-red-500/25 bg-red-950/30 text-red-200'
      : tone === 'success'
        ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'
        : 'border-amber-300/20 bg-amber-500/10 text-amber-100';

  return <div className={cn('rounded-2xl border px-4 py-3 text-sm', toneClass, className)}>{children}</div>;
}

export function AdminStatusBadge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300/20 bg-amber-500/10 text-amber-100'
        : tone === 'danger'
          ? 'border-red-500/25 bg-red-950/20 text-red-200'
          : 'border-white/10 bg-white/5 text-stone-200';

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', toneClass)}>{children}</span>;
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
    <div
      className={cn(
        'rounded-[28px] border border-dashed border-white/10 bg-[#101010] px-6 py-16 text-center',
        className
      )}
    >
      <div className="mx-auto max-w-md space-y-3">
        <h2 className="text-lg font-medium text-stone-50">{title}</h2>
        <p className="text-sm leading-6 text-stone-400">{description}</p>
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
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-stone-400 transition hover:text-stone-100">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <AdminPageHeader title={title} description={description} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">{children}</div>
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            {summary}
            <div className="rounded-[28px] border border-white/10 bg-[#101010] p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Editor map</div>
              <nav className="mt-4 space-y-1">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-start gap-3 rounded-2xl border border-transparent px-3 py-2 text-sm text-stone-300 transition hover:border-white/10 hover:bg-white/[0.03] hover:text-stone-100"
                  >
                    <span className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/55">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="space-y-0.5">
                      <span className="block font-medium">{section.label}</span>
                      {section.description ? <span className="block text-xs text-stone-500">{section.description}</span> : null}
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
    <section id={id} className={cn('scroll-mt-24 rounded-[28px] border border-white/10 bg-[#101010] p-5 md:p-6', className)}>
      <div className="mb-5 max-w-2xl space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-stone-50">{title}</h2>
        <p className="text-sm leading-6 text-stone-400">{description}</p>
      </div>
      {children}
    </section>
  );
}
