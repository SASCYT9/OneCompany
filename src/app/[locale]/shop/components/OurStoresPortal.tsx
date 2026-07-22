import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { ShopCatalogQuickSearch } from "@/components/shop/ShopCatalogQuickSearch";
import { ShopHubNavigation } from "@/components/shop/ShopHubNavigation";
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
    ilmberger: `/${locale}/shop/ilmberger`,
  };
  return map[store.id] ?? store.href ?? "#";
}

/* ══════════════════════════════════════════════════════════════ */
/* Three featured stores, followed by 12 stores in complete three-column rows. */
/* ══════════════════════════════════════════════════════════════ */

const HERO_IDS = ["urban", "akrapovic", "brabus"];
const STORE_ORDER = [
  "urban",
  "akrapovic",
  "brabus",
  "do88",
  "burger",
  "racechip",
  "csf",
  "ohlins",
  "girodisc",
  "ipe",
  "adro",
  "ilmberger",
  "kw",
  "fi",
  "eventuri",
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
      data-store-id={store.id}
      className={`group relative flex w-full flex-col overflow-hidden bg-card border-b border-r border-foreground/10 transition-all duration-500 ${height}`}
    >
      {isExternal ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-20 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          aria-label={t(isUa, store.name, store.nameUk)}
        />
      ) : (
        <Link
          href={href}
          className="absolute inset-0 z-20 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          aria-label={t(isUa, store.name, store.nameUk)}
        />
      )}

      {store.collageImages && store.collageImages.length === 2 ? (
        <div className="absolute inset-0 flex w-full h-full overflow-hidden select-none">
          <div className="relative w-1/2 h-full overflow-hidden border-r border-white/10">
            <Image
              src={store.collageImages[0]}
              alt=""
              fill
              sizes={sizes ? "(max-width: 768px) 50vw, 17vw" : undefined}
              className="object-contain p-4 md:p-6 transition-all duration-700 ease-out group-hover:scale-[1.05] opacity-90 group-hover:opacity-100"
              style={{ objectPosition: store.collagePositions?.[0] ?? "center" }}
              loading={eager ? "eager" : "lazy"}
            />
          </div>
          <div className="relative w-1/2 h-full overflow-hidden">
            <Image
              src={store.collageImages[1]}
              alt=""
              fill
              sizes={sizes ? "(max-width: 768px) 50vw, 17vw" : undefined}
              className="object-contain p-4 md:p-6 transition-all duration-700 ease-out group-hover:scale-[1.05] opacity-90 group-hover:opacity-100"
              style={{ objectPosition: store.collagePositions?.[1] ?? "center" }}
              loading={eager ? "eager" : "lazy"}
            />
          </div>
        </div>
      ) : store.imageUrl ? (
        <Image
          src={store.imageUrl}
          alt=""
          fill
          sizes={sizes}
          className={`object-cover object-center transition-all duration-700 ease-out group-hover:scale-[1.03] ${
            isLogoAsset ? "opacity-90 object-contain! p-10" : "opacity-90 group-hover:opacity-100"
          }`}
          loading={eager ? "eager" : "lazy"}
          unoptimized={isLogoAsset}
        />
      ) : null}

      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10 transition-opacity duration-500 group-hover:from-black/75" />

      <div className="relative z-10 mt-auto w-full px-4 pb-4 md:px-7 md:pb-7">
        <h3 className="text-base font-bold leading-tight text-white transition-colors duration-300 group-hover:text-primary sm:text-lg lg:text-xl">
          {t(isUa, store.name, store.nameUk)}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs font-light leading-relaxed text-white/75 md:max-w-[40ch] md:text-sm">
          {t(isUa, store.description, store.descriptionUk)}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-transparent transition-all duration-400 group-hover:text-white/85 group-hover:gap-3">
          {exploreLabel}
          <ArrowRight
            className="h-[13px] w-[13px] transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

export default function OurStoresPortal({ locale }: OurStoresPortalProps) {
  const isUa = locale === "ua";
  const storesMap = new Map(OUR_STORES.filter((s) => !s.isHidden).map((s) => [s.id, s]));

  const ordered = STORE_ORDER.map((id) => storesMap.get(id)).filter(
    Boolean
  ) as (typeof OUR_STORES)[number][];

  const heroStores = ordered.filter((s) => HERO_IDS.includes(s.id));
  const remainingStores = ordered.filter((s) => !HERO_IDS.includes(s.id));

  const exploreLabel = isUa ? "Дослідити" : "Explore";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(194,157,89,0.06)_0%,transparent_70%)]" />
      </div>

      {/* ─── HERO ─────────────────────────────────────────────── */}
      {/* Original photo at full quality in both themes. Defender is naturally
          dark (concrete garage backdrop) so white text reads cleanly without
          aggressive filters. Soft bottom gradient just blends into page bg. */}
      <section className="relative flex min-h-[55vh] items-center justify-center overflow-hidden bg-background pt-24 pb-10 sm:min-h-[50vh] sm:pt-24 sm:pb-0">
        <Image
          src="/images/shop/urban/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Soft bottom fade to page bg (theme-aware) so the photo blends into
            the cream/dark canvas below. No top/side overlays — keeps photo open. */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-background via-background/35 to-transparent sm:h-36" />

        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center sm:gap-5">
          <h1 className="text-2xl font-extralight uppercase leading-tight tracking-[0.12em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:text-3xl sm:tracking-[0.15em] md:text-4xl">
            {t(isUa, "One Company Brands", "Бренди One Company")}
          </h1>
          <div className="flex items-center gap-3">
            <div className="h-px w-12 bg-linear-to-r from-transparent to-primary/70 sm:w-24" />
            <div className="h-1.5 w-1.5 rotate-45 bg-primary/50" />
            <div className="h-px w-12 bg-linear-to-l from-transparent to-primary/70 sm:w-24" />
          </div>
          <p className="max-w-lg text-[13px] font-light leading-relaxed text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] sm:text-sm md:text-base">
            {t(
              isUa,
              "15 premium brands in one shop. Explore official collections and find parts for your car or motorcycle.",
              "15 преміальних брендів в одному магазині. Досліджуйте фірмові колекції та обирайте деталі для свого авто або мото."
            )}
          </p>
          <div className="mt-4 animate-bounce text-white/40 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] sm:mt-8">
            <ArrowDown className="h-6 w-6" strokeWidth={1} aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* ─── COLLAGE ──────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-[1720px] px-4 pb-20 sm:px-6 lg:px-8 xl:px-16">
        <ShopHubNavigation
          locale={locale}
          active="brands"
          className="relative z-20 -mt-12 mb-4 sm:-mt-14 sm:mb-5"
        />

        <ShopCatalogQuickSearch locale={locale} className="mb-5 sm:mb-6" />

        {/* Seamless grid */}
        <div
          id="shop-brands"
          className="scroll-mt-28 overflow-hidden rounded-2xl border border-foreground/10 sm:scroll-mt-32"
        >
          {/* Row 1 — hero: Urban + Akrapovič + Brabus (3 col) */}
          <div data-shop-store-grid="featured" className="grid grid-cols-1 sm:grid-cols-3">
            {heroStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                locale={locale}
                isUa={isUa}
                exploreLabel={exploreLabel}
                height="h-[280px] sm:h-[360px] lg:h-[460px]"
                sizes="(max-width: 768px) 100vw, 33vw"
                eager
              />
            ))}
          </div>

          {/* Remaining 12 stores: four complete rows on desktop, six on tablet. */}
          <div
            data-shop-store-grid="remaining"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {remainingStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                locale={locale}
                isUa={isUa}
                exploreLabel={exploreLabel}
                height="h-[250px] sm:h-[310px] lg:h-[370px]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
