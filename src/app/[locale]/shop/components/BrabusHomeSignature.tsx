'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import { BRABUS_HERO, BRABUS_FEATURED_MODELS } from '../data/brabusHomeData';
import { BRABUS_SHOWCASES } from '../data/brabusShowcasesData';
import BrabusThemeScript from './BrabusThemeScript';
import BrabusVideoBackground from './BrabusVideoBackground';
import BrabusQuickSelector from './BrabusQuickSelector';
import BrabusTiltCard from './BrabusTiltCard';

/* ── Image references ──────────────────────────────── */
const BRABUS_ROCKET_IMG = '/images/shop/brabus/hq/brabus-supercars-26.jpg';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}
function locHref(locale: SupportedLocale, path: string) {
  if (path.startsWith('http') || path.startsWith('#')) return path;
  return path.startsWith('/') ? `/${locale}${path}` : `/${locale}/${path}`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function BrabusHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="br-home" id="BrabusHome">
      <BrabusThemeScript />

      {/* ─── Back to Stores ─── */}
      <div className="br-back">
        <Link href={`/${locale}/shop`} className="br-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      <div className="br-home" id="BrabusHome">

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — CINEMATIC HERO (full viewport)
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-hero" id="br-hero">
          <BrabusVideoBackground 
            videoSrc="/videos/shop/brabus/brabus-hero.mp4?v=rocket900"
            fallbackImage={BRABUS_HERO.heroImageUrl} 
            overlayStyle="hero" 
          />

          {/* Content — left-aligned, vertically centered */}
          <div className="br-hero__content" data-br-reveal>
            {/* BRABUS® wordmark */}
            <div className="br-hero__wordmark">
              BRABUS<sup>®</sup>
            </div>

            <div className="br-hero__divider" aria-hidden />

            <h1 className="br-hero__title">
              {L(isUa, 'Beyond', 'За межами')}<br />
              {L(isUa, 'Perfection', 'досконалості')}
            </h1>

            <p className="br-hero__eyebrow">
              One Company × Brabus
            </p>

            <p className="br-hero__subtitle">
              {L(isUa,
                BRABUS_HERO.subtitle,
                BRABUS_HERO.subtitleUk
              )}
            </p>

            <div className="br-hero__buttons">
              <Link
                href={locHref(locale, BRABUS_HERO.primaryButtonLink)}
                className="br-btn br-btn--ghost"
              >
                {L(isUa, BRABUS_HERO.primaryButtonLabel, BRABUS_HERO.primaryButtonLabelUk)}
              </Link>
              <Link
                href={locHref(locale, BRABUS_HERO.secondaryButtonLink)}
                className="br-btn br-btn--ghost"
              >
                {L(isUa, BRABUS_HERO.secondaryButtonLabel, BRABUS_HERO.secondaryButtonLabelUk)}
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="br-hero__scroll" aria-hidden>
            <div className="br-hero__scroll-line" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — QUICK SELECTOR
        ════════════════════════════════════════════════════════════════════ */}
        <BrabusQuickSelector locale={locale} />

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — HORIZONTAL SHOWCASES (snap-scroll carousel)
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-showcases" data-br-reveal>
          <div className="br-showcases__header">
            <span className="br-label">
              {L(isUa, 'Programmes', 'Програми')}
            </span>
            <h2 className="br-section-title">
              {L(isUa, 'Engineering Perfection', 'Інженерна досконалість')}
            </h2>
            <div className="br-header-line" />
          </div>

          <div className="br-showcases__track" data-br-hscroll>
            {BRABUS_SHOWCASES.map((s, idx) => (
              <Link
                key={s.num}
                href={s.exploreLink.startsWith('#') ? s.exploreLink : `/${locale}${s.exploreLink}`}
                className="br-sc"
              >
                <div className="br-sc__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="br-sc__img"
                    src={s.imageUrl}
                    alt={s.imageAlt}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                </div>
                <div className="br-sc__overlay" aria-hidden />
                <span className="br-sc__idx">{s.num}</span>
                <div className="br-sc__content">
                  <span className="br-sc__badge">{L(isUa, s.badge, s.badgeUk)}</span>
                  <h3 className="br-sc__name">
                    {L(isUa, s.name, s.nameUk).split('\n').map((line, i) => (
                      <span key={i}>{line}{i === 0 ? <br /> : null}</span>
                    ))}
                  </h3>
                  <p className="br-sc__sub">{L(isUa, s.subtitle, s.subtitleUk)}</p>
                  <span className="br-sc__cta">
                    {L(isUa, 'Explore', 'Дослідити')}
                    <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </span>
                </div>
                {/* Red dot accent */}
                <div className="br-sc__dot" aria-hidden />
              </Link>
            ))}
          </div>

          {/* Scroll progress dots */}
          <div className="br-showcases__dots">
            {BRABUS_SHOWCASES.map((_, i) => (
              <span key={i} className="br-showcases__dot" data-br-dot />
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3.5 — WIDESTAR VIDEO SHOWCASE
            Three cinematic hero cards: G-Class, Porsche, Range Rover
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-widestar" data-br-reveal>
          <div className="br-widestar__header">
            <span className="br-label">
              {L(isUa, 'Brabus Widestar', 'Brabus Widestar')}
            </span>
            <h2 className="br-section-title">
              {L(isUa, 'The Vehicles We Build For', 'Автомобілі, для яких ми створюємо')}
            </h2>
            <div className="br-header-line" />
            <p className="br-section-sub">
              {L(isUa,
                'Aerodynamic body kits, forged wheels, and performance upgrades — available for order with worldwide delivery.',
                'Аеродинамічні обвіси, ковані диски та збільшення потужності — доступні для замовлення з доставкою по всьому світу.'
              )}
            </p>
          </div>

          <div className="br-widestar__grid">
            {/* ── G-Class Widestar ── */}
            <div data-br-reveal>
              <BrabusTiltCard
                href={locHref(locale, '/shop/brabus/collections/g-class')}
                className="br-widestar__card"
              >
                <div className="br-widestar__card-media">
                  <Image
                    src="/images/shop/brabus/hq/brabus-supercars-126.jpg"
                    alt="Brabus Widestar G-Class"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="br-widestar__card-img"
                    unoptimized
                  />
                </div>
                <div className="br-widestar__card-overlay" />
                <div className="br-widestar__card-content">
                  <span className="br-widestar__card-badge">Widestar</span>
                  <h3 className="br-widestar__card-title">G-Class</h3>
                  <p className="br-widestar__card-sub">
                    {L(isUa,
                      'W465 · Up to 900 HP · Carbon Widestar body kit',
                      'W465 · До 900 к.с. · Карбоновий обвіс Widestar'
                    )}
                  </p>
                  <span className="br-widestar__card-cta">
                    {L(isUa, 'Shop Components', 'Каталог деталей')}
                    <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </span>
                </div>
                <div className="br-widestar__card-accent" />
              </BrabusTiltCard>
            </div>

            {/* ── Porsche 911 ── */}
            <div data-br-reveal>
              <BrabusTiltCard
                href={locHref(locale, '/shop/brabus/collections/porsche')}
                className="br-widestar__card"
              >
                <div className="br-widestar__card-media">
                  <Image
                    src="/images/shop/brabus/hq/brabus-supercars-84.jpg"
                    alt="Brabus Rocket R Porsche 911"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="br-widestar__card-img"
                    unoptimized
                  />
                </div>
                <div className="br-widestar__card-overlay" />
                <div className="br-widestar__card-content">
                  <span className="br-widestar__card-badge">Rocket R</span>
                  <h3 className="br-widestar__card-title">Porsche 911</h3>
                  <p className="br-widestar__card-sub">
                    {L(isUa,
                      'Turbo S · 900 HP · Full carbon aero programme',
                      'Turbo S · 900 к.с. · Повна карбонова аеро програма'
                    )}
                  </p>
                  <span className="br-widestar__card-cta">
                    {L(isUa, 'Shop Components', 'Каталог деталей')}
                    <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </span>
                </div>
                <div className="br-widestar__card-accent" />
              </BrabusTiltCard>
            </div>

            {/* ── Range Rover ── */}
            <div data-br-reveal>
              <BrabusTiltCard
                href={locHref(locale, '/shop/brabus/collections/range-rover')}
                className="br-widestar__card"
              >
                <div className="br-widestar__card-media">
                  <Image
                    src="/images/shop/brabus/hq/brabus-supercars-148.jpg"
                    alt="Brabus Range Rover 600"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="br-widestar__card-img"
                    unoptimized
                  />
                </div>
                <div className="br-widestar__card-overlay" />
                <div className="br-widestar__card-content">
                  <span className="br-widestar__card-badge">Signature</span>
                  <h3 className="br-widestar__card-title">Range Rover</h3>
                  <p className="br-widestar__card-sub">
                    {L(isUa,
                      '600 HP · Carbon body kit · Bespoke interior',
                      '600 к.с. · Карбоновий обвіс · Ексклюзивний інтер\'єр'
                    )}
                  </p>
                  <span className="br-widestar__card-cta">
                    {L(isUa, 'Shop Components', 'Каталог деталей')}
                    <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </span>
                </div>
                <div className="br-widestar__card-accent" />
              </BrabusTiltCard>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — FLEET GRID (Featured Models — portrait cards)
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-fleet" data-br-reveal>
          <div className="br-fleet__header">
            <span className="br-label">
              {L(isUa, 'Curated Fleet', 'Преміальний модельний ряд')}
            </span>
            <h2 className="br-section-title">
              {L(isUa, '1-Second-Wow Effect', '1-Second-Wow Ефект')}
            </h2>
            <div className="br-header-line" />
            <p className="br-section-sub">
              {L(isUa,
                'Every model, engineered to perfection. Choose your masterpiece.',
                'Кожна модель — шедевр інженерії. Оберіть свій.'
              )}
            </p>
          </div>

          <div className="br-fleet__grid">
            {BRABUS_FEATURED_MODELS.map((model, i) => (
              <Link
                key={model.title}
                href={locHref(locale, model.link)}
                className="br-fleet__card"
                data-br-fleet-card
                data-br-reveal
                style={{ '--stagger': `${i * 0.08}s` } as React.CSSProperties}
              >
                <div className="br-fleet__card-media">
                  <Image
                    src={model.imageUrl}
                    alt={L(isUa, model.title, model.titleUk)}
                    fill
                    sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                    className="br-fleet__card-img"
                    unoptimized
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="br-fleet__card-info">
                  <div className="br-fleet__card-tags">
                    <span>{model.tagOne}</span>
                    <span>{model.tagTwo}</span>
                  </div>
                  <h3 className="br-fleet__card-title">{L(isUa, model.title, model.titleUk)}</h3>
                  <p className="br-fleet__card-sub">{L(isUa, model.subtitle, model.subtitleUk)}</p>
                  <div className="br-fleet__line" />
                </div>
                <span className="br-fleet__card-arrow" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 5 — THE BRABUS LEGACY (VIDEO)
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-rocket" data-br-reveal>
          <BrabusVideoBackground 
            videoSrc="/videos/shop/brabus/brabus-hero-new.mp4"
            fallbackImage={BRABUS_ROCKET_IMG} 
            overlayStyle="hero" 
          />

          <div className="br-rocket__content">
            <h2 className="br-hero__title" style={{ marginTop: '4rem', marginBottom: '1.5rem', fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              {isUa ? 'The Brabus Legacy' : 'The Brabus Legacy'}
            </h2>
            <p className="br-hero__subtitle" style={{ maxWidth: '600px', fontSize: '1rem', marginBottom: '3rem' }}>
              {isUa
                ? 'Понад 45 років інженерної досконалості. Від розробки двигунів до виробництва розкішних суперкарів світового рівня у Ботропі. Кожна деталь створюється з метою перевершити очікування.'
                : 'Over 45 years of engineering perfection. From engine development to manufacturing world-class luxury supercars in Bottrop. Every detail is created to exceed expectations.'}
            </p>
            <a href="https://www.brabus.com" target="_blank" rel="noopener noreferrer" className="br-btn">
              {isUa ? 'Офіційний Brabus' : 'Official Brabus'}
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 6 — ROCKET 1000 HERO BANNER
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-rocket" data-br-reveal>
          <BrabusVideoBackground 
            videoSrc="/videos/shop/brabus/brabus-rocket.mp4"
            fallbackImage={BRABUS_ROCKET_IMG} 
            overlayStyle="rocket" 
          />

          <div className="br-rocket__content">
            <div className="br-rocket__badge">
              <div className="br-rocket__badge-line" />
              <span>LIMITED EDITION</span>
              <div className="br-rocket__badge-line" />
            </div>

            <h2 className="br-rocket__title">
              ROCKET 1000
            </h2>
            <span className="br-rocket__edition">&quot;1 OF 25&quot;</span>

            <p className="br-rocket__sub">
              {L(isUa,
                'The first 1,000-horsepower BRABUS supercar. Limited to 25 units worldwide. Hybrid performance with bare carbon aerodynamics.',
                'Перший суперкар BRABUS потужністю 1000 к.с. Лімітована серія з 25 екземплярів. Гібридна потужність та відкрите карбонове аеро.'
              )}
            </p>

            <div className="br-rocket__specs">
              {[
                { num: '1000', unit: L(isUa, 'HP', 'К.С.') },
                { num: '1820', unit: L(isUa, 'Nm', 'Нм') },
                { num: '2.6', unit: L(isUa, 'sec', 'сек') },
                { num: '25', unit: L(isUa, 'units', 'шт.') },
              ].map((spec, idx) => (
                <div key={idx} className="br-rocket__spec">
                  <span className="br-rocket__spec-num">{spec.num}</span>
                  <span className="br-rocket__spec-unit">{spec.unit}</span>
                </div>
              ))}
            </div>

            <Link href={`/${locale}/shop/brabus/collections`} className="br-btn br-btn--red">
              {L(isUa, 'Explore Rocket', 'Детальніше про Rocket')}
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </Link>
          </div>
        </section>

      </div>

      {/* ═══════════ BRABUS STEALTH-RED CSS ═══════════ */}
      <style jsx global>{`
        /* ── Reset & Base ──────────────────────────── */
        .br-home {
          --br-bg: #030303;
          --br-card: rgba(255, 255, 255, 0.02);
          --br-card-hover: rgba(255, 255, 255, 0.05);
          --br-red: #c29d59; /* Stealth wealth bronze override */
          --br-white: #ffffff;
          --br-muted: rgba(255, 255, 255, 0.6);
          --br-faint: rgba(255, 255, 255, 0.05);
          background-color: var(--br-bg);
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(194, 157, 89, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 100%, rgba(255, 255, 255, 0.02) 0%, transparent 40%),
            url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0V0zm2 2h2v2H2V2zm2 2h2v2H4V4zm2 2h2v2H6V6zm2 2h2v2H8V8zm2 2h2v2h-2v-2zm-2-2v-2h2v2h-2zm-2-2V4h2v2h-2zm-2-2V2h2v2H6zm-2-2V0h2v2H4z' fill='%23ffffff' fill-opacity='0.008' fill-rule='evenodd'/%3E%3C/svg%3E");
          background-attachment: fixed;
          color: var(--br-white);
          backdrop-filter: blur(20px);
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
        }

        /* ── Back Link ─────────────────────────────── */
        .br-back {
          position: fixed; top: 60px; left: 0; z-index: 90;
          padding: 1rem 1.5rem;
        }
        .br-back__link {
          font-size: .65rem; text-transform: uppercase; letter-spacing: .15em;
          color: rgba(255,255,255,.35); text-decoration: none;
          transition: color .3s;
        }
        .br-back__link:hover { color: var(--br-white); }

        /* ── Shared typography ──────────────────────── */
        .br-label {
          display: inline-block;
          font-size: .65rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; color: var(--br-red);
          margin-bottom: 1rem;
          opacity: 0; transform: translateY(20px);
          transition: transform .6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity .6s ease;
        }
        .br-section-title {
          font-family: var(--font-stack-condensed), var(--font-stack-display), sans-serif;
          font-size: clamp(2rem, 4.5vw, 3.2rem); font-weight: 400;
          text-transform: uppercase; letter-spacing: .04em;
          line-height: 1.05; margin: 0;
          opacity: 0; transform: translateY(30px);
          transition: transform .8s cubic-bezier(0.2, 0.8, 0.2, 1) .15s, opacity .8s ease .15s;
        }
        .br-header-line {
          width: 0; height: 1px; background: var(--br-red); margin: 1.5rem auto 0;
          transition: width .8s ease .3s;
        }
        .br-vis .br-header-line { width: 60px; }
        .br-vis .br-label, .br-vis .br-section-title, .br-vis .br-section-sub {
          opacity: 1; transform: translateY(0);
        }
        .br-section-sub {
          font-size: .9rem; font-weight: 300; color: var(--br-muted);
          letter-spacing: .02em; margin-top: 1.5rem; max-width: 500px;
        }

        /* ── Buttons ───────────────────────────────── */
        .br-btn {
          display: inline-flex; align-items: center; gap: .5rem;
          padding: .85rem 2rem;
          font-size: .7rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; text-decoration: none;
          border: 1px solid rgba(255,255,255,.2);
          color: var(--br-white); background: transparent;
          transition: all .35s ease;
        }
        .br-btn:hover {
          border-color: var(--br-white);
          background: rgba(255,255,255,.05);
        }
        .br-btn svg {
          width: 16px; height: 16px; fill: none;
          stroke: currentColor; stroke-width: 2;
          transition: transform .3s ease;
        }
        .br-btn:hover svg {
          transform: translateX(3px);
        }
        .br-btn--ghost {
          border-color: rgba(255,255,255,.15);
          position: relative;
          overflow: hidden;
        }
        .br-btn--ghost::before {
          content: '';
          position: absolute; inset: 0;
          background: rgba(255,255,255,0.04);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .br-btn--ghost:hover::before {
          transform: scaleX(1);
        }
        .br-btn--red {
          border-color: var(--br-red); color: var(--br-white);
          position: relative; overflow: hidden;
        }
        .br-btn--red::before {
          content: '';
          position: absolute; inset: 0;
          background: var(--br-red);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .br-btn--red:hover { color: #030303; }
        .br-btn--red:hover::before { transform: scaleX(1); }
        .br-btn--red span, .br-btn--red svg { position: relative; z-index: 1; }

        /* ── Reveal animation ──────────────────────── */
        [data-br-reveal] {
          opacity: 0; transform: translateY(28px);
          transition: opacity .8s ease, transform .8s ease;
        }
        [data-br-reveal].br-vis {
          opacity: 1; transform: translateY(0);
        }
        [data-br-reveal][style*="--stagger"] {
          transition-delay: var(--stagger);
        }

        /* ═══════════════════ HERO ═══════════════════ */
        .br-hero {
          position: relative; width: 100%; height: 100dvh; min-height: 700px;
          overflow: hidden; display: flex; align-items: center;
        }
        .br-hero__media {
          position: absolute; inset: 0; z-index: 0;
        }
        .br-hero__parallax {
          position: absolute; inset: -15% 0 0 0; width: 100%; height: 130%;
        }
        .br-hero__img {
          object-fit: cover; width: 100%; height: 100%;
        }
        .br-hero__overlay {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(105deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 45%, transparent 70%);
        }
        .br-hero__vignette {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(to top, rgba(0,0,0,.85) 0%, transparent 40%);
        }
        .br-hero__accent-line {
          position: absolute; top: 0; left: 0; right: 0;
          height: 1px; z-index: 5;
          background: linear-gradient(90deg, transparent, var(--br-red) 15%, var(--br-red) 85%, transparent);
        }
        .br-hero__content {
          position: relative; z-index: 20;
          padding: 0 clamp(2rem, 6vw, 8rem);
          max-width: 680px;
        }
        .br-hero__wordmark {
          font-size: 1.1rem; font-weight: 600; letter-spacing: .35em;
          text-transform: uppercase; margin-bottom: 1rem;
        }
        .br-hero__wordmark sup { font-size: .5em; }
        .br-hero__divider {
          width: 50px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--br-red), transparent);
          background-size: 200% 100%;
          animation: br-shimmer 2.5s linear infinite;
          margin-bottom: 1.5rem;
        }
        @keyframes br-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .br-hero__title {
          font-family: var(--font-stack-condensed), var(--font-stack-display), sans-serif;
          font-size: clamp(3rem, 7vw, 5.5rem);
          font-weight: 400; text-transform: uppercase;
          letter-spacing: 0.04em; line-height: 0.95;
          margin: 0 0 1rem;
        }
        .br-hero__eyebrow {
          font-size: .65rem; font-weight: 400; text-transform: uppercase;
          letter-spacing: .25em; color: var(--br-muted);
          margin: 0 0 1rem;
        }
        .br-hero__subtitle {
          font-size: .82rem; font-weight: 300; color: var(--br-muted);
          letter-spacing: .02em; line-height: 1.7;
          max-width: 440px; margin: 0 0 2rem;
        }
        .br-hero__buttons {
          display: flex; gap: 1rem; flex-wrap: wrap;
        }



        /* Scroll indicator */
        .br-hero__scroll {
          position: absolute; bottom: 80px; left: 50%; z-index: 20;
          transform: translateX(-50%);
        }
        .br-hero__scroll-line {
          width: 1px; height: 42px;
          background: linear-gradient(to bottom, var(--br-red), transparent);
          animation: br-scroll-pulse 2s ease-in-out infinite;
        }
        @keyframes br-scroll-pulse {
          0%, 100% { opacity: .4; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.3); }
        }

        /* ═══════════════════ SHOWCASES ═══════════════════ */
        .br-showcases {
          padding: 6rem 0 4rem;
          background: transparent;
        }
        .br-showcases__header {
          padding: 0 clamp(2rem, 6vw, 8rem);
          margin-bottom: 4rem;
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .br-showcases__track {
          display: flex; gap: 1.5rem;
          overflow-x: auto; scroll-snap-type: x mandatory;
          padding: 0 clamp(2rem, 6vw, 8rem) 1.5rem; /* bottom padding for scrollbar */
        }
        .br-showcases__track::-webkit-scrollbar { 
          height: 6px; 
          background: rgba(255, 255, 255, 0.05);
        }
        .br-showcases__track::-webkit-scrollbar-thumb { 
          background: var(--br-red);
        }

        .br-sc {
          flex: 0 0 min(85vw, 700px);
          height: clamp(400px, 65vh, 600px);
          position: relative; overflow: hidden;
          border-radius: 16px;
          scroll-snap-align: start;
          text-decoration: none; color: var(--br-white);
          opacity: 0; transform: translateY(60px);
          transition: transform .6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity .6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow .6s ease;
        }
        .br-sc::after {
          content: ""; position: absolute; inset: 0;
          border-radius: 16px; border: 1px solid rgba(255,255,255,0.03);
          pointer-events: none;
        }
        .br-showcases.br-vis .br-sc {
          opacity: 1; transform: translateY(0);
        }
        .br-showcases.br-vis .br-sc:nth-child(1) { transition-delay: .1s; }
        .br-showcases.br-vis .br-sc:nth-child(2) { transition-delay: .25s; }
        .br-showcases.br-vis .br-sc:nth-child(3) { transition-delay: .4s; }
        
        @media (hover: hover) {
          .br-sc:hover { 
            transform: scale(1.02) translateY(-8px); 
            box-shadow: 
              0 25px 60px -15px rgba(194, 157, 89, 0.15),
              0 0 0 1px rgba(194, 157, 89, 0.1);
            z-index: 10;
          }
        }
        .br-sc__media {
          position: absolute; inset: 0;
        }
        .br-sc__img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform .8s ease;
        }
        .br-sc:hover .br-sc__img { transform: scale(1.06); }
        .br-sc__overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.1) 50%);
        }
        .br-sc__idx {
          position: absolute; top: 1.5rem; right: 1.5rem;
          font-size: .65rem; font-weight: 400; letter-spacing: .15em;
          color: rgba(255,255,255,.3);
        }
        .br-sc__content {
          position: absolute; bottom: 0; left: 0;
          padding: 2rem;
        }
        .br-sc__badge {
          display: inline-block;
          font-size: .55rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: .2em;
          border: 1px solid var(--br-red); color: var(--br-red);
          padding: .25rem .6rem; margin-bottom: .75rem;
        }
        .br-sc__name {
          font-size: clamp(1.2rem, 2.5vw, 1.8rem);
          font-weight: 200; text-transform: uppercase;
          letter-spacing: .08em; line-height: 1.25;
          margin: 0 0 .5rem;
        }
        .br-sc__sub {
          font-size: .75rem; font-weight: 300; color: rgba(255,255,255,.55);
          max-width: 340px; line-height: 1.6; margin: 0 0 1rem;
        }
        .br-sc__cta {
          display: inline-flex; align-items: center; gap: .4rem;
          font-size: .65rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .15em; color: var(--br-red);
        }
        .br-sc__cta svg {
          width: 14px; height: 14px; fill: none;
          stroke: var(--br-red); stroke-width: 2;
        }
        .br-sc__dot {
          position: absolute; top: 1.5rem; left: 2rem;
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--br-red);
        }

        /* Scroll dots */
        .br-showcases__dots {
          display: flex; justify-content: center; gap: .5rem;
          margin-top: 2rem;
        }
        .br-showcases__dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(255,255,255,.15);
          transition: all .3s;
          cursor: pointer;
        }
        .br-showcases__dot.active {
          background: var(--br-red); width: 20px; border-radius: 3px;
        }

        /* ═══════════════════ WIDESTAR SHOWCASE ═══════════════════ */
        .br-widestar {
          padding: 6rem clamp(2rem, 6vw, 8rem) 4rem;
          background: transparent;
        }
        .br-widestar__header {
          margin-bottom: 3.5rem;
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .br-widestar__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.2rem;
        }
        @media (max-width: 960px) {
          .br-widestar__grid { grid-template-columns: 1fr; gap: 1rem; }
        }
        .br-widestar__card {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          border-radius: 12px;
          text-decoration: none;
          color: var(--br-white);
          display: block;
          cursor: pointer;
        }
        .br-widestar__card-media {
          position: absolute; inset: 0;
        }
        .br-widestar__card-img {
          object-fit: cover;
          filter: brightness(0.45) saturate(0.85);
          transition: transform .8s cubic-bezier(0.2, 0.8, 0.2, 1), filter .6s ease;
        }
        .br-widestar__card:hover .br-widestar__card-img {
          transform: scale(1.08);
          filter: brightness(0.55) saturate(1);
        }
        .br-widestar__card-overlay {
          position: absolute; inset: 0; z-index: 2;
          background: linear-gradient(
            to top,
            rgba(0,0,0,.85) 0%,
            rgba(0,0,0,.3) 40%,
            rgba(0,0,0,.1) 100%
          );
        }
        .br-widestar__card-content {
          position: absolute; bottom: 0; left: 0; right: 0;
          z-index: 3; padding: 2rem;
        }
        .br-widestar__card-badge {
          display: inline-block;
          font-size: .55rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: .2em;
          border: 1px solid var(--br-red); color: var(--br-red);
          padding: .2rem .55rem; margin-bottom: .6rem;
        }
        .br-widestar__card-title {
          font-size: clamp(1.4rem, 2.5vw, 2rem);
          font-weight: 200; text-transform: uppercase;
          letter-spacing: .1em; line-height: 1.1;
          margin: 0 0 .4rem;
        }
        .br-widestar__card-sub {
          font-size: .72rem; font-weight: 300; color: rgba(255,255,255,.55);
          line-height: 1.5; margin: 0 0 .8rem;
        }
        .br-widestar__card-cta {
          display: inline-flex; align-items: center; gap: .4rem;
          font-size: .6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .15em; color: var(--br-red);
          opacity: 0; transform: translateX(-8px);
          transition: opacity .4s ease, transform .4s ease;
        }
        .br-widestar__card:hover .br-widestar__card-cta {
          opacity: 1; transform: translateX(0);
        }
        .br-widestar__card-cta svg {
          width: 14px; height: 14px; fill: none;
          stroke: var(--br-red); stroke-width: 2;
        }
        .br-widestar__card-accent {
          position: absolute; top: 0; left: 0; right: 0;
          height: 1px; z-index: 4;
          background: linear-gradient(90deg, transparent, var(--br-red) 30%, var(--br-red) 70%, transparent);
          transform: scaleX(0); transform-origin: left;
          transition: transform .5s ease;
        }
        .br-widestar__card:hover .br-widestar__card-accent {
          transform: scaleX(1);
        }

        /* ═══════════════════ FLEET GRID ═══════════════════ */
        .br-fleet {
          padding: 6rem clamp(2rem, 6vw, 8rem);
          background: transparent;
        }
        .br-fleet__header {
          margin-bottom: 4rem;
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .br-fleet__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 960px) {
          .br-fleet__grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .br-fleet__grid { grid-template-columns: 1fr; }
        }
        .br-fleet__card {
          position: relative; overflow: hidden;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 12px;
          text-decoration: none; color: var(--br-white);
          opacity: 0; transform: translateY(40px) scale(0.98);
          transition: transform .7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity .7s ease, background .3s, box-shadow .4s ease;
        }
        .br-fleet__card::after {
          content: ""; position: absolute; inset: 0;
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
          pointer-events: none; transition: border-color .4s ease;
        }
        .br-fleet__card:hover::after {
          border-color: rgba(194, 157, 89, 0.15);
        }
        .br-fleet.br-vis .br-fleet__card {
          opacity: 1; transform: translateY(0) scale(1);
        }
        .br-fleet.br-vis .br-fleet__card:nth-child(1) { transition-delay: .1s; }
        .br-fleet.br-vis .br-fleet__card:nth-child(2) { transition-delay: .2s; }
        .br-fleet.br-vis .br-fleet__card:nth-child(3) { transition-delay: .3s; }
        .br-fleet.br-vis .br-fleet__card:nth-child(4) { transition-delay: .4s; }
        .br-fleet__card:hover { background: var(--br-card-hover); }
        .br-fleet__card-media {
          position: relative; aspect-ratio: 4/3; overflow: hidden;
          background: #fdfdfd;
        }
        .br-fleet__card-img {
          object-fit: contain; width: 100%; height: 100%;
          padding: 1.5rem;
          mix-blend-mode: multiply;
          transition: transform .6s ease;
        }
        .br-fleet__card:hover .br-fleet__card-img {
          transform: scale(1.05);
        }
        .br-fleet__card-info {
          padding: 1.25rem 1.5rem 1.5rem;
        }
        .br-fleet__card-tags {
          display: flex; gap: .5rem; margin-bottom: .5rem;
        }
        .br-fleet__card-tags span {
          font-size: .55rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .12em; color: var(--br-muted);
          border: 1px solid var(--br-faint); padding: .15rem .5rem;
          border-radius: 2px;
        }
        .br-fleet__card-title {
          font-size: .95rem; font-weight: 400; letter-spacing: .05em;
          margin: 0;
        }
        .br-fleet__card-sub {
          font-size: .75rem; font-weight: 300; color: var(--br-muted);
          margin: .3rem 0 0;
        }
        .br-fleet__line {
          width: 0; height: 1px;
          background: linear-gradient(90deg, var(--br-red), transparent);
          margin-top: 1rem; transition: width .5s ease;
        }
        .br-fleet__card:hover .br-fleet__line { width: 100%; }
        .br-fleet__card-arrow {
          position: absolute; top: 1rem; right: 1rem;
          font-size: 1.1rem; color: rgba(255,255,255,.15);
          transition: color .4s ease, transform .4s ease;
        }
        .br-fleet__card:hover .br-fleet__card-arrow {
          color: var(--br-red);
          transform: translateX(3px);
        }

        /* ═══════════════════ ROCKET 1000 ═══════════════════ */
        .br-rocket {
          position: relative; width: 100%;
          min-height: 80vh; overflow: hidden;
          display: flex; align-items: center;
        }
        .br-rocket__media {
          position: absolute; inset: 0;
        }
        .br-rocket__img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .br-rocket__overlay {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, rgba(0,0,0,.9) 0%, rgba(0,0,0,.5) 50%, transparent 70%);
        }
        .br-rocket__content {
          position: relative; z-index: 20;
          padding: 4rem clamp(2rem, 6vw, 8rem);
          max-width: 640px;
        }
        .br-rocket__badge {
          display: flex; align-items: center; gap: .75rem;
          margin-bottom: 1.5rem;
        }
        .br-rocket__badge span {
          font-size: .6rem; font-weight: 600; letter-spacing: .3em;
          text-transform: uppercase; color: var(--br-red);
        }
        .br-rocket__badge-line {
          width: 36px; height: 1px; background: var(--br-red);
        }
        .br-rocket__title {
          font-family: var(--font-stack-condensed), var(--font-stack-display), sans-serif;
          font-size: clamp(3rem, 6vw, 5rem);
          font-weight: 400; letter-spacing: .04em;
          line-height: 0.95; margin: 0;
        }
        .br-rocket__edition {
          display: block;
          font-size: clamp(1rem, 2vw, 1.4rem);
          font-weight: 200; color: var(--br-red);
          margin-top: .5rem; margin-bottom: 1.5rem;
          letter-spacing: .05em;
        }
        .br-rocket__sub {
          font-size: .82rem; font-weight: 300; color: var(--br-muted);
          line-height: 1.7; max-width: 480px; margin: 0 0 2rem;
        }
        .br-rocket__specs {
          display: flex; gap: 2rem; flex-wrap: wrap;
          margin-bottom: 2.5rem;
        }
        .br-rocket__spec {
          border-left: 2px solid var(--br-red);
          padding-left: 1rem;
        }
        .br-rocket__spec-num {
          display: block;
          font-family: var(--font-stack-condensed), var(--font-stack-display), sans-serif;
          font-size: 2.4rem; font-weight: 400;
          font-variant-numeric: tabular-nums;
          color: var(--br-white); line-height: 1;
        }
        .br-rocket__spec-unit {
          display: block; font-size: .55rem; font-weight: 500;
          text-transform: uppercase; letter-spacing: .2em;
          color: var(--br-muted); margin-top: .3rem;
        }

        /* ── Mobile Responsive ──────────────────────── */
        @media (max-width: 768px) {
          .br-hero__content { padding: 0 1.5rem; }
          .br-hero__scroll { display: none; }
          .br-showcases__header { padding: 0 1.5rem; }
          .br-showcases__track { padding: 0 1.5rem; }
          .br-sc { flex: 0 0 88vw; }
          .br-fleet { padding: 4rem 1.5rem; }
          .br-rocket__content { padding: 3rem 1.5rem; }
          .br-back { display: none; }
        }
      `}</style>
    </div>
  );
}
