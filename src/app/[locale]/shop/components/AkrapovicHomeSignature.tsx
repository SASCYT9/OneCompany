"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";

const AkrapovicLogoSvg = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 101.86088 22.968215"
    width="101.86088"
    height="22.968215"
    className={className}
    style={{ display: "block" }}
  >
    <g transform="translate(43.37092,-179.68256)">
      <g transform="matrix(0.26458333,0,0,0.26458333,-46.601834,177.14679)">
        {/* Scorpion (Red) */}
        <path
          fill="#dc0432"
          d="m 12.83,84.79 c 0.42,-2.572 3.922,-21.942 3.922,-21.942 2.1,2.795 4.052,5.333 4.619,6.029 1.199,1.484 3.894,1.752 5.977,0.085 L 44.384,54.488 25.979,32.052 C 19.087,23.274 25.285,10.084 37.141,10.084 h 57.516 c -3.855,3.281 -15.584,13.302 -17.979,15.287 -1.719,1.432 -3.654,1.862 -5.675,1.862 H 54.768 c -1.905,0 -2.834,2.115 -1.562,3.647 l 28.226,34.17 c 1.196,1.358 3.39,0.707 3.723,-1.076 l 2.834,-16.073 c 0.37,-2.066 0.919,-3.756 2.887,-5.429 2.811,-2.398 12.865,-10.95 17.912,-15.24 L 98.674,84.646 C 96.458,96.292 81.571,99.409 74.764,91.248 L 56.91,69.667 c 0,0 -25.5,21.783 -28.136,23.915 C 21.329,99.612 11.52,92.795 12.83,84.79"
        />
        {/* Letters (White) */}
        <path
          fill="#ffffff"
          d="m 395.851,18.37 c 0,0 -16.149,1.157 -17.719,1.253 -1.403,0.089 -2.661,1.204 -2.923,2.682 l -0.43,2.444 h 19.95 z m -182.574,39.523 4.259,-24.189 c 0.618,-3.501 -1.71,-6.339 -5.209,-6.339 l -21.049,0.072 -12.056,68.401 h 9.146 l 4.382,-24.871 3.423,-0.794 1.408,25.665 h 9.287 l -1.843,-28.39 c 2.9,-0.825 7.229,-3.751 8.252,-9.555 m -9.274,0.841 c -0.154,0.852 -0.71,1.263 -1.193,1.404 l -8.529,2.155 4.683,-26.555 8.104,0.036 c 0.541,0 0.903,0.437 0.805,0.979 z M 132.565,27.437 c -3.495,0 -6.822,2.839 -7.439,6.336 l -10.93,62.065 h 9.093 l 4.385,-24.871 9.611,-2.107 -4.753,26.979 h 9.005 l 12.054,-68.401 h -21.026 z m 6.248,32.774 -9.604,2.115 4.513,-25.662 c 0.094,-0.539 0.61,-0.979 1.147,-0.979 h 8.265 z m 48.969,-32.774 h -8.989 l -14.991,32.656 5.754,-32.656 h -9.101 l -12.061,68.401 h 9.106 l 4.9,-27.794 4.335,27.794 h 8.993 l -4.834,-31.409 z m 203.62,0 -14.794,0.004 c -3.499,0 -6.822,2.835 -7.43,6.327 l -9.829,55.727 c -0.617,3.499 1.692,6.398 5.191,6.398 h 14.783 c 3.499,0 6.823,-2.84 7.44,-6.332 l 3.271,-18.595 h -8.98 l -2.797,15.741 c -0.091,0.538 -0.604,0.982 -1.146,0.982 h -7.279 c -0.536,0 -0.899,-0.444 -0.805,-0.982 l 8.803,-49.965 c 0.101,-0.538 0.617,-0.979 1.151,-0.979 h 7.279 c 0.535,0 0.899,0.441 0.805,0.979 l -2.436,13.821 h 9.029 l 2.94,-16.796 c 0.617,-3.491 -1.703,-6.33 -5.196,-6.33 m -161.283,0 c -3.497,0 -6.818,2.839 -7.438,6.336 l -10.926,62.065 h 9.09 l 4.379,-24.854 9.62,-2.115 -4.758,26.969 h 9.004 l 12.055,-68.401 z m 6.251,32.774 -9.606,2.115 4.512,-25.662 c 0.098,-0.539 0.61,-0.979 1.154,-0.979 h 8.26 z m 104.052,-32.774 -13.484,50.248 4.25,-50.248 h -9.098 l -3.644,68.401 h 10.608 l 20.358,-68.401 z m 14.055,0 -12.062,68.401 h 9.111 l 12.058,-68.401 z m -70.414,6.354 c 0.62,-3.512 -1.712,-6.354 -5.222,-6.354 h -21.017 l -12.059,68.401 h 9.137 l 4.386,-24.871 12.035,-3.386 c 2.901,-0.825 7.454,-3.787 8.484,-9.609 z m -13.476,24.795 c -0.149,0.852 -0.754,1.336 -1.24,1.479 l -8.523,2.229 4.663,-26.664 h 8.196 c 0.54,0 0.903,0.44 0.805,0.982 z m 40.924,-31.149 -14.797,0.004 c -3.489,0 -6.815,2.835 -7.428,6.327 l -9.83,55.727 c -0.614,3.499 1.693,6.396 5.192,6.396 h 14.788 c 3.499,0 6.817,-2.838 7.436,-6.33 l 9.836,-55.793 c 0.62,-3.492 -1.708,-6.331 -5.197,-6.331 m -13.14,59.271 c -0.093,0.537 -0.609,0.982 -1.147,0.982 h -7.277 c -0.542,0 -0.898,-0.445 -0.807,-0.982 l 8.824,-50.179 c 0.099,-0.535 0.617,-0.975 1.151,-0.975 h 7.283 c 0.534,0 0.894,0.44 0.803,0.975 z"
        />
      </g>
    </g>
  </svg>
);
import {
  AKRAPOVIC_HERO,
  AKRAPOVIC_GALLERY,
  AKRAPOVIC_PRODUCT_LINES,
  AKRAPOVIC_HERITAGE,
} from "../data/akrapovicHomeData";
import { AKRAPOVIC_SOUNDS } from "../data/akrapovicSoundData";

// Moto data sources
import {
  AKRAPOVIC_MOTO_HERO,
  AKRAPOVIC_MOTO_GALLERY,
  AKRAPOVIC_MOTO_PRODUCT_LINES,
  AKRAPOVIC_MOTO_HERITAGE,
} from "../data/akrapovicMotoHomeData";
import { AKRAPOVIC_MOTO_SOUNDS } from "../data/akrapovicMotoSoundData";

import AkrapovicVideoBackground from "./AkrapovicVideoBackground";
import AkrapovicSoundPlayer from "./AkrapovicSoundPlayer";
import AkrapovicVehicleFilter from "./AkrapovicVehicleFilter";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function AkrapovicHomeSignature({ locale, products, viewerContext }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const searchParams = useSearchParams();
  const segmentParam = searchParams.get("segment");

  // activeSegment state: 'auto' | 'moto' | null. If segmentParam is provided, use it. Otherwise show portal.
  const [activeSegment, setActiveSegment] = useState<"auto" | "moto" | null>(() => {
    if (segmentParam === "auto") return "auto";
    if (segmentParam === "moto") return "moto";
    return null; // Show portal by default if no segment is active
  });

  // Sync state with URL parameter changes (e.g. from header switcher)
  useEffect(() => {
    if (segmentParam === "auto") {
      setActiveSegment("auto");
    } else if (segmentParam === "moto") {
      setActiveSegment("moto");
    } else {
      setActiveSegment(null);
    }
  }, [segmentParam]);

  const handleSegmentChange = (seg: "auto" | "moto" | null) => {
    setActiveSegment(seg);
    const params = new URLSearchParams(window.location.search);
    if (seg) {
      params.set("segment", seg);
    } else {
      params.delete("segment");
    }
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    if (activeSegment === null) return;
    const els = document.querySelectorAll("[data-ak-reveal]");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("ak-vis");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [activeSegment]);

  // Determine current active data
  const isMoto = activeSegment === "moto";
  const currentHero = isMoto ? AKRAPOVIC_MOTO_HERO : AKRAPOVIC_HERO;
  const currentGallery = isMoto ? AKRAPOVIC_MOTO_GALLERY : AKRAPOVIC_GALLERY;
  const currentLines = isMoto ? AKRAPOVIC_MOTO_PRODUCT_LINES : AKRAPOVIC_PRODUCT_LINES;
  const currentSounds = isMoto ? AKRAPOVIC_MOTO_SOUNDS : AKRAPOVIC_SOUNDS;
  const currentHeritage = isMoto ? AKRAPOVIC_MOTO_HERITAGE : AKRAPOVIC_HERITAGE;

  // Filter products by scope
  const filteredProducts = products.filter((p) => {
    if (isMoto) return p.scope === "moto";
    return p.scope !== "moto";
  });

  // Portal selection page
  if (activeSegment === null) {
    return (
      <div className="ak-portal">
        {/* Left Side: Auto */}
        <button
          onClick={() => handleSegmentChange("auto")}
          className="ak-portal__side ak-portal__side--auto group"
          aria-label={L(isUa, "Enter Auto Division", "Перейти до розділу Авто")}
        >
          <div className="ak-portal__bg ak-portal__bg--auto" />
          <div className="ak-portal__overlay" />
          <div className="ak-portal__side-content">
            <span className="ak-portal__subtitle">Akrapovič</span>
            <h2 className="ak-portal__title">Auto</h2>
            <span className="ak-portal__cta-text">
              {L(isUa, "Enter Division", "Перейти до розділу")} →
            </span>
          </div>
        </button>

        {/* Right Side: Moto */}
        <button
          onClick={() => handleSegmentChange("moto")}
          className="ak-portal__side ak-portal__side--moto group"
          aria-label={L(isUa, "Enter Moto Division", "Перейти до розділу Мото")}
        >
          <div className="ak-portal__bg ak-portal__bg--moto" />
          <div className="ak-portal__overlay" />
          <div className="ak-portal__side-content">
            <span className="ak-portal__subtitle">Akrapovič</span>
            <h2 className="ak-portal__title ak-portal__title--moto">Moto</h2>
            <span className="ak-portal__cta-text">
              {L(isUa, "Enter Division", "Перейти до розділу")} →
            </span>
          </div>
        </button>

        {/* Central Logo */}
        <div className="ak-portal__logo-wrap">
          <AkrapovicLogoSvg className="ak-portal__logo" />
        </div>

        {/* Subtle Portal Footer */}
        <footer className="ak-portal__footer">
          <Link href={`/${locale}/shop`} className="ak-portal__footer-link">
            ← {L(isUa, "Back to all stores", "Назад до всіх магазинів")}
          </Link>
          <div className="ak-portal__footer-divider" />
          <span className="ak-portal__footer-text">
            One Company × Akrapovič Official Retail Partner
          </span>
          <div className="ak-portal__footer-divider" />
          <span className="ak-portal__footer-text">© {new Date().getFullYear()} One Company</span>
        </footer>
      </div>
    );
  }

  return (
    <div className={`ak-home ${activeSegment ? "ak-home--has-switcher" : ""}`} id="AkrapovicHome">
      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO (full viewport, center-aligned)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-hero" id="ak-hero-section">
        <AkrapovicVideoBackground
          videoSrc={currentHero.heroVideoUrl}
          fallbackImage={currentHero.heroImageFallback}
          fallbackWidth={currentHero.heroImageWidth}
          fallbackHeight={currentHero.heroImageHeight}
          overlayStyle="hero"
          withAudio
          isMuted
        />

        <div className="ak-hero__content">
          <div className="ak-hero__logo-wrapper">
            <AkrapovicLogoSvg className="ak-hero__logo" />
          </div>

          <p className="ak-hero__overtitle">One Company × Akrapovič {isMoto ? "Moto" : "Auto"}</p>

          <h1 className="sr-only">
            {isMoto
              ? L(
                  isUa,
                  "Akrapovič Exhaust Systems | Motorcycle Racing",
                  "Мотоциклетні вихлопні системи Akrapovič | Перегони та Трек"
                )
              : L(
                  isUa,
                  "Akrapovič Exhaust Systems | Titanium & Carbon",
                  "Автомобільні вихлопні системи Akrapovič | Титан і Карбон"
                )}
          </h1>
          <p className="ak-hero__title">
            {L(isUa, "The Sound of", "Звук")}
            <br />
            <em>
              {isMoto ? L(isUa, "Racing", "Перегонів") : L(isUa, "Perfection", "Досконалості")}
            </em>
          </p>

          <p className="ak-hero__subtitle">
            {L(isUa, currentHero.subtitle, currentHero.subtitleUk)}
          </p>

          <AkrapovicVehicleFilter
            locale={locale}
            products={filteredProducts}
            viewerContext={viewerContext}
            productPathPrefix={`/${locale}/shop/akrapovic/products`}
            filterOnly
            heroCompact
          />
        </div>

        {/* Scroll indicator */}
        <div className="ak-hero__scroll" aria-hidden>
          <div className="ak-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — GALLERY MASONRY (real official photos)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-gallery" data-ak-reveal>
        <div className="ak-gallery__grid">
          {currentGallery.map((item, index) => (
            <article
              key={item.id}
              className={`ak-gallery__card${index === 0 ? " ak-gallery__card--featured" : ""}`}
            >
              <div className="ak-gallery__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt=""
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-lines" data-ak-reveal>
        <div className="ak-lines__header">
          <span className="ak-label">{L(isUa, "Product Lines", "Лінійки продукції")}</span>
          <h2 className="ak-section-title">
            {isMoto
              ? L(isUa, "Built for Your Bike", "Створено для вашого байка")
              : L(isUa, "Engineered for Your Machine", "Створено для вашої машини")}
          </h2>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-lines__track">
          {currentLines.map((line) => (
            <Link key={line.id} href={`/${locale}${line.link}`} className="ak-line-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ak-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                width={line.imageWidth}
                height={line.imageHeight}
                loading="lazy"
                decoding="async"
              />
              <div className="ak-line-card__overlay" />
              <span className="ak-line-card__badge">{L(isUa, line.badge, line.badgeUk)}</span>
              <div className="ak-line-card__content">
                <h3 className="ak-line-card__name">{L(isUa, line.name, line.nameUk)}</h3>
                <p className="ak-line-card__desc">
                  {L(isUa, line.description, line.descriptionUk)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — SOUND COMPARISON GRID (interactive audio)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-sounds" data-ak-reveal>
        <div className="ak-sounds__header">
          <span className="ak-label">{L(isUa, "Hear the difference", "Почуйте різницю")}</span>
          <h2 className="ak-section-title">
            {L(isUa, "Every Engine Has Its Voice", "Кожен двигун має свій голос")}
          </h2>
          <p className="ak-section-sub" style={{ margin: "1.5rem auto 0" }}>
            {isMoto
              ? L(
                  isUa,
                  "Click on any motorcycle to hear the Akrapovič exhaust note. Short clips captured at our test facility.",
                  "Натисніть на будь-який мотоцикл, щоб почути звук вихлопу Akrapovič. Короткі записи з нашого тестувального полігону."
                )
              : L(
                  isUa,
                  "Click on any car to hear the Akrapovič exhaust note. Short clips captured at our test facility.",
                  "Натисніть на будь-яке авто, щоб почути звук вихлопу Akrapovič. Короткі записи з нашого тестувального полігону."
                )}
          </p>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-sounds__grid">
          {currentSounds.map((entry) => (
            <AkrapovicSoundPlayer key={entry.id} entry={entry} isUa={isUa} />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — SOUND WAVE DIVIDER
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 8 + ((i * 13) % 24);
          return (
            <div
              key={i}
              className="ak-wave__bar"
              style={
                {
                  "--h": `${h}px`,
                  animationDelay: `${Number((i * 0.06).toFixed(2))}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6 — HERITAGE (video background + storytelling)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-heritage" data-ak-reveal>
        <AkrapovicVideoBackground
          videoSrc={currentHeritage.videoUrl}
          fallbackImage={currentHeritage.fallbackImage}
          fallbackWidth={currentHeritage.fallbackWidth}
          fallbackHeight={currentHeritage.fallbackHeight}
          overlayStyle="heritage"
          defer
        />

        <div className="ak-heritage__content">
          <span className="ak-label">{L(isUa, "Heritage", "Спадщина")}</span>
          <h2 className="ak-heritage__title">
            {L(isUa, currentHeritage.title, currentHeritage.titleUk)}
          </h2>
          <div className="ak-divider ak-divider--center" />
          <p className="ak-heritage__desc">
            {L(isUa, currentHeritage.description, currentHeritage.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7 — BOTTOM CTA (single, subtle)
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-bottom-cta" data-ak-reveal>
        <span className="ak-label">{L(isUa, "Ready to upgrade?", "Готові до апгрейду?")}</span>
        <br />
        <Link
          href={`/${locale}/shop/akrapovic/collections${isMoto ? "?scope=moto" : ""}`}
          className="ak-btn"
        >
          {L(isUa, "Explore Catalog", "Переглянути каталог")}
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
