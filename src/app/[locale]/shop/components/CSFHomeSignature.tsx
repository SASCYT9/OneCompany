import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  CSF_HERO,
  CSF_MATERIALS,
  CSF_PRODUCT_LINES,
  CSF_HERITAGE,
} from '../data/csfHomeData';

// Extracted client logic
import CSFCanvas from './canvas/CSFCanvas';
import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ── Contextual Metrics — Cooling Performance specific ── */
const CSF_METRICS = [
  { val: '50+', en: 'Years Eng.', ua: 'Років досвіду' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs заводу' },
  { val: '+15%', en: 'B-Tube Trans.', ua: 'Теплообмін' },
  { val: '6061', en: 'Alloy Grade', ua: 'Марка сплаву' },
];

/* ── Material specs — more data-driven ── */
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

export default function CSFHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="csf-home" id="CSFHome">
      <ScrollRevealClient selector="[data-csf-reveal]" revealClass="csf-vis" />

      {/* ── Blueprint Grid & Canvas ── */}
      <CSFCanvas />

      {/* ── Back to Stores ── */}
      <div className="csf-back">
        <Link href={`/${locale}/shop`} className="csf-back__link">
          ← {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — THERMAL LAB BLUEPRINT HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="csf-blueprint-hero">
        <div className="csf-hud">
          [SYS_OK] THERMAL DYNAMICS V.4.1<br/>
          {new Date().toISOString().split('T')[0]} 
        </div>

        <div className="csf-blueprint-hero__inner" data-csf-reveal>
          <h1 className="sr-only">
            {L(isUa, 'CSF Racing | Cooling Systems & Radiators', 'CSF Racing | Системи охолодження та радіатори')}
          </h1>
          <p className="csf-hero-title">
            {L(isUa, 'Thermal', 'Термальна')}<br />
            {L(isUa, 'Supremacy', 'Перевага')}
          </p>

          <p className="csf-hero-subtitle">
            {L(isUa, CSF_HERO.subtitle, CSF_HERO.subtitleUk)}
          </p>

          {/* HUD Stats Row */}
          <div className="csf-hud-stats">
            {CSF_METRICS.map((s, i) => (
              <div key={i} className="csf-stat-box">
                <span className="csf-stat-val">{s.val}</span>
                <span className="csf-stat-label">{L(isUa, s.en, s.ua)}</span>
              </div>
            ))}
          </div>

          <Link href={`/${locale}/shop/csf/collections`} className="csf-btn">
            {L(isUa, 'Initialize Cooling', 'Активувати Охолодження')}
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — TECHNICAL SPECIFICATIONS
      ════════════════════════════════════════════════════════════════ */}
      <section className="csf-tech-specs">
        <div className="csf-tech-grid">
          
          {/* B-Tube */}
          <div className="csf-spec-card" data-csf-reveal>
            <div className="csf-spec-image-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CSF_MATERIALS.btube.image} alt={L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)} />
            </div>
            <div className="csf-spec-content">
              <h3 className="csf-spec-title">{L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)}</h3>
              <p className="csf-spec-desc">{L(isUa, CSF_MATERIALS.btube.description, CSF_MATERIALS.btube.descriptionUk)}</p>
              
              <div className="csf-data-grid">
                {BTUBE_SPECS.map((s, idx) => (
                  <div key={idx} className="csf-data-cell">
                    <span className="csf-data-val">{s.val}</span>
                    <span className="csf-data-label">{L(isUa, s.en, s.ua)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Aluminum */}
          <div className="csf-spec-card" data-csf-reveal style={{ transitionDelay: '0.2s' }}>
            <div className="csf-spec-image-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CSF_MATERIALS.aluminum.image} alt={L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)} />
            </div>
            <div className="csf-spec-content">
              <h3 className="csf-spec-title">{L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)}</h3>
              <p className="csf-spec-desc">{L(isUa, CSF_MATERIALS.aluminum.description, CSF_MATERIALS.aluminum.descriptionUk)}</p>
              
              <div className="csf-data-grid">
                {ALUMINUM_SPECS.map((s, idx) => (
                  <div key={idx} className="csf-data-cell">
                    <span className="csf-data-val">{s.val}</span>
                    <span className="csf-data-label">{L(isUa, s.en, s.ua)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — MODULAR PLATFORM GRID
      ════════════════════════════════════════════════════════════════ */}
      <section className="csf-modular-section">
        <div className="csf-section-header" data-csf-reveal>
          <h2>{L(isUa, 'Cooling Network', 'Мережа Обладнання')}</h2>
        </div>

        <div className="csf-platform-grid">
          {CSF_PRODUCT_LINES.map((line, idx) => (
            <Link key={line.id} href={line.link} className="csf-platform-card" data-csf-reveal style={{ transitionDelay: `${idx * 0.1}s` }}>
              <span className="csf-platform-badge">{L(isUa, line.badge, line.badgeUk)}</span>
              <h3 className="csf-platform-title">{L(isUa, line.name, line.nameUk)}</h3>
              <p className="csf-platform-desc">{L(isUa, line.description, line.descriptionUk)}</p>
              <div className="csf-platform-link">
                {L(isUa, 'View Details', 'Переглянути')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HERITAGE TERMINAL
      ════════════════════════════════════════════════════════════════ */}
      <section className="csf-terminal-section" data-csf-reveal>
        <div className="csf-terminal-window">
          <div className="csf-terminal-header">
            <div className="csf-terminal-dot"></div>
            <div className="csf-terminal-dot"></div>
            <div className="csf-terminal-dot"></div>
          </div>
          <div className="csf-terminal-body">
            <p><span>&gt;</span> INIT CSF_HISTORY_MODULE</p>
            <p><span>&gt;</span> {L(isUa, CSF_HERITAGE.title, CSF_HERITAGE.titleUk)}</p>
            <br />
            <p>{L(isUa, CSF_HERITAGE.description, CSF_HERITAGE.descriptionUk)}</p>
            <br />
            <p><span>&gt;</span> PORT STATUS: READY</p>
            <p className="animate-pulse">_</p>
          </div>
        </div>
      </section>

    </div>
  );
}
