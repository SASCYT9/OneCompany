"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";
import { localizeShopText, localizeShopProductTitle, localizeShopDescription } from "@/lib/shopText";
import { getBrandLogo } from "@/lib/brandLogos";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct, ShopProductVariantSummary } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { htmlToPlainText } from "@/lib/sanitizeRichTextHtml";
import { MobileProductDisclosure } from "./MobileProductDisclosure";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";

type Props = {
  locale: string;
  resolvedLocale: SupportedLocale;
  product: ShopProduct;
  pricing: ReturnType<typeof resolveShopProductPricing>;
  viewerContext: ShopViewerPricingContext;
  rates: Record<string, number> | null;
  defaultVariant: ShopProductVariantSummary | null;
  relatedProducts: ShopProduct[];
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function formatDescriptionDisplay(text: string) {
  if (!text) return "";

  // If input is already structured HTML (has h3/ul/li/p tags), pass through —
  // the Tailwind `prose` class will style it. Don't flatten to plain text.
  if (/<(?:h[1-6]|ul|ol|li)\b/i.test(text)) {
    return text;
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const plainText = htmlToPlainText(text);
  if (!plainText) return "";

  // 1. Double newlines -> single newline for normalization
  let html = escapeHtml(plainText).replace(/\n\n+/g, "\n");
  
  // 2. Identify common headings and wrap them
  const headingRegex = /(Характеристики та переваги|Особливості|Features and benefits|Applications|Застосування|Особливості та переваги|What's Included:?|Що в комплекті:?|Шо в комплекті:?|Fitment:?|Сумісність:?|Vehicle Fitment:?|Підходить для:?)/gi;
  html = html.replace(headingRegex, 
    '<strong style="color: var(--burger-yellow); font-size: 1.05em; letter-spacing: 0.15em; display: inline-block; margin-top: 24px; margin-bottom: 12px; text-transform: uppercase;">$1</strong>'
  );

  // 3. Convert explicit newlines into breaks
  html = html.replace(/\n/g, "<br/><br/>");

  // 4. Format multiple bullet points that are squashed on one line or multiple lines
  // The lazily captured text (.*?) will grab everything until the next bullet, <br/>, or end of string.
  html = html.replace(/•\s*(.*?)(?=\s*•|<br\/>|$)/g, 
    '<div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; padding-left: 8px;"><span style="color: var(--burger-yellow); font-size: 16px; line-height: 1.4; flex-shrink: 0;">•</span><span style="opacity: 0.9; line-height: 1.6;">$1</span></div>'
  );

  // 5. Break up massive walls of text
  // We split by existing breaks, then apply a 2-sentence split rule to long chunks
  const blocks = html.split('<br/><br/>');
  const processedBlocks = blocks.map(block => {
    // If block is a list item or a heading or too short, skip breaking it
    if (block.length < 150 || block.includes('display: flex') || block.includes('<strong')) {
      return block;
    }
    
    let sentenceCount = 0;
    // Look for a period, exclamation, or question mark followed by a space and a capital letter
    return block.replace(/([.!?])\s+([А-ЯІЇЄҐA-Z])/g, (match, punct, nextLetter) => {
      sentenceCount++;
      return sentenceCount % 2 === 0 ? `${punct}<br/><br/>${nextLetter}` : match;
    });
  });

  html = processedBlocks.join('<br/><br/>');

  // 6. Clean up trailing/leading breaks
  html = html.replace(/^(<br\/>)+/, '').replace(/(<br\/>)+$/, '');

  return html;
}

export function BurgerShopProductDetailLayout({
  locale,
  resolvedLocale,
  product,
  pricing,
  rates,
  defaultVariant,
  relatedProducts,
}: Props) {
  const isUa = resolvedLocale === "ua";
  const title = localizeShopProductTitle(resolvedLocale, product);

  // Clean description string from backend (either bodyHtml or longDescription)
  const descriptionRaw = localizeShopDescription(resolvedLocale, product.longDescription);

  // Build gallery: filter out empty/duplicate URLs, dedupe with main image first
  const rawGallery = (product.gallery || []).filter((g): g is string => !!g && typeof g === "string" && g.trim().length > 0);
  const galleryUnique = Array.from(new Set([
    ...(product.image ? [product.image] : []),
    ...rawGallery,
  ]));
  const gallery = galleryUnique.length ? galleryUnique : (product.image ? [product.image] : []);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [brokenIdx, setBrokenIdx] = useState<Set<number>>(new Set());
  const visibleGallery = gallery.filter((_, i) => !brokenIdx.has(i));
  // activeImageIdx indexes the ORIGINAL gallery array (kept in sync with thumb
  // click via realIdx). If that image is broken or out of range, fall back to
  // the first visible image so we never show the wrong picture.
  const mainImage = (
    activeImageIdx >= 0 && activeImageIdx < gallery.length && !brokenIdx.has(activeImageIdx)
      ? gallery[activeImageIdx]
      : visibleGallery[0]
  ) || "";
  const isInStock = product.stock === "inStock";

  // Filter internal facet tags out of the user-facing tag list. brand/type/
  // vendor/model/chassis/engine prefixes are filter-only metadata, not display.
  const FACET_PREFIXES = ["brand:", "type:", "vendor:", "model:", "chassis:", "engine:", "year:"];
  const displayTags = (product.tags || []).filter((t) => !FACET_PREFIXES.some((p) => t.startsWith(p)));

  const computeCrossPrices = (priceObj: { eur: number; usd: number; uah: number }) => {
    let computedUah = priceObj.uah || 0;
    let computedEur = priceObj.eur || 0;
    let computedUsd = priceObj.usd || 0;
    const hasValid = (v?: number) => typeof v === "number" && v > 0;
    if (hasValid(priceObj.uah) && rates) {
      if (!hasValid(computedEur)) computedEur = (priceObj.uah / rates.UAH) * rates.EUR;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.uah / rates.UAH) * rates.USD;
    } else if (hasValid(priceObj.eur) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.eur / rates.EUR) * rates.UAH;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.eur / rates.EUR) * rates.USD;
    } else if (hasValid(priceObj.usd) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.usd / rates.USD) * rates.UAH;
      if (!hasValid(computedEur)) computedEur = (priceObj.usd / rates.USD) * rates.EUR;
    }
    return { uah: computedUah, eur: computedEur, usd: computedUsd };
  };

  return (
    <div className="burger-shop" style={{ minHeight: "100dvh", paddingTop: 100 }}>
      {/* ── Back Link ── */}
      <div className="burger-back" style={{ paddingBottom: 0 }}>
        <Link href={`/${locale}/shop/burger/products`} className="burger-back__link">
          ← {isUa ? "До каталогу Burger" : "Back to Burger catalog"}
        </Link>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "48px 48px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 64, alignItems: "start" }}>
          
          {/* ── Left: Media Gallery ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Main Image */}
            <div style={{
              aspectRatio: "1",
              background: "var(--burger-card)",
              border: "1px solid var(--burger-border)",
              borderRadius: 12,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              overflow: "hidden",
            }}>
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={title}
                  onError={() => {
                    // Mark this image broken; advance to next visible image if available.
                    setBrokenIdx((prev) => new Set([...prev, gallery.indexOf(mainImage)]));
                    setActiveImageIdx(0);
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <ShoppingBag size={80} color="var(--burger-border)" />
              )}

              {/* Badges */}
              <div style={{ position: "absolute", top: 20, left: 20, display: "flex", gap: 8 }}>
                {product.tags?.find((t) => t.startsWith("type:")) && (
                  <span style={{
                    padding: "5px 10px",
                    background: "var(--burger-yellow, #FFD700)",
                    color: "#000",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    borderRadius: 3,
                  }}>
                    {product.tags.find((t) => t.startsWith("type:"))?.slice(5).replace(/-/g, " ")}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails — click to switch main image */}
            {visibleGallery.length > 1 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(visibleGallery.length, 5)}, 1fr)`,
                gap: 10,
              }}>
                {visibleGallery.slice(0, 5).map((img) => {
                  const realIdx = gallery.indexOf(img);
                  const isActive = realIdx === activeImageIdx;
                  return (
                    <button
                      key={realIdx + img}
                      type="button"
                      onClick={() => setActiveImageIdx(realIdx)}
                      style={{
                        all: "unset",
                        aspectRatio: "1",
                        background: "var(--burger-card)",
                        border: `1.5px solid ${isActive ? "var(--burger-yellow, #FFD700)" : "var(--burger-border)"}`,
                        borderRadius: 8,
                        padding: 10,
                        cursor: "pointer",
                        transition: "border-color 0.15s, opacity 0.15s",
                        opacity: isActive ? 1 : 0.7,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isActive ? "1" : "0.7"; }}
                    >
                      <img
                        src={img}
                        alt=""
                        onError={() => setBrokenIdx((prev) => new Set([...prev, realIdx]))}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: Details ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{
                  width: 38, height: 38,
                  background: "#fff",
                  borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 3,
                  flexShrink: 0,
                }}>
                  <img src={getBrandLogo(product.brand)} alt={product.brand} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                    {product.brand}
                  </div>
                  {product.sku && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
                      SKU: {product.sku}
                    </div>
                  )}
                </div>
              </div>

              <h1 style={{
                fontSize: "clamp(22px, 2.4vw, 30px)",
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
                marginBottom: 0,
                color: "rgba(255,255,255,0.95)",
              }}>
                {title}
              </h1>

              {/* Price Block */}
              <div style={{ 
                background: "var(--burger-card)", 
                border: "1px solid var(--burger-border)", 
                padding: 32, 
                marginTop: 32,
                display: "flex",
                flexDirection: "column",
                gap: 24
              }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--burger-muted)", marginBottom: 8 }}>
                    {isUa ? "Ціна" : "Price"}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: "var(--burger-yellow)" }}>
                      <ShopPrimaryPriceBox locale={resolvedLocale} isUa={isUa} price={pricing.effectivePrice} />
                    </div>
                    {pricing.effectiveCompareAt && (
                      <div style={{ fontSize: 18, textDecoration: "line-through", color: "rgba(255,255,255,0.3)" }}>
                        {formatPrice(resolvedLocale, computeCrossPrices(pricing.effectiveCompareAt).usd, "USD")}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <ShopB2BPricingBand pricing={pricing} locale={resolvedLocale} />
                  </div>
                  {SHOW_STOCK_BADGE ? (
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 16,
                      padding: "6px 12px",
                      background: isInStock ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 152, 0, 0.1)",
                      border: `1px solid ${isInStock ? "rgba(0, 200, 83, 0.3)" : "rgba(255, 152, 0, 0.3)"}`,
                      color: isInStock ? "#00e676" : "#ff9800",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em"
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: isInStock ? "#00e676" : "#ff9800"
                      }} />
                      {isInStock ? (isUa ? "В наявності" : "In stock") : (isUa ? "Під замовлення" : "Pre order")}
                    </div>
                  ) : null}
                </div>

                {/* CTA Action logic */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                  <div style={{ width: "100%", padding: "2px" }}>
                    {(!pricing.effectivePrice || pricing.effectivePrice.usd === 0) ? (
                      <Link
                        href={`/${resolvedLocale}/contact`}
                        className="burger-btn w-full justify-center text-center uppercase tracking-widest font-bold"
                        style={{ background: "white", color: "black", padding: "16px", borderRadius: "8px", display: "block" }}
                      >
                        {isUa ? "Запитати ціну" : "Request Price"}
                      </Link>
                    ) : (
                      <AddToCartButton 
                        slug={product.slug} 
                        locale={resolvedLocale} 
                        variantId={defaultVariant?.id ?? null} 
                        productName={title} 
                        variant="default"
                        label={isUa ? "Додати в кошик" : "Add to Cart"}
                        className="burger-btn burger-btn--primary w-full justify-center"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description HTML */}
            {descriptionRaw && (
              <MobileProductDisclosure
                title={isUa ? "Опис" : "Description"}
                className="mt-2"
              >
                <div
                  className="prose prose-invert max-w-none burger-prose"
                  dangerouslySetInnerHTML={{ __html: formatDescriptionDisplay(descriptionRaw) }}
                />
              </MobileProductDisclosure>
            )}

            {/* Display tags only — internal facet tags (brand:/type:/chassis:/...) are hidden. */}
            {displayTags.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {displayTags.map((tag) => (
                  <span key={tag} style={{
                    padding: "4px 10px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 999,
                    fontSize: 10.5,
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: "0.02em",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
