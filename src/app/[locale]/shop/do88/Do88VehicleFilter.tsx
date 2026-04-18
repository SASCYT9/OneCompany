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
  BMW: [
    'M2 (F87)', 'M2 (G87)', 
    'M3 / M4 (F80/F82)', 'M3 / M4 (G80/G82)', 
    '1 Series / 2 Series (F20/F22)',
    '3 Series / 4 Series (E90/E92)',
    '3 Series / 4 Series (F30/F32)', 
    'Supra / Z4 (B58)'
  ],
  Audi: ['RS3 / TTRS (8V/8S)', 'RS6 / RS7 (C7)', 'RS6 / RS7 (C8)', 'S3 / Golf R (8V/Mk7)', 'A4 / S4 (B8/B9)'],
  Porsche: ['911 (930)', '911 (964)', '911 (993)', '911 (996)', '911 (997)', '911 (991)', '911 (992)', 'Cayman / Boxster (987/981)'],
  Volkswagen: ['Golf GTI (Mk5/Mk6)', 'Golf GTI / R (Mk7/Mk7.5)', 'Golf R (Mk8)'],
  Volvo: ['240 / 740 / 940', '850', 'S60 / V60', 'V70 / XC70', 'XC60 / XC90'],
  Saab: ['900 Classic', '9-3 (OG/NG)', '9-5', '9000'],
  Toyota: ['GR Supra (A90)', 'GR Yaris'],
} as const;

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
  
  const initialBrand = (searchParams?.get('brand') as Make) || '';
  const initialKeyword = searchParams?.get('keyword') || '';

  const [selectedMake, setSelectedMake] = useState<Make | ''>(initialBrand);
  const [selectedModel, setSelectedModel] = useState<string>(initialKeyword);
  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory);

  const isUa = locale === 'ua';

  // Sync state if URL changes externally
  useEffect(() => {
    setSelectedMake((searchParams?.get('brand') as Make) || '');
    setSelectedModel(searchParams?.get('keyword') || '');
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
      : "do88-glass-panel do88-filter-container relative z-20 w-full max-w-4xl mx-auto overflow-visible do88-animate-up text-left";

  return (
    <div className={wrapperClass} style={{ animationDelay: '0.1s' }}>
      {(!compact && !isSidebar) && (
        <div className="mb-6 flex flex-col items-center text-center">
          <h2 className="text-2xl font-light tracking-[0.1em] text-white">
            {isUa ? 'ЗНАЙДІТЬ СВІЙ АВТОМОБІЛЬ' : 'FIND YOUR VEHICLE'}
          </h2>
          <p className="text-sm text-white/50 mt-2">
            {isUa 
              ? 'Виберіть марку та модель для підбору запчастин DO88' 
              : 'Select your make and model to find compatible DO88 performance parts'}
          </p>
        </div>
      )}

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
