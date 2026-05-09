"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "../_shared/palettes.css";
import "./shop-preview.css";
import { PALETTES, DEFAULT_PALETTE, type PaletteId } from "../_shared/palettes";
import PaletteSwitcher from "../_shared/PaletteSwitcher";

type FeaturedProduct = {
  brand: string;
  title: string;
  fitment: string;
  price: string;
  badge?: string;
};

const FEATURED_PRODUCTS: readonly FeaturedProduct[] = [
  {
    brand: "AKRAPOVIC",
    title: "Evolution Line Titanium",
    fitment: "BMW M3 / M4 · G80 G82",
    price: "€ 4 850",
    badge: "BESTSELLER",
  },
  {
    brand: "iPE INNOTECH",
    title: "Innotech Performance Exhaust",
    fitment: "Porsche 992 Turbo S",
    price: "€ 7 200",
    badge: "NEW",
  },
  {
    brand: "BRABUS",
    title: "Rocket 900 Widebody Kit",
    fitment: "Mercedes-AMG G63 W463A",
    price: "€ 25 400",
    badge: "EXCLUSIVE",
  },
  {
    brand: "HRE WHEELS",
    title: "P101SC Forged · Satin Bronze",
    fitment: '21" set · custom-spec offsets',
    price: "€ 12 800",
  },
  {
    brand: "ÖHLINS",
    title: "Road & Track Coilovers",
    fitment: "McLaren 720S",
    price: "€ 4 600",
  },
  {
    brand: "BREMBO",
    title: "GT Series Big Brake Kit",
    fitment: "Audi RS6 / RS7 C8",
    price: "€ 3 950",
  },
  {
    brand: "KW SUSPENSIONS",
    title: "Variant 5 Adaptive Coilovers",
    fitment: "BMW M2 G87",
    price: "€ 5 200",
    badge: "JUST IN",
  },
  {
    brand: "CSF",
    title: "High-Performance Radiator",
    fitment: "Lamborghini Huracán Evo",
    price: "€ 1 480",
  },
];

const BRANDS = [
  { name: "Akrapovic", logo: "/logos/akrapovic.svg" },
  { name: "Brabus", logo: "/logos/brabus.svg" },
  { name: "Mansory", logo: "/logos/mansory.svg" },
  { name: "iPE Exhaust", logo: "/logos/ipe-exhaust.svg" },
  { name: "KW Suspensions", logo: "/logos/kw-suspensions.svg" },
  { name: "Öhlins", logo: "/logos/ohlins.svg" },
  { name: "HRE Wheels", logo: "/logos/hre-wheels.png" },
  { name: "Brembo", logo: "/logos/brembo.png" },
  { name: "ADRO", logo: "/logos/adro.svg" },
  { name: "Burger Motorsport", logo: "/logos/burger-motorsport.svg" },
] as const;

const COLLECTIONS = [
  { title: "Exhaust Systems", count: "1 240+", desc: "Titanium, Inconel, valved" },
  { title: "Forged Wheels", count: "680+", desc: "HRE, Anrky, ADV.1, Rotiform" },
  { title: "Coilovers & Suspension", count: "920+", desc: "KW, Öhlins, Bilstein, AST" },
  { title: "Carbon Body Kits", count: "350+", desc: "Brabus, Mansory, 1016 Industries" },
] as const;

export default function ShopPreviewClient() {
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);
  const active = PALETTES.find((p) => p.id === palette)!;

  return (
    <div className="shop-preview" data-palette={palette}>
      {/* DEMO RIBBON */}
      <div className="sp-ribbon">
        <div className="sp-ribbon__inner">
          <strong>Light Theme Preview · {active.name}</strong>
          <span className="sp-ribbon__sep">·</span>
          <span>{active.short}</span>
          <PaletteSwitcher value={palette} onChange={setPalette} compact />
          <Link href="/dev/theme-lab" className="sp-ribbon__link">
            Theme Lab →
          </Link>
        </div>
      </div>

      {/* HEADER */}
      <header className="sp-header">
        <div className="sp-header__inner">
          <div className="sp-header__brand">
            <span className="sp-logo">ONE</span>
            <span className="sp-logo__sub">COMPANY</span>
          </div>
          <nav className="sp-nav" aria-label="Primary">
            <a href="#">Auto</a>
            <a href="#">Moto</a>
            <a href="#">Brands</a>
            <a href="#">Collections</a>
            <a href="#">Sale</a>
            <a href="#">Contact</a>
          </nav>
          <div className="sp-header__actions">
            <button className="sp-icon-btn" aria-label="Search">
              <SearchIcon />
            </button>
            <button className="sp-icon-btn" aria-label="Account">
              <UserIcon />
            </button>
            <button className="sp-icon-btn sp-icon-btn--cart" aria-label="Cart">
              <BagIcon />
              <span className="sp-cart-count">2</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="sp-hero">
        <div className="sp-hero__bg" aria-hidden />
        <div className="sp-hero__inner">
          <div className="sp-hero__copy">
            <div className="sp-hero__eyebrow">EXCLUSIVE · LIMITED RELEASE</div>
            <h1 className="sp-hero__title">
              Brabus Rocket 900
              <br />
              <em>One Of Ten Edition</em>
            </h1>
            <p className="sp-hero__sub">
              900 horsepower V8. Carbon-forged widebody. Hand-finished interior. Офіційний
              дистриб&apos;ютор Brabus в Україні та СНД — повна комплектація з установкою.
            </p>
            <div className="sp-hero__cta">
              <a className="btn-bronze">Configure yours</a>
              <a className="btn-ghost">Specifications →</a>
            </div>
            <div className="sp-hero__stats">
              <div>
                <strong>900</strong>
                <span>HP</span>
              </div>
              <div>
                <strong>1 250</strong>
                <span>Nm</span>
              </div>
              <div>
                <strong>2.8</strong>
                <span>0-100 km/h</span>
              </div>
              <div>
                <strong>350+</strong>
                <span>top speed</span>
              </div>
            </div>
          </div>
          <div className="sp-hero__visual" aria-hidden>
            <div className="sp-hero__plate">
              <div className="sp-hero__plate-glow" />
              <div className="sp-hero__plate-label">G63 · ROCKET 900</div>
            </div>
          </div>
        </div>
      </section>

      {/* BRAND STRIP */}
      <section className="sp-brands">
        <div className="sp-brands__heading">
          <span className="sp-eyebrow">OFFICIAL DISTRIBUTOR · 200+ BRANDS</span>
        </div>
        <div className="sp-brands__row">
          {BRANDS.map((b) => (
            <div key={b.name} className="sp-brand" title={b.name}>
              <Image
                src={b.logo}
                alt={b.name}
                width={120}
                height={48}
                className="sp-brand__logo"
                unoptimized
              />
            </div>
          ))}
        </div>
      </section>

      {/* COLLECTIONS */}
      <section className="sp-section">
        <div className="sp-section__head">
          <h2 className="sp-section__title">Shop by category</h2>
          <a href="#" className="sp-section__link">
            All collections →
          </a>
        </div>
        <div className="sp-coll-grid">
          {COLLECTIONS.map((c, i) => (
            <a
              href="#"
              key={c.title}
              className="sp-coll-card"
              data-tone={i % 2 === 0 ? "warm" : "cool"}
            >
              <div className="sp-coll-card__bg" aria-hidden />
              <div className="sp-coll-card__body">
                <div className="sp-coll-card__count">{c.count}</div>
                <div className="sp-coll-card__title">{c.title}</div>
                <div className="sp-coll-card__desc">{c.desc}</div>
                <div className="sp-coll-card__arrow">→</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="sp-section">
        <div className="sp-section__head">
          <h2 className="sp-section__title">Featured this week</h2>
          <a href="#" className="sp-section__link">
            View all 1 200+ products →
          </a>
        </div>
        <div className="sp-product-grid">
          {FEATURED_PRODUCTS.map((p) => (
            <article key={p.title} className="sp-product">
              <div className="sp-product__media">
                <ProductSilhouette brand={p.brand} />
                {p.badge && <span className="sp-product__badge">{p.badge}</span>}
                <button className="sp-product__fav" aria-label="Save">
                  <HeartIcon />
                </button>
              </div>
              <div className="sp-product__body">
                <div className="sp-product__brand">{p.brand}</div>
                <h3 className="sp-product__title">{p.title}</h3>
                <div className="sp-product__fit">{p.fitment}</div>
                <div className="sp-product__foot">
                  <span className="sp-product__price">{p.price}</span>
                  <button className="sp-product__cta">+ Add</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* FEATURE BLOCK */}
      <section className="sp-feature">
        <div className="sp-feature__visual">
          <div className="sp-feature__chip">PORSCHE 992 GT3 RS</div>
          <div className="sp-feature__plate">
            <div className="sp-feature__title-line">Track-spec</div>
            <div className="sp-feature__title-line sp-feature__title-line--accent">
              configurator
            </div>
          </div>
        </div>
        <div className="sp-feature__copy">
          <div className="sp-eyebrow">NEW · BETA</div>
          <h2 className="sp-feature__title">Build your spec.</h2>
          <p className="sp-feature__text">
            Інтерактивний конфігуратор: вибери чашу, ваги, диски, гальма, пакет аеро. Отримай
            миттєвий розрахунок ваги, ціни, та строку поставки. Налаштування зберігаються у твоєму
            кабінеті.
          </p>
          <ul className="sp-feature__list">
            <li>50+ перевірених сетапів від OneCompany Engineering</li>
            <li>Калькулятор ваги і потужності в реальному часі</li>
            <li>Експорт до PDF · поділись з друзями · збережи у профілі</li>
          </ul>
          <a className="btn-bronze">Try the configurator →</a>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="sp-trust">
        <div className="sp-trust__item">
          <ShipIcon />
          <div>
            <strong>Worldwide shipping</strong>
            <span>США · ЄС · Україна · 14 днів у середньому</span>
          </div>
        </div>
        <div className="sp-trust__item">
          <ShieldIcon />
          <div>
            <strong>Original warranty</strong>
            <span>Кожен продукт з оригінальним сертифікатом виробника</span>
          </div>
        </div>
        <div className="sp-trust__item">
          <ToolIcon />
          <div>
            <strong>Installation network</strong>
            <span>Сертифіковані партнери в 12 містах України</span>
          </div>
        </div>
        <div className="sp-trust__item">
          <PhoneIcon />
          <div>
            <strong>White-glove support</strong>
            <span>Особистий менеджер на кожне замовлення &gt; €5 000</span>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="sp-news">
        <div className="sp-news__inner">
          <div className="sp-news__copy">
            <div className="sp-eyebrow">JOIN THE LIST</div>
            <h2 className="sp-news__title">Перші у черзі на limited drops.</h2>
            <p className="sp-news__sub">
              Новинки Akrapovic, Brabus, Mansory, ексклюзивні дропи HRE — 1-2 листи на місяць, без
              спаму.
            </p>
          </div>
          <form className="sp-news__form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="your@email.com" />
            <button className="btn-bronze" type="submit">
              Subscribe
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="sp-footer">
        <div className="sp-footer__top">
          <div className="sp-footer__col sp-footer__col--brand">
            <div className="sp-header__brand">
              <span className="sp-logo">ONE</span>
              <span className="sp-logo__sub">COMPANY</span>
            </div>
            <p className="sp-footer__tag">
              Premium auto & moto tuning. Worldwide shipping. Estd. 2018.
            </p>
            <div className="sp-footer__social">
              <a href="#" aria-label="Instagram">
                <IgIcon />
              </a>
              <a href="#" aria-label="YouTube">
                <YtIcon />
              </a>
              <a href="#" aria-label="Telegram">
                <TgIcon />
              </a>
            </div>
          </div>
          <div className="sp-footer__col">
            <div className="sp-footer__heading">Shop</div>
            <a href="#">All Brands</a>
            <a href="#">Auto</a>
            <a href="#">Moto</a>
            <a href="#">Collections</a>
            <a href="#">New arrivals</a>
            <a href="#">Sale</a>
          </div>
          <div className="sp-footer__col">
            <div className="sp-footer__heading">Support</div>
            <a href="#">Contact</a>
            <a href="#">Shipping & returns</a>
            <a href="#">Installation network</a>
            <a href="#">B2B / Wholesale</a>
            <a href="#">Career</a>
          </div>
          <div className="sp-footer__col">
            <div className="sp-footer__heading">Company</div>
            <a href="#">About</a>
            <a href="#">Story</a>
            <a href="#">Press</a>
            <a href="#">Partnership</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
        <div className="sp-footer__bottom">
          <span>© 2026 OneCompany Global LLC. Усі права захищені.</span>
          <span>Made with care in Kyiv 🇺🇦</span>
        </div>
      </footer>
    </div>
  );
}

/* ============= ICONS ============= */
function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  );
}
function ShipIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.34a2 2 0 0 0-.59-1.42L18 9h-4" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function ToolIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}
function IgIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}
function YtIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}
function TgIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.5 4.5-19 7.5 6 2 2 6 4-4 5 4z" />
    </svg>
  );
}

/* Stylized "product silhouette" — pure CSS/SVG so it works without images */
function ProductSilhouette({ brand }: { brand: string }) {
  const variant = brand.toLowerCase();
  return (
    <div className="sp-silhouette" data-variant={variant}>
      <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <linearGradient id={`g-${variant.replace(/\s/g, "-")}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" />
            <stop offset="100%" stopColor="var(--muted)" />
          </linearGradient>
        </defs>
        {variant.includes("akrapovic") || variant.includes("ipe") ? (
          // Exhaust silhouette
          <g
            fill={`url(#g-${variant.replace(/\s/g, "-")})`}
            stroke="var(--border)"
            strokeWidth="1.5"
          >
            <ellipse cx="40" cy="75" rx="14" ry="22" />
            <rect x="48" y="58" width="120" height="34" rx="6" />
            <ellipse cx="170" cy="75" rx="14" ry="22" />
            <circle cx="170" cy="75" r="9" fill="var(--bg)" />
          </g>
        ) : variant.includes("hre") || variant.includes("wheel") ? (
          // Wheel silhouette
          <g
            fill={`url(#g-${variant.replace(/\s/g, "-")})`}
            stroke="var(--border)"
            strokeWidth="1.5"
          >
            <circle cx="100" cy="75" r="55" />
            <circle cx="100" cy="75" r="38" fill="var(--bg)" />
            <g stroke="var(--border)" strokeWidth="2" fill="none">
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <line
                  key={deg}
                  x1="100"
                  y1="75"
                  x2={100 + 38 * Math.cos((deg * Math.PI) / 180)}
                  y2={75 + 38 * Math.sin((deg * Math.PI) / 180)}
                />
              ))}
            </g>
            <circle cx="100" cy="75" r="10" fill="var(--primary)" />
          </g>
        ) : variant.includes("öhlins") ||
          variant.includes("kw") ||
          variant.includes("suspension") ? (
          // Coilover silhouette
          <g
            fill={`url(#g-${variant.replace(/\s/g, "-")})`}
            stroke="var(--border)"
            strokeWidth="1.5"
          >
            <rect x="88" y="20" width="24" height="20" rx="3" />
            <rect x="80" y="40" width="40" height="14" />
            <rect x="92" y="54" width="16" height="50" fill="var(--primary)" opacity="0.8" />
            <g stroke="var(--card)" strokeWidth="2" fill="none">
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={i} x1="92" y1={58 + i * 7} x2="108" y2={58 + i * 7} />
              ))}
            </g>
            <rect x="80" y="104" width="40" height="14" />
            <rect x="88" y="118" width="24" height="20" rx="3" />
          </g>
        ) : variant.includes("brembo") || variant.includes("brake") ? (
          // Brake disc + caliper
          <g stroke="var(--border)" strokeWidth="1.5">
            <circle cx="100" cy="75" r="50" fill={`url(#g-${variant.replace(/\s/g, "-")})`} />
            <circle cx="100" cy="75" r="20" fill="var(--bg)" />
            <g stroke="var(--muted-fg)" strokeWidth="0.5" opacity="0.5">
              {Array.from({ length: 24 }).map((_, i) => {
                const a = (i * 15 * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1={100 + 22 * Math.cos(a)}
                    y1={75 + 22 * Math.sin(a)}
                    x2={100 + 48 * Math.cos(a)}
                    y2={75 + 48 * Math.sin(a)}
                  />
                );
              })}
            </g>
            <rect x="55" y="60" width="22" height="30" rx="4" fill="var(--primary)" />
          </g>
        ) : variant.includes("brabus") || variant.includes("body") || variant.includes("kit") ? (
          // Body kit / spoiler abstraction
          <g
            fill={`url(#g-${variant.replace(/\s/g, "-")})`}
            stroke="var(--border)"
            strokeWidth="1.5"
          >
            <path d="M 20 110 Q 40 60, 100 55 Q 160 60, 180 110 Z" />
            <path d="M 50 110 Q 70 80, 100 78 Q 130 80, 150 110 Z" fill="var(--bg)" />
            <rect x="85" y="38" width="30" height="8" rx="2" />
          </g>
        ) : (
          // Generic radiator / part
          <g
            fill={`url(#g-${variant.replace(/\s/g, "-")})`}
            stroke="var(--border)"
            strokeWidth="1.5"
          >
            <rect x="30" y="35" width="140" height="80" rx="6" />
            <g stroke="var(--card)" strokeWidth="1.5" fill="none">
              {Array.from({ length: 14 }).map((_, i) => (
                <line key={i} x1={36 + i * 9.5} y1="42" x2={36 + i * 9.5} y2="108" />
              ))}
            </g>
            <rect x="20" y="65" width="14" height="20" fill="var(--primary)" />
            <rect x="166" y="65" width="14" height="20" fill="var(--primary)" />
          </g>
        )}
      </svg>
    </div>
  );
}
