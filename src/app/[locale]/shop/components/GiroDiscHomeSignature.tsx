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

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ── Material specs ── */
const IRON_SPECS = [
  { val: '72', en: 'Curved Vanes', ua: 'Вигнуті ребра' },
  { val: 'USA', en: 'Cast Iron Origin', ua: 'Виробництво чавуну' },
  { val: '2-Piece', en: 'Floating Design', ua: 'Плаваюча конструкція' },
  { val: '800°C', en: 'Operating Temp', ua: 'Робоча температура' },
];
const ALUMINUM_SPECS = [
  { val: '6061-T6', en: 'Alloy Grade', ua: 'Марка сплаву' },
  { val: '−8 lbs', en: 'Per Corner', ua: 'На кожне колесо' },
  { val: 'CNC', en: 'Machining', ua: 'Обробка' },
  { val: 'Anodized', en: 'Surface Finish', ua: 'Покриття' },
];

export default function GiroDiscHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-gd-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('gd-vis');
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
    const counters = document.querySelectorAll('[data-gd-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.gdCount || '0';
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
    <div className="gd-home" id="GiroDiscHome">
      {/* ── Back to Stores ── */}
      <div className="gd-back">
        <Link href={`/${locale}/shop`} className="gd-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-hero" id="gd-hero-section">
        <div className="gd-hero__bg">
          <Image
            src={GIRODISC_HERO.heroImageFallback}
            alt="GiroDisc 2-Piece Brake Rotors"
            fill
            priority
            sizes="100vw"
            quality={90}
            style={{ objectFit: 'cover' }}
          />
        </div>
        <div className="gd-hero__overlay" />

        <div className="gd-hero__content" data-gd-reveal>
          <p className="gd-hero__overtitle">
            One Company × GiroDisc
          </p>

          <h1 className="gd-hero__title">
            {L(isUa, 'Braking', 'Гальмівна')}<br />
            <em>{L(isUa, 'Precision', 'Точність')}</em>
          </h1>

          <p className="gd-hero__subtitle">
            {L(isUa, GIRODISC_HERO.subtitle, GIRODISC_HERO.subtitleUk)}
          </p>

          <Link href={`/${locale}/shop/girodisc/collections`} className="gd-btn" style={{ marginTop: '2.5rem' }}>
            {L(isUa, 'Explore Catalog', 'Перейти в каталог')}
            <svg viewBox="0 0 24 24">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        {/* Stats bar */}
        <div className="gd-hero__stats" data-gd-reveal>
          {GIRODISC_STATS.map((s, i) => (
            <div key={i} className="gd-hero__stat">
              <span className="gd-hero__stat-num" data-gd-count={s.val}>
                0
              </span>
              <span className="gd-hero__stat-label">
                {L(isUa, s.en, s.ua)}
              </span>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="gd-hero__scroll" aria-hidden>
          <div className="gd-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — MATERIAL SHOWCASE (Cast Iron & Aluminum)
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-materials">
        <div className="gd-materials__header">
          <span className="gd-label">
            {L(isUa, 'Materials & Technology', 'Матеріали та технології')}
          </span>
        </div>

        {/* Cast Iron */}
        <div className="gd-material" data-gd-reveal>
          <div className="gd-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={GIRODISC_MATERIALS[0].image}
              alt="Curved vane cast iron"
              loading="lazy"
            />
          </div>
          <div className="gd-material__text">
            <span className="gd-label">
              {L(isUa, 'Material', 'Матеріал')}
            </span>
            <h2 className="gd-material__title">
              {L(isUa, GIRODISC_MATERIALS[0].title, GIRODISC_MATERIALS[0].titleUk)}
            </h2>
            <div className="gd-material__shimmer" />
            <p className="gd-material__desc">
              {L(isUa, GIRODISC_MATERIALS[0].description, GIRODISC_MATERIALS[0].descriptionUk)}
            </p>
            <div className="gd-material__specs">
              {IRON_SPECS.map((sp, i) => (
                <div key={i} className="gd-material__spec">
                  <span className="gd-material__spec-val">{sp.val}</span>
                  <span className="gd-material__spec-label">
                    {L(isUa, sp.en, sp.ua)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Aluminum */}
        <div className="gd-material gd-material--reverse" data-gd-reveal>
          <div className="gd-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={GIRODISC_MATERIALS[1].image}
              alt="CNC billet aluminum"
              loading="lazy"
            />
          </div>
          <div className="gd-material__text">
            <span className="gd-label">
              {L(isUa, 'Technology', 'Технологія')}
            </span>
            <h2 className="gd-material__title">
              {L(isUa, GIRODISC_MATERIALS[1].title, GIRODISC_MATERIALS[1].titleUk)}
            </h2>
            <div className="gd-material__shimmer" />
            <p className="gd-material__desc">
              {L(isUa, GIRODISC_MATERIALS[1].description, GIRODISC_MATERIALS[1].descriptionUk)}
            </p>
            <div className="gd-material__specs">
              {ALUMINUM_SPECS.map((sp, i) => (
                <div key={i} className="gd-material__spec">
                  <span className="gd-material__spec-val">{sp.val}</span>
                  <span className="gd-material__spec-label">
                    {L(isUa, sp.en, sp.ua)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-lines" data-gd-reveal>
        <div className="gd-lines__header">
          <span className="gd-label">
            {L(isUa, 'Product Lines', 'Лінійки продукції')}
          </span>
          <h2 className="gd-section-title">
            {L(isUa, 'Track Ready Hardware', 'Обладнання для треку')}
          </h2>
          <div className="gd-divider gd-divider--center" />
        </div>

        <div className="gd-lines__track">
          {GIRODISC_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="gd-line-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="gd-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                loading="lazy"
              />
              <div className="gd-line-card__overlay" />
              <span className="gd-line-card__badge">
                {L(isUa, line.badge, line.badgeUk)}
              </span>
              <div className="gd-line-card__content">
                <h3 className="gd-line-card__name">
                  {L(isUa, line.name, line.nameUk)}
                </h3>
                <p className="gd-line-card__desc">
                  {L(isUa, line.description, line.descriptionUk)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HERITAGE (image background + storytelling)
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-heritage" data-gd-reveal>
        <div className="gd-hero__bg" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Image
            src={GIRODISC_HERITAGE.fallbackImage}
            alt="GiroDisc Heritage"
            fill
            sizes="100vw"
            quality={85}
            style={{ objectFit: 'cover', filter: 'brightness(0.3) grayscale(0.3)' }}
          />
        </div>
        <div className="gd-hero__overlay" style={{
          background: 'linear-gradient(to top, var(--gd-bg) 5%, transparent 50%, var(--gd-bg) 95%)',
          zIndex: 2,
        }} />

        <div className="gd-heritage__content">
          <span className="gd-label">
            {L(isUa, 'Heritage', 'Історія')}
          </span>
          <h2 className="gd-heritage__title">
            {L(isUa, GIRODISC_HERITAGE.title, GIRODISC_HERITAGE.titleUk)}
          </h2>
          <div className="gd-divider gd-divider--center" />
          <p className="gd-heritage__desc">
            {L(isUa, GIRODISC_HERITAGE.description, GIRODISC_HERITAGE.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — BOTTOM CTA
      ════════════════════════════════════════════════════════════════ */}
      <div className="gd-bottom-cta" data-gd-reveal>
        <span className="gd-label">
          {L(isUa, 'Ready to upgrade?', 'Готові до апгрейду?')}
        </span>
        <br />
        <Link href={`/${locale}/shop/girodisc/collections`} className="gd-btn">
          {L(isUa, 'Explore Catalog', 'Переглянути каталог')}
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
