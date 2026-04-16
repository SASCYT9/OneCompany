"use client";

import Image from "next/image";
import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import { OUR_STORES } from "../data/ourStores";

type OurStoresPortalProps = {
  locale: SupportedLocale;
  isB2bApproved: boolean;
};

function localize(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

const getCardSpan = (id: string) => {
  switch (id) {
    case 'urban':
    case 'brabus':
      return 'md:col-span-2 md:row-span-2 min-h-[400px] md:min-h-[500px]'; // 2x2 Feature
    case 'do88':
    case 'racechip':
      return 'md:col-span-2 md:row-span-1 min-h-[250px] md:min-h-[300px]'; // 2x1 Wide
    case 'akrapovic':
      return 'md:col-span-2 md:row-span-1 min-h-[250px] md:min-h-[300px]'; // 2x1 Wide
    case 'csf':
    case 'ohlins':
    case 'girodisc':
    case 'ipe':
    case 'burger':
    case 'fi':
    case 'kw':
    case 'eventuri':
    default:
      return 'col-span-1 md:col-span-1 md:row-span-1 min-h-[250px] md:min-h-[300px]'; // 1x1 Standard
  }
};

export default function OurStoresPortal({ locale, isB2bApproved }: OurStoresPortalProps) {
  const isUa = locale === "ua";

  return (
    <div className="relative min-h-screen bg-[#050505] text-white pt-24 pb-20 selection:bg-white/20">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/[0.03] via-[#050505] to-[#050505] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Navigation & Header */}
        <div className="flex justify-between items-start mb-16 lg:mb-24">
          <div className="max-w-2xl">
            <div className="w-16 h-[1px] bg-gradient-to-r from-white/80 to-transparent mb-6" />
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-3 font-semibold">
              {isUa ? "Глобальний портал" : "Global Portal"}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tighter uppercase leading-none mb-6 text-white/90">
              {isUa ? "Наші Магазини" : "Our Stores"}
            </h1>
            <p className="text-sm md:text-base text-white/50 leading-relaxed max-w-lg font-light">
              {isUa
                ? "Офіційні магазини партнерів One Company. Досліджуйте простір преміальних автомобільних брендів та тюнінг-ательє."
                : "Official One Company partner stores. Explore the space of premium automotive brands and tuning ateliers."}
            </p>
          </div>
          
          <Link 
            href={`/${locale}`} 
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-xs font-medium tracking-widest uppercase text-white/70 hover:text-white backdrop-blur-md transition-all duration-300"
          >
            ← {isUa ? "Головна" : "Home"}
          </Link>
        </div>

        {/* B2B Stock Portal */}
        {isB2bApproved && (
          <div className="mb-6 lg:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <Link 
              href={`/${locale}/shop/stock`}
              className="group relative flex flex-col justify-end w-full min-h-[280px] md:min-h-[360px] p-6 md:p-10 rounded-[28px] md:rounded-[36px] overflow-hidden border border-white/10 bg-[#0a0a0c] transition-all duration-500 hover:border-white/20 hover:shadow-[0_0_80px_rgba(255,255,255,0.05)]"
            >
              <Image
                src="/images/shop/stores/one-company-stock-porsche.png"
                alt="One Company Stock"
                fill
                sizes="100vw"
                className="object-cover opacity-40 transition-transform duration-700 ease-out group-hover:scale-105 group-hover:opacity-60"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-4xl">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isUa ? "B2B Доступ Відкрито" : "B2B Access Granted"}
                  </div>
                  <h2 className="text-3xl md:text-5xl font-light uppercase tracking-tight text-white mb-2 group-hover:text-emerald-50 transition-colors">
                    One Company Stock
                  </h2>
                  <p className="text-sm md:text-base text-white/60 font-light max-w-2xl leading-relaxed">
                    {isUa 
                      ? "Спеціалізований B2B-портал складу. Отримуйте миттєвий доступ до залишків, гуртових цін та оформлюйте замовлення на преміальні запчастини з наявністю."
                      : "Specialized B2B stock portal. Get instant access to inventory, wholesale pricing, and place orders for premium parts in stock."}
                  </p>
                </div>
                
                <div className="shrink-0 flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-md group-hover:bg-white group-hover:text-black group-hover:scale-110 transition-all duration-500">
                  <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 auto-rows-min gap-4 md:gap-6 lg:gap-8 grid-flow-dense">
          {OUR_STORES.filter(store => !store.isHidden).map((store, i) => {
            const href = store.id === "urban" ? `/${locale}/shop/urban`
              : store.id === "do88" ? `/${locale}/shop/do88`
              : store.id === "brabus" ? `/${locale}/shop/brabus`
              : store.id === "burger" ? `/${locale}/shop/burger`
              : store.id === "akrapovic" ? `/${locale}/shop/akrapovic`
              : store.id === "racechip" ? `/${locale}/shop/racechip`
              : store.id === "csf" ? `/${locale}/shop/csf`
              : store.id === "ohlins" ? `/${locale}/shop/ohlins`
              : store.id === "girodisc" ? `/${locale}/shop/girodisc`
              : store.id === "ipe" ? `/${locale}/shop/ipe`
              : store.href || "#";
              
            const isExternal = store.external === true;
            const isLogoAsset = store.imageUrl?.startsWith("/logos/") ?? false;
            const spanClass = getCardSpan(store.id);
            const delay = i * 100;

            const content = (
              <div className="relative w-full h-full flex flex-col justify-end p-6 md:p-8 rounded-[24px] md:rounded-[32px] overflow-hidden border border-white/5 bg-[#0a0a0c] group-hover:border-white/20 transition-all duration-500">
                {store.imageUrl ? (
                  <>
                    <Image
                      src={store.imageUrl}
                      alt={localize(isUa, store.name, store.nameUk)}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className={`object-cover transition-transform duration-1000 ease-out group-hover:scale-105 ${isLogoAsset ? 'opacity-90 grayscale invert p-12 object-contain' : 'opacity-50 group-hover:opacity-75'}`}
                      unoptimized={isLogoAsset}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c20] to-[#0e0e11] opacity-50" />
                )}

                <div className="relative z-10 flex flex-col justify-end h-full">
                  <div className="transform transition-all duration-500 lg:translate-y-4 lg:group-hover:translate-y-0">
                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-light uppercase tracking-tight text-white/90 mb-3 drop-shadow-lg">
                      {localize(isUa, store.name, store.nameUk)}
                    </h3>
                    <p className="text-xs md:text-sm text-white/60 font-light leading-relaxed max-w-[40ch] opacity-80 md:opacity-0 md:-translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75 hidden sm:block">
                      {localize(isUa, store.description, store.descriptionUk)}
                    </p>
                  </div>
                </div>

                <div className="absolute top-6 right-6 md:top-8 md:right-8 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500 flex items-center justify-center w-10 h-10 rounded-full bg-white text-black">
                  {isExternal ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  )}
                </div>
              </div>
            );

            const containerClass = `group block w-full h-full outline-none transform-gpu animate-in fade-in zoom-in-95 duration-700 fill-mode-both ${spanClass}`;

            if (isExternal) {
              return (
                <a key={store.id} href={href} target="_blank" rel="noopener noreferrer" className={containerClass} style={{ animationDelay: `${delay}ms` }}>
                  {content}
                </a>
              );
            }
            return (
              <Link key={store.id} href={href} className={containerClass} style={{ animationDelay: `${delay}ms` }}>
                {content}
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}
