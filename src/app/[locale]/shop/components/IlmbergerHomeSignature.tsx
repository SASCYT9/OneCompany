"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

// LiquidChrome uses ogl (WebGL) — client-side only.
const IlmbergerLiquidChrome = dynamic(() => import("./IlmbergerLiquidChrome"), {
  ssr: false,
});
import IlmbergerCollage from "./IlmbergerCollage";
import { ArrowRight } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
// products + viewerContext are accepted (server passes them) but unused on
// the storytelling-only home — real product listing lives in /collections.
import {
  ILMBERGER_HERO,
  ILMBERGER_PRODUCT_LINES,
  ILMBERGER_GALLERY,
} from "../data/ilmbergerHomeData";
import IlmbergerBikePicker from "./IlmbergerBikePicker";
import IlmbergerShinyText from "./IlmbergerShinyText";
import IlmbergerTiltedCard from "./IlmbergerTiltedCard";
import IlmbergerScrollReveal from "./IlmbergerScrollReveal";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function IlmbergerHomeSignature({
  locale,
  products: _products,
  viewerContext: _viewerContext,
}: Props) {
  const isUa = locale === "ua";
  const router = useRouter();

  const productCountByModel = useMemo(() => {
    const counts = new Map<string, number>();
    const hasRealProducts = _products.length > 0;
    if (!hasRealProducts) return counts;
    for (const p of _products) {
      for (const tag of p.tags ?? []) {
        if (typeof tag !== "string") continue;
        if (
          /^(S 1000 (RR|R|XR)|M 1000 (RR|R|XR)|Panigale V4|Streetfighter V4|Diavel V4|Diavel 1260|XDiavel)$/.test(
            tag
          )
        ) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [_products]);

  const handleBikePick = (mfr: string, model: string) => {
    router.push(
      `/${locale}/shop/ilmberger/collections?manufacturer=${encodeURIComponent(
        mfr
      )}&model=${encodeURIComponent(model)}`
    );
  };

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll("[data-il-reveal]");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("il-vis");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="il-home" id="IlmbergerHome">
      {/* ── Back to Stores ── */}
      <div className="il-back">
        <Link href={`/${locale}/shop`} className="il-back__link">
          ← {L(isUa, "All our stores", "Усі наші магазини")}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="il-hero" id="il-hero-section">
        <div className="il-hero__bg" aria-hidden>
          {/* Poster image paints first (fast LCP). Video fades in on top. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ILMBERGER_HERO.heroImageFallback}
            alt=""
            width={ILMBERGER_HERO.heroImageWidth}
            height={ILMBERGER_HERO.heroImageHeight}
            loading="eager"
            fetchPriority="high"
          />
          {ILMBERGER_HERO.heroVideoUrl && (
            <video
              src={ILMBERGER_HERO.heroVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
          )}
        </div>
        <div className="il-hero__content !max-w-7xl">
          <div className="max-w-3xl mx-auto">
            <div className="il-hero__logo-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/ilmberger-carbon-transparent.webp"
                alt="Ilmberger Carbon"
                className="il-hero__logo"
              />
            </div>

            <p className="il-hero__overtitle">One Company × Ilmberger Carbon</p>

            <h1 className="sr-only">
              {L(
                isUa,
                "Ilmberger Carbon — Карбонові деталі для спортбайків",
                "Ilmberger Carbon — Prepreg Carbon for Sportbikes"
              )}
            </h1>
            <p className="il-hero__title">
              {L(isUa, "Hand-Laid", "Карбон ручної")}{" "}
              <IlmbergerShinyText
                text={L(isUa, "Carbon", "роботи")}
                color="#e5e7eb"
                shineColor="#ffffff"
                speed={4}
                className="il-hero__title-em"
              />
            </p>

            <p className="il-hero__subtitle">
              {L(isUa, ILMBERGER_HERO.subtitle, ILMBERGER_HERO.subtitleUk)}
            </p>
          </div>

          <IlmbergerBikePicker
            locale={locale}
            productCountByModel={productCountByModel}
            onPick={handleBikePick}
            variant="hero"
          />
        </div>

        <div className="il-hero__scroll" aria-hidden>
          <div className="il-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — PRODUCT LINES (full-photo category cards — WOW)
      ════════════════════════════════════════════════════════════════ */}
      <section className="il-section" data-il-reveal>
        <div className="il-section__head il-section__head--center">
          <span className="il-label">{L(isUa, "Categories", "Категорії")}</span>
          <h2 className="il-section-title">
            <IlmbergerScrollReveal>
              {L(isUa, "Built for Your Bike", "Створено для вашого байка")}
            </IlmbergerScrollReveal>
          </h2>
          <div className="il-divider il-divider--center" />
          <p className="il-section-sub mx-auto" style={{ textAlign: "center" }}>
            {L(
              isUa,
              "Six product lines covering every visible carbon surface on a sportbike.",
              "Шість лінійок продукції — повне покриття всіх карбонових деталей спортбайка."
            )}
          </p>
        </div>

        <div className="il-lines-grid">
          {ILMBERGER_PRODUCT_LINES.map((line) => (
            <IlmbergerTiltedCard
              key={line.id}
              href={`/${locale}${line.link}`}
              image={line.image}
              objectPosition={line.objectPosition}
              badge={L(isUa, line.badge, line.badgeUk)}
              name={L(isUa, line.name, line.nameUk)}
              description={L(isUa, line.description, line.descriptionUk)}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — ABOUT ILMBERGER
      ════════════════════════════════════════════════════════════════ */}
      <section className="il-about" data-il-reveal>
        <div className="il-about__liquid" aria-hidden>
          <IlmbergerLiquidChrome interactive={false} speed={0.1} amplitude={0.32} />
        </div>
        <div className="il-about__wrap">
          <div>
            <span className="il-label">{L(isUa, "About", "Про бренд")}</span>
            <h2 className="il-about__title">
              <IlmbergerScrollReveal>
                {`${L(isUa, "About", "Про")} Ilmberger Carbon`}
              </IlmbergerScrollReveal>
            </h2>
            <p className="il-about__lede">
              {L(
                isUa,
                "A family-run carbon atelier from Lindberg, Bavaria. Three decades of hand-laid prepreg layup, autoclave curing and CNC finishing for the world's fastest motorcycles.",
                "Сімейна карбонова майстерня з Ліндберга, Баварія. Три десятиліття ручної укладки препрегу, запікання в автоклаві та CNC-обробки для найшвидших мотоциклів світу."
              )}
            </p>
            <div className="il-about__stats">
              <div className="il-about__stat">
                <p className="il-about__stat-num">1995</p>
                <p className="il-about__stat-label">{L(isUa, "Founded", "Засновано")}</p>
              </div>
              <div className="il-about__stat">
                <p className="il-about__stat-num">600+</p>
                <p className="il-about__stat-label">{L(isUa, "SKUs", "SKU")}</p>
              </div>
              <div className="il-about__stat">
                <p className="il-about__stat-num">FIM</p>
                <p className="il-about__stat-label">{L(isUa, "Approved", "Сертифіковано")}</p>
              </div>
              <div className="il-about__stat">
                <p className="il-about__stat-num">DE</p>
                <p className="il-about__stat-label">
                  {L(isUa, "Made in Lindberg", "Виробництво в Ліндбергу")}
                </p>
              </div>
            </div>
          </div>

          <div className="il-about__body">
            <div className="il-about__genesis">
              <span className="il-about__genesis-tag">
                {L(isUa, "ATELIER GENESIS", "ІСТОРІЯ АТЕЛЬЄ")}
              </span>
              <p>
                {L(
                  isUa,
                  "Since 1995, every Ilmberger Carbon part has been hand-laid, autoclave-cured and CNC-finished in Lindberg, Bavaria. The atelier was founded by Andreas Ilmberger as a one-man garage operation; today three generations of the Ilmberger family run the workshop, with engineers, technicians and CFD specialists working under one roof.",
                  "З 1995 року кожну деталь Ilmberger Carbon виготовляють вручну, запікають в автоклаві та обробляють на ЧПУ-станку в Ліндберзі, Баварія. Майстерню заснував Андреас Ільмбергер як невелику гаражну справу; сьогодні три покоління родини Ільмбергерів керують виробництвом, де під одним дахом працюють інженери, техніки та CFD-спеціалісти."
                )}
              </p>
            </div>

            <div className="il-about__cards">
              {/* Card 1 */}
              <div className="il-about-card">
                <span className="il-about-card__index">01</span>
                <h3 className="il-about-card__title">
                  {L(isUa, "PREPREG LAYUP", "ПРЕПРЕГ-УКЛАДКА")}
                </h3>
                <p className="il-about-card__desc">
                  {L(
                    isUa,
                    "Every sheet is oriented by hand for predictable fibre direction. Vacuum bagging and high-pressure autoclave cycles ensure zero voids — every panel comes out structurally consistent.",
                    "Кожен лист орієнтують вручну для передбачуваного напрямку волокон. Вакуумне пакування та цикли високого тиску в автоклаві забезпечують повну відсутність порожнин — кожна панель виходить структурно однорідною."
                  )}
                </p>
              </div>

              {/* Card 2 */}
              <div className="il-about-card">
                <span className="il-about-card__index">02</span>
                <h3 className="il-about-card__title">
                  {L(isUa, "RACE-PROVEN INTEGRATION", "ПЕРЕВІРЕНО НА ГОНКАХ")}
                </h3>
                <p className="il-about-card__desc">
                  {L(
                    isUa,
                    "From MotoGP test bikes to World Superbike paddocks, Ilmberger panels live on bikes ridden by some of the fastest people on Earth. The same parts ship to street riders looking for the lightest, stiffest carbon money can buy.",
                    "Від тестових мотоциклів MotoGP до паддоків World Superbike — панелі Ilmberger стоять на байках найшвидших гонщиків планети. Ті самі деталі ми відвантажуємо вуличним мотоциклістам, які шукають найлегший та найжорсткіший карбон."
                  )}
                </p>
              </div>

              {/* Card 3 */}
              <div className="il-about-card">
                <span className="il-about-card__index">03</span>
                <h3 className="il-about-card__title">
                  {L(isUa, "TWILL WEAVE FINISH", "TWILL-ПЛЕТІННЯ ТА ЛАК")}
                </h3>
                <p className="il-about-card__desc">
                  {L(
                    isUa,
                    "Visible carbon parts ship with a 2×2 twill weave clearcoat by default. Custom finishes (matte, race-spec satin, paint-to-sample bodywork) are available on request.",
                    "Видимі карбонові деталі за замовчуванням поставляються з 2×2 twill-плетінням під глянцевим лаком. На замовлення доступні індивідуальні покриття: матове, гоночний сатин та фарбування під зразок."
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4.5 — PHOTO GALLERY (atmosphere — moved below About)
      ════════════════════════════════════════════════════════════════ */}
      <section className="il-gallery" data-il-reveal>
        <div className="il-gallery__head">
          <div>
            <h2 className="il-gallery__title">
              <IlmbergerScrollReveal>{L(isUa, "Gallery", "Галерея")}</IlmbergerScrollReveal>
            </h2>
            <p className="il-gallery__sub">
              {L(
                isUa,
                "Real shots from Lindberg atelier and World Superbike paddocks",
                "Реальні кадри з майстерні в Ліндберзі та паддоків World Superbike"
              )}
            </p>
          </div>
        </div>
        <IlmbergerCollage items={ILMBERGER_GALLERY} isUa={isUa} />
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — BOTTOM CTA
      ════════════════════════════════════════════════════════════════ */}
      <div className="il-bottom-cta" data-il-reveal>
        <span className="il-label">{L(isUa, "Ready to upgrade?", "Готові до апгрейду?")}</span>
        <br />
        <Link href={`/${locale}/shop/ilmberger/collections`} className="il-btn il-btn--solid">
          {L(isUa, "Explore Full Catalog", "Переглянути весь каталог")}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
