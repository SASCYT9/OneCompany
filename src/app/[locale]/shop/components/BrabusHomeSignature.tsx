'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import { BRABUS_HERO, BRABUS_FEATURED_MODELS } from '../data/brabusHomeData';
import { BRABUS_SHOWCASES } from '../data/brabusShowcasesData';
import BrabusThemeScript from './BrabusThemeScript';
import BrabusVideoBackground from './BrabusVideoBackground';

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
              {L(isUa, 'Masterpiece', 'Шедевр')}<br />
              {L(isUa, 'of Power', 'Потужності')}
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
              <a
                href={BRABUS_HERO.secondaryButtonLink}
                target={BRABUS_HERO.secondaryButtonNewTab ? '_blank' : undefined}
                rel={BRABUS_HERO.secondaryButtonNewTab ? 'noopener noreferrer' : undefined}
                className="br-btn br-btn--ghost"
              >
                {L(isUa, BRABUS_HERO.secondaryButtonLabel, BRABUS_HERO.secondaryButtonLabelUk)}
              </a>
            </div>
          </div>

          {/* Bottom stats bar */}
          <div className="br-hero__stats" data-br-reveal>
            {[
              { val: '1977', label: L(isUa, 'Founded', 'Засновано') },
              { val: '900+', label: L(isUa, 'Maximum HP', 'Макс. к.с.') },
              { val: '1025', label: L(isUa, 'Components', 'Компонентів') },
            ].map((s, i) => (
              <div key={i} className="br-hero__stat">
                <span className="br-hero__stat-num" data-br-count={s.val}>0</span>
                <span className="br-hero__stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="br-hero__scroll" aria-hidden>
            <div className="br-hero__scroll-line" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — HORIZONTAL SHOWCASES (snap-scroll carousel)
        ════════════════════════════════════════════════════════════════════ */}
        <section className="br-showcases" data-br-reveal>
          <div className="br-showcases__header">
            <span className="br-label">
              {L(isUa, 'Programmes', 'Програми')}
            </span>
            <h2 className="br-section-title">
              {L(isUa, 'Engineering Perfection', 'Інженерна досконалість')}
            </h2>
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
            SECTION 4 — ROCKET 1000 HERO BANNER
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
          --br-bg: #0a0a0a;
          --br-card: #111;
          --br-card-hover: #161616;
          --br-red: #cc0000;
          --br-white: #fff;
          --br-muted: rgba(255,255,255,.8);
          --br-faint: rgba(255,255,255,.15);
          background-color: var(--br-bg);
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(255, 0, 0, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, rgba(255, 255, 255, 0.02) 0%, transparent 40%),
            url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0V0zm2 2h2v2H2V2zm2 2h2v2H4V4zm2 2h2v2H6V6zm2 2h2v2H8V8zm2 2h2v2h-2v-2zm-2-2v-2h2v2h-2zm-2-2V4h2v2h-2zm-2-2V2h2v2H6zm-2-2V0h2v2H4z' fill='%23ffffff' fill-opacity='0.012' fill-rule='evenodd'/%3E%3C/svg%3E");
          background-attachment: fixed;
          color: var(--br-white);
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
          display: block;
          font-size: .65rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; color: var(--br-red);
          margin-bottom: .75rem;
          opacity: 0; transform: translateY(20px);
          transition: transform .6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity .6s ease;
        }
        .br-section-title {
          font-size: clamp(1.4rem, 3vw, 2.2rem); font-weight: 200;
          text-transform: uppercase; letter-spacing: .08em;
          line-height: 1.15; margin: 0;
          opacity: 0; transform: translateY(30px);
          transition: transform .8s cubic-bezier(0.2, 0.8, 0.2, 1) .15s, opacity .8s ease .15s;
        }
        .br-vis .br-label, .br-vis .br-section-title, .br-vis .br-section-sub {
          opacity: 1; transform: translateY(0);
        }
        .br-section-sub {
          font-size: .85rem; font-weight: 300; color: var(--br-muted);
          letter-spacing: .02em; margin-top: .75rem; max-width: 440px;
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
        .br-btn--ghost { border-color: rgba(255,255,255,.15); }
        .br-btn--red {
          border-color: var(--br-red); color: var(--br-white);
        }
        .br-btn--red:hover { background: var(--br-red); }
        .br-btn svg {
          width: 16px; height: 16px; fill: none;
          stroke: currentColor; stroke-width: 2;
        }

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
          position: relative; width: 100%; height: 100vh; min-height: 700px;
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
          height: 3px; z-index: 5;
          background: linear-gradient(90deg, transparent, var(--br-red) 15%, var(--br-red) 85%, transparent);
        }
        .br-hero__content {
          position: relative; z-index: 3;
          padding: 0 clamp(2rem, 6vw, 8rem);
          max-width: 680px;
        }
        .br-hero__wordmark {
          font-size: 1.1rem; font-weight: 600; letter-spacing: .35em;
          text-transform: uppercase; margin-bottom: 1rem;
        }
        .br-hero__wordmark sup { font-size: .5em; }
        .br-hero__divider {
          width: 50px; height: 1px; background: var(--br-red);
          margin-bottom: 1.5rem;
        }
        .br-hero__title {
          font-size: clamp(2.2rem, 5vw, 4rem);
          font-weight: 200; text-transform: uppercase;
          letter-spacing: .08em; line-height: 1.1;
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

        /* Hero bottom stats */
        .br-hero__stats {
          position: absolute; bottom: 0; left: 0; right: 0;
          z-index: 4;
          display: flex; justify-content: center; gap: 0;
          border-top: 1px solid var(--br-faint);
          background: rgba(0,0,0,.6);
          backdrop-filter: blur(12px);
        }
        .br-hero__stat {
          flex: 1; max-width: 240px;
          padding: 1.5rem 2rem; text-align: center;
          border-right: 1px solid var(--br-faint);
        }
        .br-hero__stat:last-child { border-right: none; }
        .br-hero__stat-num {
          display: block; font-size: 1.4rem; font-weight: 200;
          letter-spacing: .04em; color: var(--br-white);
          font-variant-numeric: tabular-nums;
        }
        .br-hero__stat-label {
          display: block; font-size: .6rem; font-weight: 500;
          text-transform: uppercase; letter-spacing: .18em;
          color: var(--br-muted); margin-top: .35rem;
        }

        /* Scroll indicator */
        .br-hero__scroll {
          position: absolute; bottom: 80px; left: 50%; z-index: 4;
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
          margin-bottom: 3rem;
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
            box-shadow: 0 25px 60px -15px rgba(204, 0, 0, 0.2);
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

        /* ═══════════════════ FLEET GRID ═══════════════════ */
        .br-fleet {
          padding: 6rem clamp(2rem, 6vw, 8rem);
          background: transparent;
        }
        .br-fleet__header {
          margin-bottom: 3.5rem;
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
          background: var(--br-card);
          border-radius: 12px;
          text-decoration: none; color: var(--br-white);
          opacity: 0; transform: translateY(40px) scale(0.98);
          transition: transform .7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity .7s ease, background .3s;
        }
        .br-fleet__card::after {
          content: ""; position: absolute; inset: 0;
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.02);
          pointer-events: none;
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
        }
        .br-fleet__card-img {
          object-fit: cover; width: 100%; height: 100%;
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
          width: 0; height: 2px; background: var(--br-red);
          margin-top: 1rem; transition: width .4s ease;
        }
        .br-fleet__card:hover .br-fleet__line { width: 100%; }
        .br-fleet__card-arrow {
          position: absolute; top: 1rem; right: 1rem;
          font-size: .85rem; color: rgba(255,255,255,.2);
          transition: color .3s;
        }
        .br-fleet__card:hover .br-fleet__card-arrow { color: var(--br-red); }

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
          position: relative; z-index: 2;
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
          font-size: clamp(2.4rem, 5vw, 4rem);
          font-weight: 200; letter-spacing: .08em;
          line-height: 1; margin: 0;
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
          display: block; font-size: 1.8rem; font-weight: 200;
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
          .br-hero__stats { flex-direction: column; }
          .br-hero__stat {
            border-right: none;
            border-bottom: 1px solid var(--br-faint);
            padding: 1rem;
          }
          .br-hero__stat:last-child { border-bottom: none; }
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
