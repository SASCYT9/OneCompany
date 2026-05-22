import Link from "next/link";

import { cn } from "@/lib/utils";

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
    <section className="relative overflow-hidden rounded-none border border-white/5 bg-[#171717]">
      <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold tracking-tight text-zinc-100">
          Воронка замовлень
        </h3>
        <span className="font-display text-[12px] text-zinc-500">всі</span>
      </div>

      <div className="grid grid-cols-2 divide-y divide-white/4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-4 xl:grid-cols-6">
        {stages.map((stage) => (
          <StageCell key={stage.status} stage={stage} formatMoney={formatMoney} />
        ))}
      </div>

      <div className="font-display flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-black/20 px-4 py-3 text-[12px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-zinc-500">Розподіл:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
            <span className="text-zinc-300">B2C</span>
            <span className="font-medium tabular-nums text-zinc-100">{b2cCount}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-zinc-300">B2B</span>
            <span className="font-medium tabular-nums text-zinc-100">{b2bCount}</span>
          </span>
        </div>
        <div className="tabular-nums text-zinc-500">
          Скасування за період{" "}
          <span
            className={cn(
              "font-medium",
              cancellationRatePct > 5 ? "text-amber-300" : "text-zinc-200"
            )}
          >
            {cancellationRatePct}%
          </span>
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
  const warn =
    stage.warnAgeDays != null &&
    stage.oldestAgeDays != null &&
    stage.oldestAgeDays > stage.warnAgeDays;
  const dim = stage.count === 0;

  // Build a complete SR-friendly label so the row makes sense without seeing the warning dot.
  const ageLabel =
    stage.oldestAgeDays != null && stage.count > 0
      ? `Oldest order ${stage.oldestAgeDays} days${warn ? " — warning, exceeds threshold" : ""}.`
      : "";
  const valueLabel = stage.valueSum > 0 ? `Total value ${formatMoney(stage.valueSum)}.` : "";
  const ariaLabel = `${stage.label}: ${stage.count} orders. ${valueLabel} ${ageLabel}`.trim();

  return (
    <Link
      href={`/admin/shop/orders?status=${encodeURIComponent(stage.status)}`}
      aria-label={ariaLabel}
      className={cn(
        "group relative px-4 py-3.5 transition-colors hover:bg-white/[0.025] focus-visible:outline-hidden focus-visible:bg-white/4 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-inset",
        dim && "opacity-50"
      )}
    >
      {warn ? (
        <span className="absolute inset-y-0 left-0 w-px bg-amber-400/70" aria-hidden="true" />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="font-display truncate text-[13px] font-medium tracking-tight text-zinc-300">
          {stage.label}
        </span>
        {warn ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
        ) : null}
      </div>
      <div className="font-condensed mt-2 text-[28px] font-normal leading-none tabular-nums text-zinc-50 sm:text-[32px]">
        {stage.count}
      </div>
      <div className="font-display mt-1 text-[12px] tabular-nums text-zinc-500">
        {stage.valueSum > 0 ? formatMoney(stage.valueSum) : "—"}
      </div>
      {stage.oldestAgeDays != null && stage.count > 0 ? (
        <div
          className={cn(
            "font-display mt-1 text-[12px] leading-tight",
            warn ? "font-medium text-amber-300" : "text-zinc-400"
          )}
        >
          <span className="text-zinc-500">найстаріше</span>{" "}
          <span className="tabular-nums">{stage.oldestAgeDays} дн</span>
        </div>
      ) : null}
    </Link>
  );
}
