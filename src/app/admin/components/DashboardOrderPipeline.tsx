import Link from 'next/link';

import { cn } from '@/lib/utils';

const CARBON_WEAVE_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 5px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 5px)',
  backgroundBlendMode: 'normal, overlay, overlay',
};

export type PipelineStage = {
  status: string;
  label: string;
  count: number;
  valueSum: number;
  oldestAgeDays: number | null;
  /** if oldestAgeDays > this, render warning */
  warnAgeDays?: number;
};

export function DashboardOrderPipeline({
  stages,
  formatMoney,
  b2cCount,
  b2bCount,
  cancellationRatePct,
}: {
  stages: PipelineStage[];
  formatMoney: (value: number) => string;
  b2cCount: number;
  b2bCount: number;
  cancellationRatePct: number;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-none border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.6)]"
      style={CARBON_WEAVE_STYLE}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-2.5">
        <span className="h-3 w-[3px] rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-100">Order pipeline</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">all-time</span>
      </div>

      <div className="grid grid-cols-2 divide-y divide-white/[0.04] sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-4 xl:grid-cols-6">
        {stages.map((stage) => (
          <StageCell key={stage.status} stage={stage} formatMoney={formatMoney} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.04] bg-black/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em]">
          <span className="text-zinc-500">Split:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
            <span className="text-zinc-300">B2C</span>
            <span className="tabular-nums text-zinc-100">{b2cCount}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-zinc-300">B2B</span>
            <span className="tabular-nums text-zinc-100">{b2bCount}</span>
          </span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums text-zinc-500">
          Cancellation rate (period) <span className={cn(cancellationRatePct > 5 ? 'text-blue-300' : 'text-zinc-200')}>{cancellationRatePct}%</span>
        </div>
      </div>
    </section>
  );
}

function StageCell({
  stage,
  formatMoney,
}: {
  stage: PipelineStage;
  formatMoney: (value: number) => string;
}) {
  const warn = stage.warnAgeDays != null && stage.oldestAgeDays != null && stage.oldestAgeDays > stage.warnAgeDays;
  const dim = stage.count === 0;

  // Build a complete SR-friendly label so the row makes sense without seeing the warning dot.
  const ageLabel =
    stage.oldestAgeDays != null && stage.count > 0
      ? `Oldest order ${stage.oldestAgeDays} days${warn ? ' — warning, exceeds threshold' : ''}.`
      : '';
  const valueLabel = stage.valueSum > 0 ? `Total value ${formatMoney(stage.valueSum)}.` : '';
  const ariaLabel = `${stage.label}: ${stage.count} orders. ${valueLabel} ${ageLabel}`.trim();

  return (
    <Link
      href={`/admin/shop/orders?status=${encodeURIComponent(stage.status)}`}
      aria-label={ariaLabel}
      className={cn(
        'group relative px-4 py-3.5 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset',
        dim && 'opacity-50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">{stage.label}</span>
        {warn ? (
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-zinc-50">{stage.count}</div>
      <div className="mt-1 text-[11px] leading-5 tabular-nums text-zinc-400">
        {stage.valueSum > 0 ? formatMoney(stage.valueSum) : '—'}
      </div>
      {stage.oldestAgeDays != null && stage.count > 0 ? (
        <div className={cn('mt-1 text-[10px] font-semibold uppercase tracking-wider tabular-nums', warn ? 'text-amber-300' : 'text-zinc-500')}>
          Oldest: {stage.oldestAgeDays}d
        </div>
      ) : null}
    </Link>
  );
}
