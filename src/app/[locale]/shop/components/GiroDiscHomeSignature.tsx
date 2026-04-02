'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  GIRODISC_HERO,
  GIRODISC_STATS,
  GIRODISC_MATERIALS,
  GIRODISC_PRODUCT_LINES,
  GIRODISC_HERITAGE,
} from '../data/girodiscHomeData';
import AkrapovicVideoBackground from './AkrapovicVideoBackground';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string = en) {
  return isUa ? ua : en;
}

export default function GiroDiscHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-girodisc-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('girodisc-vis');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Counter animation ── */
  useEffect(() => {
    const counters = document.querySelectorAll('[data-girodisc-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.girodiscCount || '0';
          io.unobserve(el);

          if (!/^\d+$/.test(target.replace(/[^0-9]/g, ''))) {
            el.textContent = target;
            return;
          }

          const num = parseInt(target.replace(/[^0-9]/g, ''), 10);
          const prefix = target.replace(/[0-9]/g, '').replace(/[^−+\-]/g, '');
          const suffix = target.replace(/[0-9]/g, '').replace(/[−+\-]/g, '');
          let current = 0;
          const step = Math.max(1, Math.floor(num / 60));
          const timer = setInterval(() => {
            current += step;
            if (current >= num) {
              current = num;
              clearInterval(timer);
            }
            el.textContent = prefix + current + suffix;
          }, 20);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="girodisc-shop" id="GiroDiscHome">
      {/* ── Back to Stores ── */}
      <div className="absolute top-8 left-8 z-50">
        <Link href={`/${locale}/shop`} className="text-xs font-bold tracking-[0.2em] text-white/40 hover:text-red-500 uppercase transition-colors">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* 1. HERO SECTION */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">
        <AkrapovicVideoBackground
          videoSrc={GIRODISC_HERO.heroVideoUrl}
          fallbackImage={GIRODISC_HERO.heroImageFallback}
          overlayStyle="heritage"
        />
        
        <div className="absolute inset-0 z-[1] pointer-events-none girodisc-hero-gradient" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center" data-girodisc-reveal>
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="w-12 h-[2px] bg-red-600"></span>
            <p className="text-white/60 uppercase tracking-[0.3em] text-xs font-bold">
              One Company × GiroDisc
            </p>
            <span className="w-12 h-[2px] bg-red-600"></span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-[8rem] girodisc-heading mb-6 tracking-tighter leading-none">
            {L(isUa, 'BRAKING', 'ГАЛЬМІВНА')}
            <br />
            <span className="girodisc-gradient-text">{L(isUa, 'PRECISION', 'ТОЧНІСТЬ')}</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 font-light leading-relaxed mb-12">
            {L(isUa, GIRODISC_HERO.subtitle, GIRODISC_HERO.subtitleUk)}
          </p>

          <Link href={`/${locale}/shop/girodisc/collections`} className="girodisc-btn inline-flex items-center gap-3">
            {L(isUa, GIRODISC_HERO.ctaText, GIRODISC_HERO.ctaTextUk)}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-black/60 backdrop-blur-md z-20">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5" data-girodisc-reveal>
            {GIRODISC_STATS.map((s, i) => (
              <div key={i} className="py-8 text-center">
                <span className="block text-3xl md:text-4xl girodisc-heading text-white mb-2" data-girodisc-count={s.val}>0</span>
                <span className="block text-[0.65rem] text-zinc-500 uppercase tracking-widest font-bold">{L(isUa, s.en, s.ua)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. MATERIALS SHOWCASE */}
      <section className="py-32 px-6 relative z-10 bg-zinc-950" data-girodisc-reveal>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl girodisc-heading">
              {L(isUa, 'Engineered in the USA', 'Розроблено в США')}
            </h2>
            <div className="w-24 h-1 girodisc-bg-red mx-auto mt-8" />
          </div>

          <div className="space-y-16 lg:space-y-32">
            {GIRODISC_MATERIALS.map((mat, i) => (
              <div key={i} className={`flex flex-col lg:flex-row gap-8 lg:gap-20 items-center ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
                <div className="w-full lg:w-1/2 aspect-video relative overflow-hidden bg-black girodisc-card">
                  <Image src={mat.image} alt={mat.title} fill className="object-cover opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                </div>
                <div className="w-full lg:w-1/2 space-y-6">
                  <span className="text-red-500 font-bold uppercase tracking-[0.2em] text-sm">{`0${i + 1}.`}</span>
                  <h3 className="text-3xl md:text-4xl girodisc-heading text-white">{L(isUa, mat.title, mat.titleUk)}</h3>
                  <p className="text-zinc-400 text-lg leading-relaxed font-light">
                    {L(isUa, mat.description, mat.descriptionUk)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PRODUCT LINES */}
      <section className="py-32 px-6 relative z-10 bg-zinc-900 border-t border-white/5" data-girodisc-reveal>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span className="text-red-500 uppercase tracking-[0.2em] text-sm font-bold block mb-4">
                {L(isUa, 'Product Selection', 'Вибір Продукції')}
              </span>
              <h2 className="text-4xl md:text-5xl girodisc-heading">
                {L(isUa, 'Track Ready Hardware', 'Обладнання для треку')}
              </h2>
            </div>
            <Link href={`/${locale}/shop/girodisc/collections`} className="text-sm tracking-widest uppercase font-bold text-zinc-400 hover:text-white transition-colors">
              {L(isUa, 'View All →', 'Переглянути все →')}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GIRODISC_PRODUCT_LINES.map((line, i) => (
              <Link key={line.id} href={`/${locale}${line.link}`} className="group flex flex-col h-[480px] relative girodisc-card overflow-hidden">
                <div className="absolute inset-0">
                  <Image src={line.image} alt={line.name} fill className="object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70 group-hover:opacity-100 mix-blend-luminosity group-hover:mix-blend-normal" sizes="400px" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent opacity-90 transition-opacity" />
                
                <div className="absolute top-6 left-6">
                  <span className="bg-red-600 text-white text-[0.6rem] font-bold uppercase tracking-widest px-3 py-1">
                    {L(isUa, line.badge, line.badgeUk)}
                  </span>
                </div>

                <div className="relative mt-auto p-8 z-10 transform transition-transform duration-500 group-hover:-translate-y-4">
                  <h3 className="text-2xl girodisc-heading text-white mb-3">{L(isUa, line.name, line.nameUk)}</h3>
                  <p className="text-sm text-zinc-400 line-clamp-3 font-light leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {L(isUa, line.description, line.descriptionUk)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. HERITAGE */}
      <section className="relative min-h-[70vh] flex items-center justify-center p-6 text-center" data-girodisc-reveal>
        <div className="absolute inset-0 z-0">
          <Image src={GIRODISC_HERITAGE.fallbackImage} alt="Heritage" fill className="object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-900" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <div className="w-16 h-1 bg-red-600 mx-auto" />
          <h2 className="text-5xl md:text-7xl girodisc-heading text-white">
            {L(isUa, GIRODISC_HERITAGE.title, GIRODISC_HERITAGE.titleUk)}
          </h2>
          <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto font-light leading-relaxed">
            {L(isUa, GIRODISC_HERITAGE.description, GIRODISC_HERITAGE.descriptionUk)}
          </p>
          <div className="pt-12">
            <Link href={`/${locale}/shop/girodisc/collections`} className="girodisc-btn inline-block">
              {L(isUa, 'Explore Products', 'Дослідити Продукцію')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
