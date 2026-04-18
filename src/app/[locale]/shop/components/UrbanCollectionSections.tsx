'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import type {
  UrbanHeroConfig,
  UrbanOverviewConfig,
  UrbanGalleryConfig,
  UrbanVideoPointerConfig,
  UrbanBannerStackConfig,
  UrbanBlueprintConfig,
} from '../data/urbanCollectionPages';

function localize(isUa: boolean, en: string, ua: string) {
  return isUa && ua ? ua : en;
}

function fullUrl(locale: string, path: string): string {
  if (path.startsWith('http') || path.startsWith('#')) return path;
  if (path === '/contact' || path === '/pages/contact') return `/${locale}/contact`;
  if (path.startsWith('/collections/')) {
    const handle = path.replace('/collections/', '');
    return `/${locale}/shop/urban/collections/${handle}#urban-products`;
  }
  return path.startsWith('/') ? `/${locale}${path}` : `/${locale}/${path}`;
}

type UrbanCinematicHeroProps = {
  locale: SupportedLocale;
  config: UrbanHeroConfig;
};

export function UrbanCinematicHero({ locale, config }: UrbanCinematicHeroProps) {
  const isUa = locale === 'ua';
  const sectionRef = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const img = el.querySelector('img');
    if (!img) {
      setLoaded(true);
      return;
    }

    if (img.complete) {
      setLoaded(true);
      return;
    }

    const handleLoad = () => setLoaded(true);
    img.addEventListener('load', handleLoad, { once: true });
    return () => img.removeEventListener('load', handleLoad);
  }, []);

  const ctaUrl = fullUrl(locale, config.buttonLink);

  return (
    <section
      ref={sectionRef}
      id="urban-collection-hero"
      className={`urban-hero urban-hero--collection ${loaded ? 'is-loaded' : ''}`}
      style={
        {
          '--urban-overlay-alpha': config.overlayOpacity / 100,
          '--urban-hero-height-mobile': `${config.mobileHeight}svh`,
          '--urban-hero-height-desktop': `${config.desktopHeight}svh`,
          '--urban-accent': config.accentColor,
        } as React.CSSProperties
      }
    >
      <div className="urban-hero__media">
        {config.externalVideoEmbedUrl ? (
          <iframe
            className="urban-hero__iframe"
            src={`${config.externalVideoEmbedUrl}&muted=1&autoplay=1&loop=1&background=1`}
            title=""
            allow="autoplay; fullscreen"
          />
        ) : (
          <img
            className="urban-hero__image"
            src={config.externalPosterUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      <div className="urban-hero__overlay" aria-hidden />
      <div className="urban-hero__content urban-hero__content--collection">
        <p className="urban-hero__eyebrow">
          {localize(isUa, config.eyebrow, config.eyebrowUk)}
        </p>
        <h1 className="urban-hero__title">
          {localize(isUa, config.title, config.titleUk)}
        </h1>
        <p className="urban-hero__subtitle">
          {localize(isUa, config.subtitle, config.subtitleUk)}
        </p>
        <Link
          href={ctaUrl}
          className="urban-hero__btn urban-hero__btn--primary"
          target={config.buttonNewTab ? '_blank' : undefined}
          rel={config.buttonNewTab ? 'noopener noreferrer' : undefined}
        >
          {localize(isUa, config.buttonLabel, config.buttonLabelUk)}
        </Link>
      </div>
    </section>
  );
}

type UrbanModelOverviewProps = {
  locale: SupportedLocale;
  config: UrbanOverviewConfig;
};

export function UrbanModelOverview({ locale, config }: UrbanModelOverviewProps) {
  const isUa = locale === 'ua';
  const ctaUrl = fullUrl(locale, config.buttonLink);

  return (
    <section
      id="urban-collection-overview"
      className="urban-overview"
      style={
        {
          '--overview-bg': config.backgroundColor,
          '--overview-border': config.borderColor,
          '--overview-copy': config.copyColor,
          paddingTop: `${config.paddingTop}px`,
          paddingBottom: `${config.paddingBottom}px`,
        } as React.CSSProperties
      }
    >
      <div className="urban-overview__container">
        <div className="urban-overview__grid">
          <div className="urban-overview__copy">
            <p className="urban-overview__eyebrow">
              {localize(isUa, config.eyebrow, config.eyebrowUk)}
            </p>
            <h2 className="urban-overview__title">
              {localize(isUa, config.title, config.titleUk)}
            </h2>
            {config.badge && (
              <span className="urban-overview__badge">
                {localize(isUa, config.badge, config.badgeUk)}
              </span>
            )}
            <p className="urban-overview__subtitle">
              {localize(isUa, config.subtitle, config.subtitleUk)}
            </p>
            <p className="urban-overview__description">
              {localize(isUa, config.description, config.descriptionUk)}
            </p>
            {config.highlights.length > 0 && (
              <div className="urban-overview__highlights">
                {config.highlights.map((h, i) => (
                  <p key={i} className="urban-overview__highlight">
                    {localize(isUa, h.text, h.textUk)}
                  </p>
                ))}
              </div>
            )}
            <Link
              href={ctaUrl}
              className="urban-overview__cta"
              target={config.buttonNewTab ? '_blank' : undefined}
              rel={config.buttonNewTab ? 'noopener noreferrer' : undefined}
            >
              {localize(isUa, config.buttonLabel, config.buttonLabelUk)}
            </Link>
          </div>
          <div className="urban-overview__media">
            <img
              src={config.externalImageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

type UrbanGalleryCarouselProps = {
  locale: SupportedLocale;
  config: UrbanGalleryConfig;
};

export function UrbanGalleryCarousel({ locale, config }: UrbanGalleryCarouselProps) {
  const isUa = locale === 'ua';
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = config.slides;
  const canPrev = index > 0;
  const canNext = index < slides.length - 1;

  return (
    <section
      id="urban-collection-gallery"
      className="urban-gallery"
      style={
        {
          '--gallery-bg': config.backgroundColor,
          '--gallery-border': config.borderColor,
          paddingTop: `${config.paddingTop}px`,
          paddingBottom: `${config.paddingBottom}px`,
        } as React.CSSProperties
      }
    >
      <div className="urban-gallery__header">
        <p className="urban-gallery__label">
          {localize(isUa, config.label, config.labelUk)}
        </p>
        <div className="urban-gallery__nav">
          <button
            type="button"
            className="urban-gallery__arrow"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="urban-gallery__arrow"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="urban-gallery__track-wrapper">
        <div
          ref={trackRef}
          className="urban-gallery__track"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translate3d(-${index * (100 / slides.length)}%, 0, 0)`,
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="urban-gallery__slide"
              style={{ flex: `0 0 ${100 / slides.length}%` }}
            >
              <img
                src={slide.externalImageUrl}
                alt={slide.caption}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type UrbanVideoPointerProps = {
  locale: SupportedLocale;
  config: UrbanVideoPointerConfig;
};

export function UrbanVideoPointer({ locale, config }: UrbanVideoPointerProps) {
  const isUa = locale === 'ua';

  return (
    <section
      id="urban-collection-video"
      className="urban-vp"
      style={
        {
          '--vp-bg': config.backgroundColor,
          paddingTop: `${config.paddingTop}px`,
          paddingBottom: `${config.paddingBottom}px`,
        } as React.CSSProperties
      }
    >
      <div className={`urban-vp__wrapper ${config.fullWidth ? 'is-full' : ''}`} style={{ maxWidth: config.fullWidth ? undefined : config.maxWidth }}>
        <iframe
          className="urban-vp__iframe"
          src={config.videoUrl}
          title=""
          allow="autoplay; fullscreen"
        />
        <div
          className="urban-vp__overlay"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,${config.overlayTop / 100}) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,${config.overlayBottom / 100}) 100%)`,
          }}
        />
        <div className="urban-vp__caption">
          <p className="urban-vp__caption-eyebrow">
            {localize(isUa, config.captionEyebrow, config.captionEyebrowUk)}
          </p>
          <p className="urban-vp__caption-title">
            {localize(isUa, config.captionTitle, config.captionTitleUk)}
          </p>
        </div>
      </div>
    </section>
  );
}

type UrbanBannerStackProps = {
  locale: SupportedLocale;
  config: UrbanBannerStackConfig;
};

export function UrbanBannerStack({ locale, config }: UrbanBannerStackProps) {
  const isUa = locale === 'ua';
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('animate');
        });
      },
      { threshold: 0.2 }
    );
    section.querySelectorAll('.urban-stack__item').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="urban-collection-banners"
      className="urban-stack"
      style={
        {
          '--stack-overlay-alpha': config.overlayOpacity / 100,
          '--stack-height-mobile': `${config.mobileHeight}svh`,
          '--stack-height-desktop': `${config.desktopHeight}svh`,
          '--stack-border-color': config.borderColor,
        } as React.CSSProperties
      }
    >
      {config.banners.map((banner, i) => {
        const ctaUrl = fullUrl(locale, banner.buttonLink);
        return (
          <div key={i} className="urban-stack__item">
            <div className="urban-stack__media">
              <img
                className="urban-stack__image"
                src={banner.externalImageUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="urban-stack__veil" aria-hidden />
            <div className="urban-stack__content">
              <div className="urban-stack__caption">
                <p className="urban-stack__caption-eyebrow">
                  {localize(isUa, banner.eyebrow, banner.eyebrowUk)}
                </p>
                <h2 className="urban-stack__caption-title">
                  {localize(isUa, banner.title, banner.titleUk)}
                </h2>
                <p className="urban-stack__caption-sub">
                  {localize(isUa, banner.subtitle, banner.subtitleUk)}
                </p>
                <Link href={ctaUrl} className="urban-stack__caption-cta">
                  {localize(isUa, banner.buttonLabel, banner.buttonLabelUk)}
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

type UrbanBlueprintKitProps = {
  locale: SupportedLocale;
  config: UrbanBlueprintConfig;
};

export function UrbanBlueprintKit({ locale, config }: UrbanBlueprintKitProps) {
  const isUa = locale === 'ua';
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const ctaUrl = fullUrl(locale, config.ctaLink);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.08 }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  const positionLabel = (label: string) => {
    if (!isUa) return label;
    const m: Record<string, string> = {
      front: 'Перед',
      left: 'Ліворуч',
      right: 'Праворуч',
      back: 'Ззаду',
    };
    return m[label.toLowerCase()] ?? label;
  };

  return (
    <section
      ref={rootRef}
      id="urban-collection-blueprint"
      className={`urban-bp ${visible ? 'is-visible' : ''}`}
      style={
        {
          '--bp-bg': config.backgroundColor,
          '--bp-card-bg': config.cardBackground,
          '--bp-text': config.textColor,
          '--bp-muted': config.mutedColor,
          '--bp-sep': config.separatorColor,
          paddingTop: `${config.paddingTop}px`,
          paddingBottom: `${config.paddingBottom}px`,
        } as React.CSSProperties
      }
    >
      <div className="urban-bp__header">
        <p className="urban-bp__eyebrow">
          {localize(isUa, config.eyebrow, config.eyebrowUk)}
        </p>
        <h2 className="urban-bp__heading">
          {localize(isUa, config.heading, config.headingUk)}
        </h2>
        <p className="urban-bp__sub">
          {localize(isUa, config.subheading, config.subheadingUk)}
        </p>
      </div>
      <div className="urban-bp__grid">
        {config.views.map((view, i) => {
          const parts = (isUa ? view.partsUk : view.partsEn).split('|').filter(Boolean);
          const title = localize(isUa, view.titleEn, view.titleUk);
          return (
            <article key={i} className="urban-bp__card">
              <div className="urban-bp__card-media">
                <img
                  src={view.externalImageUrl}
                  alt={title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="urban-bp__card-body">
                <div className="urban-bp__card-head">
                  <p className="urban-bp__card-position">
                    {positionLabel(view.positionLabel)}
                  </p>
                  <h3 className="urban-bp__card-title">{title}</h3>
                  {parts.length > 0 && <div className="urban-bp__card-divider" />}
                </div>
                {parts.length > 0 && (
                  <ul className="urban-bp__card-parts">
                    {parts.map((p, j) => (
                      <li key={j}>{p.trim()}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {config.ctaLabel && config.ctaLink && (
        <div className="urban-bp__cta-row">
          <Link
            href={ctaUrl}
            className="urban-bp__cta"
            target={config.ctaNewTab ? '_blank' : undefined}
            rel={config.ctaNewTab ? 'noopener noreferrer' : undefined}
          >
            {localize(isUa, config.ctaLabel, config.ctaLabelUk)}
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </section>
  );
}
