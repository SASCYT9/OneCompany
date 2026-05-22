import type { ReactNode } from "react";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * KPI card — "Premium Operator Console" direction.
 *
 *  - Hero number: Bebas Neue (condensed display) tabular — reads like an
 *    instrument readout, takes the visual weight.
 *  - Label + meta: Unbounded (display) — distinctive but readable copy.
 *  - Optional thin top accent stripe (`primary`) elevates ONE card per row
 *    to indicate the hero metric without resorting to bigger sizing.
 *  - Optional sparkline anchored to the bottom for trend context.
 */
export function DashboardKpiCard({
  label,
  value,
  current,
  previous,
  meta,
  pills,
  spark,
  tone = "default",
  invertDelta = false,
  icon,
  primary = false,
}: {
  label: string;
  value: ReactNode;
  current?: number;
  previous?: number;
  meta?: ReactNode;
  pills?: Array<{ label: string; value: ReactNode; tone?: "green" | "amber" | "red" | "neutral" }>;
  spark?: number[];
  tone?: "default" | "accent";
  invertDelta?: boolean;
  icon?: ReactNode;
  /** Mark as the row's hero metric — adds a thin blue top stripe. */
  primary?: boolean;
}) {
  const hasDelta = current != null && previous != null && previous !== 0;
  const deltaPct = hasDelta ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const deltaUp = deltaPct != null && deltaPct > 0;
  const deltaFlat = deltaPct != null && Math.abs(deltaPct) < 0.5;
  const deltaIsGood = invertDelta ? !deltaUp : deltaUp;

  const deltaColor = deltaFlat ? "text-zinc-500" : deltaIsGood ? "text-green-400" : "text-red-400";

  const hasSpark = spark && spark.length > 0;

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-none border bg-[#171717] transition-colors duration-200",
        tone === "accent" ? "border-blue-500/30 bg-blue-500/[0.03]" : "border-white/8",
        "hover:border-white/16"
      )}
    >
      {primary ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400 to-transparent"
        />
      ) : null}

      <div
        className={cn("flex flex-1 flex-col px-4 pt-4 sm:px-5", hasSpark ? "pb-3" : "pb-4 sm:pb-5")}
      >
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/15 text-blue-400 [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-[12px] font-medium text-zinc-400">
              {label}
            </div>
            <div className="font-condensed mt-1.5 truncate text-[32px] font-normal leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[40px]">
              {value}
            </div>

            {hasDelta ? (
              <div
                className={cn(
                  "font-display mt-2 flex items-center gap-1 truncate text-[12px] font-medium tabular-nums",
                  deltaColor
                )}
              >
                {deltaFlat ? (
                  <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : deltaUp ? (
                  <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {deltaFlat ? "≈ 0%" : `${deltaPct! > 0 ? "+" : ""}${deltaPct!.toFixed(1)}%`}
                </span>
                <span className="truncate text-[12px] font-normal text-zinc-500">vs прев.</span>
              </div>
            ) : null}

            {meta ? (
              <div
                className={cn(
                  "font-display line-clamp-2 text-[12px] leading-tight text-zinc-400",
                  hasDelta ? "mt-1.5" : "mt-2"
                )}
              >
                {meta}
              </div>
            ) : null}

            {pills && pills.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {pills.map((p, i) => (
                  <span
                    key={i}
                    className={cn(
                      "font-display inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      p.tone === "green" && "border-green-500/25 bg-green-500/10 text-green-300",
                      p.tone === "amber" && "border-amber-500/25 bg-amber-500/10 text-amber-300",
                      p.tone === "red" && "border-red-500/25 bg-red-500/10 text-red-300",
                      (!p.tone || p.tone === "neutral") && "border-white/8 bg-white/4 text-zinc-300"
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

  // Smooth cardinal spline
  let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const t = 0.5;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * t;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * t;
    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Тренд, ${data.length} періодів`}
      className="block h-10 w-full"
    >
      <defs>
        <linearGradient id="oc-kpi-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#oc-kpi-spark)" />
      <path
        d={linePath}
        fill="none"
        stroke="rgb(96 165 250)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
