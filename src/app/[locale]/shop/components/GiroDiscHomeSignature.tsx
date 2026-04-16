'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import { GIRODISC_HERO, GIRODISC_PRODUCT_LINES, GIRODISC_FACTORY_CONTENT } from '../data/girodiscHomeData';

type Props = { locale: SupportedLocale };

function L<T>(isUa: boolean, en: T, ua: T) {
  return isUa ? ua : en;
}

function locHref(locale: SupportedLocale, path: string) {
  if (path.startsWith('http') || path.startsWith('#')) return path;
  return path.startsWith('/') ? `/${locale}${path}` : `/${locale}/${path}`;
}

export default function GiroDiscHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="giro-tech" id="GirodiscHome">
      {/* ─── Back to Stores ─── */}
      <div className="giro-back">
        <Link href={`/${locale}/shop`} className="giro-back__link">
          <span className="giro-symbol">‹</span> {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ─── TECH HERO ─── */}
      <section className="giro-hero">
        <div className="giro-grid-bg" />
        
        <div className="giro-hero__split">
          <div className="giro-hero__text">
            <div className="giro-hud-line">
              <span className="giro-hud-dot" /> SYSTEM ONLINE
            </div>
            <h1 className="giro-hero__title">
              {L(isUa, 'GIRODISC', 'GIRODISC')}<br/>
              {L(isUa, 'PERFORMANCE', 'ДИНАМІКА')}
            </h1>
            <p className="giro-hero__subtitle">
              <span className="giro-sub-label">SPEC // </span>
              {L(isUa, GIRODISC_HERO.subtitle, GIRODISC_HERO.subtitleUk)}
            </p>
            <div className="giro-hero__actions">
              <Link href={locHref(locale, GIRODISC_HERO.primaryButtonLink)} className="giro-btn giro-btn--primary">
                {L(isUa, GIRODISC_HERO.primaryButtonLabel, GIRODISC_HERO.primaryButtonLabelUk)}
              </Link>
              <Link href={locHref(locale, GIRODISC_HERO.secondaryButtonLink)} className="giro-btn giro-btn--outline">
                {L(isUa, GIRODISC_HERO.secondaryButtonLabel, GIRODISC_HERO.secondaryButtonLabelUk)}
              </Link>
            </div>
          </div>

          <div className="giro-hero__visual">
            <div className="giro-visual-frame">
              <span className="giro-frame-corner top-left" />
              <span className="giro-frame-corner top-right" />
              <span className="giro-frame-corner bottom-left" />
              <span className="giro-frame-corner bottom-right" />
              <Image 
                src={GIRODISC_HERO.heroImageUrl} 
                alt="GiroDisc Hero" 
                fill 
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="giro-hero-img" 
                unoptimized
                priority
              />
              <div className="giro-visual-glow" />
              <div className="giro-visual-overlay" />
              <div className="giro-visual-stats">
                <div className="stat-row">
                  <span>MAX TEMP</span>
                  <span>1400°F</span>
                </div>
                <div className="stat-row">
                  <span>ALLOY</span>
                  <span>CAST IRON</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TECHNICAL SPEC GRID ─── */}
      <section className="giro-specs">
        <div className="giro-section-head">
          <div className="giro-line" />
          <h2>{L(isUa, 'HARDWARE SPECS', 'ТЕХ СПЕЦИФІКАЦІЇ')}</h2>
          <div className="giro-line" />
        </div>

        <div className="giro-specs__grid">
          {GIRODISC_PRODUCT_LINES.map((item) => (
            <Link key={item.title} href={locHref(locale, item.link)} className="giro-spec-card">
              <div className="giro-spec-media">
                <Image 
                  src={item.imageUrl} 
                  alt={item.title} 
                  fill 
                  sizes="(max-width: 768px) 100vw, 25vw"
                  className="giro-spec-img" 
                  unoptimized 
                />
                <div className="giro-spec-tag">{L(isUa, item.badge, item.badgeUk)}</div>
              </div>
              <div className="giro-spec-data">
                <h3>{L(isUa, item.title, item.titleUk)}</h3>
                <p>{L(isUa, item.subtitle, item.subtitleUk)}</p>
                <div className="giro-tech-tags">
                  <span>[{item.tagOne}]</span>
                  <span>[{item.tagTwo}]</span>
                </div>
                <div className="giro-spec-arrow">→</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── CNC FACTORY SECTION ─── */}
      <section className="giro-cnc">
        <div className="giro-cnc__intro">
          <span className="giro-hud-dot" /> 
          <span className="giro-mono-label">FACILITY: USA</span>
          <h2>{L(isUa, GIRODISC_FACTORY_CONTENT.title, GIRODISC_FACTORY_CONTENT.titleUk)}</h2>
          <p>{L(isUa, GIRODISC_FACTORY_CONTENT.description, GIRODISC_FACTORY_CONTENT.descriptionUk)}</p>
        </div>

        <div className="giro-cnc__tiles">
          {GIRODISC_FACTORY_CONTENT.cards.map((card, i) => (
            <div key={card.title} className="giro-cnc-tile">
              <div className="cnc-header">
                <span className="cnc-num">0{i + 1}</span>
                <span className="cnc-line" />
              </div>
              <div className="cnc-media">
                <Image src={card.img} alt={card.title} fill sizes="(max-width: 960px) 100vw, 33vw" className="cnc-img" unoptimized />
                <div className="cnc-img-filter" />
              </div>
              <div className="cnc-info">
                <h4>{L(isUa, card.title, card.titleUk)}</h4>
                <p>{L(isUa, card.desc, card.descUk)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* STYLES */}
      <style jsx global>{`
        .giro-tech {
          --gd-bg: #050505;
          --gd-off-bg: #0a0a0a;
          --gd-border: rgba(255, 255, 255, 0.1);
          --gd-border-hover: rgba(194, 157, 89, 0.5);
          --gd-accent: #c29d59;
          --gd-accent-glow: rgba(194, 157, 89, 0.2);
          --gd-text: #ffffff;
          --gd-muted: #888888;
          --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          --font-sans: var(--font-body, 'Inter', system-ui, sans-serif);
          
          background-color: var(--gd-bg);
          color: var(--gd-text);
          font-family: var(--font-sans);
          padding-bottom: 8rem;
          min-height: 100vh;
        }

        /* typography */
        .giro-tech h1, .giro-tech h2, .giro-tech h3, .giro-tech h4 {
          text-transform: uppercase;
          margin: 0;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        /* Back Link */
        .giro-back {
          position: absolute;
          top: 6rem;
          left: 5%;
          z-index: 50;
        }
        .giro-back__link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--gd-muted);
          text-decoration: none;
          font-size: 0.85rem;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: color 0.3s;
        }
        .giro-back__link:hover {
          color: var(--gd-text);
        }
        .giro-symbol {
          color: var(--gd-accent);
          font-size: 1.2rem;
          line-height: 1;
        }

        /* === HERO SECTION === */
        .giro-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 8rem 5% 4rem;
          overflow: hidden;
        }
        
        .giro-grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(var(--gd-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--gd-border) 1px, transparent 1px);
          background-size: 4rem 4rem;
          opacity: 0.2;
          z-index: 0;
          pointer-events: none;
          mask-image: radial-gradient(circle at center, black 20%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black 20%, transparent 80%);
        }

        .giro-hero__split {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
        }

        @media (max-width: 1024px) {
          .giro-hero__split {
            grid-template-columns: 1fr;
            gap: 3rem;
            margin-top: 4rem;
          }
        }

        /* Hero Text */
        .giro-hud-line {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--gd-accent);
          letter-spacing: 0.1em;
          border: 1px solid var(--gd-border);
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          margin-bottom: 2rem;
          background: rgba(194, 157, 89, 0.05);
        }
        .giro-hud-dot {
          width: 6px;
          height: 6px;
          background-color: var(--gd-accent);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--gd-accent);
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .giro-hero__title {
          font-size: clamp(2.5rem, 5vw, 4.5rem);
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-bottom: 1.5rem;
          line-height: 1.1;
          background: linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));
        }

        .giro-hero__subtitle {
          font-size: clamp(1rem, 1.2vw, 1.25rem);
          color: var(--gd-muted);
          max-width: 500px;
          line-height: 1.6;
          margin-bottom: 3rem;
          font-weight: 300;
        }
        .giro-sub-label {
          font-family: var(--font-mono);
          color: var(--gd-accent);
          font-size: 0.8em;
          font-weight: normal;
        }

        .giro-hero__actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* Buttons */
        .giro-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 3.5rem;
          padding: 0 2rem;
          font-size: 0.85rem;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-decoration: none;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .giro-btn--primary {
          background-color: var(--gd-text);
          color: var(--gd-bg);
          font-weight: 600;
        }
        .giro-btn--primary:hover {
          background-color: var(--gd-accent);
        }

        .giro-btn--outline {
          background-color: transparent;
          color: var(--gd-text);
          border: 1px solid var(--gd-border);
        }
        .giro-btn--outline:hover {
          border-color: var(--gd-accent);
          background-color: rgba(194,157,89, 0.05);
        }

        /* Hero Visual */
        .giro-hero__visual {
          position: relative;
          aspect-ratio: 1 / 1;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .giro-visual-frame {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gd-off-bg);
        }

        .giro-hero-img {
          object-fit: cover;
          opacity: 0.8;
          filter: contrast(1.2) sepia(0.2) hue-rotate(-15deg);
          mix-blend-mode: hard-light;
        }

        .giro-frame-corner {
          position: absolute;
          width: 16px;
          height: 16px;
          border: 2px solid var(--gd-accent);
          z-index: 10;
        }
        .top-left { top: -2px; left: -2px; border-right: none; border-bottom: none; }
        .top-right { top: -2px; right: -2px; border-left: none; border-bottom: none; }
        .bottom-left { bottom: -2px; left: -2px; border-right: none; border-top: none; }
        .bottom-right { bottom: -2px; right: -2px; border-left: none; border-top: none; }

        .giro-visual-overlay {
          position: absolute;
          inset: 0;
          background: inset 0 0 60px var(--gd-bg);
          pointer-events: none;
        }

        .giro-visual-glow {
          position: absolute;
          inset: 15%;
          background: radial-gradient(circle at center, var(--gd-accent-glow) 0%, transparent 70%);
          filter: blur(20px);
          pointer-events: none;
        }

        .giro-visual-stats {
          position: absolute;
          bottom: 2rem;
          right: 2rem;
          background: rgba(5, 5, 5, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--gd-border);
          border-left: 2px solid var(--gd-accent);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          z-index: 10;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          gap: 2rem;
        }
        .stat-row span:first-child { color: var(--gd-muted); }
        .stat-row span:last-child { color: var(--gd-accent); font-weight: bold; }

        @media (max-width: 768px) {
          .giro-visual-stats {
            bottom: 1rem; right: 1rem;
          }
        }

        /* === SPECS SECTION === */
        .giro-specs {
          padding: 6rem 5%;
          max-width: 1600px;
          margin: 0 auto;
        }

        .giro-section-head {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-bottom: 4rem;
        }
        .giro-section-head h2 {
          font-size: 1.5rem;
          font-family: var(--font-mono);
          letter-spacing: 0.2em;
          color: var(--gd-text);
          white-space: nowrap;
        }
        .giro-line {
          flex: 1;
          height: 1px;
          background: var(--gd-border);
        }

        .giro-specs__grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }

        @media (max-width: 1200px) {
          .giro-specs__grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .giro-specs__grid { grid-template-columns: 1fr; }
        }

        .giro-spec-card {
          display: flex;
          flex-direction: column;
          background: var(--gd-off-bg);
          border: 1px solid var(--gd-border);
          text-decoration: none;
          color: var(--gd-text);
          transition: all 0.3s ease;
          position: relative;
        }
        .giro-spec-card:hover {
          border-color: var(--gd-border-hover);
          background: rgba(194, 157, 89, 0.02);
          transform: translateY(-4px);
        }

        .giro-spec-media {
          position: relative;
          aspect-ratio: 4/3;
          overflow: hidden;
          background: #000;
        }
        .giro-spec-img {
          object-fit: cover;
          opacity: 0.7;
          transition: opacity 0.5s, transform 0.5s;
        }
        .giro-spec-card:hover .giro-spec-img {
          opacity: 0.9;
          transform: scale(1.05);
        }

        .giro-spec-tag {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: var(--gd-accent);
          color: #000;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          padding: 0.25rem 0.5rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .giro-spec-data {
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }
        .giro-spec-data h3 {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .giro-spec-data p {
          color: var(--gd-muted);
          font-size: 0.85rem;
          line-height: 1.5;
          flex: 1;
        }

        .giro-tech-tags {
          display: flex;
          gap: 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--gd-muted);
          margin-top: 1rem;
        }

        .giro-spec-arrow {
          position: absolute;
          bottom: 1.5rem;
          right: 1.5rem;
          font-family: var(--font-mono);
          font-size: 1.2rem;
          color: var(--gd-accent);
          opacity: 0;
          transform: translateX(-10px);
          transition: all 0.3s;
        }
        .giro-spec-card:hover .giro-spec-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        /* === CNC FACTORY SECTION === */
        .giro-cnc {
          padding: 4rem 5%;
          max-width: 1600px;
          margin: 0 auto;
        }

        .giro-cnc__intro {
          margin-bottom: 4rem;
          max-width: 800px;
        }
        .giro-mono-label {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          color: var(--gd-accent);
          margin-left: 0.5rem;
          letter-spacing: 0.1em;
        }
        .giro-cnc__intro h2 {
          margin-top: 1.5rem;
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 800;
          margin-bottom: 1.5rem;
        }
        .giro-cnc__intro p {
          font-size: 1.1rem;
          color: var(--gd-muted);
          line-height: 1.6;
        }

        .giro-cnc__tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }

        @media (max-width: 960px) {
          .giro-cnc__tiles { grid-template-columns: 1fr; }
        }

        .giro-cnc-tile {
          border-left: 1px solid var(--gd-border);
          padding-left: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .giro-cnc-tile:hover {
          border-left-color: var(--gd-accent);
        }

        .cnc-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .cnc-num {
          font-family: var(--font-mono);
          color: var(--gd-accent);
          font-size: 1.2rem;
        }
        .cnc-line {
          flex: 1;
          height: 1px;
          background: var(--gd-border);
        }

        .cnc-media {
          position: relative;
          aspect-ratio: 16/10;
          background: #000;
          overflow: hidden;
        }
        .cnc-img {
          object-fit: cover;
          opacity: 0.6;
          filter: grayscale(100%) contrast(1.2);
          transition: all 0.5s;
        }
        .giro-cnc-tile:hover .cnc-img {
          opacity: 0.9;
          filter: grayscale(0%) contrast(1.1);
          transform: scale(1.05);
        }
        .cnc-img-filter {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
          pointer-events: none;
        }

        .cnc-info h4 {
          font-size: 1.3rem;
          margin-bottom: 0.5rem;
        }
        .cnc-info p {
          color: var(--gd-muted);
          font-size: 0.9rem;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
