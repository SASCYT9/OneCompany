'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import fitmentOptions from '../data/burgerFitmentOptions.json';
import BurgerSelect from './BurgerSelect';

type FitmentOptions = Record<string, {
  count: number;
  models: Record<string, { count: number; chassis: string[]; engines: string[] }>;
  allChassis: string[];
  allEngines: string[];
}>;

const OPTIONS = fitmentOptions as FitmentOptions;

// ─── Smart sort helpers ─────────────────────────────────────────
// Brands sorted alphabetically (alphabet > popularity for finding by name)
function sortBrands(items: { key: string; count: number }[]) {
  return [...items].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

// Models — group then natural sort within group
// BMW pattern: Series → M-cars → X-line → Z → i (electric)
// Generic: natural alphanumeric
const BMW_MODEL_GROUP: Record<string, number> = {
  Series: 0, M: 1, X: 2, Z: 3, i: 4,
};
function bmwGroup(model: string) {
  if (/-Series$/.test(model)) return 0;
  if (/^M\d/.test(model)) return 1;
  if (/^X\d/.test(model) || model === 'XM') return 2;
  if (/^Z\d/.test(model)) return 3;
  if (/^i\d/.test(model)) return 4;
  return 5;
}
function modelSortValue(model: string) {
  // Extract leading number for "3-Series" → 3, "M3" → 3, "X5M" → 5
  const m = model.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}
function sortModels(brand: string, items: { key: string; count: number }[]) {
  const list = [...items];
  if (brand === 'BMW') {
    return list.sort((a, b) => {
      const ga = bmwGroup(a.key);
      const gb = bmwGroup(b.key);
      if (ga !== gb) return ga - gb;
      const na = modelSortValue(a.key);
      const nb = modelSortValue(b.key);
      if (na !== nb) return na - nb;
      return a.key.localeCompare(b.key);
    });
  }
  // Generic natural alphanumeric
  return list.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));
}

// Chassis — natural alphanumeric sort: E36 < E46 < F30 < G20
function sortChassis(items: string[]) {
  return [...items].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

type Props = { locale: string };

export default function BurgerHeroPicker({ locale }: Props) {
  const isUa = locale === 'ua';
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from URL (works on catalog page where ?brand=BMW&model=M5&chassis=F90 is set)
  const [brand, setBrand] = useState(() => searchParams?.get('brand') ?? '');
  const [model, setModel] = useState(() => searchParams?.get('model') ?? '');
  const [chassis, setChassis] = useState(() => searchParams?.get('chassis') ?? '');

  const brandList = useMemo(
    () => sortBrands(Object.entries(OPTIONS).map(([k, v]) => ({ key: k, count: v.count }))),
    []
  );

  const modelList = useMemo(() => {
    if (!brand) return [];
    const bd = OPTIONS[brand];
    if (!bd) return [];
    return sortModels(brand, Object.entries(bd.models).map(([k, v]) => ({ key: k, count: v.count })));
  }, [brand]);

  const chassisList = useMemo(() => {
    if (!brand) return [];
    const raw = model
      ? OPTIONS[brand]?.models[model]?.chassis || []
      : OPTIONS[brand]?.allChassis || [];
    return sortChassis(raw);
  }, [brand, model]);

  const hasAnySelection = Boolean(brand || model || chassis);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    if (model) params.set('model', model);
    if (chassis) params.set('chassis', chassis);
    const q = params.toString();
    router.push(`/${locale}/shop/burger/products${q ? `?${q}` : ''}`);
  }

  function onReset() {
    setBrand('');
    setModel('');
    setChassis('');
    router.push(`/${locale}/shop/burger/products`);
  }

  return (
    <form onSubmit={onSubmit} className="bm-picker">
      <span className="bm-picker-glow" aria-hidden="true" />
      <div className="bm-picker__header">
        <div className="bm-picker__label">
          {isUa ? 'Підбір по авто' : 'Find parts for your car'}
        </div>
        {hasAnySelection && (
          <button
            type="button"
            onClick={onReset}
            className="bm-picker__reset"
            aria-label={isUa ? 'Скинути фільтри' : 'Reset filters'}
          >
            {isUa ? 'Скинути' : 'Reset'}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      <div className="bm-picker__row">
        <BurgerSelect
          label={isUa ? 'Марка' : 'Brand'}
          placeholder={isUa ? 'Будь-яка' : 'Any'}
          value={brand}
          options={brandList.map((b) => ({ value: b.key, label: b.key, count: b.count }))}
          onChange={(v) => { setBrand(v); setModel(''); setChassis(''); }}
        />

        <BurgerSelect
          label={isUa ? 'Модель' : 'Model'}
          placeholder={
            !brand
              ? (isUa ? '— оберіть марку —' : '— select brand first —')
              : modelList.length === 0
              ? (isUa ? 'Без моделей' : 'No models')
              : (isUa ? 'Будь-яка' : 'Any')
          }
          value={model}
          options={modelList.map((m) => ({ value: m.key, label: m.key, count: m.count }))}
          disabled={!brand || modelList.length === 0}
          onChange={(v) => { setModel(v); setChassis(''); }}
        />

        <BurgerSelect
          label={isUa ? 'Кузов' : 'Chassis'}
          placeholder={
            !brand
              ? (isUa ? '— оберіть марку —' : '— select brand first —')
              : chassisList.length === 0
              ? (isUa ? 'Без кузовів' : 'No chassis')
              : (isUa ? 'Будь-який' : 'Any')
          }
          value={chassis}
          options={chassisList.map((c) => ({ value: c, label: c }))}
          disabled={!brand || chassisList.length === 0}
          onChange={(v) => setChassis(v)}
        />

        <button type="submit" className="bm-picker__btn">
          {isUa ? 'Знайти' : 'Find'}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </form>
  );
}
