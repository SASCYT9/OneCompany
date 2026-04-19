"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { localizeShopText, localizeShopProductTitle, localizeShopDescription } from "@/lib/shopText";
import { getBrandLogo } from "@/lib/brandLogos";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct, ShopProductVariantSummary } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { htmlToPlainText } from "@/lib/sanitizeRichTextHtml";

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
  
  const mainImage = product.image || product.gallery?.[0] || "";
  const gallery = product.gallery?.length ? product.gallery : (mainImage ? [mainImage] : []);
  const isInStock = product.stock === "inStock";

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
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Main Image */}
            <div style={{ 
              aspectRatio: "1", 
              background: "var(--burger-card)", 
              border: "1px solid var(--burger-border)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 40
            }}>
              {mainImage ? (
                <img 
                  src={mainImage} 
                  alt={title} 
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <ShoppingBag size={80} color="var(--burger-border)" />
              )}
              
              {/* Badges */}
              <div style={{ position: "absolute", top: 24, left: 24, display: "flex", gap: 8 }}>
                {product.tags?.find(t => t.startsWith("type:")) && (
                  <span style={{ 
                    padding: "6px 12px", 
                    background: "var(--burger-yellow)", 
                    color: "#000",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    fontWeight: 700
                  }}>
                    {product.tags.find(t => t.startsWith("type:"))?.slice(5)}
                  </span>
                )}
                {product.vendor && (
                  <span style={{ 
                    padding: "6px 12px", 
                    background: "#111", 
                    color: "var(--burger-text)",
                    border: "1px solid var(--burger-border)",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                  }}>
                    {product.vendor}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {gallery.slice(0, 4).map((img, idx) => (
                  <div key={idx} style={{
                    aspectRatio: "1",
                    background: "var(--burger-card)",
                    border: "1px solid var(--burger-border)",
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.2s"
                  }}>
                    <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Details ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ 
                  width: 48, height: 48, 
                  background: "#fff", 
                  borderRadius: 4, 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 4
                }}>
                  <img src={getBrandLogo(product.brand)} alt={product.brand} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--burger-muted)" }}>
                    {product.brand}
                  </div>
                  {product.sku && (
                    <div style={{ fontSize: 12, color: "var(--burger-muted)", marginTop: 4 }}>
                      SKU: {product.sku}
                    </div>
                  )}
                </div>
              </div>
              
              <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
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
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--burger-yellow)", marginBottom: 24 }}>
                  {isUa ? "Опис" : "Description"}
                </h3>
                <div 
                  className="prose prose-invert max-w-none burger-prose" 
                  style={{ color: "var(--burger-muted)", fontSize: 15, lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: formatDescriptionDisplay(descriptionRaw) }} 
                />
              </div>
            )}

            {/* Metadata Tags */}
            {product.tags && product.tags.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {product.tags.map(tag => (
                  <span key={tag} style={{ 
                    padding: "6px 12px", 
                    background: "var(--burger-card)", 
                    border: "1px solid var(--burger-border)",
                    fontSize: 11,
                    color: "var(--burger-muted)"
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
