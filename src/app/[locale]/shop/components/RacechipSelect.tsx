'use client';

import { useState, useRef, useEffect, useId } from 'react';

export type RacechipSelectOption = {
  value: string;
  label: string;
  count?: number;
};

type Props = {
  label: string;
  value: string;
  placeholder: string;
  options: RacechipSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function RacechipSelect({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  // Close on outside click / tap (mouse + touch for mobile reliability)
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className="rc-select" ref={containerRef}>
      <label className="rc-select__label" htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="rc-select__button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={
            'rc-select__value' +
            (!selectedOption ? ' rc-select__value--placeholder' : '')
          }
        >
          {displayLabel}
        </span>
        <span
          className={'rc-select__chev' + (open ? ' rc-select__chev--open' : '')}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && !disabled && (
        <ul ref={listRef} className="rc-select__list" role="listbox">
          <li>
            <button
              type="button"
              className={
                'rc-select__option' +
                (value === '' ? ' rc-select__option--active' : '')
              }
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              role="option"
              aria-selected={value === ''}
            >
              <span>{placeholder}</span>
            </button>
          </li>
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className={
                  'rc-select__option' +
                  (value === opt.value ? ' rc-select__option--active' : '')
                }
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={value === opt.value}
              >
                <span className="rc-select__option-label">{opt.label}</span>
                {typeof opt.count === 'number' && (
                  <span className="rc-select__option-count">{opt.count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
