import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  RACECHIP_HERO,
  RACECHIP_FLAGSHIP,
  RACECHIP_APP,
  RACECHIP_ENGINEERING,
} from '../data/racechipHomeData';
import ScrollRevealClient from './ScrollRevealClient';
import RacechipQuickFinder, { type RacechipMakeModelEntry } from './RacechipQuickFinder';
import '../racechip/racechip-shop.css';

type Props = {
  locale: SupportedLocale;
  makeModels: RacechipMakeModelEntry[];
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function RacechipHomeSignature({ locale, makeModels }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="rc" id="RacechipHome">
      <ScrollRevealClient selector="[data-rc]" revealClass="is-vis" />

      {/* ── Back to Stores ── */}
      <div className="rc__back">
        <Link href={`/${locale}/shop`} className="rc__back-link">
          &larr; {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          1 · HERO — wordmark + finder above-the-fold + product photo
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__hero" id="rc-finder">
        <div className="rc__hero-glow" aria-hidden="true" />

        <div className="rc__hero-grid">
          <div className="rc__hero-copy">
            <p className="rc__eyebrow" data-rc>
              {L(isUa, RACECHIP_HERO.eyebrow, RACECHIP_HERO.eyebrowUk)}
            </p>

            <h1 className="rc__hero-wordmark" data-rc data-rc-delay="1">
              <span className="rc__wordmark-text">RACECHIP</span>
              <span className="rc__wordmark-r">®</span>
              <span className="rc__wordmark-sub">
                {L(isUa, 'Chiptuning — Made in Germany', 'Чіп-тюнінг — Зроблено в Німеччині')}
              </span>
            </h1>

            {/* Finder right under the wordmark — first thing users see */}
            <div className="rc__hero-finder" data-rc data-rc-delay="2">
              <RacechipQuickFinder
                locale={locale}
                makeModels={makeModels}
                variant="hero"
              />
              <p className="rc__hero-finder-note">
                {L(
                  isUa,
                  `${makeModels.length}+ brands · 4,900+ vehicle variants · all certified RaceChip GTS 5 Black`,
                  `${makeModels.length}+ марок · 4 900+ модифікацій · усі сертифіковані RaceChip GTS 5 Black`
                )}
              </p>
            </div>

            <p className="rc__hero-sub" data-rc data-rc-delay="3">
              {L(isUa, RACECHIP_HERO.subtitle, RACECHIP_HERO.subtitleUk)}
            </p>

            <div className="rc__hero-cta-row" data-rc data-rc-delay="4">
              <Link href={`/${locale}/shop/racechip/catalog`} className="rc__cta-ghost">
                {L(isUa, 'Browse full catalog', 'Весь каталог')}
                <span className="rc__cta-arrow">→</span>
              </Link>
            </div>
          </div>

          <div className="rc__hero-product" data-rc data-rc-delay="2">
            <Image
              src={RACECHIP_HERO.heroImage}
              alt="RaceChip GTS 5 Black tuning module"
              width={900}
              height={900}
              priority
              className="rc__hero-product-img"
              unoptimized
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          2 · FLAGSHIP — single product showcase: GTS 5 Black
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__flagship">
        <div className="rc__flagship-inner">
          <div className="rc__flagship-header" data-rc>
            <span className="rc__label">
              {L(isUa, 'The Module', 'Модуль')}
            </span>
            <h2 className="rc__section-title">
              {L(isUa, RACECHIP_FLAGSHIP.title, RACECHIP_FLAGSHIP.titleUk)}
            </h2>
            <p className="rc__flagship-tagline">
              {L(isUa, RACECHIP_FLAGSHIP.tagline, RACECHIP_FLAGSHIP.taglineUk)}
            </p>
          </div>

          <div className="rc__flagship-grid">
            <div className="rc__flagship-media" data-rc>
              <span className="rc__flagship-badge">
                {L(isUa, RACECHIP_FLAGSHIP.badge, RACECHIP_FLAGSHIP.badgeUk)}
              </span>
              <Image
                src={RACECHIP_FLAGSHIP.imageUrl}
                alt={RACECHIP_FLAGSHIP.title}
                width={900}
                height={900}
                className="rc__flagship-img"
                unoptimized
              />
            </div>

            <div className="rc__flagship-copy" data-rc data-rc-delay="1">
              <p className="rc__flagship-desc">
                {L(isUa, RACECHIP_FLAGSHIP.description, RACECHIP_FLAGSHIP.descriptionUk)}
              </p>

              <ul className="rc__flagship-highlights">
                {RACECHIP_FLAGSHIP.highlights.map((h) => (
                  <li key={h.en}>
                    <span className="rc__flagship-highlight-title">
                      <span className="rc__feature-dot" aria-hidden />
                      {L(isUa, h.en, h.uk)}
                    </span>
                    <span className="rc__flagship-highlight-detail">
                      {L(isUa, h.detailEn, h.detailUk)}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/${locale}${RACECHIP_FLAGSHIP.catalogLink}`}
                className="rc__cta rc__flagship-cta"
              >
                {L(isUa, 'Find your fitment', 'Підібрати під авто')}
                <span className="rc__cta-arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          3 · APP CONTROL — real RaceChip app footage
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__app">
        <div className="rc__app-inner">
          <div className="rc__app-media" data-rc>
            <iframe
              className="rc__app-video"
              src={`https://www.youtube-nocookie.com/embed/${RACECHIP_APP.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${RACECHIP_APP.youtubeId}&controls=0&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&playsinline=1`}
              title={RACECHIP_APP.youtubeTitle}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
              aria-hidden="true"
            />
            {/* Click-blocking overlay — keeps hover state from revealing the YouTube chrome */}
            <div className="rc__app-video-shield" aria-hidden="true" />
          </div>

          <div className="rc__app-copy" data-rc data-rc-delay="1">
            <span className="rc__label">{L(isUa, RACECHIP_APP.label, RACECHIP_APP.labelUk)}</span>
            <h2 className="rc__section-title">{L(isUa, RACECHIP_APP.title, RACECHIP_APP.titleUk)}</h2>
            <p className="rc__section-body">
              {L(isUa, RACECHIP_APP.description, RACECHIP_APP.descriptionUk)}
            </p>
            <ul className="rc__feature-list">
              {RACECHIP_APP.features.map((f) => (
                <li key={f.en}>
                  <span className="rc__feature-dot" />
                  {L(isUa, f.en, f.uk)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          4 · ENGINEERING — real product detail photo
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__engineering">
        <div className="rc__engineering-inner">
          <div className="rc__app-copy" data-rc>
            <span className="rc__label">{L(isUa, RACECHIP_ENGINEERING.label, RACECHIP_ENGINEERING.labelUk)}</span>
            <h2 className="rc__section-title">{L(isUa, RACECHIP_ENGINEERING.title, RACECHIP_ENGINEERING.titleUk)}</h2>
            <p className="rc__section-body">
              {L(isUa, RACECHIP_ENGINEERING.description, RACECHIP_ENGINEERING.descriptionUk)}
            </p>
            <ul className="rc__feature-list">
              {RACECHIP_ENGINEERING.features.map((f) => (
                <li key={f.en}>
                  <span className="rc__feature-dot" />
                  {L(isUa, f.en, f.uk)}
                </li>
              ))}
            </ul>
          </div>

          <div className="rc__engineering-media" data-rc data-rc-delay="1">
            <Image
              src={RACECHIP_ENGINEERING.imageUrl}
              alt="RaceChip GTS 5 Black module with App Control"
              width={1200}
              height={900}
              className="rc__engineering-img"
              unoptimized
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          5 · SECONDARY FINDER — duplicate the filter near the end
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__finder-section rc__finder-section--alt">
        <div className="rc__finder-inner">
          <div className="rc__finder-header" data-rc>
            <span className="rc__label">
              {L(isUa, 'Ready to Order?', 'Готові замовити?')}
            </span>
            <h2 className="rc__section-title">
              {L(isUa, 'Pick your car · ship the same day', 'Оберіть авто · відправка день у день')}
            </h2>
          </div>
          <div className="rc__finder-card" data-rc data-rc-delay="1">
            <RacechipQuickFinder locale={locale} makeModels={makeModels} variant="panel" />
          </div>
        </div>
      </section>

    </div>
  );
}
