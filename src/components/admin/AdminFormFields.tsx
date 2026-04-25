import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const INPUT_BASE =
  'w-full rounded-lg border border-white/[0.08] bg-[#171717] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-150 focus:border-blue-500/50 focus:bg-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50';

const LABEL_BASE = 'mb-1.5 block text-xs font-medium text-zinc-400';

const HELPER_BASE = 'mt-1.5 block text-xs leading-5 text-zinc-500';

type BaseFieldProps = {
  label: string;
  helper?: ReactNode;
  className?: string;
};

type InputFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function AdminInputField({
  label,
  value,
  onChange,
  type = 'text',
  step,
  placeholder,
  helper,
  mono = false,
  disabled = false,
  prefix,
  suffix,
  className,
}: InputFieldProps) {
  const hasAffix = Boolean(prefix || suffix);

  return (
    <label className={cn('block', className)}>
      <span className={LABEL_BASE}>{label}</span>
      {hasAffix ? (
        <div
          className={cn(
            'flex items-stretch overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717] transition-all duration-150 focus-within:border-blue-500/50 focus-within:bg-[#1A1A1A] focus-within:ring-2 focus-within:ring-blue-500/15',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {prefix ? (
            <span className="flex items-center border-r border-white/[0.06] bg-black/30 px-3 text-xs font-semibold uppercase tracking-wider text-blue-400">
              {prefix}
            </span>
          ) : null}
          <input
            type={type}
            step={step}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed',
              mono && 'font-mono text-[13px] tabular-nums'
            )}
          />
          {suffix ? (
            <span className="flex items-center border-l border-white/[0.06] bg-black/30 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {suffix}
            </span>
          ) : null}
        </div>
      ) : (
        <input
          type={type}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(INPUT_BASE, mono && 'font-mono text-[13px] tabular-nums')}
        />
      )}
      {helper ? <span className={HELPER_BASE}>{helper}</span> : null}
    </label>
  );
}

type TextareaFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
};

export function AdminTextareaField({
  label,
  value,
  onChange,
  rows = 5,
  helper,
  mono = false,
  placeholder,
  className,
}: TextareaFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className={LABEL_BASE}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={cn(INPUT_BASE, 'resize-y leading-6', mono && 'font-mono text-[13px]')}
      />
      {helper ? <span className={HELPER_BASE}>{helper}</span> : null}
    </label>
  );
}

type SelectFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
};

export function AdminSelectField({
  label,
  value,
  onChange,
  options,
  helper,
  disabled,
  className,
}: SelectFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className={LABEL_BASE}>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={cn(INPUT_BASE, 'appearance-none pr-10', '[&>option]:bg-[#171717] [&>option]:text-zinc-100')}
        >
          {options.map((option) => (
            <option key={`${option.value}-${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-400">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {helper ? <span className={HELPER_BASE}>{helper}</span> : null}
    </label>
  );
}

type CheckboxFieldProps = BaseFieldProps & {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function AdminCheckboxField({
  label,
  checked,
  onChange,
  helper,
  className,
}: CheckboxFieldProps) {
  return (
    <label className={cn('group inline-flex cursor-pointer items-start gap-3 text-sm text-zinc-100', className)}>
      <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 cursor-pointer appearance-none rounded border border-white/[0.14] bg-[#171717] transition-all checked:border-blue-500 checked:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]"
        />
        <svg
          className="pointer-events-none relative h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="space-y-1">
        <span className="block leading-5 transition-colors group-hover:text-zinc-50">{label}</span>
        {helper ? <span className="block text-xs leading-5 text-zinc-500">{helper}</span> : null}
      </span>
    </label>
  );
}
