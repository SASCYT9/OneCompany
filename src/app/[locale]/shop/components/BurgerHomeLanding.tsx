'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  BURGER_HERO,
  BURGER_STATS,
  BURGER_SHOWCASES,
  BURGER_BRANDS,
} from '../data/burgerHomeData';

type Props = { locale: string };

const L = (isUa: boolean, en: string, ua: string) => (isUa ? ua : en);

export default function BurgerHomeLanding({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <>
      {/* ═════ HERO ═════ */}
      <section className="burger-hero">
        <div className="burger-hero__bg">
          <img
            src={BURGER_HERO.heroImageUrl}
            alt="Burger Motorsports JB4 Performance"
            loading="eager"
          />
          <div className="burger-hero__overlay" />
        </div>

        <div className="burger-hero__content">
          <div className="burger-hero__eyebrow">
            {L(isUa, BURGER_HERO.eyebrow, BURGER_HERO.eyebrowUk)}
          </div>

          <h1 className="burger-hero__title">
            <span>{L(isUa, BURGER_HERO.title, BURGER_HERO.titleUk)}</span>
            {L(isUa, BURGER_HERO.titleLine2, BURGER_HERO.titleLine2Uk)}
          </h1>

          <p className="burger-hero__subtitle">
            {L(isUa, BURGER_HERO.subtitle, BURGER_HERO.subtitleUk)}
          </p>

          <div className="burger-hero__buttons">
            <Link
              href={`/${locale}${BURGER_HERO.primaryButtonLink}`}
              className="burger-btn burger-btn--primary"
            >
              {L(isUa, BURGER_HERO.primaryButtonLabel, BURGER_HERO.primaryButtonLabelUk)}
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </Link>
            <Link
              href={`/${locale}${BURGER_HERO.secondaryButtonLink}`}
              className="burger-btn burger-btn--ghost"
            >
              {L(isUa, BURGER_HERO.secondaryButtonLabel, BURGER_HERO.secondaryButtonLabelUk)}
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="burger-stats">
          {BURGER_STATS.map((s, i) => (
            <div key={i} className="burger-stats__item">
              <div className="burger-stats__num">{s.num}</div>
              <div className="burger-stats__label">{L(isUa, s.label, s.labelUk)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═════ SHOWCASE CARDS ═════ */}
      <section className="burger-showcase">
        <div className="burger-showcase__title">
          {isUa ? 'Що ми пропонуємо' : 'What We Offer'}
        </div>

        <div className="burger-showcase__grid">
          {BURGER_SHOWCASES.map((s, i) => (
            <Link
              key={i}
              href={`/${locale}${s.link}`}
              className="burger-showcase__card"
            >
              <img
                src={s.imageUrl}
                alt={s.name}
                className="burger-showcase__card-img"
                loading="lazy"
              />
              <div className="burger-showcase__card-body">
                <div className="burger-showcase__card-badge">
                  {L(isUa, s.badge, s.badgeUk)}
                </div>
                <div className="burger-showcase__card-name">
                  {L(isUa, s.name, s.nameUk)}
                </div>
                <div className="burger-showcase__card-desc">
                  {L(isUa, s.desc, s.descUk)}
                </div>
              </div>
              <div className="burger-showcase__card-cta">
                {isUa ? 'Дослідити' : 'Explore'}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═════ BRAND GRID ═════ */}
      <section className="burger-brands">
        <div className="burger-brands__title">
          {isUa ? 'Підтримувані марки' : 'Supported Brands'}
        </div>

        <div className="burger-brands__grid">
          {BURGER_BRANDS.map((b, i) => (
            <Link
              key={i}
              href={`/${locale}${b.link}`}
              className="burger-brands__item"
            >
              {b.name}
              <span className="burger-brands__count">{b.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═════ LEGACY ═════ */}
      <section className="burger-legacy">
        <div>
          <div className="burger-legacy__eyebrow">Since 2007</div>
          <h2 className="burger-legacy__title">
            {isUa ? 'Піонери Plug & Play Тюнінгу' : 'Pioneers of Plug & Play Tuning'}
          </h2>
          <p className="burger-legacy__text">
            {isUa
              ? 'Більше 17 років Burger Motorsports створює продукти світового рівня для performance ентузіастів. JB4 — найпопулярніший piggyback тюнер у світі, встановлений на сотні тисяч автомобілів по всій планеті. 100% зворотнє встановлення, без постійних модифікацій.'
              : 'For over 17 years, Burger Motorsports has been creating world-class products for performance enthusiasts. JB4 is the most popular piggyback tuner in the world, installed on hundreds of thousands of vehicles globally. 100% reversible installation, no permanent modifications.'}
          </p>
          <a
            href="https://burgertuning.com"
            target="_blank"
            rel="noopener noreferrer"
            className="burger-btn burger-btn--ghost"
          >
            {isUa ? 'Офіційний сайт' : 'Official Website'}
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </a>
        </div>
        <div>
          <img
            src="/images/shop/burger/legacy-jb4.jpg"
            alt="Burger Motorsports JB4"
            className="burger-legacy__img"
            loading="lazy"
          />
        </div>
      </section>

      {/* ═════ CTA FOOTER ═════ */}
      <section className="burger-cta">
        <h2 className="burger-cta__title">
          {isUa ? 'Готові до ' : 'Ready to '}
          <span>{isUa ? 'апгрейду?' : 'upgrade?'}</span>
        </h2>
        <p className="burger-cta__sub">
          {isUa
            ? '665 товарів для 30+ марок авто. Безкоштовна консультація.'
            : '665 products for 30+ vehicle brands. Free consultation.'}
        </p>
        <Link
          href={`/${locale}/shop/burger/products`}
          className="burger-btn burger-btn--primary"
        >
          {isUa ? 'Відкрити каталог' : 'Open Catalog'}
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </Link>
      </section>
    </>
  );
}
