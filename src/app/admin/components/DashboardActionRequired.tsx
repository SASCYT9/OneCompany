import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

const CARBON_WEAVE_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 5px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 5px)',
  backgroundBlendMode: 'normal, overlay, overlay',
};

export type ActionItem = {
  id: string;
  severity: 'red' | 'amber' | 'green';
  label: string;
  count: number;
  detail: ReactNode;
  href: string;
};

const SEVERITY_RANK: Record<ActionItem['severity'], number> = { red: 0, amber: 1, green: 2 };

export function DashboardActionRequired({ items }: { items: ActionItem[] }) {
  // Sort: red first, then amber, then green; within each severity by count desc.
  // Filter out green entries (they're not actionable — keep the panel about issues).
  const actionable = items
    .filter((i) => i.severity !== 'green' && i.count > 0)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count);

  return (
    <section
      className="relative overflow-hidden rounded-none border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.6)]"
      style={CARBON_WEAVE_STYLE}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-2.5">
        <span className="h-3 w-[3px] rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-100">Action required</h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider tabular-nums text-zinc-500">
          {actionable.length} {actionable.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {actionable.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6 text-sm text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]" />
          <span>All clear. No urgent actions right now.</span>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {actionable.map((item) => (
            <li key={item.id}>
              <ActionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const dotClass =
    item.severity === 'red'
      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
      : item.severity === 'amber'
        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
        : 'bg-green-500';

  const stripeClass =
    item.severity === 'red' ? 'bg-red-500' : item.severity === 'amber' ? 'bg-amber-400' : 'bg-green-500';

  const countClass =
    item.severity === 'red' ? 'text-red-300' : item.severity === 'amber' ? 'text-amber-200' : 'text-green-200';

  // Spell out severity for assistive tech.
  const severityText =
    item.severity === 'red' ? 'Critical' : item.severity === 'amber' ? 'Warning' : 'Info';

  return (
    <Link
      href={item.href}
      aria-label={`${severityText}: ${item.label}, count ${item.count}`}
      className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset"
    >
      <span className={cn('absolute left-0 top-0 h-full w-[2px]', stripeClass)} aria-hidden="true" />
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-100">{item.label}</span>
          <span className={cn('text-sm font-bold tabular-nums', countClass)}>{item.count}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-zinc-400">{item.detail}</div>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-blue-400" aria-hidden="true" />
    </Link>
  );
}
