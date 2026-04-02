'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  OHLINS_HERO,
  OHLINS_STATS,
  OHLINS_MATERIALS,
  OHLINS_PRODUCT_LINES,
  OHLINS_HERITAGE,
} from '../data/ohlinsHomeData';
import AkrapovicVideoBackground from './AkrapovicVideoBackground';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string = en) {
  return isUa ? ua : en;
}

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';
  const [isMuted, setIsMuted] = useState(true);

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-ohlins-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('ohlins-vis');
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
    const counters = document.querySelectorAll('[data-ohlins-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.ohlinsCount || '0';
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

  /* ── Sound toggle for hero video ── */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      const video = document.querySelector('#ohlins-hero-section video') as HTMLVideoElement | null;
      if (video) {
        video.muted = next;
      }
      return next;
    });
  }, []);

  return (
    <div className="ohlins-shop" id="OhlinsHome">
      {/* ── Back to Stores ── */}
      <div className="absolute top-8 left-8 z-50">
        <Link href={`/${locale}/shop`} className="text-sm font-medium tracking-wider text-white/50 hover:text-white uppercase transition-colors">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* 1. HERO SECTION */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden" id="ohlins-hero-section">
        <AkrapovicVideoBackground
          videoSrc="/videos/shop/ohlins/ohlins-hero.mp4"
          fallbackImage="/images/shop/ohlins/hero-fallback.jpg"
          overlayStyle="heritage"
          withAudio
          isMuted={isMuted}
        />
        
        <div className="absolute inset-0 z-[1] pointer-events-none ohlins-hero-gradient" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center" data-ohlins-reveal>
          <p className="text-white/60 uppercase tracking-[0.2em] text-sm md:text-base font-semibold mb-6 flex items-center justify-center gap-4">
            <span className="w-8 h-[1px] bg-white/20"></span>
            One Company × Öhlins
            <span className="w-8 h-[1px] bg-white/20"></span>
          </p>

          <h1 className="text-5xl md:text-7xl lg:text-8xl ohlins-heading mb-6 tracking-tight">
            {L(isUa, 'FEEL THE', 'ВІДЧУЙ')}
            <br />
            <span className="ohlins-gradient-text">ROAD</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/80 leading-relaxed mb-12">
            {L(isUa, OHLINS_HERO.description, "Öhlins Racing постачає передові підвіски для найвибагливіших водіїв та гонщиків по всьому світу.")}
          </p>

          <Link href={`/${locale}/shop/ohlins/collections`} className="ohlins-btn inline-flex items-center gap-2">
            {L(isUa, OHLINS_HERO.ctaText, "Каталог Продукції")}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        <button
          className="absolute bottom-8 right-8 z-50 text-white/50 hover:text-white transition-colors flex items-center gap-2 text-sm uppercase tracking-wider font-semibold"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
              {L(isUa, 'Sound', 'Звук')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              {L(isUa, 'Mute', 'Вимкнути')}
            </>
          )}
        </button>

        <div className="absolute top-1/2 right-8 -translate-y-1/2 flex flex-col gap-12 z-20 hidden lg:flex" data-ohlins-reveal>
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="text-right">
              <span className="block text-4xl ohlins-heading ohlins-text-gold mb-1" data-ohlins-count={s.value}>0</span>
              <span className="block text-sm text-white/50 uppercase tracking-widest">{L(isUa, s.label, s.label)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. PRODUCT LINES */}
      <section className="py-24 px-6 relative z-10" data-ohlins-reveal>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-white/50 uppercase tracking-[0.2em] text-sm font-semibold block mb-4">
              {L(isUa, 'Product Selection', 'Вибір Продукції')}
            </span>
            <h2 className="text-4xl md:text-5xl ohlins-heading">
              {L(isUa, 'Engineered Details', 'Інженерні Деталі')}
            </h2>
            <div className="w-16 h-1 ohlins-bg-gold mx-auto mt-8 opacity-50" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {OHLINS_PRODUCT_LINES.map((line, i) => (
              <Link key={line.id} href={`/${locale}${line.link}`} className="ohlins-card group flex flex-col h-[400px] relative">
                <div className="absolute inset-0">
                  <Image src={line.image} alt={line.name} fill className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-100" sizes="400px" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-70 transition-opacity" />
                
                <div className="relative mt-auto p-6 z-10">
                  <div className="w-8 h-[2px] ohlins-bg-gold mb-4 scale-x-0 group-hover:scale-x-100 transform origin-left transition-transform duration-300" />
                  <h3 className="text-xl ohlins-heading mb-2">{L(isUa, line.name, line.name)}</h3>
                  <p className="text-sm text-white/60 line-clamp-3">{L(isUa, line.description, line.description)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. MATERIALS SHOWCASE */}
      <section className="py-24 px-6 relative z-10 bg-[#0a0a0a]" data-ohlins-reveal>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl ohlins-heading">
              {L(isUa, 'The Golden Standard', 'Золотий Стандарт')}
            </h2>
            <div className="w-16 h-1 ohlins-bg-gold mx-auto mt-8 opacity-50" />
          </div>

          <div className="space-y-12 lg:space-y-24">
            {OHLINS_MATERIALS.map((mat, i) => (
              <div key={i} className={`flex flex-col lg:flex-row gap-8 lg:gap-16 items-center ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
                <div className="w-full lg:w-1/2 aspect-[4/3] relative rounded-lg overflow-hidden">
                  <Image src={mat.image} alt={mat.name} fill className="object-cover" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg pointer-events-none" />
                </div>
                <div className="w-full lg:w-1/2 space-y-6">
                  <span className="text-white/40 uppercase tracking-[0.2em] text-sm">{`0${i + 1}.`}</span>
                  <h3 className="text-3xl ohlins-heading text-white">{L(isUa, mat.name, mat.name)}</h3>
                  <p className="text-white/60 text-lg leading-relaxed max-w-lg">
                    {L(isUa, mat.description, mat.description)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. BOTTOM CTA */}
      <section className="py-32 px-6 relative z-10 text-center" data-ohlins-reveal>
        <div className="absolute inset-0 z-0">
          <Image src={OHLINS_HERITAGE.image} alt="Heritage" fill className="object-cover opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-[#050505]/80 to-transparent" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
          <span className="text-white/50 uppercase tracking-[0.2em] text-sm font-semibold">
            {L(isUa, OHLINS_HERITAGE.title, OHLINS_HERITAGE.title)}
          </span>
          <h2 className="text-5xl md:text-6xl ohlins-heading ohlins-gradient-text py-2">
            RIDE WITH CHAMPIONS
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            {L(isUa, OHLINS_HERITAGE.description, OHLINS_HERITAGE.description)}
          </p>
          <div className="pt-8">
            <Link href={`/${locale}/shop/ohlins/collections`} className="ohlins-btn inline-block">
              {L(isUa, 'View Collections', 'Переглянути Колекції')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
