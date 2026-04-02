'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  IPE_HERO,
  IPE_STATS,
  IPE_HIGHLIGHTS,
  IPE_PRODUCT_LINES,
} from '../data/ipeHomeData';
import AkrapovicVideoBackground from './AkrapovicVideoBackground';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function IpeHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-ak-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('ak-vis');
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
    const counters = document.querySelectorAll('[data-ak-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.akCount || '0';
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
    <div className="ak-home" id="IpeHome">
      {/* ── Back to Stores ── */}
      <div className="ak-back">
        <Link href={`/${locale}/shop`} className="ak-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-hero" id="ak-hero-section">
        <AkrapovicVideoBackground
          videoSrc={IPE_HERO.heroVideoUrl}
          fallbackImage={IPE_HERO.heroImageFallback}
          overlayStyle="hero"
          withAudio={false}
        />

        <div className="ak-hero__content" data-ak-reveal>
          <p className="ak-hero__overtitle">
            One Company × iPE Exhaust
          </p>

          <h1 className="ak-hero__title">
            {L(isUa, 'Valvetronic', 'Фірмовий')}<br />
            <em>{L(isUa, 'Mastery', 'Звук F1')}</em>
          </h1>

          <p className="ak-hero__subtitle">
            {L(isUa, IPE_HERO.subtitle, IPE_HERO.subtitleUk)}
          </p>
        </div>

        {/* Stats bar */}
        <div className="ak-hero__stats" data-ak-reveal>
          {IPE_STATS.map((stat, i) => (
            <div key={i} className="ak-hero__stat-item">
              <div className="ak-hero__stat-val" data-ak-count={stat.value}>0</div>
              <div className="ak-hero__stat-lbl">{L(isUa, stat.label, stat.labelUk)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — HIGHLIGHTS (Bento)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-section">
        <div className="ak-section__header" data-ak-reveal>
          <h2 className="ak-section__title">
            {L(isUa, 'Engineering Excellence', 'Інженерна Досконалість')}
          </h2>
        </div>

        <div className="ak-grid ak-grid--3" data-ak-reveal>
          {IPE_HIGHLIGHTS.map((hl, i) => (
            <div key={i} className="ak-card">
              <div className="ak-card__media">
                <Image
                  src={hl.image}
                  alt={L(isUa, hl.title, hl.titleUk)}
                  fill
                  className="ak-card__img"
                />
              </div>
              <div className="ak-card__overlay">
                <h3 className="ak-card__title">{L(isUa, hl.title, hl.titleUk)}</h3>
                <p className="ak-card__desc">{L(isUa, hl.description, hl.descriptionUk)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PRODUCT LINES
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-section">
        <div className="ak-section__header" data-ak-reveal>
          <h2 className="ak-section__title">
            {L(isUa, 'Shop by Make', 'Каталог Брендів')}
          </h2>
        </div>

        <div className="ak-grid ak-grid--2x2" data-ak-reveal>
          {IPE_PRODUCT_LINES.map((pl) => (
            <Link key={pl.id} href={`/${locale}${pl.href}`} className="ak-card ak-card--link">
              <div className="ak-card__media">
                <Image src={pl.image} alt={pl.name} fill className="ak-card__img group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="ak-card__overlay">
                <div className="ak-card__tag">iPE {pl.name}</div>
                <h3 className="ak-card__title">{L(isUa, `View ${pl.name}`, `Дивитись ${pl.name}`)}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — CTA
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-section ak-cta" data-ak-reveal>
        <Image
          src={IPE_HERO.heroImageFallback}
          alt="iPE Exhaust"
          fill
          className="ak-cta__bg"
        />
        <div className="ak-cta__content">
          <h2 className="ak-cta__title">{L(isUa, 'Transform Your Drive', 'Перевтілення Твого Авто')}</h2>
          <Link href={`/${locale}/shop/ipe/collections`} className="ak-btn">
            {L(isUa, 'Explore Catalog', 'Відкрити Каталог')}
          </Link>
        </div>
      </section>
    </div>
  );
}
