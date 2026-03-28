'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import Do88VehicleFilter from '../do88/Do88VehicleFilter';
import { DO88_HERO } from '../data/do88HomeData';

export default function Do88HomeSignature({ locale }: { locale: SupportedLocale }) {
  const isUa = locale === 'ua';

  return (
    <main className="min-h-[85vh] bg-black text-white relative flex flex-col items-center justify-center overflow-hidden pb-16">
      {/* Animated Cinematic BW Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="w-full h-full bg-center bg-cover bg-no-repeat opacity-40 do88-ken-burns"
          style={{ backgroundImage: `url(${DO88_HERO.heroImageUrl})` }}
        />
      </div>

      {/* Background Ambience Layer */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-90" />

      <div className="relative z-10 flex flex-col items-center justify-center text-center mt-32 px-4 w-full">
        {/* Eyebrow */}
        <p className="text-[10px] sm:text-[12px] uppercase tracking-[0.3em] text-white/50 mb-6 do88-animate-up">
          {isUa ? 'Преміальні системи охолодження' : 'Premium Cooling Systems'}
        </p>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-[0.05em] leading-[1.1] mb-6 do88-animate-up text-white/90 drop-shadow-lg" style={{ animationDelay: '0.1s' }}>
          DO88 <br/> PERFORMANCE
        </h1>

        <p className="max-w-xl text-white/60 text-sm sm:text-base mb-16 leading-relaxed do88-animate-up" style={{ animationDelay: '0.15s' }}>
          {isUa 
            ? 'Шведська довершеність в розробці інтеркулерів, пайпінгів та радіаторів. Безкомпромісна якість для досягнення максимальних результатів на треку.' 
            : 'Swedish excellence in intercooler and plumbing engineering. Uncompromising quality to deliver maximum results on the track.'}
        </p>

        {/* Vehicle Filter */}
        <div className="w-full relative z-20 do88-animate-up" style={{ animationDelay: '0.2s' }}>
          <Do88VehicleFilter locale={locale} />
        </div>

        {/* All categories CTA */}
        <div className="mt-16 do88-animate-up" style={{ animationDelay: '0.3s' }}>
          <Link 
            href={`/${locale}/shop/do88/collections`}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white transition relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[1px] after:bg-white/20 hover:after:bg-white"
          >
            {isUa ? 'Або перегляньте всі категорії' : 'Or view all categories'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
