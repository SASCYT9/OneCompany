'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  AKRAPOVIC_HERO,
  AKRAPOVIC_STATS,
  AKRAPOVIC_MATERIALS,
  AKRAPOVIC_PRODUCT_LINES,
  AKRAPOVIC_HERITAGE,
} from '../data/akrapovicHomeData';
import { AKRAPOVIC_SOUNDS } from '../data/akrapovicSoundData';
import AkrapovicVideoBackground from './AkrapovicVideoBackground';
import AkrapovicSoundPlayer from './AkrapovicSoundPlayer';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function AkrapovicHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';
  const [isMuted, setIsMuted] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

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



  /* ── Sound toggle for hero video ── */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      // Find the hero video element and toggle mute
      const video = document.querySelector('#ak-hero-section video') as HTMLVideoElement | null;
      if (video) {
        video.muted = next;
      }
      return next;
    });
  }, []);

  return (
    <div className="ak-home" id="AkrapovicHome">
      {/* ── Back to Stores ── */}
      <div className="ak-back">
        <Link href={`/${locale}/shop`} className="ak-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO (full viewport, center-aligned)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-hero" id="ak-hero-section">
        <AkrapovicVideoBackground
          videoSrc={AKRAPOVIC_HERO.heroVideoUrl}
          fallbackImage={AKRAPOVIC_HERO.heroImageFallback}
          overlayStyle="hero"
          withAudio
          isMuted={isMuted}
        />

        <div className="ak-hero__content" data-ak-reveal>
          <p className="ak-hero__overtitle">
            One Company × Akrapovič
          </p>

          <h1 className="sr-only">
            {L(isUa, 'Akrapovič Exhaust Systems | Titanium & Carbon', 'Автомобільні вихлопні системи Akrapovič | Титан і Карбон')}
          </h1>
          <p className="ak-hero__title">
            {L(isUa, 'The Sound of', 'Звук')}<br />
            <em>{L(isUa, 'Perfection', 'Досконалості')}</em>
          </p>

          <p className="ak-hero__subtitle">
            {L(isUa, AKRAPOVIC_HERO.subtitle, AKRAPOVIC_HERO.subtitleUk)}
          </p>
        </div>

        {/* 🔊 Sound Toggle */}
        <button
          className="ak-hero__sound-toggle"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
              {L(isUa, 'Turn on sound', 'Увімкнути звук')}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              {L(isUa, 'Sound on', 'Звук увімкнено')}
            </>
          )}
        </button>

        {/* Stats bar */}
        <div className="ak-hero__stats" data-ak-reveal>
          {AKRAPOVIC_STATS.map((s, i) => (
            <div key={i} className="ak-hero__stat">
              <span className="ak-hero__stat-num">
                {s.val}
              </span>
              <span className="ak-hero__stat-label">
                {L(isUa, s.en, s.ua)}
              </span>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="ak-hero__scroll" aria-hidden>
          <div className="ak-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — MATERIAL SHOWCASE (Titanium & Carbon)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-materials">
        <div className="ak-materials__header">
          <span className="ak-label">
            {L(isUa, 'What we work with', 'З чим ми працюємо')}
          </span>
        </div>

        {/* Titanium */}
        <div className="ak-material" data-ak-reveal>
          <div className="ak-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AKRAPOVIC_MATERIALS.titanium.image}
              alt="Titanium alloy closeup"
              loading="lazy"
            />
          </div>
          <div className="ak-material__text">
            <span className="ak-label">
              {L(isUa, 'Material', 'Матеріал')}
            </span>
            <h2 className="ak-material__title">
              {L(isUa, AKRAPOVIC_MATERIALS.titanium.title, AKRAPOVIC_MATERIALS.titanium.titleUk)}
            </h2>
            <div className="ak-material__shimmer" />
            <p className="ak-material__desc">
              {L(isUa, AKRAPOVIC_MATERIALS.titanium.description, AKRAPOVIC_MATERIALS.titanium.descriptionUk)}
            </p>
            <div className="ak-material__specs">
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">600°C</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'Max Temperature', 'Макс. температура')}
                </span>
              </div>
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">−40%</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'vs Stainless Steel', 'проти нерж. сталі')}
                </span>
              </div>
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">Grade 1</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'Aerospace Alloy', 'Авіаційний сплав')}
                </span>
              </div>
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">🇸🇮</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'Made in Slovenia', 'Виготовлено у Словенії')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Carbon */}
        <div className="ak-material ak-material--reverse" data-ak-reveal>
          <div className="ak-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AKRAPOVIC_MATERIALS.carbon.image}
              alt="Carbon fibre closeup"
              loading="lazy"
            />
          </div>
          <div className="ak-material__text">
            <span className="ak-label">
              {L(isUa, 'Material', 'Матеріал')}
            </span>
            <h2 className="ak-material__title">
              {L(isUa, AKRAPOVIC_MATERIALS.carbon.title, AKRAPOVIC_MATERIALS.carbon.titleUk)}
            </h2>
            <div className="ak-material__shimmer" />
            <p className="ak-material__desc">
              {L(isUa, AKRAPOVIC_MATERIALS.carbon.description, AKRAPOVIC_MATERIALS.carbon.descriptionUk)}
            </p>
            <div className="ak-material__specs">
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">3K</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'Twill Weave', 'Плетіння')}
                </span>
              </div>
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">−70%</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'vs Aluminum', 'проти алюмінію')}
                </span>
              </div>
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">120°C</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'Autoclave Cured', 'Автоклавне затвердіння')}
                </span>
              </div>
              <div className="ak-material__spec">
                <span className="ak-material__spec-val">UV+</span>
                <span className="ak-material__spec-label">
                  {L(isUa, 'Stable Clear Coat', 'UV-стійке покриття')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-lines" data-ak-reveal>
        <div className="ak-lines__header">
          <span className="ak-label">
            {L(isUa, 'Product Lines', 'Лінійки продукції')}
          </span>
          <h2 className="ak-section-title">
            {L(isUa, 'Engineered for Your Machine', 'Створено для вашої машини')}
          </h2>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-lines__track">
          {AKRAPOVIC_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="ak-line-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ak-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                loading="lazy"
              />
              <div className="ak-line-card__overlay" />
              <span className="ak-line-card__badge">
                {L(isUa, line.badge, line.badgeUk)}
              </span>
              <div className="ak-line-card__content">
                <h3 className="ak-line-card__name">
                  {L(isUa, line.name, line.nameUk)}
                </h3>
                <p className="ak-line-card__desc">
                  {L(isUa, line.description, line.descriptionUk)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — SOUND COMPARISON GRID (interactive audio)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-sounds" data-ak-reveal>
        <div className="ak-sounds__header">
          <span className="ak-label">
            {L(isUa, 'Hear the difference', 'Почуйте різницю')}
          </span>
          <h2 className="ak-section-title">
            {L(isUa, 'Every Engine Has Its Voice', 'Кожен двигун має свій голос')}
          </h2>
          <p className="ak-section-sub" style={{ margin: '1.5rem auto 0' }}>
            {L(
              isUa,
              'Click on any car to hear the Akrapovič exhaust note. Short clips captured at our test facility.',
              'Натисніть на будь-яке авто, щоб почути звук вихлопу Akrapovič. Короткі записи з нашого тестувального полігону.'
            )}
          </p>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-sounds__grid">
          {AKRAPOVIC_SOUNDS.map((entry) => (
            <AkrapovicSoundPlayer
              key={entry.id}
              entry={entry}
              isUa={isUa}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6 — SOUND WAVE DIVIDER (second)
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 6 + Math.cos(i * 0.4) * 14 + Math.random() * 10;
          return (
            <div
              key={i}
              className="ak-wave__bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${i * 0.06}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7 — HERITAGE (video background + storytelling)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-heritage" data-ak-reveal>
        <AkrapovicVideoBackground
          videoSrc={AKRAPOVIC_HERITAGE.videoUrl}
          fallbackImage={AKRAPOVIC_HERITAGE.fallbackImage}
          overlayStyle="heritage"
        />

        <div className="ak-heritage__content">
          <span className="ak-label">
            {L(isUa, 'Heritage', 'Спадщина')}
          </span>
          <h2 className="ak-heritage__title">
            {L(isUa, AKRAPOVIC_HERITAGE.title, AKRAPOVIC_HERITAGE.titleUk)}
          </h2>
          <div className="ak-divider ak-divider--center" />
          <p className="ak-heritage__desc">
            {L(isUa, AKRAPOVIC_HERITAGE.description, AKRAPOVIC_HERITAGE.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 8 — BOTTOM CTA (single, subtle)
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-bottom-cta" data-ak-reveal>
        <span className="ak-label">
          {L(isUa, 'Ready to upgrade?', 'Готові до апгрейду?')}
        </span>
        <br />
        <Link href={`/${locale}/shop/akrapovic/collections`} className="ak-btn">
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
