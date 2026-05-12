"use client";

import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import type { BrabusCollectionPageConfig } from "../data/brabusCollectionPages";

type Props = {
  locale: SupportedLocale;
  config: BrabusCollectionPageConfig;
  productCount: number;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function BrabusCollectionHero({ locale, config, productCount }: Props) {
  const isUa = locale === "ua";

  return (
    <>
      <style jsx global>{`
        .bch {
          --bch-red: #c29d59;
          --bch-muted: rgba(255, 255, 255, 0.4);
          --bch-faint: rgba(255, 255, 255, 0.06);
          background: #0a0a0a; /* solid dark to anchor scope-dark hero region in light theme */
        }
        .bch-hero {
          position: relative;
          width: 100%;
          min-height: 75vh;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          background: #0a0a0a;
        }
        .bch-hero__media {
          position: absolute;
          inset: 0;
        }
        .bch-hero__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .bch-hero__overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.92) 0%,
            rgba(0, 0, 0, 0.3) 50%,
            rgba(0, 0, 0, 0.15) 100%
          );
        }
        .bch-hero__accent {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--bch-red) 15%,
            var(--bch-red) 85%,
            transparent
          );
        }
        .bch-hero__content {
          position: relative;
          z-index: 2;
          padding: 4rem clamp(2rem, 6vw, 8rem);
          width: 100%;
          max-width: 800px;
        }
        .bch-hero__back {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--bch-muted);
          text-decoration: none;
          transition: color 0.3s;
          margin-bottom: 2rem;
          display: inline-block;
        }
        .bch-hero__back:hover {
          color: #fff;
        }
        .bch-hero__eyebrow {
          font-size: 0.6rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          color: var(--bch-red);
          margin: 0 0 0.75rem;
        }
        .bch-hero__title {
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 200;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1.1;
          margin: 0 0 0.5rem;
          color: #fff;
        }
        .bch-hero__subtitle {
          font-size: 0.8rem;
          font-weight: 300;
          color: var(--bch-muted);
          letter-spacing: 0.02em;
          line-height: 1.7;
          max-width: 520px;
          margin: 0 0 2rem;
        }
        .bch-hero__desc {
          font-size: 0.78rem;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.8;
          max-width: 500px;
          margin: 0 0 2rem;
        }
        .bch-hero__meta {
          display: flex;
          align-items: center;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .bch-hero__count {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.6rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--bch-muted);
        }
        .bch-hero__count-num {
          font-size: 1.1rem;
          font-weight: 200;
          color: #fff;
        }

        /* Specs */
        .bch-specs {
          display: flex;
          gap: 0;
          border-top: 1px solid var(--bch-faint);
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(12px);
        }
        .bch-spec {
          flex: 1;
          max-width: 200px;
          padding: 1.5rem 2rem;
          text-align: center;
          border-right: 1px solid var(--bch-faint);
        }
        .bch-spec:last-child {
          border-right: none;
        }
        .bch-spec__val {
          display: block;
          font-size: 1.4rem;
          font-weight: 200;
          color: #fff;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
        }
        .bch-spec__label {
          display: block;
          font-size: 0.55rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--bch-muted);
          margin-top: 0.3rem;
        }

        @media (max-width: 768px) {
          .bch-hero__content {
            padding: 3rem 1.5rem;
          }
          .bch-specs {
            flex-direction: column;
          }
          .bch-spec {
            border-right: none;
            border-bottom: 1px solid var(--bch-faint);
            padding: 1rem;
          }
          .bch-spec:last-child {
            border-bottom: none;
          }
        }
      `}</style>

      <div className="dark bch">
        <section className="bch-hero">
          <div className="bch-hero__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="bch-hero__img"
              src={config.heroImage}
              alt={config.title}
              loading="eager"
            />
          </div>
          <div className="bch-hero__overlay" aria-hidden />
          <div className="bch-hero__accent" aria-hidden />

          <div className="bch-hero__content">
            <Link href={`/${locale}/shop/brabus/collections`} className="bch-hero__back">
              ← {L(isUa, "All Programmes", "Усі програми")}
            </Link>

            <p className="bch-hero__eyebrow">BRABUS</p>

            <h1 className="bch-hero__title">{L(isUa, config.title, config.titleUk)}</h1>
            <p className="bch-hero__subtitle">{L(isUa, config.subtitle, config.subtitleUk)}</p>
            <p className="bch-hero__desc">{L(isUa, config.description, config.descriptionUk)}</p>

            <div className="bch-hero__meta">
              <span className="bch-hero__count">
                <span className="bch-hero__count-num">{productCount}</span>
                {L(isUa, "components", "компонентів")}
              </span>
            </div>
          </div>
        </section>

        {config.specs && config.specs.length > 0 && (
          <div className="bch-specs">
            {config.specs.map((spec, i) => (
              <div key={i} className="bch-spec">
                <span className="bch-spec__val">{spec.val}</span>
                <span className="bch-spec__label">{L(isUa, spec.label, spec.labelUk)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
