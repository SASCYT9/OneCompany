import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  GIRODISC_HERO,
  GIRODISC_STATS,
  GIRODISC_PRODUCT_LINES,
  GIRODISC_MATERIALS,
  GIRODISC_HERITAGE,
} from '../data/girodiscHomeData';

import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function GiroDiscHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="gd-home" id="GiroDiscHome">
      <ScrollRevealClient selector="[data-gd-dyn]" revealClass="gd-in" />

      {/* ── Back to Stores ── */}
      <div className="gd-back">
        <Link href={`/${locale}/shop`} className="gd-back__link">
          ← {L(isUa, 'Stores', 'Магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          1. ASYMMETRIC HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-hero-asym">
        <div className="gd-hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GIRODISC_HERO.heroImageFallback} alt="GiroDisc Splash" />
        </div>
        <div className="gd-hero-gradient"></div>

        <div className="gd-hero-text" data-gd-dyn>
          <h1 className="sr-only">
            {L(isUa, 'GiroDisc | High Performance Brake Rotors', 'GiroDisc | Високопродуктивні гальмівні диски')}
          </h1>
          <p className="gd-htitle">
            <span>Braking</span>
            <span>Forged</span>
          </p>
          <p className="gd-hsubtitle">
            {L(isUa, GIRODISC_HERO.subtitle, GIRODISC_HERO.subtitleUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          2. SLANT STATS
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-slanted-stats" data-gd-dyn>
        <div className="gd-stat-inc">
          {GIRODISC_STATS.map((s, i) => (
            <div key={i} className="gd-stat-block">
               <span className="gd-stat-val">{s.val}</span>
               <span className="gd-stat-lab">{L(isUa, s.en, s.ua)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          3. EDITORIAL SPLIT (MATERIALS)
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-editorial">
        <div className="gd-ed-header" data-gd-dyn>
           <h2>{L(isUa, 'Performance Architecture', 'Архітектура')}</h2>
        </div>
        
        <div className="gd-ed-split">
           <div className="gd-ed-sticky-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GIRODISC_MATERIALS[1].image} alt="Factory Machining" />
           </div>
           <div className="gd-ed-content-scroll">
              {GIRODISC_MATERIALS.map((mat, i) => (
                <div key={i} className="gd-ed-block" data-gd-dyn>
                  <h3>{L(isUa, mat.title, mat.titleUk)}</h3>
                  <p>{L(isUa, mat.description, mat.descriptionUk)}</p>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          4. ASYMMETRIC HARDWARE STACK
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-hw-stack">
        {GIRODISC_PRODUCT_LINES.map((line, idx) => (
          <Link key={idx} href={line.link} className="gd-hw-item" data-gd-dyn>
             <div className="gd-hw-item-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={line.image} alt={L(isUa, line.name, line.nameUk)} loading="lazy" />
             </div>
             <div className="gd-hw-item-text">
                <span className="gd-pad">{L(isUa, line.badge, line.badgeUk)}</span>
                <h3>{L(isUa, line.name, line.nameUk)}</h3>
                <p>{L(isUa, line.description, line.descriptionUk)}</p>
             </div>
          </Link>
        ))}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          5. FULL BLEED HERITAGE VIDEO
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-fact-video">
         {GIRODISC_HERITAGE.videoUrl ? (
            <iframe 
               src={`${GIRODISC_HERITAGE.videoUrl}&mute=1&autoplay=1&loop=1`} 
               title="GiroDisc Factory Video"
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
               allowFullScreen
            ></iframe>
         ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={GIRODISC_HERITAGE.fallbackImage} alt="GiroDisc Factory" />
         )}
         <div className="gd-fact-overlay" data-gd-dyn>
            <h2><span>Precision</span> Crafted</h2>
            <p>{L(isUa, GIRODISC_HERITAGE.description, GIRODISC_HERITAGE.descriptionUk)}</p>
         </div>
      </section>

    </div>
  );
}
