"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Zap, Target } from "lucide-react";

import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct, ShopProductVariant } from "@prisma/client";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { useRouter } from "next/navigation";
import { sanitizeRichTextHtml } from "@/lib/sanitizeRichTextHtml";
import { MobileProductDisclosure } from "./MobileProductDisclosure";

type Props = {
  locale: SupportedLocale;
  product: ShopProduct & { variants?: ShopProductVariant[] };
  viewerContext: ShopViewerPricingContext;
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export default function RacechipShopProductDetailLayout({
  locale,
  product,
  viewerContext,
}: Props) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const router = useRouter();
  const variant = product.variants?.[0];
  const [isAdding, setIsAdding] = useState(false);
  const [inCart, setInCart] = useState(false);

  const productTitle = isUa ? (product.titleUa || product.titleEn) : (product.titleEn || product.titleUa);
  const longDesc = sanitizeRichTextHtml(
    isUa ? (product.longDescUa || product.longDescEn) : (product.longDescEn || product.longDescUa)
  );
  
  // Format Breadcrumbs from tags
  const makeTag = product.tags?.find(t => t.startsWith("car_make:"))?.slice(9);
  const modelTag = product.tags?.find(t => t.startsWith("car_model:"))?.slice(10);
  const engineTag = product.tags?.find(t => t.startsWith("car_engine:"))?.slice(11);
  
  const formattedMake = makeTag ? makeTag.charAt(0).toUpperCase() + makeTag.slice(1) : "RaceChip";
  const formattedModel = modelTag ? modelTag.toUpperCase().replace('-', ' ') : "";

  // Pricing Logic — compute all 3 currencies
  const getPricing = () => {
    let basePriceEur = 0;
    if (variant) {
      basePriceEur = variant.priceEur ? Number(variant.priceEur) : 0;
    } else {
      const pPricing = resolveShopProductPricing(product as any, viewerContext);
      basePriceEur = pPricing.effectivePrice.eur ?? (product.priceEur ? Number(product.priceEur) : 0);
    }
    if (basePriceEur <= 0) return null;

    const priceUsd = product.priceUsd ? Number(product.priceUsd) : (rates?.USD ? Math.round(basePriceEur * rates.USD) : 0);
    const priceUah = product.priceUah ? Number(product.priceUah) : (rates?.UAH ? Math.round(basePriceEur * rates.UAH) : 0);

    return {
      eur: formatPrice(locale, basePriceEur, "EUR"),
      usd: priceUsd > 0 ? formatPrice(locale, priceUsd, "USD") : null,
      uah: priceUah > 0 ? formatPrice(locale, priceUah, "UAH") : null,
      primary: currency === "USD" && priceUsd > 0
        ? formatPrice(locale, priceUsd, "USD")
        : currency === "UAH" && priceUah > 0
          ? formatPrice(locale, priceUah, "UAH")
          : formatPrice(locale, basePriceEur, "EUR"),
    };
  };

  const pricing = getPricing();
  const finalPriceLabel = pricing?.primary ?? null;
  
  const handleAddToCart = async () => {
    if (!variant || isAdding || inCart) return;
    setIsAdding(true);
    try {
      const payload = {
        slug: product.slug,
        variantId: variant.id,
        quantity: 1,
      };
      const response = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Add to cart failed");
      setInCart(true);
      router.push(`/${locale}/shop/cart`);
    } catch (err) {
      console.error("Failed to add to cart", err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white selection:bg-[#ff4a00] selection:text-white font-sans overflow-hidden">
      
      {/* Background Cinematic Glow Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_top_right,rgba(255,74,0,0.06)_0%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />

      <main className="max-w-[1500px] mx-auto pt-[120px] pb-24 px-6 md:px-12 relative z-10">
        
        {/* Navigation Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-bold text-zinc-500 mb-12">
          <Link href={`/${locale}/shop/racechip`} className="hover:text-[#ff4a00] transition-colors flex items-center gap-2">
            <ArrowLeft size={14} />
            {isUa ? "Назад до фільтра" : "Back to Filter"}
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-zinc-600">{formattedMake}</span>
          {formattedModel && (
            <>
              <ChevronRight size={12} className="opacity-40" />
              <span className="text-zinc-600">{formattedModel}</span>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          
          {/* LEFT: IMAGE GALLERY (Floating Canvas) */}
          <div className="relative sticky top-[120px]">
            <div className="bg-[#0a0a0a] rounded-3xl border border-white/[0.04] p-12 aspect-square flex items-center justify-center relative overflow-hidden group shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
               {/* Accent Background */}
               <div className="absolute inset-0 bg-white/5 group-hover:bg-white/[0.07] transition-colors duration-500" />
               <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-1000 bg-[radial-gradient(circle_at_center,rgba(255,74,0,1)_0%,transparent_60%)] pointer-events-none" />

               {product.image ? (
                  <Image
                    src={product.image}
                    alt={productTitle}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain p-10 drop-shadow-2xl group-hover:scale-105 transition-transform duration-700 hover:drop-shadow-[0_20px_40px_rgba(255,74,0,0.2)]"
                    priority
                  />
               ) : (
                  <div className="text-8xl relative z-10">🏎️</div>
               )}
            </div>
          </div>

          {/* RIGHT: DETAILS & ACTIONS */}
          <div className="flex flex-col">
            
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#ff4a00] font-black bg-[#ff4a00]/10 px-3 py-1.5 rounded-sm border border-[#ff4a00]/20 mb-6">
                <Zap size={14} strokeWidth={2.5} />
                RaceChip GTS 5 + App Control
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.1] tracking-tight mb-4">
                {productTitle}
              </h1>
              {engineTag && (
                  <p className="text-lg text-zinc-400 font-medium">
                     Engine Spec: {engineTag.replace(/-/g, ' ').toUpperCase()}
                  </p>
              )}
            </div>

            <div className="w-full h-px bg-white/[0.05] my-8" />

            {/* PERFORMANCE SPECS (Extracted dynamically from longDescription HTML if present) */}
            {longDesc && (
              <MobileProductDisclosure
                title={isUa ? "Опис і характеристики" : "Description & specs"}
                className="mb-10"
              >
                <div
                  className="prose prose-invert prose-orange max-w-none text-sm text-zinc-300
                  [&_.racechip-specs_h3]:text-[#ff4a00] [&_.racechip-specs_h3]:uppercase [&_.racechip-specs_h3]:tracking-widest [&_.racechip-specs_h3]:text-[13px] [&_.racechip-specs_h3]:mb-4
                  [&_.racechip-specs_ul]:list-none [&_.racechip-specs_ul]:pl-0 [&_.racechip-specs_ul]:space-y-3
                  [&_.racechip-specs_li]:border-b [&_.racechip-specs_li]:border-white/[0.04] [&_.racechip-specs_li]:pb-3
                  [&_strong]:text-white [&_strong]:font-bold"
                  dangerouslySetInnerHTML={{ __html: longDesc }}
                />
              </MobileProductDisclosure>
            )}

            {/* ACTION CENTER */}
            <div className="bg-[#0a0a0a] rounded-2xl border border-white/[0.06] p-8 shadow-2xl relative overflow-hidden group">
               {/* Hover Accent Glow */}
               <div className="absolute inset-x-0 bottom-0 h-1 bg-[#ff4a00]/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

               <div className="flex items-end justify-between mb-8">
                   <div>
                     <span className="block text-[11px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-bold">
                       {isUa ? "Ціна" : "Price"}
                     </span>
                     <div className="text-4xl font-black text-white tracking-tight">
                       {finalPriceLabel || (isUa ? "Під замовлення" : "On Request")}
                     </div>
                     {/* All 3 currencies row */}
                     {pricing && (
                       <div className="flex items-center gap-3 mt-3 text-[11px] tracking-widest font-light text-zinc-500">
                         <span className={currency === "EUR" ? "text-white font-bold" : ""}>{pricing.eur}</span>
                         {pricing.usd && (
                           <><span className="text-zinc-700">·</span>
                           <span className={currency === "USD" ? "text-white font-bold" : ""}>{pricing.usd}</span></>
                         )}
                         {pricing.uah && (
                           <><span className="text-zinc-700">·</span>
                           <span className={currency === "UAH" ? "text-white font-bold" : ""}>{pricing.uah}</span></>
                         )}
                       </div>
                     )}
                   </div>
                   <div className="text-right">
                     <span className="block text-xs text-[#00e676] font-bold uppercase tracking-widest flex items-center justify-end gap-1.5">
                        <Check size={14} strokeWidth={3} />
                        {isUa ? "У наявності" : "In Stock"}
                     </span>
                   </div>
                </div>

               {finalPriceLabel ? (
                 <button
                   onClick={handleAddToCart}
                   disabled={isAdding || inCart}
                   className={`w-full py-5 px-8 rounded-xl text-sm font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-3 ${
                     inCart
                       ? "bg-white text-black drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                       : "bg-[#ff4a00] text-white hover:bg-[#ff6a00] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(255,74,0,0.3)] shadow-[0_5px_15px_rgba(255,74,0,0.2)]"
                   }`}
                 >
                   {isAdding ? (
                     <span className="animate-pulse">{isUa ? "Додаємо..." : "Adding..."}</span>
                   ) : inCart ? (
                     <>
                       <Check size={20} strokeWidth={3} />
                       {isUa ? "У Кошику" : "In Cart"}
                     </>
                   ) : (
                     <>{isUa ? "Додати в кошик" : "Add to Cart"}</>
                   )}
                 </button>
               ) : (
                 <Link href={`/${locale}/contact`}>
                  <button className="w-full bg-[#111] hover:bg-white text-white hover:text-black border border-white/10 hover:border-transparent py-5 px-8 rounded-xl text-sm font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                    <Target size={18} />
                    {isUa ? "Запитати ціну" : "Request Price"}
                  </button>
                 </Link>
               )}

               <p className="text-center text-[11px] text-zinc-500 mt-6 tracking-wide">
                 {isUa 
                   ? "Безкоштовна доставка для всіх конфігурацій GTS 5. Модуль App Control входить в пакет." 
                   : "Free shipping for all GTS 5 modules. App Control included."}
               </p>
            </div>
            
          </div>
        </div>

      </main>
    </div>
  );
}
