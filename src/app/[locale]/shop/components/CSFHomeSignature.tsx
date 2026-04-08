import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  CSF_HERO,
  CSF_MATERIALS,
  CSF_PRODUCT_LINES,
  CSF_HERITAGE,
} from '../data/csfHomeData';

import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale; smmSource?: string };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

const CSF_METRICS = [
  { val: '50+', en: 'Years Eng.', ua: 'Років досвіду' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs заводу' },
  { val: '+15%', en: 'B-Tube Trans.', ua: 'Теплообмін' },
  { val: '6061', en: 'Alloy Grade', ua: 'Марка сплаву' },
];

const ALUMINUM_SPECS = [
  { val: '6061-T6', en: 'Alloy Grade', ua: 'Марка сплаву' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs OEM' },
  { val: 'TIG', en: 'Weld Method', ua: 'Тип зварки' },
  { val: '100%', en: 'Aluminum Core', ua: 'Алюмінієва серцевина' },
];

const BTUBE_SPECS = [
  { val: '+15%', en: 'Surface Area', ua: 'Площа теплообміну' },
  { val: 'B-Shape', en: 'Cross Section', ua: 'Поперечний переріз' },
  { val: 'Patent', en: 'CSF Exclusive', ua: 'Тільки CSF' },
  { val: '−20%', en: 'Weight Saving', ua: 'Зниження ваги' },
];

export default function CSFHomeSignature({ locale, smmSource }: Props) {
  const isUa = locale === 'ua';
  const isFromIG = smmSource === 'ig';

  return (
    <div className="csf-home" id="CSFHome">
      <ScrollRevealClient selector="[data-csf-reveal]" revealClass="csf-vis" />

      {/* SMM Greeting Banner */}
      {isFromIG && (
        <div className="bg-black/80 backdrop-blur-md border-b border-white/10 text-center py-3 text-sm text-gray-300 tracking-wide font-medium z-50 relative animate-fade-in">
          {L(isUa, '✨ Welcome from Instagram! Explore the world-class cooling systems featured in our latest Reel.', '✨ Вітаємо з Instagram! Дослідіть охолоджувальні системи світового рівня, які ви бачили в нашому Reel.')}
        </div>
      )}

      {/* Back to Stores */}
      <div className="csf-back">
        <Link href={`/${locale}/shop`} className="csf-back__link">
          ← {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* HERO SECTION */}
      <section className={`csf-hero ${isFromIG ? 'border-t border-[#fca311]/30 shadow-[0_0_50px_rgba(252,163,17,0.1)]' : ''}`} style={{ backgroundImage: `url(${CSF_HERO.heroImageFallback})` }}>
        <div className="csf-hero-overlay" style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, rgba(5,5,5,0.95) 100%)' }} />
        <div className="csf-hero-content rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-8 shadow-2xl transition-all duration-700 hover:border-white/20 hover:shadow-white/5" data-csf-reveal>
          <h1 className="sr-only">
            {L(isUa, 'CSF Racing | Cooling Systems & Radiators', 'CSF Racing | Системи охолодження та радіатори')}
          </h1>
          
          {isFromIG && (
            <div className="mb-4 inline-block px-3 py-1 rounded-full border border-[#fca311]/50 bg-[#fca311]/10 text-[#fca311] text-xs font-bold uppercase tracking-widest">
              {L(isUa, 'Featured Brand', 'Бренд із відео')}
            </div>
          )}

          <p className="csf-hero-title drop-shadow-2xl">
            {L(isUa, 'Thermal', 'Термальна')}<br />
            <span className="csf-text-accent bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-500">{L(isUa, 'Supremacy', 'Перевага')}</span>
          </p>

          <p className="csf-hero-subtitle text-gray-400 font-light max-w-lg mx-auto">
            {L(isUa, CSF_HERO.subtitle, CSF_HERO.subtitleUk)}
          </p>

          <div className="csf-hero-stats gap-6 mt-8">
            {CSF_METRICS.map((s, i) => (
              <div key={i} className="csf-stat-box flex flex-col items-center bg-gray-900/50 rounded-xl p-4 border border-gray-800 transition-all hover:bg-gray-800/80">
                <span className="csf-stat-val text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">{s.val}</span>
                <span className="csf-stat-label text-xs uppercase tracking-wider text-gray-500 mt-1">{L(isUa, s.en, s.ua)}</span>
              </div>
            ))}
          </div>

          <Link href={`/${locale}/shop/csf/collections`} className="csf-btn-primary mt-10 inline-block bg-white text-black px-8 py-4 rounded font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors">
            {L(isUa, 'View Collections', 'Перейти до каталогу')}
          </Link>
        </div>
      </section>

      {/* TECHNICAL SPECIFICATIONS */}
      <section className="csf-specs">
        <div className="csf-specs-grid">
          {/* B-Tube */}
          <div className="csf-spec-card" data-csf-reveal>
            <div className="csf-spec-image">
              <img src={CSF_MATERIALS.btube.image} alt={L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)} />
            </div>
            <div className="csf-spec-body">
              <h3>{L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)}</h3>
              <p>{L(isUa, CSF_MATERIALS.btube.description, CSF_MATERIALS.btube.descriptionUk)}</p>
              <div className="csf-spec-data">
                {BTUBE_SPECS.map((s, idx) => (
                  <div key={idx} className="csf-data-item">
                    <span className="csf-data-val">{s.val}</span>
                    <span className="csf-data-lbl">{L(isUa, s.en, s.ua)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Aluminum */}
          <div className="csf-spec-card" data-csf-reveal style={{ transitionDelay: '0.2s' }}>
            <div className="csf-spec-image">
              <img src={CSF_MATERIALS.aluminum.image} alt={L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)} />
            </div>
            <div className="csf-spec-body">
              <h3>{L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)}</h3>
              <p>{L(isUa, CSF_MATERIALS.aluminum.description, CSF_MATERIALS.aluminum.descriptionUk)}</p>
              <div className="csf-spec-data">
                {ALUMINUM_SPECS.map((s, idx) => (
                  <div key={idx} className="csf-data-item">
                    <span className="csf-data-val">{s.val}</span>
                    <span className="csf-data-lbl">{L(isUa, s.en, s.ua)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODULAR PLATFORM GRID (PRODUCTS) */}
      <section className="csf-products-section">
        <div className="csf-products-header" data-csf-reveal>
          <h2>{L(isUa, 'Cooling Network', 'Мережа Обладнання')}</h2>
        </div>

        <div className="csf-products-grid">
          {CSF_PRODUCT_LINES.map((line, idx) => (
            <Link key={line.id} href={`/${locale}${line.link}`} className="csf-product-card" data-csf-reveal style={{ transitionDelay: `${Math.min(idx * 0.1, 0.4)}s` }}>
              <div className="csf-product-image-container">
                <img src={line.image} alt={L(isUa, line.name, line.nameUk)} />
                <span className="csf-product-badge">{L(isUa, line.badge, line.badgeUk)}</span>
              </div>
              <div className="csf-product-info">
                <h3>{L(isUa, line.name, line.nameUk)}</h3>
                <p>{L(isUa, line.description, line.descriptionUk)}</p>
                <span className="csf-product-action">
                  {L(isUa, 'View Details', 'Переглянути')} &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HERITAGE SECTION */}
      <section className="csf-heritage" data-csf-reveal>
        <div className="csf-heritage-inner">
          <div className="csf-heritage-image">
            <img src={CSF_HERITAGE.fallbackImage} alt="CSF Engineering" />
          </div>
          <div className="csf-heritage-text">
            <h2>{L(isUa, CSF_HERITAGE.title, CSF_HERITAGE.titleUk)}</h2>
            <p>{L(isUa, CSF_HERITAGE.description, CSF_HERITAGE.descriptionUk)}</p>
          </div>
        </div>
      </section>

    </div>
  );
}
