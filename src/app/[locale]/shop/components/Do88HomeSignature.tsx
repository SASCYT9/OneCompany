'use client';

import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import Do88VehicleFilter from '../do88/Do88VehicleFilter';
import { DO88_HERO } from '../data/do88HomeData';

export default function Do88HomeSignature({ locale }: { locale: SupportedLocale }) {
  const isUa = locale === 'ua';

  return (
    <main className="min-h-[85vh] bg-[#030303] text-white relative flex flex-col items-center justify-center overflow-hidden pb-24 border-b border-[#111]">
      {/* Heavy Film Grain */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.08] mix-blend-overlay pointer-events-none z-[1]"></div>
      {/* Animated Cinematic BW Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="w-full h-full bg-center bg-cover bg-no-repeat opacity-40 do88-ken-burns"
          style={{ backgroundImage: `url(${DO88_HERO.heroImageUrl})` }}
        />
      </div>

      {/* Background Ambience Layer with Bronze Mesh */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#030303] via-transparent to-[#030303] opacity-90 z-[2]" />
      <div className="absolute inset-0 pointer-events-none do88-bg-mesh opacity-80 z-[2]" />

      <div className="relative z-10 flex flex-col items-center justify-center text-center mt-32 px-4 w-full">
        {/* Eyebrow */}
        <p className="text-[10px] sm:text-[12px] uppercase tracking-[0.3em] text-[#c29d59] mb-6 do88-animate-up do88-text-glow" style={{ animationDelay: '0.05s' }}>
          {isUa ? 'Преміальні системи охолодження' : 'Premium Cooling Systems'}
        </p>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-[0.1em] leading-[1.1] mb-8 do88-animate-up text-white/90 drop-shadow-2xl" style={{ animationDelay: '0.1s' }}>
          <span className="do88-gradient-text">DO88</span> <br/> 
          <span className="font-light tracking-[0.15em] text-white/80">PERFORMANCE</span>
        </h1>

        <p className="max-w-xl text-white/60 text-sm sm:text-base mb-16 leading-relaxed do88-animate-up" style={{ animationDelay: '0.15s' }}>
          {isUa 
            ? 'Шведська довершеність в розробці інтеркулерів, пайпінгів та радіаторів. Безкомпромісна якість для досягнення максимальних результатів на треку.' 
            : 'Swedish excellence in intercooler and plumbing engineering. Uncompromising quality to deliver maximum results on the track.'}
        </p>

        {/* Vehicle Filter (chips + search/reset) */}
        <div className="w-full relative z-20 do88-animate-up" style={{ animationDelay: '0.2s' }}>
          <Do88VehicleFilter locale={locale} />
        </div>

        {/* All categories CTA */}
        <div className="mt-16 do88-animate-up" style={{ animationDelay: '0.3s' }}>
          <Link 
            href={`/${locale}/shop/do88/collections`}
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#c29d59]/70 hover:text-[#c29d59] transition relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[1px] after:bg-[#c29d59]/20 hover:after:bg-[#c29d59] do88-text-glow"
          >
            {isUa ? 'Або перегляньте всі категорії' : 'Or view all categories'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-4 h-4"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
