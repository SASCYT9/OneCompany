import Link from 'next/link';

import { cn } from '@/lib/utils';

const CARBON_WEAVE_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 5px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 5px)',
  backgroundBlendMode: 'normal, overlay, overlay',
};

export type HealthLevel = 'green' | 'amber' | 'red';

export type HealthLight = {
  id: string;
  label: string;
  level: HealthLevel;
  detail: string;
  href?: string;
};

/**
 * Horizontal banner of operational health lights — answers "how is everything working".
 */
export function DashboardOpsHealthBanner({ lights }: { lights: HealthLight[] }) {
  return (
    <section
      className="relative overflow-hidden rounded-none border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.6)]"
      style={CARBON_WEAVE_STYLE}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-2.5">
        <span className="h-3 w-[3px] rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-100">Operations health</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">live</span>
      </div>
      <div className="grid grid-cols-2 divide-y divide-white/[0.04] sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
        {lights.map((light) => (
          <HealthLightCell key={light.id} light={light} />
        ))}
      </div>
    </section>
  );
}

function HealthLightCell({ light }: { light: HealthLight }) {
  const dotClass =
    light.level === 'green'
      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]'
      : light.level === 'amber'
        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';

  const stripeClass =
    light.level === 'green'
      ? 'bg-green-500'
      : light.level === 'amber'
        ? 'bg-amber-400'
        : 'bg-red-500';

  // For screen readers: spell out severity since color alone is insufficient.
  const statusText =
    light.level === 'green' ? 'Healthy' : light.level === 'amber' ? 'Warning' : 'Critical';

  const inner = (
    <div className="relative h-full px-4 py-3.5 transition-colors hover:bg-white/[0.025]">
      <span className={cn('absolute left-0 top-0 h-full w-[2px]', stripeClass)} aria-hidden="true" />
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', dotClass)} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">{light.label}</span>
        <span className="sr-only">: status {statusText}.</span>
      </div>
      <div className="mt-1.5 text-xs leading-5 text-zinc-400">{light.detail}</div>
    </div>
  );

  if (light.href) {
    return (
      <Link
        href={light.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-[-2px] focus-visible:ring-offset-[#0A0A0A]"
        aria-label={`${light.label}: ${statusText}. ${light.detail}`}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div role="status" aria-label={`${light.label}: ${statusText}. ${light.detail}`}>
      {inner}
    </div>
  );
}
