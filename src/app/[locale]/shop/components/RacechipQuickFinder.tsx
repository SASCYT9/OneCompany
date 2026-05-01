'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import type { SupportedLocale } from '@/lib/seo';
import {
  formatRacechipMake,
  parseRacechipModelSlug,
} from '@/lib/racechipFormat';

export type RacechipMakeModelEntry = {
  make: string;
  models: string[]; // full chassis-level slugs, e.g. "rs6-c8-from-2019"
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
  const [modelKey, setModelKey] = useState<string>('');
  const [chassisKey, setChassisKey] = useState<string>('');

  // Parse the make's models into a Map<modelKey, { label, chassis: [{key,label}] }>.
  type ModelBucket = { label: string; chassis: { key: string; label: string }[] };
  const modelTree = useMemo<Map<string, ModelBucket>>(() => {
    if (!make) return new Map();
    const entry = makeModels.find((m) => m.make === make);
    if (!entry) return new Map();

    const tree = new Map<string, { label: string; chassis: Map<string, string> }>();

    for (const slug of entry.models) {
      const p = parseRacechipModelSlug(slug, make);
      let bucket = tree.get(p.modelKey);
      if (!bucket) {
        bucket = { label: p.modelLabel, chassis: new Map() };
        tree.set(p.modelKey, bucket);
      }
      const ck = p.chassisKey || '_none';
      const cl = p.chassisLabel || (p.years ? `(${p.years})` : '—');
      if (!bucket.chassis.has(ck)) bucket.chassis.set(ck, cl);
    }

    const out = new Map<string, ModelBucket>();
    for (const [k, v] of [...tree.entries()].sort((a, b) =>
      a[1].label.localeCompare(b[1].label),
    )) {
      out.set(k, {
        label: v.label,
        chassis: [...v.chassis.entries()]
          .map(([key, label]) => ({ key, label }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
    return out;
  }, [make, makeModels]);

  const modelOptions = useMemo(
    () => [...modelTree.entries()].map(([key, v]) => ({ key, label: v.label })),
    [modelTree],
  );
  const chassisOptions = useMemo(() => {
    if (!modelKey) return [];
    return modelTree.get(modelKey)?.chassis ?? [];
  }, [modelKey, modelTree]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (make) params.set('make', make);
    if (modelKey) params.set('model', modelKey);
    if (chassisKey && chassisKey !== '_none') params.set('chassis', chassisKey);
    const qs = params.toString();
    router.push(`/${locale}/shop/racechip/catalog${qs ? `?${qs}` : ''}`);
  }

  const labelMake = isUa ? 'Марка' : 'Make';
  const labelModel = isUa ? 'Модель' : 'Model';
  const labelChassis = isUa ? 'Кузов' : 'Chassis';
  const placeholderMake = isUa ? 'Виберіть марку' : 'Select make';
  const placeholderModel = isUa
    ? make
      ? 'Виберіть модель'
      : 'Залежить від марки'
    : make
      ? 'Select model'
      : 'Defined by make';
  const placeholderChassis = isUa
    ? modelKey
      ? 'Виберіть кузов'
      : 'Залежить від моделі'
    : modelKey
      ? 'Select chassis'
      : 'Defined by model';
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
            setModelKey('');
            setChassisKey('');
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
          value={modelKey}
          onChange={(e) => {
            setModelKey(e.target.value);
            setChassisKey('');
          }}
          disabled={!make}
          aria-label={labelModel}
        >
          <option value="">{placeholderModel}</option>
          {modelOptions.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rc-finder__field">
        <label className="rc-finder__label">{labelChassis}</label>
        <select
          className="rc-finder__select"
          value={chassisKey}
          onChange={(e) => setChassisKey(e.target.value)}
          disabled={!modelKey || chassisOptions.length === 0}
          aria-label={labelChassis}
        >
          <option value="">{placeholderChassis}</option>
          {chassisOptions.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
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
