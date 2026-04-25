import type { ReactNode } from 'react';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * KPI card matching the OneCompany reference:
 *  - Blue circular icon top-left
 *  - Label · big tabular value
 *  - Optional ↗/↘ delta% vs prev period (compact, single line)
 *  - Optional meta text (truncated to 2 lines)
 *  - Optional bottom blue line+area sparkline edge-to-edge
 *
 * Cards use flex column with the spark anchored to the bottom so heights
 * stay equal in a 6-column grid.
 */
export function DashboardKpiCard({
  label,
  value,
  current,
  previous,
  meta,
  pills,
  spark,
  tone = 'default',
  invertDelta = false,
  icon,
}: {
  label: string;
  value: ReactNode;
  current?: number;
  previous?: number;
  meta?: ReactNode;
  pills?: Array<{ label: string; value: ReactNode; tone?: 'green' | 'amber' | 'red' | 'neutral' }>;
  spark?: number[];
  tone?: 'default' | 'accent';
  invertDelta?: boolean;
  icon?: ReactNode;
}) {
  const hasDelta = current != null && previous != null && previous !== 0;
  const deltaPct = hasDelta ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const deltaUp = deltaPct != null && deltaPct > 0;
  const deltaFlat = deltaPct != null && Math.abs(deltaPct) < 0.5;
  const deltaIsGood = invertDelta ? !deltaUp : deltaUp;

  const deltaColor = deltaFlat ? 'text-zinc-500' : deltaIsGood ? 'text-green-400' : 'text-red-400';

  const hasSpark = spark && spark.length > 0;

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-[#171717] transition-all duration-200',
        tone === 'accent' ? 'border-blue-500/25' : 'border-white/[0.05]',
        'hover:border-white/[0.12]'
      )}
    >
      <div className={cn('flex flex-1 flex-col px-5 pt-5', hasSpark ? 'pb-3' : 'pb-5')}>
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/15 text-blue-400 [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-zinc-500">{label}</div>
            <div className="mt-1.5 truncate text-[26px] font-semibold leading-none tracking-tight tabular-nums text-zinc-50">
              {value}
            </div>

            {hasDelta ? (
              <div className={cn('mt-1.5 flex items-center gap-1 truncate text-[11px] font-medium tabular-nums', deltaColor)}>
                {deltaFlat ? (
                  <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : deltaUp ? (
                  <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span>{deltaFlat ? '~0%' : `${deltaPct! > 0 ? '+' : ''}${deltaPct!.toFixed(1)}%`}</span>
                <span className="truncate text-[11px] font-normal text-zinc-500">vs prev</span>
              </div>
            ) : null}

            {meta ? (
              <div className={cn('line-clamp-2 text-[11px] leading-[16px] text-zinc-500', hasDelta ? 'mt-1' : 'mt-1.5')}>
                {meta}
              </div>
            ) : null}

            {pills && pills.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {pills.map((p, i) => (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
                      p.tone === 'green' && 'border-green-500/25 bg-green-500/10 text-green-300',
                      p.tone === 'amber' && 'border-amber-500/25 bg-amber-500/10 text-amber-300',
                      p.tone === 'red' && 'border-red-500/25 bg-red-500/10 text-red-300',
                      (!p.tone || p.tone === 'neutral') && 'border-white/[0.08] bg-white/[0.04] text-zinc-300'
                    )}
                  >
                    <span className="text-zinc-500">{p.label}</span>
                    <span>{p.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasSpark ? (
        <div className="mt-auto">
          <SparkLine data={spark} />
        </div>
      ) : null}
    </div>
  );
}

function SparkLine({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 320;
  const h = 40;
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
      className="block h-10 w-full"
    >
      <defs>
        <linearGradient id="oc-kpi-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#oc-kpi-spark)" />
      <path d={linePath} fill="none" stroke="rgb(96 165 250)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
