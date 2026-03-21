'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import { URBAN_HERO, URBAN_FEATURED_MODELS } from '../data/urbanHomeData';
import { URBAN_SHOWCASES } from '../data/urbanShowcasesData';
import UrbanThemeScript from './UrbanThemeScript';

const HOME_ID = 'UrbanHomeV7';
const ONE_COMPANY_LOGO = 'https://onecompany.global/branding/logo-light.svg';
const URBAN_LOGO = '/images/shop/urban/svgs/logo.svg';
const WIDETRACK_LOGO = '/images/shop/urban/svgs/widetrack.svg';
const DEFENDER_IMG = '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp';

type UrbanHomeSignatureProps = {
  locale: SupportedLocale;
};

function localize(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

function localizeHref(locale: SupportedLocale, href: string) {
  if (href.startsWith('http') || href.startsWith('#')) {
    return href;
  }

  return href.startsWith('/') ? `/${locale}${href}` : `/${locale}/${href}`;
}

export default function UrbanHomeSignature({ locale }: UrbanHomeSignatureProps) {
  const isUa = locale === 'ua';

  return (
    <>
      <div className="urban-back-to-stores">
        <Link href={`/${locale}/shop`} className="urban-back-to-stores__link">
          ← {isUa ? 'Усі наші магазини' : 'All our stores'}
        </Link>
      </div>

      <section
        className="uh7"
        id={HOME_ID}
        style={
          {
            '--accent': '#f5f5f3',
            '--hero-h-mobile': '90vh',
            '--hero-h-desktop': '90vh',
            '--overlay-alpha': 0.25,
            '--logo-w': '220px',
          } as React.CSSProperties
        }
      >
        <UrbanThemeScript />

        <div className="uh7-progress" aria-hidden>
          <div className="uh7-progress__bar" id={`${HOME_ID}-progress`} />
        </div>

        <div className="uh7-loader" id={`${HOME_ID}-loader`} aria-hidden>
          <div className="uh7-loader__brand" aria-label="One Company x Urban Automotive">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="uh7-loader__brand-one" src={ONE_COMPANY_LOGO} alt="One Company" width={422} height={155} />
            <span className="uh7-loader__brand-x" aria-hidden>x</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="uh7-loader__brand-urban" src={URBAN_LOGO} alt="Urban Automotive" width={643} height={101} />
          </div>
          <div className="uh7-loader__bar">
            <div className="uh7-loader__bar-fill" />
          </div>
        </div>

        <div className="uh7-hero" id={`${HOME_ID}-hero`}>
          <div className="uh7-hero__media">
            <div className="uh7-hero__parallax" data-uh7-parallax="hero">
              <Image
                src={URBAN_HERO.heroImageUrl}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
          <div className="uh7-hero__overlay" aria-hidden />
          <div className="uh7-hero__letterbox uh7-hero__letterbox--top" aria-hidden />
          <div className="uh7-hero__letterbox uh7-hero__letterbox--bot" aria-hidden />
          <div className="uh7-shutter" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="uh7-shutter__p" style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <div className="uh7-hero__frame" aria-hidden>
            <span className="uh7-hero__frame-v uh7-hero__frame-v--l" />
            <span className="uh7-hero__frame-v uh7-hero__frame-v--r" />
          </div>
          <div className="uh7-hero__corner uh7-hero__corner--tl" aria-hidden />
          <div className="uh7-hero__corner uh7-hero__corner--tr" aria-hidden />
          <div className="uh7-hero__corner uh7-hero__corner--bl" aria-hidden />
          <div className="uh7-hero__corner uh7-hero__corner--br" aria-hidden />
          <div className="uh7-hero__particles" aria-hidden>
            {[
              { left: '8%', bottom: '10%', dur: 9, dly: 0 },
              { left: '22%', bottom: '5%', dur: 11, dly: 1.5 },
              { left: '38%', bottom: '15%', dur: 8, dly: 3 },
              { left: '55%', bottom: '8%', dur: 10, dly: 0.8 },
              { left: '68%', bottom: '12%', dur: 12, dly: 2.2 },
              { left: '82%', bottom: '6%', dur: 9, dly: 4 },
              { left: '92%', bottom: '18%', dur: 10, dly: 1 },
              { left: '15%', bottom: '20%', dur: 13, dly: 5 },
              { left: '45%', bottom: '3%', dur: 7, dly: 2.8 },
              { left: '75%', bottom: '22%', dur: 11, dly: 3.5 },
            ].map((p, i) => (
              <div
                key={i}
                className="uh7-hero__particle"
                style={{
                  left: p.left,
                  bottom: p.bottom,
                  ['--dur' as string]: p.dur + 's',
                  ['--dly' as string]: p.dly + 's',
                }}
              />
            ))}
          </div>
          <span className="uh7-hero__side-text uh7-hero__side-text--l" aria-hidden>
            {isUa ? 'Засн. 2015 — Бірмінгем, Англія' : 'Est. 2015 — Birmingham, England'}
          </span>
          <span className="uh7-hero__side-text uh7-hero__side-text--r" aria-hidden>
            {isUa ? 'Офіційний постачальник Urban в Україні' : 'Official Urban Supplier in Ukraine'}
          </span>
          <div className="uh7-hero__glow" aria-hidden />
          <div className="uh7-hero__content">
            <div className="uh7-hero__brand" aria-label="One Company x Urban Automotive">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="uh7-hero__brand-one" src={ONE_COMPANY_LOGO} alt="One Company" width={422} height={155} />
              <span className="uh7-hero__brand-x" aria-hidden>x</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="uh7-hero__brand-urban" src={URBAN_LOGO} alt="Urban Automotive" width={643} height={101} />
            </div>
            <p className="uh7-hero__eyebrow">{localize(isUa, URBAN_HERO.eyebrow, URBAN_HERO.eyebrowUk)}</p>
            <h1 className="uh7-hero__title" data-uh7-split>
              {localize(isUa, URBAN_HERO.title, URBAN_HERO.titleUk)}
              <span className="uh7-hero__title-shimmer" aria-hidden>
                {localize(isUa, URBAN_HERO.title, URBAN_HERO.titleUk)}
              </span>
            </h1>
            <p className="uh7-hero__subtitle">
              {localize(isUa, URBAN_HERO.subtitle, URBAN_HERO.subtitleUk)}
            </p>
            <p className="uh7-hero__official">
              {isUa ? 'One Company × Urban Automotive' : 'One Company × Urban Automotive'}
            </p>
            <div className="uh7-hero__buttons">
              <Link
                href={localizeHref(locale, URBAN_HERO.primaryButtonLink)}
                className="uh7-btn uh7-btn--primary uh7-mag"
              >
                {localize(isUa, URBAN_HERO.primaryButtonLabel, URBAN_HERO.primaryButtonLabelUk)}
              </Link>
              <a
                href={URBAN_HERO.secondaryButtonLink}
                target={URBAN_HERO.secondaryButtonNewTab ? '_blank' : undefined}
                rel={URBAN_HERO.secondaryButtonNewTab ? 'noopener noreferrer' : undefined}
                className="uh7-btn uh7-btn--secondary uh7-mag"
              >
                {localize(isUa, URBAN_HERO.secondaryButtonLabel, URBAN_HERO.secondaryButtonLabelUk)}
              </a>
            </div>
          </div>
        </div>

        <div className="uh7-trust uh7-rv" data-uh7-reveal>
          <div className="uh7-trust__item">
            <svg className="uh7-trust__icon" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {isUa
              ? 'Офіційні програми Urban Automotive в Україні'
              : 'Official Urban Automotive programmes in Ukraine'}
          </div>
          <div className="uh7-trust__item">
            <svg className="uh7-trust__icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            {isUa ? 'Доставка по всьому світу' : 'Worldwide Delivery'}
          </div>
          <div className="uh7-trust__item">
            <svg className="uh7-trust__icon" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {isUa ? 'Ручна робота в Англії' : 'Handcrafted in England'}
          </div>
          <div className="uh7-trust__item">
            <svg className="uh7-trust__icon" viewBox="0 0 24 24">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="m16 8 4 2.5v6.5a1 1 0 0 1-1 1h-2" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            {isUa ? 'Онлайн-магазин' : 'Shop Online'}
          </div>
        </div>

        <div className="uh7-showcases" id={`${HOME_ID}-showcases`}>
          {URBAN_SHOWCASES.map((s) => (
            <div key={s.num} className="uh7-sc uh7-rv-s" data-uh7-reveal>
              <div className="uh7-sc__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="uh7-sc__img"
                  data-uh7-parallax="sc"
                  src={s.imageUrl}
                  alt={s.imageAlt}
                  loading="lazy"
                />
                <iframe
                  className="uh7-sc__vimeo"
                  data-uh7-vimeo
                  data-src={s.vimeoUrl}
                  allow="autoplay"
                  loading="lazy"
                  aria-hidden
                  title=""
                />
              </div>
              <div className="uh7-sc__overlay" aria-hidden />
              <span className="uh7-sc__num">{s.num}</span>
              <div className="uh7-sc__content">
                <span className="uh7-sc__badge">{localize(isUa, s.badge, s.badgeUk)}</span>
                <h2 className="uh7-sc__name">
                  {localize(isUa, s.name, s.nameUk).split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i === 0 ? <br /> : null}
                    </span>
                  ))}
                </h2>
                <p className="uh7-sc__sub">{localize(isUa, s.subtitle, s.subtitleUk)}</p>
                <div className="uh7-sc__actions">
                  <Link
                    className="uh7-sc__cta uh7-mag"
                    href={s.exploreLink.startsWith('#') ? s.exploreLink : `/${locale}${s.exploreLink}`}
                  >
                    {isUa ? 'Дослідити' : 'Explore'}
                    <svg viewBox="0 0 24 24">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                  <Link
                    className="uh7-btn uh7-btn--shop uh7-mag"
                    href={s.shopLink.startsWith('#') ? s.shopLink : `/${locale}${s.shopLink}`}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    {isUa ? 'Замовити' : 'Shop Programme'}
                  </Link>
                  <span className="uh7-sc__avail">
                    <span className="uh7-sc__avail-dot" aria-hidden />
                    {localize(isUa, s.avail, s.availUk)}
                  </span>
                </div>
              </div>
              <div className="uh7-sc__divider" aria-hidden />
            </div>
          ))}
        </div>

        <div className="uh7-fleet" id={`${HOME_ID}-fleet`}>
          <div className="uh7-shdr uh7-rv" data-uh7-reveal>
            <div className="uh7-shdr__rule" />
            <p className="uh7-shdr__label">{isUa ? 'Преміальний модельний ряд' : 'Curated Premium Fleet'}</p>
            <h2 className="uh7-shdr__title">
              {isUa ? 'Кожна модель — витвір мистецтва' : 'Every Model, a Masterpiece'}
            </h2>
            <p className="uh7-shdr__desc">
              {isUa ? 'Оберіть свій Urban — ми доставимо по всьому світу' : 'Choose your Urban — worldwide delivery'}
            </p>
          </div>
          <div className="uh7-fleet__grid uh7-stg" data-uh7-reveal>
            {URBAN_FEATURED_MODELS.map((model) => (
              <Link
                key={model.title}
                href={localizeHref(locale, model.link)}
                className="uh7-card"
                data-uh7-tilt
              >
                <div className="uh7-card__inner">
                  <div className="uh7-card__media">
                    <Image
                      src={model.imageUrl}
                      alt={localize(isUa, model.title, model.titleUk)}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="uh7-card__light" aria-hidden />
                  <div className="uh7-card__light-warm" aria-hidden />
                  <div className="uh7-card__holo" aria-hidden />
                  <div className="uh7-card__gradient" aria-hidden />
                  <div className="uh7-card__vignette" aria-hidden />
                  <span className="uh7-card__shop">{isUa ? 'Дослідити' : 'Explore'}</span>
                  <div className="uh7-card__content">
                    <span className="uh7-card__badge">
                      {localize(isUa, model.badge, model.badgeUk)}
                    </span>
                    <h3 className="uh7-card__title">{localize(isUa, model.title, model.titleUk)}</h3>
                    <p className="uh7-card__subtitle">
                      {localize(isUa, model.subtitle, model.subtitleUk)}
                    </p>
                    <div className="uh7-card__tags">
                      <span className="uh7-card__tag">{model.tagOne}</span>
                      <span className="uh7-card__tag">{model.tagTwo}</span>
                    </div>
                  </div>
                  <div className="uh7-card__arrow" aria-hidden>
                    <svg viewBox="0 0 24 24">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="uh7-def">
          <div className="uh7-def__hero" id={`${HOME_ID}-def-hero`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="uh7-def__hero-img"
              src={DEFENDER_IMG}
              alt="Urban Automotive Defender Widetrack"
              loading="lazy"
            />
            <div className="uh7-def__hero-overlay" aria-hidden />
            <div className="uh7-def__hero-content">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="uh7-def__widetrack-logo" src={WIDETRACK_LOGO} alt="Widetrack" loading="lazy" />
              <h2 className="uh7-def__title">
                {isUa ? <>Домінування<br />Widetrack</> : <>Widetrack<br />Domination</>}
              </h2>
              <p className="uh7-def__subtitle">
                {isUa
                  ? 'Найкращі Defender у світі. Карбонові аеродинамічні пакети, розширені арки та ексклюзивне оздоблення — все виготовлено вручну у Великій Британії.'
                  : "The world's finest Defenders. Carbon aero packages, widened arches and bespoke finishing — all hand-built in Great Britain."}
              </p>
              <div className="uh7-def__features">
                <div className="uh7-def__feat">
                  <div className="uh7-def__feat-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <span className="uh7-def__feat-text">{isUa ? 'Візуальний карбон' : 'Visual Carbon'}</span>
                </div>
                <div className="uh7-def__feat">
                  <div className="uh7-def__feat-icon">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                  </div>
                  <span className="uh7-def__feat-text">{isUa ? 'Ковані диски' : 'Forged Wheels'}</span>
                </div>
                <div className="uh7-def__feat">
                  <div className="uh7-def__feat-icon">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <span className="uh7-def__feat-text">{isUa ? 'Ручна збірка' : 'Hand Built'}</span>
                </div>
              </div>
              <Link href={`/${locale}/shop/urban/collections/land-rover-defender-110`} className="uh7-def__cta">
                {isUa ? 'Дослідити Defender' : 'Explore Defender'}
                <svg viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
            <div className="uh7-def__stats">
              <div className="uh7-def__stat">
                <p className="uh7-def__stat-num">90 / 110 / 130</p>
                <p className="uh7-def__stat-label">{isUa ? 'Модельний ряд' : 'Model Range'}</p>
              </div>
              <div className="uh7-def__stat">
                <p className="uh7-def__stat-num">Widetrack</p>
                <p className="uh7-def__stat-label">{isUa ? 'Фірмова програма' : 'Signature Programme'}</p>
              </div>
              <div className="uh7-def__stat">
                <p className="uh7-def__stat-num">Carbon</p>
                <p className="uh7-def__stat-label">{isUa ? 'Аеро пакет' : 'Aero Package'}</p>
              </div>
              <div className="uh7-def__stat">
                <p className="uh7-def__stat-num">UK</p>
                <p className="uh7-def__stat-label">{isUa ? 'Виробництво' : 'Hand Built'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
