"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import Do88Listbox, { FilterGroup } from './Do88Listbox';
import { CAR_DATA } from './do88FitmentData';
import { DO88_COLLECTION_CARDS } from '../data/do88CollectionsList';

interface Do88VehicleFilterProps {
  locale: string;
  compact?: boolean;
  isSidebar?: boolean;
  currentCategory?: string;
}

export const DO88_CATEGORIES = [
  { handle: 'all', title: 'All Parts', titleUa: 'Всі деталі' },
  ...DO88_COLLECTION_CARDS.map((card) => ({
    handle: card.categoryHandle,
    title: card.title,
    titleUa: card.titleUk || card.title,
  })),
];

type Make = keyof typeof CAR_DATA;

export default function Do88VehicleFilter({
  locale,
  compact = false,
  isSidebar = false,
  currentCategory = 'all',
}: Do88VehicleFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedMake, setSelectedMake] = useState<Make | ''>(() => (searchParams?.get('brand') as Make | null) ?? '');
  const [selectedModel, setSelectedModel] = useState<string>(() => searchParams?.get('model') ?? '');
  const [selectedChassis, setSelectedChassis] = useState<string>(() => searchParams?.get('chassis') ?? '');
  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory);

  const isUa = locale === 'ua';

  // Sync state when URL changes externally (e.g. back/forward, deep link)
  useEffect(() => {
    const urlBrand = (searchParams?.get('brand') as Make | null) ?? '';
    const urlModel = searchParams?.get('model') ?? '';
    const urlChassis = searchParams?.get('chassis') ?? '';
    setSelectedMake(urlBrand);
    setSelectedModel(urlModel);
    setSelectedChassis(urlChassis);
  }, [searchParams]);

  useEffect(() => {
    setSelectedCategory(currentCategory);
  }, [currentCategory]);

  const pushLiveUpdate = (
    make: string,
    model: string,
    chassis: string,
    cat: string
  ) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (make) params.set('brand', make); else params.delete('brand');
    if (model) params.set('model', model); else params.delete('model');
    if (chassis) params.set('chassis', chassis); else params.delete('chassis');
    params.delete('keyword'); // legacy

    const q = params.toString();
    const targetPath = `/${locale}/shop/do88/collections/${cat || 'all'}`;

    startTransition(() => {
      router.push(`${targetPath}${q ? `?${q}` : ''}`);
    });
  };

  const handleMakeChange = (makeValue: string) => {
    const make = makeValue as Make | '';
    setSelectedMake(make);
    setSelectedModel('');
    setSelectedChassis('');
    pushLiveUpdate(make, '', '', selectedCategory);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setSelectedChassis('');
    pushLiveUpdate(selectedMake, model, '', selectedCategory);
  };

  const handleChassisChange = (chassis: string) => {
    setSelectedChassis(chassis);
    pushLiveUpdate(selectedMake, selectedModel, chassis, selectedCategory);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    pushLiveUpdate(selectedMake, selectedModel, selectedChassis, cat);
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
              options: Array.from(
                new Set(CAR_DATA[selectedMake].map((entry) => entry.model))
              ).map((m) => ({ value: m, label: m })),
            },
          ]
        : [],
    [selectedMake]
  );

  const chassisGroups = useMemo<FilterGroup[]>(
    () =>
      selectedMake && selectedModel
        ? [
            {
              label: selectedModel,
              options: CAR_DATA[selectedMake]
                .filter((entry) => entry.model === selectedModel)
                .map((entry) => ({ value: entry.chassis, label: entry.chassis })),
            },
          ]
        : [],
    [selectedMake, selectedModel]
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

  return (
    <div className={cn(wrapperClass, 'relative')} style={{ animationDelay: '0.1s' }}>
      {isPending && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-pulse rounded-t-2xl bg-gradient-to-r from-transparent via-[#c29d59] to-transparent"
        />
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
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-widest text-white uppercase">
            <span>{isUa ? 'Ваше Авто' : 'Your Vehicle'}</span>
            {isPending && (
              <span
                aria-live="polite"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2 py-[3px] text-[9px] font-normal tracking-[0.18em] text-white/75"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 animate-spin rounded-full border border-white/30 border-t-white"
                />
                {isUa ? 'Завантаження' : 'Loading'}
              </span>
            )}
          </h2>
        </div>
      )}

      <div className={cn(
        `grid grid-cols-1 ${(!isSidebar && compact) ? 'md:flex md:w-full md:gap-4' : 'gap-4'} text-left`,
        isPending && 'pointer-events-none opacity-70 transition-opacity duration-150'
      )}>
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

        <div className={`${(!isSidebar && compact) ? 'md:flex-1 mt-3 md:mt-0' : ''}`}>
          <Do88Listbox
            label={isUa ? 'Кузов' : 'Chassis'}
            placeholder={isUa ? 'Оберіть кузов' : 'Select chassis'}
            disabledPlaceholder={isUa ? 'Спершу оберіть модель' : 'Select model first'}
            value={selectedChassis}
            onChange={handleChassisChange}
            groups={chassisGroups}
            clearLabel={isUa ? 'Усі кузови' : 'All chassis'}
            clearValue=""
            disabled={!selectedMake || !selectedModel}
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
