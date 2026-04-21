import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  BURGER_HERO,
  BURGER_SHOWCASES,
  BURGER_BRANDS,
} from '../data/burgerHomeData';

import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function BurgerStoreHome({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="bm-home" id="BurgerHome">
      <ScrollRevealClient selector="[data-bm-reveal]" revealClass="bm-vis" />

      {/* ── Back ── */}
      <div className="bm-back">
        <Link href={`/${locale}/shop`} className="bm-back__link">
          ← {L(isUa, 'All Stores', 'Всі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════
          HERO — Full-bleed cinematic with logo
      ════════════════════════════════════════ */}
      <section className="bm-hero">
        {/* Background image */}
        <div className="bm-hero__bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop/burger/hero-engine-bay-moody.jpg"
            alt=""
            aria-hidden="true"
          />
        </div>
        <div className="bm-hero__dim" />

        {/* Typographic watermark */}
        <div className="bm-hero__watermark" aria-hidden="true">
          BURGER
        </div>

        {/* Centered content */}
        <div className="bm-hero__body">
          <p className="bm-hero__eyebrow" data-bm-reveal>
            One Company × Burger Motorsports
          </p>

          <h1 className="sr-only">
            Burger Motorsports — JB4 Performance Tuning
          </h1>

          {/* Brand logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/burger-motorsport.svg"
            alt="Burger Motorsports"
            className="bm-hero__logo"
            data-bm-reveal
            style={{ transitionDelay: '0.1s' }}
          />

          <p className="bm-hero__tagline" data-bm-reveal style={{ transitionDelay: '0.15s' }}>
            {L(isUa, 'JB4 Performance Tuning', 'JB4 Performance Tuning')}
          </p>

          <p className="bm-hero__sub" data-bm-reveal style={{ transitionDelay: '0.2s' }}>
            {L(isUa, BURGER_HERO.subtitle, BURGER_HERO.subtitleUk)}
          </p>

          <div data-bm-reveal style={{ transitionDelay: '0.3s' }}>
            <Link href={`/${locale}/shop/burger/products`} className="bm-cta-primary">
              {L(isUa, 'Explore Catalog', 'Каталог')}
              <span className="cta-arrow">→</span>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="bm-hero__scroll" aria-hidden="true">
          <span>Scroll</span>
          <span className="bm-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════
          HOW JB4 WORKS — Horizontal steps
      ════════════════════════════════════════ */}
      <section className="bm-how">
        <div className="bm-how__label" data-bm-reveal>
          {L(isUa, 'How JB4 Works', 'Як працює JB4')}
        </div>
        <div className="bm-how__steps">
          <div className="bm-step" data-bm-reveal>
            <span className="bm-step__num">01</span>
            <h3>{L(isUa, 'Plug In', 'Підключення')}</h3>
            <p>{L(isUa, 'Connect the JB4 module to your engine harness — no soldering, no wiring cuts, no permanent modifications.', 'Підключіть модуль JB4 до проводки двигуна — без пайки, без різки, без постійних модифікацій.')}</p>
          </div>
          <div className="bm-step" data-bm-reveal style={{ transitionDelay: '0.1s' }}>
            <span className="bm-step__num">02</span>
            <h3>{L(isUa, 'Tune', 'Налаштування')}</h3>
            <p>{L(isUa, 'Select from 8+ performance maps via Bluetooth. Adjust boost, timing, and fueling in real-time through the JB4 mobile app.', 'Оберіть з 8+ мап продуктивності через Bluetooth. Налаштуйте буст, тайминг та подач палива в реальному часі через додаток JB4.')}</p>
          </div>
          <div className="bm-step" data-bm-reveal style={{ transitionDelay: '0.2s' }}>
            <span className="bm-step__num">03</span>
            <h3>{L(isUa, 'Drive', 'Їзда')}</h3>
            <p>{L(isUa, 'Experience gains up to +100 HP with full logging, safety limiters, and instant revert to stock at any time.', 'Отримайте до +100 к.с. з повним логуванням, захисними лімітерами та миттєвим поверненням до заводських налаштувань.')}</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          JB4 TECH — Full-width feature
      ════════════════════════════════════════ */}
      <section className="bm-feature">
        <div className="bm-feature__visual" data-bm-reveal>
          <Image
            src="/images/shop/burger/showcase-jb4.jpg"
            alt="JB4 Performance Chip"
            fill
            className="bm-feature__img"
          />
          <div className="bm-feature__overlay" />
          <div className="bm-feature__caption">
            <span className="bm-feature__tag">
              {L(isUa, 'Flagship', 'Флагман')}
            </span>
            <h2>JB4 Tuning Module</h2>
            <p>
              {isUa
                ? 'Plug & play чіп-тюнінг для 30+ марок. 8 мап продуктивності, Bluetooth логування, повне повернення до заводських параметрів.'
                : 'Plug & play chip tuning for 30+ brands. 8 performance maps, Bluetooth logging, full return to stock parameters.'}
            </p>
            <Link href={`/${locale}/shop/burger/products`} className="bm-feature__link">
              {L(isUa, 'View Products', 'Переглянути')}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PRODUCT LINES — Stacked panels
      ════════════════════════════════════════ */}
      <section className="bm-products">
        <div className="bm-products__label" data-bm-reveal>
          {L(isUa, 'Product Lines', 'Направлення')}
        </div>

        <div className="bm-products__stack">
          {BURGER_SHOWCASES.map((s, idx) => (
            <Link
              key={idx}
              href={`/${locale}${s.link}`}
              className="bm-panel"
              data-bm-reveal
              style={{ transitionDelay: `${idx * 0.08}s` }}
            >
              <div className="bm-panel__img-wrap">
                <Image
                  src={s.imageUrl}
                  alt={L(isUa, s.name, s.nameUk)}
                  fill
                  className="bm-panel__img"
                />
              </div>
              <div className="bm-panel__info">
                <span className="bm-panel__badge">{L(isUa, s.badge, s.badgeUk)}</span>
                <h3>{L(isUa, s.name, s.nameUk)}</h3>
                <p>{L(isUa, s.desc, s.descUk)}</p>
              </div>
              <span className="bm-panel__arrow">→</span>
            </Link>
          ))}
        </div>

        <div className="bm-products__cta" data-bm-reveal>
          <Link href={`/${locale}/shop/burger/products`} className="bm-cta-primary">
            {L(isUa, 'Browse Full Catalog', 'Переглянути весь каталог')}
            <span className="cta-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PLATFORMS — Minimal grid
      ════════════════════════════════════════ */}
      <section className="bm-platforms">
        <div className="bm-platforms__label" data-bm-reveal>
          {L(isUa, 'Supported Platforms', 'Підтримувані платформи')}
        </div>
        <div className="bm-platforms__grid" data-bm-reveal style={{ transitionDelay: '0.1s' }}>
          {BURGER_BRANDS.map((b) => (
            <Link key={b.name} href={`/${locale}${b.link}`} className="bm-platforms__item">
              {b.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
