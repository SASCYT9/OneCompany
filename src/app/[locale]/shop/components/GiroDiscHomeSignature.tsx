import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import type { GirodiscHeroVehicleMake } from '@/lib/girodiscHeroCatalog';
import {
  GIRODISC_HERO,
  GIRODISC_PRODUCT_LINES,
  GIRODISC_MATERIALS,
  GIRODISC_FACTORY_CONTENT,
  GIRODISC_HERITAGE,
} from '../data/girodiscHomeData';
import ScrollRevealClient from './ScrollRevealClient';
import GiroDiscVideoEmbed from './GiroDiscVideoEmbed';
import GirodiscHeroFilter from './GirodiscHeroFilter';

type Props = {
  locale: SupportedLocale;
  availableVehicles?: GirodiscHeroVehicleMake[];
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function GiroDiscHomeSignature({ locale, availableVehicles }: Props) {
  const isUa = locale === 'ua';
  const vehicles = availableVehicles ?? [];

  return (
    <div className="gd-page" id="GirodiscHome">
      <ScrollRevealClient selector="[data-r]" revealClass="is-vis" />

      {/* ── Back ── */}
      <div className="gd__back">
        <Link href={`/${locale}/shop`} className="gd__back-link">
          &larr; {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════
          1 · HERO — Full-bleed Cinematic Video
      ══════════════════════════════════════════════════ */}
      <section className="gd__hero">
        {/* Typographic watermark */}
        <div className="gd__watermark gd__watermark--hero" aria-hidden="true">
          GIRODISC
        </div>

        {/* Ambient video background */}
        <div className="gd__hero-video-wrap">
          <GiroDiscVideoEmbed youtubeId={GIRODISC_HERO.heroVideoId} />
        </div>
        <div className="gd__hero-dim" />

        {/* Content — centered */}
        <div className="gd__hero-body">
          <p className="gd__eyebrow" data-r>
            {L(isUa, GIRODISC_HERO.eyebrow, GIRODISC_HERO.eyebrowUk)}
          </p>
          <h1 className="gd__hero-wordmark" data-r data-r-delay="1">
            <span className="gd__wordmark-text">
              <span className="gd__wordmark-g">G</span>
              <span className="gd__wordmark-sm">IRO</span>
              <span className="gd__wordmark-d">D</span>
              <span className="gd__wordmark-sm">ISC</span>
              <span className="gd__wordmark-r">®</span>
            </span>
            <span className="gd__wordmark-sub">Racing Brakes and Technology</span>
          </h1>
          <p className="gd__hero-tagline" data-r data-r-delay="2">
            {L(isUa, 'Forged Precision', 'Кована Точність')}
          </p>
          <p className="gd__hero-sub" data-r data-r-delay="2">
            {L(isUa, GIRODISC_HERO.subtitle, GIRODISC_HERO.subtitleUk)}
          </p>
          <div data-r data-r-delay="3">
            <Link
              href={`/${locale}${GIRODISC_HERO.primaryButtonLink}`}
              className="gd__cta"
            >
              {L(isUa, GIRODISC_HERO.primaryButtonLabel, GIRODISC_HERO.primaryButtonLabelUk)}
              <span className="gd__cta-arrow">→</span>
            </Link>
          </div>

          <div className="gd__hf-wrap" data-r data-r-delay="4">
            <GirodiscHeroFilter locale={locale} vehicles={vehicles} />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="gd__scroll-hint" aria-hidden="true">
          <span>Scroll</span>
          <span className="gd__scroll-line" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          2 · ENGINEERING EDITORIAL — Sticky Split
      ══════════════════════════════════════════════════ */}
      <section className="gd__editorial">
        {/* Typographic watermark */}
        <div className="gd__watermark gd__watermark--editorial" aria-hidden="true">
          PRECISION
        </div>

        <div className="gd__editorial-header" data-r>
          <p className="gd__eyebrow">
            {L(isUa, 'Engineering', 'Інженерія')}
          </p>
          <h2 className="gd__editorial-title">
            {L(isUa, 'Material Science & Manufacturing', 'Матеріалознавство та виробництво')}
          </h2>
        </div>

        <div className="gd__editorial-split">
          {/* Sticky editorial image */}
          <div className="gd__editorial-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/shop/girodisc/girodisc-cnc.jpg"
              alt={L(isUa, 'GiroDisc CNC Manufacturing', 'ЧПК Виробництво GiroDisc')}
              loading="lazy"
            />
          </div>

          {/* Scrolling content cards */}
          <div className="gd__editorial-content">
            {GIRODISC_MATERIALS.map((mat, idx) => (
              <div
                key={mat.id}
                className="gd__ed-card"
                data-r
                data-r-delay={`${Math.min(idx + 1, 3)}`}
              >
                <h3>{L(isUa, mat.title, mat.titleUk)}</h3>
                <p>{L(isUa, mat.description, mat.descriptionUk)}</p>
                <div className="gd__ed-spec">
                  <span className="gd__ed-spec-val">{mat.spec}</span>
                  <span className="gd__ed-spec-label">
                    {L(isUa, mat.specLabel, mat.specLabelUk)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          3 · PRODUCT CATALOG — Card Grid
      ══════════════════════════════════════════════════ */}
      <section id="catalog" className="gd__catalog">
        <div className="gd__catalog-header" data-r>
          <h2 className="gd__catalog-title">
            {L(isUa, 'Product Range', 'Модельний ряд')}
          </h2>
          <span className="gd__catalog-count">
            {GIRODISC_PRODUCT_LINES.length} {L(isUa, 'categories', 'категорій')}
          </span>
        </div>

        <div className="gd__catalog-grid">
          {GIRODISC_PRODUCT_LINES.map((line, idx) => (
            <Link
              key={line.title}
              href={`/${locale}${line.link}`}
              className="gd__card"
              data-r
              data-r-delay={`${Math.min(idx + 1, 4)}`}
            >
              <div className="gd__card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={line.imageUrl}
                  alt={L(isUa, line.title, line.titleUk)}
                  loading="lazy"
                />
                <span className="gd__card-badge">
                  {L(isUa, line.badge, line.badgeUk)}
                </span>
              </div>
              <div className="gd__card-body">
                <h3>{L(isUa, line.title, line.titleUk)}</h3>
                <p className="gd__card-sub">
                  {L(isUa, line.subtitle, line.subtitleUk)}
                </p>
                <div className="gd__card-tags">
                  <span className="gd__card-tag">{line.tagOne}</span>
                  <span className="gd__card-tag">{line.tagTwo}</span>
                </div>
                <span className="gd__card-link">
                  {L(isUa, 'Explore', 'Дослідити')} <span>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          4 · FACTORY SHOWREEL — Full-bleed Video
      ══════════════════════════════════════════════════ */}
      <section className="gd__showreel">
        <div className="gd__showreel-video">
          <GiroDiscVideoEmbed youtubeId={GIRODISC_FACTORY_CONTENT.videoId} />
        </div>
        <div className="gd__showreel-dim" />

        <div className="gd__showreel-body" data-r>
          <p className="gd__showreel-label">
            {L(isUa, 'Bellingham, WA', 'Беллінгем, Вашингтон')}
          </p>
          <h2 className="gd__showreel-h">
            {L(isUa, GIRODISC_FACTORY_CONTENT.title, GIRODISC_FACTORY_CONTENT.titleUk)}
          </h2>
          <p className="gd__showreel-desc">
            {L(isUa, GIRODISC_FACTORY_CONTENT.description, GIRODISC_FACTORY_CONTENT.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          5 · HERITAGE — Cinematic Closing Statement
      ══════════════════════════════════════════════════ */}
      <section className="gd__heritage">
        <div className="gd__heritage-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GIRODISC_HERITAGE.backgroundImage}
            alt="GiroDisc Heritage"
            loading="lazy"
          />
        </div>
        <div className="gd__heritage-overlay" />

        {/* Typographic watermark */}
        <div className="gd__watermark gd__watermark--heritage" aria-hidden="true">
          GIRODISC
        </div>

        <div className="gd__heritage-body" data-r>
          <p className="gd__heritage-brand">GiroDisc × One Company</p>
          <h2 className="gd__heritage-h2">
            {L(isUa, GIRODISC_HERITAGE.title, GIRODISC_HERITAGE.titleUk)}
          </h2>
          <p className="gd__heritage-desc">
            {L(isUa, GIRODISC_HERITAGE.description, GIRODISC_HERITAGE.descriptionUk)}
          </p>
          <Link
            href={`/${locale}/shop/girodisc/catalog`}
            className="gd__cta"
          >
            {L(isUa, 'Browse Full Catalog', 'Переглянути повний каталог')}
            <span className="gd__cta-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          6 · FOOTER CTA
      ══════════════════════════════════════════════════ */}
      <div className="gd__footer-cta">
        <Link href={`/${locale}/shop/girodisc/catalog`}>
          {L(isUa, 'Explore the Full Range', 'Переглянути повний модельний ряд')}
          <span className="gd__cta-arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
