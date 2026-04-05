"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import {
  localizeShopDescription,
  localizeShopProductTitle,
  localizeShopText,
} from "@/lib/shopText";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import type { SupportedLocale } from "@/lib/seo";
import BrabusVideoBackground from "./BrabusVideoBackground";

type Props = {
  locale: string;
  resolvedLocale: SupportedLocale;
  product: ShopProduct;
  pricing: any;
  viewerContext: ShopViewerPricingContext;
  rates: { EUR: number; USD: number; UAH: number } | null;
  defaultVariant: any;
  relatedProducts: ShopProduct[];
};

export function BrabusShopProductDetailLayout({
  locale,
  resolvedLocale,
  product,
  pricing,
  viewerContext,
  rates,
  defaultVariant,
  relatedProducts,
}: Props) {
  const isUa = resolvedLocale === "ua";

  const productTitle = localizeShopProductTitle(resolvedLocale, product);
  const productCategory = localizeShopText(resolvedLocale, product.category);
  const shortDescription = localizeShopDescription(resolvedLocale, product.shortDescription);
  const longDescription = localizeShopDescription(resolvedLocale, product.longDescription);
  const leadTime = localizeShopText(resolvedLocale, product.leadTime);
  const collection = localizeShopText(resolvedLocale, product.collection);
  const isInStock = product.stock === "inStock";

  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const cleanImages = gallery
    .map((img) => img?.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean) as string[];

  // Build spec items
  const specItems: { label: string; value: string }[] = [];
  if (product.highlights.length > 0) {
    product.highlights.forEach((h) => {
      const text = localizeShopText(resolvedLocale, h);
      if (text.includes(":")) {
        const [label, ...rest] = text.split(":");
        specItems.push({ label: label.trim(), value: rest.join(":").trim() });
      } else {
        specItems.push({ label: isUa ? "Деталь" : "Detail", value: text });
      }
    });
  }
  if (product.sku)
    specItems.push({ label: isUa ? "Артикул" : "SKU", value: product.sku });
  if (collection)
    specItems.push({ label: isUa ? "Колекція" : "Collection", value: collection });
  if (leadTime)
    specItems.push({ label: isUa ? "Термін" : "Lead Time", value: leadTime });

  const [openAccordion, setOpenAccordion] = useState<string | null>("desc");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIdx((prev) => (prev + 1) % cleanImages.length);
  };
  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIdx((prev) => (prev - 1 + cleanImages.length) % cleanImages.length);
  };
  
  // Close fullscreen and navigate via keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
      if (isFullscreen) {
         if (e.key === "ArrowRight") handleNext();
         if (e.key === "ArrowLeft") handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, cleanImages.length]);

  return (
    <>
      <style jsx global>{`
        .b-pdp {
          --b-bg: transparent;
          --b-card: #0f0f0f;
          --b-red: #cc0000;
          --b-muted: rgba(255,255,255,.5);
          --b-border: rgba(255,255,255,.08);
          background: var(--b-bg);
          color: #fff;
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
          min-height: 100dvh;
          position: relative;
        }

        /* ── Grid Layout ──────────────────────── */
        .b-pdp__container {
          display: grid;
          grid-template-columns: 62% 38%;
          max-width: 1920px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }
        @media (max-width: 1024px) {
          .b-pdp__container {
            grid-template-columns: 1fr;
            display: flex; flex-direction: column;
          }
        }

        /* ── Left: Media Carousel ──────────────── */
        .b-pdp__media {
          display: flex; flex-direction: column;
          padding: 4rem clamp(2rem, 4vw, 6rem);
          background: transparent;
        }
        .b-carousel {
          position: sticky; top: 120px;
          display: flex; flex-direction: column; gap: 1.5rem;
          width: 100%;
        }
        .b-carousel__main {
          position: relative; width: 100%; aspect-ratio: 4/3;
          background: #f8f8f8; border-radius: 16px; overflow: hidden;
          box-shadow: 0 30px 60px -15px rgba(0,0,0,0.8);
          border: 1px solid rgba(255,255,255,.1); cursor: zoom-in;
        }
        .b-carousel__main img {
          object-fit: contain; width: 100%; height: 100%; padding: 2.5rem;
          mix-blend-mode: multiply; transition: transform .5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .b-carousel__main:hover img { transform: scale(1.03); }
        
        .b-carousel__arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 48px; height: 48px; border-radius: 50%;
          background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05);
          color: #000; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .3s; opacity: 0; z-index: 10;
        }
        .b-carousel__main:hover .b-carousel__arrow { opacity: 1; }
        .b-carousel__arrow:hover { background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15); scale: 1.1; }
        .b-carousel__arrow--prev { left: 1.5rem; }
        .b-carousel__arrow--next { right: 1.5rem; }
        
        .b-carousel__expand {
          position: absolute; top: 1.5rem; right: 1.5rem;
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(0,0,0,0.04); color: #000;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none; opacity: 0; transition: opacity .3s, background .3s;
        }
        .b-carousel__main:hover .b-carousel__expand { opacity: 1; }
        
        .b-carousel__thumbs {
          display: flex; gap: 1rem; overflow-x: auto; padding-bottom: .5rem;
        }
        .b-carousel__thumbs::-webkit-scrollbar { height: 4px; }
        .b-carousel__thumbs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        
        .b-carousel__thumb {
          position: relative; width: 100px; height: 75px; flex-shrink: 0;
          background: #f8f8f8; border-radius: 8px; overflow: hidden; cursor: pointer;
          border: 2px solid transparent; transition: border-color .3s, opacity .3s;
          opacity: 0.5;
        }
        .b-carousel__thumb img {
          object-fit: contain; width: 100%; height: 100%; padding: .5rem;
          mix-blend-mode: multiply;
        }
        .b-carousel__thumb:hover { opacity: 0.8; }
        .b-carousel__thumb.is-active { border-color: var(--b-red); opacity: 1; }
        
        @media (max-width: 1024px) {
          .b-pdp__media { padding: 2rem 1.5rem; }
          .b-carousel { position: static; }
        }

        /* ── Fullscreen Overlay ─────────────── */
        .b-fs {
          position: fixed; inset: 0; z-index: 99999;
          background: rgba(5,5,5,0.95); backdrop-filter: blur(20px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0; pointer-events: none; transition: opacity .4s ease;
        }
        .b-fs.is-open { opacity: 1; pointer-events: auto; }
        
        .b-fs__header {
          position: absolute; top: 0; left: 0; right: 0;
          padding: 2rem; display: flex; justify-content: flex-end; z-index: 100000;
          pointer-events: none;
        }
        .b-fs__close {
          width: 50px; height: 50px; border-radius: 50%;
          background: rgba(255,255,255,0.1); color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .3s; border: none;
          pointer-events: auto; z-index: 100001;
        }
        .b-fs__close:hover { background: var(--b-red); }
        
        .b-fs__stage {
          position: relative; width: 90vw; height: 85vh;
          background: #f8f8f8; border-radius: 20px; box-shadow: 0 40px 100px rgba(0,0,0,0.9);
          overflow: hidden; display: flex; align-items: center; justify-content: center;
        }
        .b-fs__stage img {
          object-fit: contain; width: 100%; height: 100%; padding: 4rem;
          mix-blend-mode: multiply;
        }
        .b-fs__arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 60px; height: 60px; border-radius: 50%;
          background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); color: #000;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .3s; z-index: 10;
        }
        .b-fs__arrow:hover { background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.2); scale: 1.1; }
        .b-fs__arrow--prev { left: 2rem; }
        .b-fs__arrow--next { right: 2rem; }

        /* ── Right: Sticky Info Panel ─────────── */
        .b-pdp__info {
          padding: 4rem 3rem 8rem 4rem;
          background: rgba(5,5,5,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255,255,255,.04);
        }
        .b-pdp__info-inner {
          position: sticky; top: 120px; /* header offset */
          max-width: 580px;
        }
        @media (max-width: 1200px) {
          .b-pdp__info { padding: 3rem; }
        }
        @media (max-width: 1024px) {
          .b-pdp__info { padding: 3rem 1.5rem; }
          .b-pdp__info-inner { position: static; max-width: 100%; }
        }

        /* Breadcrumbs */
        .b-bc {
          font-size: .6rem; text-transform: uppercase; letter-spacing: .25em;
          color: var(--b-muted); margin-bottom: 2rem;
          display: flex; align-items: center; flex-wrap: wrap; gap: .75rem;
        }
        .b-bc a { color: var(--b-muted); text-decoration: none; transition: color .3s; }
        .b-bc a:hover { color: #fff; }
        .b-bc span { color: var(--b-border); }

        /* Titles */
        .b-brand {
          font-size: .65rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: .25em; color: var(--b-red); margin-bottom: 1rem;
        }
        .b-title {
          font-size: clamp(1.4rem, 2vw, 1.8rem); font-weight: 300;
          text-transform: uppercase; letter-spacing: .08em;
          line-height: 1.2; margin: 0 0 1.25rem; color: #fff;
        }

        /* Mini specs inline */
        .b-mini-specs {
          display: flex; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 2.5rem;
          padding-bottom: 2.5rem; border-bottom: 1px solid var(--b-border);
        }
        .b-ms-item { display: flex; flex-direction: column; gap: .4rem; }
        .b-ms-label { font-size: .55rem; text-transform: uppercase; letter-spacing: .2em; color: var(--b-muted); }
        .b-ms-val { font-size: .75rem; color: #fff; font-weight: 400; text-transform: uppercase; letter-spacing: .1em; }
        .b-ms-val--ok { color: #4ade80; }
        .b-ms-val--wait { color: #fbbf24; }

        /* Price */
        .b-price-box { margin-bottom: 2.5rem; }

        /* Boxed CTA */
        .b-action {
          display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 3.5rem;
        }
        .b-btn-custom {
          width: 100%; background: var(--b-red) !important; color: #fff !important;
          border: 1px solid var(--b-red) !important;
          padding: 1.25rem !important; text-align: center;
          font-size: .75rem !important; font-weight: 600 !important;
          text-transform: uppercase !important; letter-spacing: .25em !important;
          transition: all .3s; cursor: pointer; border-radius: 0;
        }
        .b-btn-custom:hover { background: #ff1a1a !important; border-color: #ff1a1a !important; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(204,0,0,0.3); }
        
        .b-action-links {
          display: flex; justify-content: space-between;
          font-size: .6rem; text-transform: uppercase; letter-spacing: .18em;
        }
        .b-action-links a { color: var(--b-muted); transition: color .3s; text-decoration: none; border-bottom: 1px solid transparent; padding-bottom: 2px; }
        .b-action-links a:hover { color: #fff; border-bottom-color: var(--b-red); }

        /* Accordions */
        .b-accordion {
          border-top: 1px solid var(--b-border);
        }
        .b-acc-item {
          border-bottom: 1px solid var(--b-border);
        }
        .b-acc-btn {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 1.75rem 0; background: transparent; border: none; color: #fff;
          font-size: .7rem; text-transform: uppercase; letter-spacing: .2em; font-weight: 500;
          cursor: pointer; text-align: left; transition: color .3s;
        }
        .b-acc-btn:hover { color: var(--b-red); }
        .b-acc-icon {
          width: 16px; height: 16px; position: relative;
        }
        .b-acc-icon::before, .b-acc-icon::after {
          content: ""; position: absolute; background: currentColor; top: 50%; left: 50%;
          transform: translate(-50%, -50%); transition: transform .4s ease;
        }
        .b-acc-icon::before { width: 12px; height: 1px; }
        .b-acc-icon::after { width: 1px; height: 12px; }
        .b-acc-item.is-open .b-acc-icon::after { transform: translate(-50%, -50%) rotate(90deg); opacity: 0; }

        .b-acc-content {
          overflow: hidden; max-height: 0; transition: max-height .5s cubic-bezier(0, 1, 0, 1);
        }
        .b-acc-item.is-open .b-acc-content { max-height: 2000px; transition: max-height 1s ease-in-out; }
        
        .b-acc-inner { 
          padding: 0 0 2rem 0; font-size: .88rem; color: var(--b-muted); 
          line-height: 1.8; font-weight: 300; 
        }
        .b-acc-inner p { margin: 0 0 1rem; }
        .b-acc-inner p:last-child { margin: 0; }

        .b-spec-table { width: 100%; border-collapse: collapse; }
        .b-spec-table td { padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,.04); }
        .b-spec-table td:first-child { width: 45%; color: rgba(255,255,255,.4); font-size: .65rem; text-transform: uppercase; letter-spacing: .15em; }
        .b-spec-table td:last-child { color: #fff; font-size: .8rem; }
        .b-spec-table tr:last-child td { border-bottom: none; }

        /* Related Products (Bottom Full Width) */
        .b-related {
          position: relative;
          z-index: 10;
          padding: 6rem clamp(2rem, 5vw, 6rem);
          background: rgba(5,5,5,0.9);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--b-border);
        }
        .b-related-title {
          font-size: 1.25rem; font-weight: 200; text-transform: uppercase; letter-spacing: .2em;
          margin: 0 0 3.5rem; text-align: center; color: #fff;
        }
        .b-rg {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1px;
          background: var(--b-border); border: 1px solid var(--b-border); border-radius: 8px; overflow: hidden;
        }
        .b-rc { background: #080808; text-decoration: none; display: flex; flex-direction: column; transition: background .3s; }
        .b-rc:hover { background: #0f0f0f; }
        .b-rc-img { aspect-ratio: 4/3; position: relative; padding: 2.5rem; background: #f8f8f8; }
        .b-rc-img img { object-fit: contain; width: 100%; height: 100%; mix-blend-mode: multiply; transition: transform .6s cubic-bezier(0.4, 0, 0.2, 1); }
        .b-rc:hover .b-rc-img img { transform: scale(1.08); }
        .b-rc-body { padding: 2rem; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .b-rc-name { font-size: .85rem; font-weight: 300; color: #fff; margin: 0 0 1rem; line-height: 1.4; }
        .b-rc-link { font-size: .6rem; text-transform: uppercase; letter-spacing: .2em; color: var(--b-red); font-weight: 600; }
      `}</style>

      <div className="b-pdp">
        {/* Background Video */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <BrabusVideoBackground 
            videoSrc="/videos/shop/brabus/brabus-hero-new.mp4"
            fallbackImage="/images/shop/brabus/hq/brabus-supercars-26.jpg" 
          />
          {/* Blend Masking / Blur */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/80 to-transparent backdrop-blur-[6px]" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[12px]" />
        </div>

        <div className="b-pdp__container">
          
          {/* L: MEDIA GALLERY (CAROUSEL) */}
          <div className="b-pdp__media">
            {cleanImages.length > 0 && (
              <div className="b-carousel">
                {/* Main Active Image */}
                <div className="b-carousel__main group" onClick={() => setIsFullscreen(true)}>
                  <Image
                    src={cleanImages[currentIdx]}
                    alt={`${productTitle} - ${currentIdx + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    priority
                  />
                  {cleanImages.length > 1 && (
                    <>
                      <button className="b-carousel__arrow b-carousel__arrow--prev" onClick={handlePrev}>
                        <ChevronLeft size={24} />
                      </button>
                      <button className="b-carousel__arrow b-carousel__arrow--next" onClick={handleNext}>
                        <ChevronRight size={24} />
                      </button>
                    </>
                  )}
                  <div className="b-carousel__expand opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 size={20} />
                  </div>
                </div>

                {/* Thumbnails */}
                {cleanImages.length > 1 && (
                  <div className="b-carousel__thumbs">
                    {cleanImages.map((img, i) => (
                      <button 
                        key={i} 
                        className={`b-carousel__thumb ${i === currentIdx ? 'is-active' : ''}`}
                        onClick={() => setCurrentIdx(i)}
                        aria-label={`View image ${i + 1}`}
                      >
                        <Image src={img} alt="" fill sizes="120px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* R: STICKY INFO PANEL */}
          <div className="b-pdp__info">
            <div className="b-pdp__info-inner">

              {/* Breadcrumbs */}
              <div className="b-bc">
                <Link href={`/${resolvedLocale}/shop`}>{isUa ? "Головна" : "Home"}</Link>
                <span>/</span>
                <Link href={`/${resolvedLocale}/shop/brabus`}>Brabus</Link>
                <span>/</span>
                <Link href={`/${resolvedLocale}/shop/brabus/products`}>{isUa ? "Каталог" : "Catalog"}</Link>
                <span>/</span>
                <span style={{ color: "var(--b-muted)" }}>{product.sku || "Product"}</span>
              </div>

              {/* Title Block */}
              <div className="b-brand">{product.brand}</div>
              <h1 className="b-title">{productTitle}</h1>

              {/* Mini Specs */}
              <div className="b-mini-specs">
                {product.sku && (
                  <div className="b-ms-item">
                    <span className="b-ms-label">{isUa ? "Артикул" : "SKU"}</span>
                    <span className="b-ms-val">{product.sku}</span>
                  </div>
                )}
                <div className="b-ms-item">
                  <span className="b-ms-label">{isUa ? "Статус" : "Status"}</span>
                  <span className={`b-ms-val ${isInStock ? "b-ms-val--ok" : "b-ms-val--wait"}`}>
                    {isInStock ? (isUa ? "В наявності" : "In Stock") : (isUa ? "Під замовлення" : "Pre-order")}
                  </span>
                </div>
                {collection && (
                  <div className="b-ms-item">
                    <span className="b-ms-label">{isUa ? "Серія" : "Collection"}</span>
                    <span className="b-ms-val">{collection}</span>
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="b-price-box">
                <ShopPrimaryPriceBox
                  locale={resolvedLocale}
                  isUa={isUa}
                  price={pricing.effectivePrice}
                />
              </div>

              {/* Action (Add to Cart) */}
              <div className="b-action">
                <div style={{ padding: "2px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <AddToCartButton
                    slug={product.slug}
                    locale={resolvedLocale}
                    variantId={defaultVariant?.id ?? null}
                    productName={productTitle}
                    className="b-btn-custom"
                    label={isUa ? "Додати в кошик" : "Add to Cart"}
                  />
                </div>
                <div className="b-action-links">
                  <Link href={`/${resolvedLocale}/contact`}>
                    {isUa ? "Перевірити сумісність" : "Check Compatibility"}
                  </Link>
                  <Link href={`/${resolvedLocale}/contact`}>
                    {isUa ? "Запит на встановлення" : "Installation Request"}
                  </Link>
                </div>
              </div>

              {/* Accordions */}
              <div className="b-accordion">
                {(longDescription || shortDescription) && (
                  <div className={`b-acc-item ${openAccordion === "desc" ? "is-open" : ""}`}>
                    <button className="b-acc-btn" onClick={() => toggleAccordion("desc")}>
                      {isUa ? "Опис" : "Description"}
                      <div className="b-acc-icon" />
                    </button>
                    <div className="b-acc-content">
                      <div 
                        className="b-acc-inner prospect-article" 
                        dangerouslySetInnerHTML={{ __html: longDescription || shortDescription || "" }} 
                      />
                    </div>
                  </div>
                )}

                {specItems.length > 0 && (
                  <div className={`b-acc-item ${openAccordion === "specs" ? "is-open" : ""}`}>
                    <button className="b-acc-btn" onClick={() => toggleAccordion("specs")}>
                      {isUa ? "Характеристики" : "Specifications"}
                      <div className="b-acc-icon" />
                    </button>
                    <div className="b-acc-content">
                      <div className="b-acc-inner">
                        <table className="b-spec-table">
                          <tbody>
                            {specItems.map((spec, idx) => (
                              <tr key={idx}>
                                <td>{spec.label}</td>
                                <td>{spec.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className={`b-acc-item ${openAccordion === "delivery" ? "is-open" : ""}`}>
                  <button className="b-acc-btn" onClick={() => toggleAccordion("delivery")}>
                    {isUa ? "Доставка і Повернення" : "Shipping & Returns"}
                    <div className="b-acc-icon" />
                  </button>
                  <div className="b-acc-content">
                    <div className="b-acc-inner">
                      <p>
                        {isUa 
                          ? "Доставка по всьому світу. Регулярні відправлення з нашого центрального складу або напряму від виробника."
                          : "Worldwide shipping available. Regular dispatches from our central warehouse or directly from the manufacturer."}
                      </p>
                      <p>
                        {isUa 
                          ? "Час виготовлення та доставки залежить від обраного артикулу та вказаний у статусі 'Термін'. Товари, що виготовляються під індивідуальне шасі (Custom VIN), поверненню не підлягають."
                          : "Lead time depends on the specific SKU and is indicated in the item status. Made-to-order items built for specific VINS are strictly non-refundable."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Related Products ────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="b-related">
            <h2 className="b-related-title">{isUa ? "Рекомендовані Доповнення" : "Recommended Combinations"}</h2>
            <div className="b-rg">
              {relatedProducts.map((rp) => (
                <Link key={rp.slug} href={`/${resolvedLocale}/shop/brabus/products/${rp.slug}`} className="b-rc">
                  <div className="b-rc-img">
                    <Image
                      src={rp.image?.replace(/^["']|["']$/g, "").trim() || ""}
                      alt={localizeShopProductTitle(resolvedLocale, rp)}
                      fill
                    />
                  </div>
                  <div className="b-rc-body">
                    <h3 className="b-rc-name">{localizeShopProductTitle(resolvedLocale, rp)}</h3>
                    <span className="b-rc-link">{isUa ? "Переглянути" : "Discover"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FULLSCREEN LIGHTBOX PORTAL */}
      <div className={`b-fs ${isFullscreen ? 'is-open' : ''}`} onClick={() => setIsFullscreen(false)}>
        <div className="b-fs__header">
          <button className="b-fs__close" onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}>
            <X size={24} />
          </button>
        </div>
        
        {isFullscreen && cleanImages.length > 0 && (
          <div className="b-fs__stage" onClick={(e) => e.stopPropagation()}>
            <Image
              src={cleanImages[currentIdx]}
              alt={`${productTitle} Fullscreen`}
              fill
              sizes="100vw"
              priority
            />
            {cleanImages.length > 1 && (
              <>
                <button className="b-fs__arrow b-fs__arrow--prev" onClick={(e) => { e.stopPropagation(); handlePrev(e); }}>
                  <ChevronLeft size={32} />
                </button>
                <button className="b-fs__arrow b-fs__arrow--next" onClick={(e) => { e.stopPropagation(); handleNext(e); }}>
                  <ChevronRight size={32} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
