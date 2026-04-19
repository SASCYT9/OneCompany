import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

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
  className,
}: InputFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full rounded-2xl border border-white/10 bg-[#101010] px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-200/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          mono && 'font-mono text-[13px]'
        )}
      />
      {helper ? <span className="mt-1.5 block text-xs text-stone-500">{helper}</span> : null}
    </label>
  );
}

type TextareaFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
};

export function AdminTextareaField({
  label,
  value,
  onChange,
  rows = 5,
  helper,
  mono = false,
  className,
}: TextareaFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={cn(
          'w-full rounded-2xl border border-white/10 bg-[#101010] px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-200/30 focus:outline-none',
          mono && 'font-mono text-[13px]'
        )}
      />
      {helper ? <span className="mt-1.5 block text-xs text-stone-500">{helper}</span> : null}
    </label>
  );
}

type SelectFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

export function AdminSelectField({
  label,
  value,
  onChange,
  options,
  helper,
  className,
}: SelectFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#101010] px-3.5 py-2.5 text-sm text-stone-100 focus:border-amber-200/30 focus:outline-none"
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helper ? <span className="mt-1.5 block text-xs text-stone-500">{helper}</span> : null}
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
    <label className={cn('inline-flex items-start gap-3 text-sm text-stone-100', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#101010]"
      />
      <span className="space-y-1">
        <span className="block">{label}</span>
        {helper ? <span className="block text-xs text-stone-500">{helper}</span> : null}
      </span>
    </label>
  );
}
