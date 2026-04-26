'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { motion } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Inline-editable cell. Click → popover with input/select → Enter saves, Esc cancels.
 * Optimistic update: calls onSave immediately, reverts on failure (returned promise rejects).
 *
 * Two flavors:
 *   - <AdminInlineSelect> for dropdown choices (status, group, policy)
 *   - <AdminInlineNumber> for numeric input (qty, markup%, price)
 */

type Editable<TValue> = {
  value: TValue;
  display?: ReactNode;
  onSave: (next: TValue) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
};

/* ════════════════════════════════════════════════════
   InlineSelect
   ════════════════════════════════════════════════════ */

type InlineSelectProps<T extends string> = Editable<T> & {
  options: Array<{ value: T; label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }>;
  placeholder?: string;
};

export function AdminInlineSelect<T extends string>({
  value,
  display,
  options,
  onSave,
  disabled,
  className,
}: InlineSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent | globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey as never);
    return () => window.removeEventListener('keydown', onKey as never);
  }, [open]);

  async function handlePick(next: T) {
    if (next === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setOpen(false);
    } catch {
      // toast is the responsibility of the caller
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return <span className={className}>{display ?? value}</span>;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-none px-1.5 py-0.5 transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/40',
          className
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{display ?? value}</span>
        {saving ? (
          <Loader2 className="h-3 w-3 motion-safe:animate-spin text-blue-400" aria-hidden="true" />
        ) : (
          <span className="h-3 w-3 rounded-full bg-white/[0.04] opacity-0 transition group-hover:opacity-100" aria-hidden="true">
            <span className="block h-full w-full rounded-full bg-blue-400/40" />
          </span>
        )}
      </button>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute left-0 top-full z-30 mt-1.5 min-w-[180px] overflow-hidden rounded-none border border-white/[0.08] bg-[#171717] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          role="listbox"
        >
          {options.map((opt) => {
            const isCurrent = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => void handlePick(opt.value)}
                disabled={saving}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                  'hover:bg-white/[0.04]',
                  isCurrent ? 'bg-blue-500/[0.08] text-blue-300' : 'text-zinc-200',
                  saving && 'opacity-50'
                )}
              >
                {isCurrent ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
        </motion.div>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   InlineNumber
   ════════════════════════════════════════════════════ */

type InlineNumberProps = Editable<number> & {
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function AdminInlineNumber({
  value,
  display,
  onSave,
  disabled,
  className,
  min,
  max,
  step = 1,
  format,
  prefix,
  suffix,
}: InlineNumberProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(String(value));
  }, [value]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [editing]);

  async function commit() {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      setEditing(false);
      return;
    }
    if (min != null && parsed < min) {
      setText(String(value));
      setEditing(false);
      return;
    }
    if (max != null && parsed > max) {
      setText(String(value));
      setEditing(false);
      return;
    }
    if (parsed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch {
      setText(String(value));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setText(String(value));
    setEditing(false);
  }

  if (disabled) {
    return <span className={className}>{display ?? format?.(value) ?? value}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-none px-1.5 py-0.5 transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/40',
          className
        )}
      >
        <span className="tabular-nums">{display ?? format?.(value) ?? value}</span>
        <span className="h-2 w-2 rounded-full bg-blue-400/40 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-none border border-blue-500/40 bg-[#0F0F0F] pl-1 pr-0.5 py-0.5">
      {prefix ? <span className="text-xs text-zinc-500">{prefix}</span> : null}
      <input
        ref={inputRef}
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        min={min}
        max={max}
        step={step}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => void commit()}
        disabled={saving}
        className="w-16 bg-transparent text-sm tabular-nums text-zinc-100 focus:outline-none disabled:opacity-50"
      />
      {suffix ? <span className="text-xs text-zinc-500">{suffix}</span> : null}
      {saving ? (
        <Loader2 className="h-3 w-3 motion-safe:animate-spin text-blue-400" aria-hidden="true" />
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void commit()}
          className="rounded-none p-0.5 text-blue-400 hover:bg-blue-500/[0.15]"
          aria-label="Save"
        >
          <Check className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={cancel}
        disabled={saving}
        className="rounded-none p-0.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
        aria-label="Cancel"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}
