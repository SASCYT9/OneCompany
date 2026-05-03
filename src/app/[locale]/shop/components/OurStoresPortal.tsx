"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { SupportedLocale } from "@/lib/seo";
import { OUR_STORES } from "../data/ourStores";

type OurStoresPortalProps = {
  locale: SupportedLocale;
};

function t(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

function resolveHref(locale: string, store: (typeof OUR_STORES)[number]) {
  const map: Record<string, string> = {
    urban: `/${locale}/shop/urban`,
    do88: `/${locale}/shop/do88`,
    brabus: `/${locale}/shop/brabus`,
    burger: `/${locale}/shop/burger`,
    akrapovic: `/${locale}/shop/akrapovic`,
    racechip: `/${locale}/shop/racechip`,
    csf: `/${locale}/shop/csf`,
    ohlins: `/${locale}/shop/ohlins`,
    girodisc: `/${locale}/shop/girodisc`,
    ipe: `/${locale}/shop/ipe`,
    adro: `/${locale}/shop/adro`,
  };
  return map[store.id] ?? store.href ?? "#";
}

/* ══════════════════════════════════════════════════════════════ */
/*  Fixed layout: 6-column seamless grid, exactly like Urban     */
/*  collections. Every row fills all 6 columns.                   */
/*                                                                */
/*  Row 1 (hero):  Urban (3) + DO88 (3)                     = 6  */
/*  Row 2:         Brabus (2) + Akrapovič (2) + Burger (2)  = 6  */
/*  Row 3:         RaceChip (2) + CSF (2) + Öhlins (2)     = 6  */
/*  Row 4:         GiroDisc (2) + iPE (2) + ADRO (2)        = 6  */
/*  Row 5:         KW (2) + FI (2) + Eventuri (2)           = 6  */
/* ══════════════════════════════════════════════════════════════ */

const HERO_IDS = ['urban', 'akrapovic', 'brabus'];
const BOTTOM_IDS = ['kw', 'fi', 'eventuri'];

/* Layout:
   Row 1 (3-col hero): Urban + Akrapovič + Brabus
   Rows 2-3 (4-col):   DO88, Burger, RaceChip, CSF, Öhlins, GiroDisc, iPE, ADRO
   Row 4 (3-col):      KW, FI, Eventuri
*/
const STORE_ORDER = [
  'urban', 'akrapovic', 'brabus',
  'do88', 'burger', 'racechip', 'csf',
  'ohlins', 'girodisc', 'ipe', 'adro',
  'kw', 'fi', 'eventuri',
];

/* ── Reusable store card ─────────────────────────────────────── */

function StoreCard({
  store,
  locale,
  isUa,
  exploreLabel,
  height,
  sizes,
  eager,
}: {
  store: (typeof OUR_STORES)[number];
  locale: string;
  isUa: boolean;
  exploreLabel: string;
  height: string;
  sizes: string;
  eager?: boolean;
}) {
  const href = resolveHref(locale, store);
  const isExternal = store.external === true;
  const isLogoAsset = store.imageUrl?.startsWith("/logos/") ?? false;

  return (
    <div
      className={`group relative flex w-full flex-col overflow-hidden bg-[#060606] border-b border-r border-white/[0.05] transition-all duration-500 ${height}`}
    >
      {isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-20" aria-label={t(isUa, store.name, store.nameUk)} />
      ) : (
        <Link href={href} className="absolute inset-0 z-20" aria-label={t(isUa, store.name, store.nameUk)} />
      )}

      {store.imageUrl && (
        <Image
          src={store.imageUrl}
          alt=""
          fill
          sizes={sizes}
          className={`object-cover object-center transition-all duration-700 ease-out group-hover:scale-[1.03] ${
            isLogoAsset ? "opacity-90 !object-contain p-10" : "opacity-90 group-hover:opacity-100"
          }`}
          loading={eager ? "eager" : "lazy"}
          unoptimized={isLogoAsset}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 transition-opacity duration-500 group-hover:from-black/75" />

      <div className="relative z-10 mt-auto w-full px-4 pb-4 md:px-7 md:pb-7">
        <h3 className="text-base font-bold leading-tight text-white transition-colors duration-300 group-hover:text-[#ead29d] sm:text-lg lg:text-xl">
          {t(isUa, store.name, store.nameUk)}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs font-light leading-relaxed text-white/65 md:max-w-[40ch] md:text-sm">
          {t(isUa, store.description, store.descriptionUk)}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/0 transition-all duration-400 group-hover:text-white/70 group-hover:gap-3">
          {exploreLabel}
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-1">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function OurStoresPortal({ locale }: OurStoresPortalProps) {
  const { data: session } = useSession();
  const isB2bApproved = session?.user?.group === 'B2B_APPROVED';
  const isUa = locale === "ua";
  const storesMap = new Map(OUR_STORES.filter((s) => !s.isHidden).map((s) => [s.id, s]));
  const storeCount = storesMap.size;

  const ordered = STORE_ORDER
    .map((id) => storesMap.get(id))
    .filter(Boolean) as (typeof OUR_STORES)[number][];

  const heroStores = ordered.filter(s => HERO_IDS.includes(s.id));
  const mainStores = ordered.filter(s => !HERO_IDS.includes(s.id) && !BOTTOM_IDS.includes(s.id));
  const bottomStores = ordered.filter(s => BOTTOM_IDS.includes(s.id));

  const exploreLabel = isUa ? "Дослідити" : "Explore";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white selection:bg-white/20">
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,_rgba(194,157,89,0.06)_0%,_transparent_70%)]" />
      </div>

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[55vh] items-center justify-center overflow-hidden pt-24 pb-10 sm:min-h-[50vh] sm:pt-24 sm:pb-0">
        <Image
          src="/images/shop/urban/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover sm:brightness-[0.25] sm:saturate-[0.5] brightness-[0.3]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-[#050505]/15 to-[#050505]" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#050505]/40 via-transparent to-[#050505]/40 sm:block" />

        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center sm:gap-5">
          <h1 className="text-2xl font-extralight uppercase leading-tight tracking-[0.12em] text-white/90 sm:text-3xl sm:tracking-[0.15em] md:text-4xl">
            {t(isUa, "Our Stores", "Наші Магазини")}
          </h1>
          <div className="flex items-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#C29D59]/70 sm:w-24" />
            <div className="h-1.5 w-1.5 rotate-45 bg-[#C29D59]/50" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#C29D59]/70 sm:w-24" />
          </div>
          <p className="max-w-lg text-[13px] font-light leading-relaxed text-white/55 sm:text-sm md:text-base">
            {t(isUa,
              "Official One Company stores. Explore the world of premium automotive brands and tuning ateliers.",
              "Офіційні магазини One Company. Досліджуйте простір преміальних автомобільних брендів та тюнінг-ательє."
            )}
          </p>
          <div className="mt-4 animate-bounce text-white/25 sm:mt-8">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ─── COLLAGE ──────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-[1720px] px-4 pb-24 pt-4 sm:px-6 lg:px-8 xl:px-16">
        {/* Section label */}
        <div className="mb-6 flex items-end justify-between sm:mb-8">
          <div>
            <div className="mb-4 h-px w-12 bg-gradient-to-r from-white/60 to-transparent" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/30">
              {t(isUa, "Explore", "Досліджуйте")}
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/25">
            {storeCount} {t(isUa, "stores", "магазинів")}
          </p>
        </div>

        {/* Seamless grid */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">

          {/* Row 1 — hero: Urban + Akrapovič + Brabus (3 col) */}
          <div className="grid grid-cols-1 sm:grid-cols-3">
            {heroStores.map((store) => (
              <StoreCard key={store.id} store={store} locale={locale} isUa={isUa} exploreLabel={exploreLabel} height="h-[280px] sm:h-[360px] lg:h-[460px]" sizes="(max-width: 768px) 100vw, 33vw" eager />
            ))}
          </div>

          {/* Rows 2–3 — main: 4 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {mainStores.map((store) => (
              <StoreCard key={store.id} store={store} locale={locale} isUa={isUa} exploreLabel={exploreLabel} height="h-[260px] sm:h-[320px] lg:h-[420px]" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
            ))}
          </div>

          {/* Row 4 — bottom: KW + FI + Eventuri (3 col) */}
          <div className="grid grid-cols-1 sm:grid-cols-3">
            {bottomStores.map((store) => (
              <StoreCard key={store.id} store={store} locale={locale} isUa={isUa} exploreLabel={exploreLabel} height="h-[260px] sm:h-[320px] lg:h-[400px]" sizes="(max-width: 640px) 100vw, 33vw" />
            ))}
          </div>

        </div>

        {/* ─── B2B STOCK ──────────────────────────────────────── */}
        {isB2bApproved && (
          <div className="mt-8 sm:mt-12 lg:mt-16">
            <Link
              href={`/${locale}/shop/stock`}
              className="group relative flex flex-col justify-end w-full min-h-[220px] p-5 sm:min-h-[260px] sm:p-6 md:min-h-[340px] md:p-10 rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.06] bg-[#0a0a0c] transition-all duration-500 hover:border-emerald-500/25 hover:shadow-[0_0_80px_rgba(16,185,129,0.06)]"
            >
              <Image
                src="/images/shop/stores/one-company-stock-porsche.png"
                alt="One Company Stock"
                fill
                sizes="100vw"
                className="object-cover opacity-35 transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-55"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
              <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {t(isUa, "B2B Access Granted", "B2B Доступ Відкрито")}
                  </div>
                  <h2 className="mb-2 text-2xl font-light uppercase tracking-tight text-white sm:text-3xl md:text-5xl">One Company Stock</h2>
                  <p className="max-w-2xl text-sm font-light leading-relaxed text-white/55 md:text-base">
                    {t(isUa,
                      "Specialized B2B stock portal. Get instant access to inventory, wholesale pricing, and place orders for premium parts in stock.",
                      "Спеціалізований B2B-портал складу. Отримуйте миттєвий доступ до залишків, гуртових цін та оформлюйте замовлення."
                    )}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60 backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-black md:h-14 md:w-14">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
