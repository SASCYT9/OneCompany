'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import type { SupportedLocale } from '@/lib/seo';
import { formatRacechipMake, formatRacechipModelLabel } from '@/lib/racechipFormat';

export type RacechipMakeModelEntry = {
  make: string;
  models: string[];
};

type Props = {
  locale: SupportedLocale;
  makeModels: RacechipMakeModelEntry[];
  variant?: 'hero' | 'panel';
  className?: string;
};

export default function RacechipQuickFinder({
  locale,
  makeModels,
  variant = 'panel',
  className,
}: Props) {
  const router = useRouter();
  const isUa = locale === 'ua';

  const [make, setMake] = useState<string>('');
  const [model, setModel] = useState<string>('');

  const models = useMemo(() => {
    if (!make) return [];
    const entry = makeModels.find((m) => m.make === make);
    return entry?.models ?? [];
  }, [make, makeModels]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (make) params.set('make', make);
    if (model) params.set('model', model);
    const qs = params.toString();
    router.push(`/${locale}/shop/racechip/catalog${qs ? `?${qs}` : ''}`);
  }

  const labelMake = isUa ? 'Марка' : 'Make';
  const labelModel = isUa ? 'Модель' : 'Model';
  const placeholderMake = isUa ? 'Виберіть марку' : 'Select make';
  const placeholderModel = isUa
    ? make
      ? 'Виберіть модель'
      : 'Залежить від марки'
    : make
      ? 'Select model'
      : 'Defined by make';
  const submit = isUa ? 'Знайти тюнінг' : 'Find Tuning';

  return (
    <form
      onSubmit={handleSubmit}
      className={`rc-finder rc-finder--${variant}${className ? ` ${className}` : ''}`}
      role="search"
      aria-label={isUa ? 'Підбір RaceChip для авто' : 'RaceChip vehicle finder'}
    >
      <div className="rc-finder__field">
        <label className="rc-finder__label">{labelMake}</label>
        <select
          className="rc-finder__select"
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
            setModel('');
          }}
          aria-label={labelMake}
        >
          <option value="">{placeholderMake}</option>
          {makeModels.map((entry) => (
            <option key={entry.make} value={entry.make}>
              {formatRacechipMake(entry.make)} ({entry.models.length})
            </option>
          ))}
        </select>
      </div>

      <div className="rc-finder__field">
        <label className="rc-finder__label">{labelModel}</label>
        <select
          className="rc-finder__select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!make}
          aria-label={labelModel}
        >
          <option value="">{placeholderModel}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {formatRacechipModelLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="rc-finder__submit">
        <Search className="rc-finder__submit-icon" aria-hidden />
        <span>{submit}</span>
        <ArrowRight className="rc-finder__submit-arrow" aria-hidden />
      </button>
    </form>
  );
}
