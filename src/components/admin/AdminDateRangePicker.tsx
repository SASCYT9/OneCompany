'use client';

import { useEffect, useRef, useState } from 'react';

import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * AdminDateRangePicker — interactive date range with presets + custom calendar.
 *
 * Features:
 *   - Presets: Today, Yesterday, Last 7d, Last 30d, This month, Last month, This year, All-time
 *   - Custom: dual-month calendar with click-to-select start, click-to-select end
 *   - Returns ISO date strings (YYYY-MM-DD) for from/to
 *
 * Usage:
 *   <AdminDateRangePicker value={range} onChange={setRange} />
 */

export type DateRange = {
  from: string | null;  // ISO YYYY-MM-DD or null = open-ended
  to: string | null;
  preset?: string | null;
};

type Preset = {
  key: string;
  label: string;
  compute: () => { from: string; to: string };
};

const PRESETS: Preset[] = [
  {
    key: 'today',
    label: 'Today',
    compute: () => {
      const t = new Date();
      const iso = isoDate(t);
      return { from: iso, to: iso };
    },
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    compute: () => {
      const t = new Date(Date.now() - 86_400_000);
      const iso = isoDate(t);
      return { from: iso, to: iso };
    },
  },
  {
    key: 'last7',
    label: 'Last 7 days',
    compute: () => {
      const to = new Date();
      const from = new Date(Date.now() - 6 * 86_400_000);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'last30',
    label: 'Last 30 days',
    compute: () => {
      const to = new Date();
      const from = new Date(Date.now() - 29 * 86_400_000);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'thisMonth',
    label: 'This month',
    compute: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: isoDate(from), to: isoDate(now) };
    },
  },
  {
    key: 'lastMonth',
    label: 'Last month',
    compute: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'thisYear',
    label: 'This year',
    compute: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: isoDate(from), to: isoDate(now) };
    },
  },
  {
    key: 'last12mo',
    label: 'Last 12 months',
    compute: () => {
      const to = new Date();
      const from = new Date(to);
      from.setMonth(from.getMonth() - 12);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatRange(range: DateRange): string {
  if (range.preset) {
    const preset = PRESETS.find((p) => p.key === range.preset);
    if (preset) return preset.label;
  }
  if (!range.from && !range.to) return 'All time';
  const fromD = parseIso(range.from);
  const toD = parseIso(range.to);
  if (fromD && toD) {
    if (range.from === range.to) {
      return fromD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return `${fromD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${toD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return 'Custom range';
}

export function AdminDateRangePicker({
  value,
  onChange,
  className,
  align = 'left',
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState(() => {
    const start = parseIso(value.from) || new Date();
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });
  const [pendingFrom, setPendingFrom] = useState<string | null>(value.from);
  const [pendingTo, setPendingTo] = useState<string | null>(value.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function applyPreset(preset: Preset) {
    const r = preset.compute();
    onChange({ from: r.from, to: r.to, preset: preset.key });
    setPendingFrom(r.from);
    setPendingTo(r.to);
    setOpen(false);
  }

  function applyCustom() {
    onChange({ from: pendingFrom, to: pendingTo, preset: null });
    setOpen(false);
  }

  function handleDayClick(day: Date) {
    const iso = isoDate(day);
    if (!pendingFrom || (pendingFrom && pendingTo)) {
      // Start fresh
      setPendingFrom(iso);
      setPendingTo(null);
    } else if (pendingFrom && !pendingTo) {
      // Set end
      const fromD = parseIso(pendingFrom)!;
      if (day < fromD) {
        setPendingFrom(iso);
        setPendingTo(pendingFrom);
      } else {
        setPendingTo(iso);
      }
    }
  }

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#171717] px-3 text-xs font-medium text-zinc-200 transition hover:border-white/15 hover:bg-[#1F1F1F]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
        {formatRange(value)}
        <ChevronDown className={cn('h-3 w-3 text-zinc-500 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-30 mt-2 flex flex-col gap-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:flex-row',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {/* Presets */}
          <div className="flex w-full flex-col gap-0.5 border-b border-white/[0.05] p-2 sm:w-44 sm:border-b-0 sm:border-r">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-left text-xs font-medium transition',
                  value.preset === p.key
                    ? 'bg-blue-500/[0.15] text-blue-300'
                    : 'text-zinc-300 hover:bg-white/[0.04]'
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onChange({ from: null, to: null, preset: null });
                setPendingFrom(null);
                setPendingTo(null);
                setOpen(false);
              }}
              className="mt-1 rounded-lg border-t border-white/[0.04] px-3 py-1.5 text-left text-xs text-zinc-500 transition hover:bg-white/[0.04]"
            >
              All time
            </button>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="text-xs font-semibold text-zinc-200">
                {activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <button
                type="button"
                onClick={() => setActiveMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <CalendarGrid
              activeMonth={activeMonth}
              fromIso={pendingFrom}
              toIso={pendingTo}
              onDayClick={handleDayClick}
            />

            <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-3">
              <input
                type="date"
                value={pendingFrom ?? ''}
                onChange={(e) => setPendingFrom(e.target.value || null)}
                className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-zinc-100 focus:outline-none"
              />
              <span className="text-xs text-zinc-500">→</span>
              <input
                type="date"
                value={pendingTo ?? ''}
                onChange={(e) => setPendingTo(e.target.value || null)}
                className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-zinc-100 focus:outline-none"
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!pendingFrom || !pendingTo}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarGrid({
  activeMonth,
  fromIso,
  toIso,
  onDayClick,
}: {
  activeMonth: Date;
  fromIso: string | null;
  toIso: string | null;
  onDayClick: (day: Date) => void;
}) {
  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth();

  // First day of month, day-of-week (0 = Sunday). We use Monday as start.
  const firstDay = new Date(year, month, 1);
  const startOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < startOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const fromD = parseIso(fromIso);
  const toD = parseIso(toIso);
  const today = isoDate(new Date());

  return (
    <div className="grid w-[224px] grid-cols-7 gap-0.5">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
        <div key={i} className="py-1 text-center text-[10px] font-bold uppercase text-zinc-600">
          {label}
        </div>
      ))}
      {cells.map((day, idx) => {
        if (!day) return <div key={idx} />;
        const iso = isoDate(day);
        const isFrom = iso === fromIso;
        const isTo = iso === toIso;
        const inRange = fromD && toD && day > fromD && day < toD;
        const isToday = iso === today;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onDayClick(day)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-xs tabular-nums transition',
              isFrom || isTo
                ? 'bg-blue-600 font-bold text-white'
                : inRange
                  ? 'bg-blue-500/[0.15] text-blue-200'
                  : 'text-zinc-300 hover:bg-white/[0.06]',
              isToday && !isFrom && !isTo && 'ring-1 ring-blue-500/30'
            )}
          >
            {day.getDate()}
          </button>
        );
      })}
    </div>
  );
}
