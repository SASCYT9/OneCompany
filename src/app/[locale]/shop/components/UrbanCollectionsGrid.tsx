"use client";

import Link from "next/link";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/seo";
import {
  URBAN_COLLECTION_CARDS,
  URBAN_COLLECTIONS_GRID_SETTINGS,
  URBAN_COLLECTION_BRANDS,
} from "../data/urbanCollectionsList";
import type { UrbanCollectionCard } from "../data/urbanCollectionsList";

const ONE_COMPANY_LOGO = "https://onecompany.global/branding/logo-light.svg";

type UrbanCollectionsGridProps = {
  locale: SupportedLocale;
  /** When provided, only these cards are shown (e.g. those with a collection page config). */
  cards?: UrbanCollectionCard[];
};

function slugifyBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function UrbanCollectionsGrid({
  locale,
  cards: cardsProp,
}: UrbanCollectionsGridProps) {
  const isUa = locale === "ua";
  const [filter, setFilter] = useState<string>("all");

  const baseCards = cardsProp ?? URBAN_COLLECTION_CARDS;

  const filteredCards =
    filter === "all" ? baseCards : baseCards.filter((c) => slugifyBrand(c.brand) === filter);

  const subheading = isUa
    ? URBAN_COLLECTIONS_GRID_SETTINGS.subheadingUk
    : URBAN_COLLECTIONS_GRID_SETTINGS.subheading;
  const exploreLabel = isUa ? "Дослідити" : "Explore";

  return (
    <section
      id="UrbanCollGrid"
      className="mx-auto w-full max-w-[1720px] px-6 py-12 md:px-12 lg:px-16 xl:py-20"
    >
      <div className="relative aspect-3/1 min-h-[440px] w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#050505] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] ease-linear hover:scale-110"
          style={{
            backgroundImage: `url(${URBAN_COLLECTIONS_GRID_SETTINGS.heroImage})`,
          }}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10 backdrop-blur-[2px]" />

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c29d59] drop-shadow-md">
            {URBAN_COLLECTIONS_GRID_SETTINGS.eyebrow}
          </p>
          <img
            className="mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            src={ONE_COMPANY_LOGO}
            alt="One Company"
            width={280}
            height={104}
          />
          {subheading && (
            <p className="max-w-2xl text-balance text-lg font-light leading-relaxed text-white/80 drop-shadow-md md:text-xl">
              {subheading}
            </p>
          )}
        </div>
      </div>

      {URBAN_COLLECTIONS_GRID_SETTINGS.showFilters && (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
          <button
            type="button"
            className={`relative px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
              filter === "all" ? "text-white" : "text-white/35 hover:text-white/70"
            }`}
            data-filter="all"
            onClick={() => setFilter("all")}
          >
            {isUa ? "Всі" : "All"}
            {filter === "all" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-5 bg-[#c29d59] rounded-full" />
            )}
          </button>

          {URBAN_COLLECTION_BRANDS.map((brand) => {
            const key = slugifyBrand(brand);
            const isActive = filter === key;
            return (
              <button
                key={brand}
                type="button"
                className={`relative px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                  isActive ? "text-white" : "text-white/35 hover:text-white/70"
                }`}
                data-filter={key}
                onClick={() => setFilter(key)}
              >
                {brand}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-5 bg-[#c29d59] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Unified seamless mosaic grid ── */}
      <div className="mt-12 overflow-hidden rounded-2xl border border-white/8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
          {filteredCards.map((card, idx) => {
            /* Row 1: 2 hero cards (3 cols each)
               Row 2+: 3 equal columns (2 cols each) */
            const isHeroCard = idx < 2;
            const colSpan = isHeroCard
              ? "sm:col-span-1 lg:col-span-3"
              : "sm:col-span-1 lg:col-span-2";
            const heightClass = isHeroCard
              ? "h-[320px] sm:h-[360px] lg:h-[420px]"
              : "h-[300px] sm:h-[340px] lg:h-[360px]";

            return (
              <div
                key={card.collectionHandle}
                className={`group relative flex w-full flex-col overflow-hidden bg-[#060606] border-b border-r border-white/5 last:border-r-0 transition-all duration-500 ${colSpan} ${heightClass}`}
                data-brand={slugifyBrand(card.brand)}
              >
                <Link
                  href={`/${locale}/shop/urban/collections/${card.collectionHandle}`}
                  className="absolute inset-0 z-20"
                  aria-label={card.title}
                />
                <img
                  className={`absolute inset-0 h-full w-full ${card.imgFit === "contain" ? "object-contain" : "object-cover"} object-center opacity-75 transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-[1.03]`}
                  src={card.externalImageUrl}
                  alt=""
                  loading={idx < 4 ? "eager" : "lazy"}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-500 group-hover:from-black/70" />

                {card.productCount && (
                  <div className="absolute right-4 top-4 z-10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-md border border-white/15">
                    {card.productCount}
                  </div>
                )}

                <div className="relative z-10 mt-auto px-5 pb-5 md:px-7 md:pb-7">
                  {card.brand && (
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c29d59]/70 transition-colors duration-300 group-hover:text-[#c29d59]">
                      {card.brand}
                    </p>
                  )}
                  <h2
                    className={`font-bold leading-tight text-white transition-colors duration-300 group-hover:text-[#ead29d] ${isHeroCard ? "text-2xl lg:text-3xl" : "text-lg lg:text-xl"}`}
                  >
                    {card.title}
                  </h2>
                  <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/0 transition-all duration-400 group-hover:text-white/70 group-hover:gap-3">
                    {exploreLabel}
                    <svg
                      viewBox="0 0 24 24"
                      width={13}
                      height={13}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
