'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  CSF_HERO,
  CSF_MATERIALS,
  CSF_PRODUCT_LINES,
  CSF_HERITAGE,
} from '../data/csfHomeData';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ── Stats ── */
const CSF_STATS = [
  { val: '1974', en: 'Founded', ua: 'Засновано' },
  { val: '+15%', en: 'B-Tube Efficiency', ua: 'Ефективність B-Tube' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs OEM' },
  { val: '200+', en: 'Vehicle Apps', ua: 'Моделей авто' },
];

/* ── Material specs ── */
const ALUMINUM_SPECS = [
  { val: '6061-T6', en: 'Alloy Grade', ua: 'Марка сплаву' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs OEM' },
  { val: 'TIG', en: 'Weld Process', ua: 'Тип зварки' },
  { val: '100%', en: 'Aluminum Core', ua: 'Алюмінієва серцевина' },
];
const BTUBE_SPECS = [
  { val: '+15%', en: 'Surface Area', ua: 'Площа теплообміну' },
  { val: 'B-Shape', en: 'Cross Section', ua: 'Поперечний переріз' },
  { val: 'Patent', en: 'CSF Exclusive', ua: 'Тільки CSF' },
  { val: '−20%', en: 'Weight Saving', ua: 'Зниження ваги' },
];

export default function CSFHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-csf-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('csf-vis');
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
    const counters = document.querySelectorAll('[data-csf-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.csfCount || '0';
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
    <div className="csf-home" id="CSFHome">
      {/* ── Back to Stores ── */}
      <div className="csf-back">
        <Link href={`/${locale}/shop`} className="csf-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO (full viewport, center-aligned)
      ════════════════════════════════════════════════════════════════ */}
      <section className="csf-hero" id="csf-hero-section">
        <div className="csf-hero__bg">
          <Image
            src={CSF_HERO.heroImageFallback}
            alt="CSF High Performance Cooling"
            fill
            priority
            sizes="100vw"
            quality={90}
            style={{ objectFit: 'cover' }}
          />
        </div>
        <div className="csf-hero__overlay" />

        <div className="csf-hero__content" data-csf-reveal>
          <p className="csf-hero__overtitle">
            One Company × CSF Racing
          </p>

          <h1 className="csf-hero__title">
            {L(isUa, 'The Science of', 'Наука')}<br />
            <em>{L(isUa, 'Cool', 'Охолодження')}</em>
          </h1>

          <p className="csf-hero__subtitle">
            {L(isUa, CSF_HERO.subtitle, CSF_HERO.subtitleUk)}
          </p>

          <Link href={`/${locale}/shop/csf/collections`} className="csf-btn" style={{ marginTop: '2.5rem' }}>
            {L(isUa, 'Explore Catalog', 'Перейти в каталог')}
            <svg viewBox="0 0 24 24">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        {/* Stats bar */}
        <div className="csf-hero__stats" data-csf-reveal>
          {CSF_STATS.map((s, i) => (
            <div key={i} className="csf-hero__stat">
              <span className="csf-hero__stat-num" data-csf-count={s.val}>
                0
              </span>
              <span className="csf-hero__stat-label">
                {L(isUa, s.en, s.ua)}
              </span>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="csf-hero__scroll" aria-hidden>
          <div className="csf-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — MATERIAL SHOWCASE (Aluminum & B-Tube)
      ════════════════════════════════════════════════════════════════ */}
      <section className="csf-materials">
        <div className="csf-materials__header">
          <span className="csf-label">
            {L(isUa, 'Materials & Technology', 'Матеріали та технології')}
          </span>
        </div>

        {/* Aluminum */}
        <div className="csf-material" data-csf-reveal>
          <div className="csf-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CSF_MATERIALS.aluminum.image}
              alt="Aerospace aluminum closeup"
              loading="lazy"
            />
          </div>
          <div className="csf-material__text">
            <span className="csf-label">
              {L(isUa, 'Material', 'Матеріал')}
            </span>
            <h2 className="csf-material__title">
              {L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)}
            </h2>
            <div className="csf-material__shimmer" />
            <p className="csf-material__desc">
              {L(isUa, CSF_MATERIALS.aluminum.description, CSF_MATERIALS.aluminum.descriptionUk)}
            </p>
            <div className="csf-material__specs">
              {ALUMINUM_SPECS.map((sp, i) => (
                <div key={i} className="csf-material__spec">
                  <span className="csf-material__spec-val">{sp.val}</span>
                  <span className="csf-material__spec-label">
                    {L(isUa, sp.en, sp.ua)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* B-Tube */}
        <div className="csf-material csf-material--reverse" data-csf-reveal>
          <div className="csf-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CSF_MATERIALS.btube.image}
              alt="B-Tube technology closeup"
              loading="lazy"
            />
          </div>
          <div className="csf-material__text">
            <span className="csf-label">
              {L(isUa, 'Technology', 'Технологія')}
            </span>
            <h2 className="csf-material__title">
              {L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)}
            </h2>
            <div className="csf-material__shimmer" />
            <p className="csf-material__desc">
              {L(isUa, CSF_MATERIALS.btube.description, CSF_MATERIALS.btube.descriptionUk)}
            </p>
            <div className="csf-material__specs">
              {BTUBE_SPECS.map((sp, i) => (
                <div key={i} className="csf-material__spec">
                  <span className="csf-material__spec-val">{sp.val}</span>
                  <span className="csf-material__spec-label">
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
      <section className="csf-lines" data-csf-reveal>
        <div className="csf-lines__header">
          <span className="csf-label">
            {L(isUa, 'Product Lines', 'Лінійки продукції')}
          </span>
          <h2 className="csf-section-title">
            {L(isUa, 'Engineered for Your Machine', 'Інженерія для вашого автомобіля')}
          </h2>
          <div className="csf-divider csf-divider--center" />
        </div>

        <div className="csf-lines__track">
          {CSF_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="csf-line-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="csf-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                loading="lazy"
              />
              <div className="csf-line-card__overlay" />
              <span className="csf-line-card__badge">
                {L(isUa, line.badge, line.badgeUk)}
              </span>
              <div className="csf-line-card__content">
                <h3 className="csf-line-card__name">
                  {L(isUa, line.name, line.nameUk)}
                </h3>
                <p className="csf-line-card__desc">
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
      <section className="csf-heritage" data-csf-reveal>
        <div className="csf-hero__bg" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Image
            src={CSF_HERITAGE.fallbackImage}
            alt="CSF Heritage"
            fill
            sizes="100vw"
            quality={85}
            style={{ objectFit: 'cover', filter: 'brightness(0.35) grayscale(0.3)' }}
          />
        </div>
        <div className="csf-hero__overlay" style={{
          background: 'linear-gradient(to top, var(--csf-bg) 5%, transparent 50%, var(--csf-bg) 95%)',
          zIndex: 2,
        }} />

        <div className="csf-heritage__content">
          <span className="csf-label">
            {L(isUa, 'Heritage', 'Історія')}
          </span>
          <h2 className="csf-heritage__title">
            {L(isUa, CSF_HERITAGE.title, CSF_HERITAGE.titleUk)}
          </h2>
          <div className="csf-divider csf-divider--center" />
          <p className="csf-heritage__desc">
            {L(isUa, CSF_HERITAGE.description, CSF_HERITAGE.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — BOTTOM CTA
      ════════════════════════════════════════════════════════════════ */}
      <div className="csf-bottom-cta" data-csf-reveal>
        <span className="csf-label">
          {L(isUa, 'Ready to upgrade?', 'Готові до апгрейду?')}
        </span>
        <br />
        <Link href={`/${locale}/shop/csf/collections`} className="csf-btn">
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
