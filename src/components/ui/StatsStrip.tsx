"use client";

import { yearsOfExcellence, satisfiedClients, flagshipProjects } from '@/lib/company';
import { useLanguage } from '@/lib/LanguageContext';

export default function StatsStrip() {
  const { locale } = useLanguage();
  const years = yearsOfExcellence();

  const fmt = (n: number) => locale === 'ua' ? n.toLocaleString('uk-UA') : n.toLocaleString('en-US');

  const items = [
    {
      value: `${years}+`,
      label: locale === 'ua' ? 'років досвіду' : 'years of excellence',
    },
    {
      value: `${fmt(satisfiedClients)}+`,
      label: locale === 'ua' ? 'задоволених клієнтів' : 'satisfied clients',
    },
    {
      value: `${flagshipProjects}+`,
      label: locale === 'ua' ? 'індивідуальних проектів' : 'bespoke projects',
    },
  ];

  return (
    <div className="relative container mx-auto px-6 mt-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it, i) => (
          <div key={i} className="group relative overflow-hidden bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] rounded-2xl p-6 backdrop-blur-sm shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-rose-500/0 to-transparent group-hover:from-orange-500/5 group-hover:via-rose-500/3 transition-all duration-700" />
            <div className="relative z-10">
              <div className="text-4xl md:text-5xl font-light tracking-tight text-white mb-2">{it.value}</div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/50">{it.label}</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/30 transition-all duration-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
