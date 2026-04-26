'use client';

import { useState, useRef, useEffect, useId } from 'react';

export type BurgerSelectOption = {
  value: string;
  label: string;
  count?: number;
};

type Props = {
  label: string;
  value: string;
  placeholder: string;
  options: BurgerSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function BurgerSelect({
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

  // Close on Escape
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
    <div className="bm-select" ref={containerRef}>
      <label className="bm-select__label" htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="bm-select__button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={
            'bm-select__value' +
            (!selectedOption ? ' bm-select__value--placeholder' : '')
          }
        >
          {displayLabel}
        </span>
        <span
          className={'bm-select__chev' + (open ? ' bm-select__chev--open' : '')}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && !disabled && (
        <ul ref={listRef} className="bm-select__list" role="listbox">
          {/* "Any" option first */}
          <li>
            <button
              type="button"
              className={
                'bm-select__option' +
                (value === '' ? ' bm-select__option--active' : '')
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
                  'bm-select__option' +
                  (value === opt.value ? ' bm-select__option--active' : '')
                }
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={value === opt.value}
              >
                <span className="bm-select__option-label">{opt.label}</span>
                {typeof opt.count === 'number' && (
                  <span className="bm-select__option-count">{opt.count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
