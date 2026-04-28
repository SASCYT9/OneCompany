import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import type { AdroHeroVehicleMake } from '@/lib/adroCatalog';
import { ADRO_PRODUCT_LINES } from '../data/adroHomeData';

import ScrollRevealClient from './ScrollRevealClient';
import AdroVideoEmbed from './AdroVideoEmbed';
import AdroHeroFilter from './AdroHeroFilter';

type Props = {
  locale: SupportedLocale;
  availableVehicles?: AdroHeroVehicleMake[];
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function AdroHomeSignature({ locale, availableVehicles }: Props) {
  const isUa = locale === 'ua';
  const vehicles = availableVehicles ?? [];

  return (
    <div className="adro" id="AdroHome">
      <ScrollRevealClient selector="[data-r]" revealClass="is-vis" />

      {/* ── Back ── */}
      <div className="adro__back">
        <Link href={`/${locale}/shop`} className="adro__back-link">
          &larr; {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════
          1 · HERO — full-bleed video, big type
      ══════════════════════════════════════════════════ */}
      <section className="adro__hero">
        <div className="adro__hero-video">
          <AdroVideoEmbed youtubeId="pyEBZ8jJvZg" />
        </div>
        <div className="adro__hero-dim" />

        <div className="adro__hero-body" data-r>
          <p className="adro__eyebrow">One Company × ADRO</p>
          <h1 className="adro__hero-h">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/shop/adro/adro-logo.svg" alt="ADRO" className="adro__hero-logo" />
          </h1>
          <p className="adro__hero-sub">
            {L(isUa,
              'Prepreg carbon. CFD engineering. Handcrafted precision.',
              'Препрег-карбон. CFD-інженерія. Ручна точність.'
            )}
          </p>
          <Link href={`/${locale}/shop/adro/collections`} className="adro__cta">
            {L(isUa, 'Open Catalog', 'Відкрити каталог')}
            <span className="adro__cta-arrow">→</span>
          </Link>

          <div className="adro__hf-wrap" data-r>
            <AdroHeroFilter locale={locale} vehicles={vehicles} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          2 · SHOWREEL — cinematic GT3 video
      ══════════════════════════════════════════════════ */}
      <section className="adro__reel">
        <div className="adro__reel-video">
          <AdroVideoEmbed youtubeId="LNXs4OI_yNA" />
        </div>
        <div className="adro__reel-dim" />
        <div className="adro__reel-body" data-r>
          <p className="adro__eyebrow">Porsche 992 GT3</p>
          <h2 className="adro__reel-h">
            {L(isUa, 'Born for the Track', 'Народжений для треку')}
          </h2>
        </div>
      </section>

      <section className="adro__collage">
        <div className="adro__collage-grid">
          {/* Row 1 — 4 photos */}
          {[
            { src: '/images/shop/adro/swan-01.webp', alt: 'BMW M4 ADRO — Front quarter' },
            { src: '/images/shop/adro/swan-02.webp', alt: 'BMW M4 ADRO — Rear angle' },
            { src: '/images/shop/adro/swan-03.webp', alt: 'BMW M4 ADRO — Side profile' },
            { src: '/images/shop/adro/swan-04.webp', alt: 'BMW M4 ADRO — Rear quarter' },
          ].map((p, i) => (
            <div key={`t${i}`} className="adro__collage-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} loading="eager" />
            </div>
          ))}

          {/* Row 2 — photo, TEXT CARD (span 2), photo */}
          <div className="adro__collage-cell">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/shop/adro/swan-05.webp" alt="BMW M4 ADRO — Detail" loading="lazy" />
          </div>

          <div className="adro__collage-text" data-r>
            {/* Blurred logo watermark */}
            <div className="adro__collage-watermark" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/shop/adro/adro-logo.svg" alt="" />
            </div>
            <p className="adro__eyebrow">
              {L(isUa, 'Material', 'Матеріал')}
            </p>
            <h2 className="adro__collage-h">Dry Carbon</h2>
            <p className="adro__collage-desc">
              {L(isUa,
                'Technology used in professional motorsport. Autoclave-cured prepreg carbon delivers maximum strength, minimum weight, and a flawless finish.\n\nBuilt for those who accept no compromises.',
                'Технологія, яка використовується у професійному автоспорті. Препрег-карбон з автоклавною обробкою забезпечує максимальну міцність, мінімальну вагу та бездоганний фініш.\n\nСтворено для тих, хто не приймає компромісів.'
              )}
            </p>
          </div>

          <div className="adro__collage-cell">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/shop/adro/swan-06.webp" alt="BMW M4 ADRO — Widebody fender" loading="lazy" />
          </div>

          {/* Row 3 — 4 photos */}
          {[
            { src: '/images/shop/adro/swan-08.webp', alt: 'BMW M4 ADRO — Carbon diffuser' },
            { src: '/images/shop/adro/swan-09.webp', alt: 'BMW M4 ADRO — Wheel arch' },
            { src: '/images/shop/adro/swan-10.webp', alt: 'BMW M4 ADRO — Sharp angle' },
            { src: '/images/shop/adro/swan-11.webp', alt: 'BMW M4 ADRO — Full profile' },
          ].map((p, i) => (
            <div key={`b${i}`} className="adro__collage-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          4 · CATALOG — vehicle cards
      ══════════════════════════════════════════════════ */}
      <section id="catalog" className="adro__catalog">
        <div className="adro__catalog-head" data-r>
          <p className="adro__eyebrow">
            {L(isUa, 'Catalog', 'Каталог')}
          </p>
          <h2 className="adro__catalog-h">
            {L(isUa, 'Shop ADRO Catalog', 'Каталог ADRO')}
          </h2>
        </div>

        <div className="adro__catalog-grid">
          {ADRO_PRODUCT_LINES.map((line, idx) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="adro__card"
              data-r
              style={{ transitionDelay: `${idx * 0.07}s` }}
            >
              <div className="adro__card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={line.image} alt={L(isUa, line.name, line.nameUk)} />
              </div>
              <div className="adro__card-info">
                <span className="adro__card-badge">{L(isUa, line.badge, line.badgeUk)}</span>
                <h3 className="adro__card-name">{L(isUa, line.name, line.nameUk)}</h3>
                <p className="adro__card-desc">{L(isUa, line.description, line.descriptionUk)}</p>
                <span className="adro__card-link">
                  {L(isUa, 'Filter catalog', 'Фільтрувати каталог')} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>


    </div>
  );
}
