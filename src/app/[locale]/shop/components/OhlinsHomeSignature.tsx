'use client';

import { useEffect, useMemo } from 'react';
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

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string = en) {
  return isUa ? ua : en;
}

/* ── Gold particles generator ── */
function GoldParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${30 + Math.random() * 40}%`,
      delay: `${Math.random() * 4}s`,
      size: `${2 + Math.random() * 3}px`,
      duration: `${3 + Math.random() * 3}s`,
    }));
  }, []);

  return (
    <div className="ohlins-particles">
      {particles.map((p) => (
        <span
          key={p.id}
          className="ohlins-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

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
      { threshold: 0.12 }
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
          }, 18);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ohlins-shop" id="OhlinsHome">

      {/* ── Back to Stores ── */}
      <div className="fixed top-8 left-8 z-50 mix-blend-difference">
        <Link
          href={`/${locale}/shop`}
          className="text-xs font-medium tracking-[0.2em] text-white/60 hover:text-white uppercase transition-colors duration-300"
        >
          ← {L(isUa, 'All stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — MONUMENT HERO (centered product + huge title)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ohlins-monument-hero">
        {/* Gold particles background */}
        <GoldParticles />

        {/* Title */}
        <h1 className="ohlins-hero-title" data-ohlins-reveal>
          {L(isUa, 'FEEL THE ROAD', 'ВІДЧУЙ ДРАЙВ')}
        </h1>

        {/* Central product image */}
        <div className="ohlins-hero-product" data-ohlins-reveal>
          <Image
            src="/images/shop/ohlins/hero-fallback.jpg"
            alt="Öhlins Coilover"
            fill
            className="object-contain drop-shadow-[0_20px_60px_rgba(200,168,78,0.25)]"
            priority
          />
        </div>

        {/* Subtitle */}
        <p className="ohlins-hero-subtitle" data-ohlins-reveal>
          {L(
            isUa,
            OHLINS_HERO.description,
            'Öhlins Racing — передові підвіски для найвимогливіших водіїв та гонщиків. Чемпіонська технологія з 1976 року.'
          )}
        </p>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — STATS BAR (3-column with gold top border)
      ════════════════════════════════════════════════════════════════ */}
      <section className="px-6 pb-16" data-ohlins-reveal>
        <div className="ohlins-stats-bar">
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="ohlins-stat-cell">
              <span className="ohlins-stat-value" data-ohlins-count={s.value}>0</span>
              <span className="ohlins-stat-label">{L(isUa, s.label, s.label)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PRODUCT LINES (2×2 card grid)
      ════════════════════════════════════════════════════════════════ */}
      <section className="px-6 pb-24 lg:pb-32" data-ohlins-reveal>
        <div className="ohlins-grid">
          {OHLINS_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="ohlins-product-card group"
            >
              {/* Text side (left) */}
              <div className="ohlins-product-card__text">
                <div>
                  <h3 className="ohlins-product-card__title">{L(isUa, line.name, line.name)}</h3>
                  <p className="ohlins-product-card__desc">
                    {L(isUa, line.description, line.description)}
                  </p>
                </div>
                <span className="ohlins-product-card__btn">
                  {L(isUa, 'Shop now', 'Переглянути')}
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </div>

              {/* Image side (right) */}
              <div className="ohlins-product-card__image">
                <Image
                  src={line.image}
                  alt={line.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 45vw, 25vw"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — TECHNOLOGY (DFV + Materials)
      ════════════════════════════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 px-6 lg:px-12">
        {/* Shimmer divider */}
        <div className="ohlins-shimmer-line mb-20" />

        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20" data-ohlins-reveal>
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/25 mb-4">
              {L(isUa, 'Technology', 'Технології')}
            </p>
            <h2 className="ohlins-cta-title">
              <span className="text-white/90">{L(isUa, 'The', '')}</span>{' '}
              <span className="ohlins-gradient-text">
                {L(isUa, 'Golden Standard', 'Золотий Стандарт')}
              </span>
            </h2>
          </div>

          <div className="space-y-20 lg:space-y-28">
            {OHLINS_MATERIALS.map((mat, i) => (
              <div
                key={i}
                className={`ohlins-tech-row ${i % 2 !== 0 ? 'ohlins-tech-row--reverse' : ''}`}
                data-ohlins-reveal
              >
                <div className="ohlins-tech-img">
                  <Image
                    src={mat.image}
                    alt={mat.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 55vw"
                  />
                </div>
                <div className="ohlins-tech-text">
                  <p className="ohlins-tech-num">{`0${i + 1}.`}</p>
                  <div className="ohlins-gold-line" />
                  <h3 className="ohlins-tech-title">{L(isUa, mat.name, mat.name)}</h3>
                  <p className="ohlins-tech-desc">{L(isUa, mat.description, mat.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — HERITAGE CTA
      ════════════════════════════════════════════════════════════════ */}
      <section className="ohlins-cta" data-ohlins-reveal>
        <Image
          src={OHLINS_HERITAGE.image}
          alt="Öhlins Heritage"
          fill
          className="object-cover opacity-[0.06]"
        />
        <div className="ohlins-cta::before" />

        <div className="relative z-10 space-y-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/25">
            {L(isUa, 'Born in Sweden, Proven Worldwide', 'Народжено у Швеції, Доведено у Світі')}
          </p>

          <h2 className="ohlins-cta-title">
            <span className="text-white/90">{L(isUa, 'Ride With', 'Їдь З')}</span>{' '}
            <span className="ohlins-gradient-text">{L(isUa, 'Champions', 'Чемпіонами')}</span>
          </h2>

          <p className="text-sm text-white/35 max-w-2xl mx-auto leading-relaxed font-light">
            {L(
              isUa,
              OHLINS_HERITAGE.description,
              'Кожен продукт Öhlins розроблено та протестовано на нашому шведському заводі. Від MotoGP до Ле-Ман — золоті амортизатори є вибором чемпіонів.'
            )}
          </p>

          <div className="pt-4">
            <Link href={`/${locale}/shop/ohlins/collections`} className="ohlins-btn">
              {L(isUa, 'View Collections', 'Переглянути Колекції')}
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
