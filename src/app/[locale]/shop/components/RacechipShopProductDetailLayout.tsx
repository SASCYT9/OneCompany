"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Zap, Target, Truck } from "lucide-react";

import type { SupportedLocale } from "@/lib/seo";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";
import type { ShopProduct, ShopProductVariantSummary } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopPriceBands, resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { useRouter } from "next/navigation";
import { sanitizeRichTextHtml } from "@/lib/sanitizeRichTextHtml";
import { MobileProductDisclosure } from "./MobileProductDisclosure";

type Props = {
  locale: SupportedLocale;
  product: ShopProduct;
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

function resolveVariantPricing(
  variant: ShopProductVariantSummary,
  viewerContext: ShopViewerPricingContext
) {
  return resolveShopPriceBands({
    b2cPrice: variant.price,
    b2cCompareAt: variant.compareAt ?? null,
    b2bPrice: variant.b2bPrice ?? null,
    b2bCompareAt: variant.b2bCompareAt ?? null,
    context: viewerContext,
  });
}

export default function RacechipShopProductDetailLayout({
  locale,
  product,
  viewerContext: ssrViewerContext,
}: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const router = useRouter();
  const variant = product.variants?.find((item) => item.isDefault) ?? product.variants?.[0] ?? null;
  const [isAdding, setIsAdding] = useState(false);
  const [inCart, setInCart] = useState(false);

  const productTitle = isUa
    ? product.title.ua || product.title.en
    : product.title.en || product.title.ua;
  const longDesc = sanitizeRichTextHtml(
    isUa
      ? product.longDescription.ua || product.longDescription.en
      : product.longDescription.en || product.longDescription.ua
  );

  // Format Breadcrumbs from tags
  const makeTag = product.tags?.find((t) => t.startsWith("car_make:"))?.slice(9);
  const modelTag = product.tags?.find((t) => t.startsWith("car_model:"))?.slice(10);
  const engineTag = product.tags?.find((t) => t.startsWith("car_engine:"))?.slice(11);

  const formattedMake = makeTag ? makeTag.charAt(0).toUpperCase() + makeTag.slice(1) : "RaceChip";
  const formattedModel = modelTag ? modelTag.toUpperCase().replace("-", " ") : "";

  // Pricing Logic — compute all 3 currencies
  const getPricing = () => {
    const resolvedPricing = variant
      ? resolveVariantPricing(variant, viewerContext)
      : resolveShopProductPricing(product, viewerContext);
    const basePriceEur = resolvedPricing.effectivePrice.eur ?? 0;
    if (basePriceEur <= 0) return null;

    const priceUsd =
      resolvedPricing.effectivePrice.usd > 0
        ? resolvedPricing.effectivePrice.usd
        : rates?.USD
          ? Math.round(basePriceEur * rates.USD)
          : 0;
    const priceUah =
      resolvedPricing.effectivePrice.uah > 0
        ? resolvedPricing.effectivePrice.uah
        : rates?.UAH
          ? Math.round(basePriceEur * rates.UAH)
          : 0;

    return {
      eur: formatPrice(locale, basePriceEur, "EUR"),
      usd: priceUsd > 0 ? formatPrice(locale, priceUsd, "USD") : null,
      uah: priceUah > 0 ? formatPrice(locale, priceUah, "UAH") : null,
      primary:
        currency === "USD" && priceUsd > 0
          ? formatPrice(locale, priceUsd, "USD")
          : currency === "UAH" && priceUah > 0
            ? formatPrice(locale, priceUah, "UAH")
            : formatPrice(locale, basePriceEur, "EUR"),
    };
  };

  const pricing = getPricing();
  const finalPriceLabel = pricing?.primary ?? null;

  // Independent ShopResolvedPricing for the B2B disclosure band — keeps the
  // existing display-formatted `pricing` untouched.
  const resolvedB2B = variant
    ? resolveVariantPricing(variant, viewerContext)
    : resolveShopProductPricing(product, viewerContext);

  const handleAddToCart = async () => {
    if (!variant || isAdding || inCart) return;
    setIsAdding(true);
    try {
      const payload = {
        slug: product.slug,
        variantId: variant?.id ?? null,
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
    } catch {
      // Cart API failed — button resets via finally; user can retry.
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-background min-h-screen text-foreground selection:bg-[#ff4a00] selection:text-white font-sans overflow-x-hidden">
      {/* Background Cinematic Glow Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_top_right,rgba(255,74,0,0.06)_0%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />

      <main className="max-w-[1500px] mx-auto pt-20 sm:pt-24 lg:pt-[120px] pb-12 md:pb-24 px-4 sm:px-6 md:px-12 relative z-10">
        {/* Navigation Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] tracking-widest uppercase font-bold text-foreground/55 dark:text-zinc-500 mb-6 md:mb-12">
          <Link
            href={`/${locale}/shop/racechip`}
            className="hover:text-[#ff4a00] transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            {isUa ? "Назад до фільтра" : "Back to Filter"}
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-foreground/40 dark:text-zinc-600">{formattedMake}</span>
          {formattedModel && (
            <>
              <ChevronRight size={12} className="opacity-40" />
              <span className="text-foreground/40 dark:text-zinc-600">{formattedModel}</span>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-24 items-start">
          {/* LEFT: IMAGE GALLERY (Floating Canvas) */}
          <div className="relative lg:sticky lg:top-[120px]">
            <div className="bg-card dark:bg-[#0a0a0a] rounded-2xl md:rounded-3xl border border-foreground/12 dark:border-white/4 p-4 sm:p-8 md:p-12 aspect-square flex items-center justify-center relative overflow-hidden group shadow-[0_4px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
              {/* Accent Background — subtle in light, brighter in dark */}
              <div className="absolute inset-0 bg-foreground/[0.02] dark:bg-white/5 group-hover:bg-foreground/[0.04] dark:group-hover:bg-white/[0.07] transition-colors duration-500" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-1000 bg-[radial-gradient(circle_at_center,rgba(255,74,0,1)_0%,transparent_60%)] pointer-events-none" />

              {product.image ? (
                <Image
                  src={product.image}
                  alt={productTitle}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain p-3 sm:p-6 md:p-10 drop-shadow-2xl group-hover:scale-105 transition-transform duration-700 hover:drop-shadow-[0_20px_40px_rgba(255,74,0,0.2)]"
                  priority
                />
              ) : (
                <div className="text-6xl sm:text-8xl relative z-10">🏎️</div>
              )}
            </div>
          </div>

          {/* RIGHT: DETAILS & ACTIONS */}
          <div className="flex flex-col">
            <div className="mb-4 md:mb-6">
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#ff4a00] font-black bg-[#ff4a00]/10 px-3 py-1.5 rounded-sm border border-[#ff4a00]/20 mb-4 md:mb-6">
                <Zap size={13} strokeWidth={2.5} />
                RaceChip GTS 5 + App Control
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-[1.15] tracking-tight mb-3 md:mb-4 break-words">
                {productTitle}
              </h1>
              {engineTag && (
                <p className="text-sm md:text-base lg:text-lg text-foreground/70 dark:text-zinc-400 font-medium break-words">
                  Engine Spec: {engineTag.replace(/-/g, " ").toUpperCase()}
                </p>
              )}
            </div>

            <div className="w-full h-px bg-foreground/10 dark:bg-white/5 my-5 md:my-8" />

            {/* PERFORMANCE SPECS (Extracted dynamically from longDescription HTML if present) */}
            {longDesc && (
              <MobileProductDisclosure
                title={isUa ? "Опис і характеристики" : "Description & specs"}
                className="mb-10"
              >
                <div
                  className="prose dark:prose-invert prose-orange max-w-none text-sm text-foreground/85 dark:text-zinc-300
                  [&_.racechip-specs_h3]:text-[#ff4a00] [&_.racechip-specs_h3]:uppercase [&_.racechip-specs_h3]:tracking-widest [&_.racechip-specs_h3]:text-[13px] [&_.racechip-specs_h3]:mb-4
                  [&_.racechip-specs_ul]:list-none [&_.racechip-specs_ul]:pl-0 [&_.racechip-specs_ul]:space-y-3
                  [&_.racechip-specs_li]:border-b [&_.racechip-specs_li]:border-foreground/10 [&_.racechip-specs_li]:dark:border-white/4 [&_.racechip-specs_li]:pb-3
                  [&_strong]:text-foreground [&_strong]:dark:text-white [&_strong]:font-bold"
                  dangerouslySetInnerHTML={{ __html: longDesc }}
                />
              </MobileProductDisclosure>
            )}

            {/* ACTION CENTER */}
            <div className="bg-card dark:bg-[#0a0a0a] rounded-2xl border border-foreground/12 dark:border-white/6 p-5 sm:p-7 md:p-8 shadow-2xl relative overflow-hidden group">
              {/* Hover Accent Glow */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-[#ff4a00]/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 md:mb-8">
                <div className="min-w-0">
                  <span className="block text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-foreground/55 dark:text-zinc-500 mb-2 font-bold">
                    {isUa ? "Ціна" : "Price"}
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight break-words">
                    {finalPriceLabel || (isUa ? "Під замовлення" : "On Request")}
                  </div>
                  {/* All 3 currencies row */}
                  {pricing && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 sm:mt-3 text-[11px] tracking-widest font-light text-foreground/55 dark:text-zinc-500">
                      <span className={currency === "EUR" ? "text-foreground font-bold" : ""}>
                        {pricing.eur}
                      </span>
                      {pricing.usd && (
                        <>
                          <span className="text-foreground/25 dark:text-zinc-700">·</span>
                          <span className={currency === "USD" ? "text-foreground font-bold" : ""}>
                            {pricing.usd}
                          </span>
                        </>
                      )}
                      {pricing.uah && (
                        <>
                          <span className="text-foreground/25 dark:text-zinc-700">·</span>
                          <span className={currency === "UAH" ? "text-foreground font-bold" : ""}>
                            {pricing.uah}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="sm:text-right shrink-0">
                  <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-foreground/85 dark:text-zinc-300 font-bold uppercase tracking-widest sm:justify-end">
                    <Truck size={13} strokeWidth={2.5} />
                    {isUa ? "Доставка 10-14 днів" : "Delivery 10-14 days"}
                  </span>
                </div>
              </div>

              <div className="mb-5 md:mb-6">
                <ShopB2BPricingBand pricing={resolvedB2B} locale={locale as SupportedLocale} />
              </div>

              {finalPriceLabel ? (
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding || inCart}
                  className={`w-full py-4 sm:py-5 px-5 sm:px-8 rounded-xl text-[13px] sm:text-sm font-black uppercase tracking-[0.18em] sm:tracking-widest transition-all flex items-center justify-center gap-3 ${
                    inCart
                      ? "bg-foreground text-background dark:bg-white dark:text-black drop-shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                      : "bg-[#ff4a00] text-white hover:bg-[#ff6a00] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(255,74,0,0.3)] shadow-[0_5px_15px_rgba(255,74,0,0.2)]"
                  }`}
                >
                  {isAdding ? (
                    <span className="animate-pulse">{isUa ? "Додаємо..." : "Adding..."}</span>
                  ) : inCart ? (
                    <>
                      <Check size={18} strokeWidth={3} />
                      {isUa ? "У Кошику" : "In Cart"}
                    </>
                  ) : (
                    <>{isUa ? "Додати в кошик" : "Add to Cart"}</>
                  )}
                </button>
              ) : (
                <Link href={`/${locale}/contact`} className="block">
                  <button className="w-full bg-foreground/8 dark:bg-[#111] hover:bg-foreground dark:hover:bg-white text-foreground dark:text-white hover:text-background dark:hover:text-black border border-foreground/15 dark:border-white/10 hover:border-transparent py-4 sm:py-5 px-5 sm:px-8 rounded-xl text-[13px] sm:text-sm font-black uppercase tracking-[0.18em] sm:tracking-widest transition-all flex items-center justify-center gap-3 shadow-[0_5px_15px_rgba(0,0,0,0.12)] dark:shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                    <Target size={16} />
                    {isUa ? "Запитати ціну" : "Request Price"}
                  </button>
                </Link>
              )}

              <p className="text-center text-[10px] sm:text-[11px] text-foreground/55 dark:text-zinc-500 mt-4 sm:mt-6 tracking-wide leading-relaxed">
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
