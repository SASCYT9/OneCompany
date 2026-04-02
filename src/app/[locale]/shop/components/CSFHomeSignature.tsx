'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  CSF_HERO,
  CSF_STATS,
  CSF_MATERIALS,
  CSF_PRODUCT_LINES,
  CSF_HERITAGE,
} from '../data/csfHomeData';
import AkrapovicVideoBackground from './AkrapovicVideoBackground';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function CSFHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';
  const [isMuted, setIsMuted] = useState(true);

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

  /* ── Sound toggle for hero video ── */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      const video = document.querySelector('#csf-hero-section video') as HTMLVideoElement | null;
      if (video) {
        video.muted = next;
      }
      return next;
    });
  }, []);

  return (
    <div className="csf-home" id="CSFHome">
      {/* ── Back to Stores ── */}
      <div className="csf-back">
        <Link href={`/${locale}/shop`} className="csf-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* 1. HERO SECTION */}
      <section className="csf-hero" id="csf-hero-section">
        <AkrapovicVideoBackground
          videoSrc={CSF_HERO.heroVideoUrl}
          fallbackImage={CSF_HERO.heroImageFallback}
          overlayStyle="heritage" /* reusing dark overlay */
          withAudio
          isMuted={isMuted}
        />

        <div className="csf-hero__content" data-csf-reveal>
          <p className="csf-hero__overtitle">
            One Company × CSF Racing
          </p>

          <h1 className="csf-hero__title">
            <em>{L(isUa, 'The Science', 'Наука')}</em><br />
            {L(isUa, 'of Cool', 'Охолодження')}
          </h1>

          <p className="csf-hero__subtitle">
            {L(isUa, CSF_HERO.subtitle, CSF_HERO.subtitleUk)}
          </p>
        </div>

        <button
          className="csf-hero__sound-toggle"
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

        <div className="csf-hero__stats" data-csf-reveal>
          {CSF_STATS.map((s, i) => (
            <div key={i} className="csf-hero__stat">
              <span className="csf-hero__stat-num" data-csf-count={s.val}>0</span>
              <span className="csf-hero__stat-label">{L(isUa, s.en, s.ua)}</span>
            </div>
          ))}
        </div>

        <div className="csf-hero__scroll" aria-hidden>
          <div className="csf-hero__scroll-line" />
        </div>
      </section>

      {/* 2. THERMAL WAVE DIVIDER */}
      <div className="csf-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 8 + Math.sin(i * 0.4) * 20 + Math.random() * 10;
          return (
            <div
              key={i}
              className="csf-wave__bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${i * 0.04}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* 3. MATERIALS SHOWCASE */}
      <section className="csf-materials">
        {/* Aerospace Aluminum */}
        <div className="csf-material" data-csf-reveal>
          <div className="csf-material__image">
            <Image
              src={CSF_MATERIALS.aluminum.image}
              alt="Aerospace Aluminum"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="csf-material__text">
            <span className="csf-label">{L(isUa, 'Foundation', 'Основа')}</span>
            <h2 className="csf-material__title">
              {L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)}
            </h2>
            <div className="csf-divider" />
            <p className="csf-material__desc">
              {L(isUa, CSF_MATERIALS.aluminum.description, CSF_MATERIALS.aluminum.descriptionUk)}
            </p>
          </div>
        </div>

        {/* B-Tube Technology */}
        <div className="csf-material csf-material--reverse" data-csf-reveal>
          <div className="csf-material__image">
            <Image
              src={CSF_MATERIALS.btube.image}
              alt="B-Tube Technology"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="csf-material__text">
            <span className="csf-label">{L(isUa, 'Innovation', 'Інновація')}</span>
            <h2 className="csf-material__title">
              {L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)}
            </h2>
            <div className="csf-divider" />
            <p className="csf-material__desc">
              {L(isUa, CSF_MATERIALS.btube.description, CSF_MATERIALS.btube.descriptionUk)}
            </p>
          </div>
        </div>
      </section>

      {/* 4. PRODUCT LINES */}
      <section className="csf-lines" data-csf-reveal>
        <div className="csf-lines__header">
          <span className="csf-label">
            {L(isUa, 'Product Lines', 'Лінійки продукції')}
          </span>
          <h2 className="csf-section-title">
            {L(isUa, 'Engineered to Outperform', 'Створено перевершувати')}
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
              <Image
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                fill
                sizes="400px"
                className="csf-line-card__img"
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

      {/* 5. TECH GRID (Replaces Audio grid) */}
      <section className="csf-thermal" data-csf-reveal>
        <div className="csf-thermal__header">
          <span className="csf-label">
            {L(isUa, 'Thermal Dynamics', 'Термодинаміка')}
          </span>
          <h2 className="csf-section-title">
            {L(isUa, 'Proven by Data', 'Доведено даними')}
          </h2>
          <p className="csf-section-sub" style={{ margin: '1.5rem auto 0' }}>
            {L(
              isUa,
              'Every CSF cooling system is validated through thousands of hours of track testing, wind tunnel analysis, and CAD/CAM fluid dynamics simulations.',
              'Кожна система охолодження CSF проходить перевірку через тисячі годин трекових тестів, випробувань в аеродинамічній трубі та симуляцій гідродинаміки CAD/CAM.'
            )}
          </p>
          <div className="csf-divider csf-divider--center" />
        </div>
      </section>

      {/* 6. THERMAL WAVE DIVIDER 2 */}
      <div className="csf-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 6 + Math.cos(i * 0.5) * 15 + Math.random() * 8;
          return (
            <div
              key={i}
              className="csf-wave__bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${i * 0.05}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* 7. HERITAGE */}
      <section className="csf-heritage" data-csf-reveal>
        <AkrapovicVideoBackground
          videoSrc={CSF_HERITAGE.videoUrl}
          fallbackImage={CSF_HERITAGE.fallbackImage}
          overlayStyle="heritage"
        />

        <div className="csf-heritage__content">
          <span className="csf-label">
            {L(isUa, 'Heritage', 'Спадщина')}
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

      {/* 8. BOTTOM CTA */}
      <div className="csf-bottom-cta" data-csf-reveal>
        <span className="csf-label">
          {L(isUa, 'Keep it cool', 'Зберігай холодний розум')}
        </span>
        <br />
        <Link href={`/${locale}/shop/csf/collections`} className="csf-btn">
          {L(isUa, 'Explore Solutions', 'Оглянути рішення')}
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
