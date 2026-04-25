"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DO88_COLLECTION_CARDS } from '../data/do88CollectionsList';

type Locale = string;

interface Do88VehicleFilterProps {
  locale: Locale;
  compact?: boolean;
  isSidebar?: boolean;
  currentCategory?: string;
}

type FilterOption = {
  value: string;
  label: string;
};

type FilterGroup = {
  label?: string;
  options: FilterOption[];
};

const CAR_DATA = {
  Porsche: [
    '911 Turbo S (992)',
    '911 (992)',
    '911 (991)',
    '911 (997)',
    '911 (996)',
    '911 (993)',
    '911 (964)',
    'Cayman / Boxster (987/981)',
  ],
  BMW: [
    'M2 (G87)',
    'M3 / M4 (G80/G82)',
    'M3 / M4 (F80/F82)',
    'M2 (F87)',
    'M340i / M440i (G20/G22, B58)',
    'Z4 M40i (G29, B58)',
  ],
  Audi: [
    'RS6 / RS7 (C8)',
    'RS3 / TTRS (8V/8S)',
    'A3 / S3 (8V/8Y, 2015+)',
  ],
  Volkswagen: [
    'Golf GTI / R (Mk7/Mk7.5)',
    'Golf GTI / R (Mk8)',
  ],
  Toyota: ['GR Supra (A90)', 'GR Yaris'],
} as const;

const FEATURED_MAKE = 'Porsche' as const;
const FEATURED_MODEL = '911 Turbo S (992)';

export const DO88_CATEGORIES = [
  { handle: 'all', title: 'All Parts', titleUa: 'Всі деталі' },
  ...DO88_COLLECTION_CARDS.map((card) => ({
    handle: card.categoryHandle,
    title: card.title,
    titleUa: card.titleUk || card.title,
  })),
];

type Make = keyof typeof CAR_DATA;

type Do88ListboxProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  groups: FilterGroup[];
  clearLabel: string;
  clearValue: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
};

function Do88Listbox({
  label,
  placeholder,
  value,
  onChange,
  groups,
  clearLabel,
  clearValue,
  disabled = false,
  disabledPlaceholder,
}: Do88ListboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const selectedOption = useMemo(
    () => groups.flatMap((group) => group.options).find((option) => option.value === value) ?? null,
    [groups, value]
  );

  const displayValue = disabled
    ? disabledPlaceholder ?? placeholder
    : selectedOption?.label ?? placeholder;
  const isClearSelected = value === clearValue;

  return (
    <div ref={rootRef} className={cn('relative overflow-visible', open && 'z-[60]')}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          'group relative flex min-h-[72px] w-full items-center justify-between gap-4 overflow-hidden rounded-[22px] border px-5 py-4 text-left transition-all duration-300',
          disabled
            ? 'cursor-not-allowed border-white/6 bg-black/35 text-white/30'
            : open
              ? 'border-[#c29d59]/30 bg-black/75 shadow-2xl'
              : 'border-white/8 bg-black/55 hover:border-[#c29d59]/18 hover:bg-black/70'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-5 top-0 h-px bg-transparent transition-colors duration-300',
            !disabled && 'group-hover:bg-[#c29d59]/12',
            open && 'bg-[#c29d59]/25'
          )}
        />
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-[0.24em] text-white/38">
            {label}
          </span>
          <span
            className={cn(
              'mt-2 block truncate text-[15px] font-light',
              selectedOption && !disabled ? 'text-white' : 'text-white/55'
            )}
          >
            {displayValue}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-white/42 transition-transform duration-300',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+12px)] z-[60] overflow-hidden rounded-[22px] border border-[#c29d59]/16 bg-[#050505]/95 shadow-[0_28px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div id={listboxId} role="listbox" className="max-h-[320px] overflow-y-auto p-2">
            <button
              type="button"
              role="option"
              aria-selected={isClearSelected}
              onClick={() => {
                onChange(clearValue);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-sm transition-colors duration-200',
                isClearSelected
                  ? 'bg-[#c29d59]/10 text-white'
                  : 'text-white/72 hover:bg-white/[0.04] hover:text-white'
              )}
            >
              <span>{clearLabel}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 rounded-full border transition-colors duration-200',
                  isClearSelected
                    ? 'border-[#c29d59] bg-[#c29d59]'
                    : 'border-white/18 bg-transparent'
                )}
              />
            </button>

            {groups.map((group) => (
              <div key={group.label ?? 'group'} className="mt-2">
                {group.label ? (
                  <p className="px-4 pb-2 pt-1 text-[10px] uppercase tracking-[0.22em] text-[#c29d59]/58">
                    {group.label}
                  </p>
                ) : null}
                <div className="space-y-1">
                  {group.options.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-sm transition-colors duration-200',
                          isSelected
                            ? 'bg-[#c29d59]/10 text-white'
                            : 'text-white/72 hover:bg-white/[0.04] hover:text-white'
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 rounded-full border transition-colors duration-200',
                            isSelected
                              ? 'border-[#c29d59] bg-[#c29d59]'
                              : 'border-white/18 bg-transparent'
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Do88VehicleFilter({ locale, compact = false, isSidebar = false, currentCategory = 'all' }: Do88VehicleFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHero = !compact && !isSidebar;

  const initialBrand = (searchParams?.get('brand') as Make) || (isHero ? FEATURED_MAKE : '');
  const initialKeyword = searchParams?.get('keyword') || (isHero ? FEATURED_MODEL : '');

  const [selectedMake, setSelectedMake] = useState<Make | ''>(initialBrand);
  const [selectedModel, setSelectedModel] = useState<string>(initialKeyword);
  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory);

  const isUa = locale === 'ua';

  // Sync state if URL changes externally
  useEffect(() => {
    const urlBrand = (searchParams?.get('brand') as Make) || '';
    const urlKeyword = searchParams?.get('keyword') || '';
    if (urlBrand || urlKeyword) {
      setSelectedMake(urlBrand);
      setSelectedModel(urlKeyword);
    }
  }, [searchParams]);

  useEffect(() => {
    setSelectedCategory(currentCategory);
  }, [currentCategory]);

  const pushLiveUpdate = (make: string, model: string, cat: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (make) params.set('brand', make);
    else params.delete('brand');
    
    if (model) params.set('keyword', model);
    else params.delete('keyword');

    const q = params.toString();
    const targetPath = `/${locale}/shop/do88/collections/${cat || 'all'}`;
    
    router.push(`${targetPath}${q ? `?${q}` : ''}`);
  };

  const handleMakeChange = (makeValue: string) => {
    const make = makeValue as Make | '';
    setSelectedMake(make);
    setSelectedModel('');
    if (isSidebar || compact) {
      pushLiveUpdate(make, '', selectedCategory);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (model || isSidebar || compact) {
      pushLiveUpdate(selectedMake, model, selectedCategory);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    pushLiveUpdate(selectedMake, selectedModel, cat);
  };

  const makeGroups = useMemo<FilterGroup[]>(
    () => [
      {
        options: Object.keys(CAR_DATA).map((make) => ({
          value: make,
          label: make,
        })),
      },
    ],
    []
  );

  const modelGroups = useMemo<FilterGroup[]>(
    () =>
      selectedMake
        ? [
            {
              label: selectedMake,
              options: CAR_DATA[selectedMake].map((model) => ({
                value: model,
                label: model,
              })),
            },
          ]
        : [],
    [selectedMake]
  );

  const categoryGroups = useMemo<FilterGroup[]>(
    () => [
      {
        options: DO88_CATEGORIES.filter((category) => category.handle !== 'all').map((category) => ({
          value: category.handle,
          label: isUa ? category.titleUa : category.title,
        })),
      },
    ],
    [isUa]
  );

  const wrapperClass = isSidebar
    ? "do88-glass-panel relative z-20 w-full overflow-visible p-6 rounded-2xl flex flex-col gap-4"
    : compact
      ? "do88-glass-panel relative z-20 w-full max-w-5xl mx-auto overflow-visible px-4 py-4 md:px-8 rounded-2xl flex flex-col md:flex-row items-center gap-4 do88-animate-up"
      : "do88-glass-panel do88-filter-container relative z-20 w-full max-w-5xl mx-auto overflow-visible do88-animate-up text-left p-6 md:p-8";

  // Hero variant: 2-column brand/model picker + Search/Reset
  if (isHero) {
    const handleSearch = () => {
      pushLiveUpdate(selectedMake, selectedModel, selectedCategory);
    };
    const handleReset = () => {
      setSelectedMake('');
      setSelectedModel('');
    };
    const makeKeys = Object.keys(CAR_DATA) as Make[];
    const models = selectedMake ? CAR_DATA[selectedMake] : [];

    // Split model name into title + chassis code suffix in parens for richer cards
    const splitModel = (m: string) => {
      const match = m.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (match) return { title: match[1].trim(), code: match[2].trim() };
      return { title: m, code: '' };
    };

    return (
      <div className={wrapperClass} style={{ animationDelay: '0.1s' }}>
        {/* Header */}
        <div className="mb-7 flex flex-col items-center text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/65 mb-2">
            {isUa ? 'Підбір по авто' : 'Vehicle finder'}
          </p>
          <h2 className="text-xl md:text-2xl font-light tracking-[0.12em] text-white uppercase">
            {isUa ? 'Знайдіть свій автомобіль' : 'Find your vehicle'}
          </h2>
        </div>

        {/* Two-column picker */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 md:gap-7 mb-6">
          {/* Brand rail */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/55 mb-3 px-1">
              {isUa ? 'Марка' : 'Make'}
            </p>
            <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0 pb-1 md:pb-0 snap-x md:snap-none">
              {makeKeys.map((make) => {
                const active = selectedMake === make;
                return (
                  <button
                    key={make}
                    type="button"
                    onClick={() => handleMakeChange(active ? '' : make)}
                    className={cn(
                      'group relative flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all duration-200 snap-start whitespace-nowrap md:whitespace-normal flex-shrink-0',
                      active
                        ? 'border-white/55 bg-white/[0.12] text-white shadow-[0_0_18px_-6px_rgba(255,255,255,0.25)]'
                        : 'border-white/10 bg-white/[0.04] text-white/80 hover:border-white/30 hover:bg-white/[0.07] hover:text-white'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-[2px] rounded-r transition-all duration-200',
                        active ? 'bg-white opacity-100' : 'bg-white opacity-0 group-hover:opacity-40'
                      )}
                    />
                    <span className="text-[13px] font-medium tracking-[0.08em] uppercase">
                      {make}
                    </span>
                    <span className={cn('text-[10px] tabular-nums transition-colors', active ? 'text-white/85' : 'text-white/45')}>
                      {CAR_DATA[make].length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model grid */}
          <div className="min-h-[200px] md:border-l md:border-white/[0.1] md:pl-7">
            <div className="flex items-baseline justify-between mb-3 px-1">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">
                {isUa ? 'Модель' : 'Model'}
              </p>
              {selectedMake ? (
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                  {selectedMake}
                </p>
              ) : null}
            </div>
            {selectedMake ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {models.map((model) => {
                  const active = selectedModel === model;
                  const isFeatured = selectedMake === FEATURED_MAKE && model === FEATURED_MODEL;
                  const { title, code } = splitModel(model);
                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => handleModelChange(active ? '' : model)}
                      className={cn(
                        'group relative flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                        active
                          ? 'border-white bg-white/[0.14] text-white shadow-[0_0_24px_-6px_rgba(255,255,255,0.3)]'
                          : isFeatured
                            ? 'border-white/45 bg-white/[0.07] text-white hover:border-white/70 hover:bg-white/[0.1]'
                            : 'border-white/15 bg-white/[0.05] text-white/85 hover:border-white/35 hover:bg-white/[0.08] hover:text-white'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isFeatured ? (
                            <span aria-hidden="true" className="text-[10px] text-white/85">★</span>
                          ) : null}
                          <span className="text-[13px] font-medium tracking-[0.02em] truncate">
                            {title}
                          </span>
                        </div>
                        {code ? (
                          <span className={cn('mt-0.5 block text-[10px] uppercase tracking-[0.18em] truncate', active ? 'text-white/75' : 'text-white/55')}>
                            {code}
                          </span>
                        ) : null}
                      </div>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                          active
                            ? 'border-white bg-white'
                            : 'border-white/30 bg-white/[0.04] group-hover:border-white/55'
                        )}
                      >
                        {active ? (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-black" fill="currentColor">
                            <path d="M4.5 8.5 2 6l.7-.7L4.5 7.1l4.8-4.8.7.7z" />
                          </svg>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8">
                <p className="text-center text-[12px] text-white/55">
                  {isUa ? 'Спершу оберіть марку зліва' : 'Select a make on the left'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selection summary + actions */}
        <div className="flex flex-col gap-4 border-t border-white/12 pt-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.04em] text-white/65">
            <span className="uppercase tracking-[0.2em] text-white/45">{isUa ? 'Вибір' : 'Selection'}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="text-white">
              {selectedMake || (isUa ? 'не обрано' : 'not selected')}
              {selectedModel ? <span className="text-white/75"> · {selectedModel}</span> : null}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!selectedMake && !selectedModel}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-white/75 transition-all duration-200 hover:border-white/35 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:bg-white/[0.04] disabled:hover:text-white/75"
            >
              {isUa ? 'Скинути' : 'Reset'}
            </button>
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-black shadow-[0_8px_24px_-8px_rgba(255,255,255,0.35)] transition-all duration-200 hover:bg-white/90 hover:shadow-[0_12px_32px_-6px_rgba(255,255,255,0.45)] active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-4 h-4">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              {isUa ? 'Перейти до підбору' : 'Browse parts'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={{ animationDelay: '0.1s' }}>
      {(compact && !isSidebar) && (
        <div className="flex-shrink-0 mb-2 md:mb-0 mr-2 text-center md:text-left">
          <p className="text-[10px] tracking-[0.2em] uppercase text-white/50 mb-1">{isUa ? 'Фільтр' : 'Filter'}</p>
          <div className="text-sm font-medium tracking-widest text-white whitespace-nowrap">
            {isUa ? 'ВАШЕ АВТО' : 'YOUR VEHICLE'}
          </div>
        </div>
      )}

      {isSidebar && (
        <div className="mb-1">
          <p className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1">{isUa ? 'Фільтр' : 'Filter'}</p>
          <h2 className="text-sm font-semibold tracking-widest text-white uppercase">
            {isUa ? 'Ваше Авто' : 'Your Vehicle'}
          </h2>
        </div>
      )}

      <div className={`grid grid-cols-1 ${(!isSidebar && compact) ? 'md:flex md:w-full md:gap-4' : 'gap-4'} text-left`}>
        <div className={`${(!isSidebar && compact) ? 'md:flex-1' : ''}`}>
          <Do88Listbox
            label={isUa ? 'Марка' : 'Make'}
            placeholder={isUa ? 'Оберіть марку' : 'Select make'}
            value={selectedMake}
            onChange={handleMakeChange}
            groups={makeGroups}
            clearLabel={isUa ? 'Усі марки' : 'All makes'}
            clearValue=""
          />
        </div>

        <div className={`${(!isSidebar && compact) ? 'md:flex-1 mt-3 md:mt-0' : ''}`}>
          <Do88Listbox
            label={isUa ? 'Модель' : 'Model'}
            placeholder={isUa ? 'Оберіть модель' : 'Select model'}
            disabledPlaceholder={isUa ? 'Спершу оберіть марку' : 'Select make first'}
            value={selectedModel}
            onChange={handleModelChange}
            groups={modelGroups}
            clearLabel={isUa ? 'Усі моделі' : 'All models'}
            clearValue=""
            disabled={!selectedMake}
          />
        </div>

        {(isSidebar || compact) && (
          <div className={`${(!isSidebar && compact) ? 'md:flex-1 mt-3 md:mt-0' : ''}`}>
            <Do88Listbox
              label={isUa ? 'Категорія' : 'Category'}
              placeholder={isUa ? 'Всі деталі' : 'All parts'}
              value={selectedCategory}
              onChange={handleCategoryChange}
              groups={categoryGroups}
              clearLabel={isUa ? 'Всі деталі' : 'All parts'}
              clearValue="all"
            />
          </div>
        )}
      </div>
    </div>
  );
}
