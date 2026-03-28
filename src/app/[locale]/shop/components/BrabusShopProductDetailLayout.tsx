"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const activeImage = cleanImages[activeImageIdx] || "";

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

  return (
    <>
      <style jsx global>{`
        .bpd {
          --bpd-bg: #0a0a0a;
          --bpd-card: #111;
          --bpd-red: #cc0000;
          --bpd-muted: rgba(255,255,255,.4);
          --bpd-faint: rgba(255,255,255,.06);
          background: var(--bpd-bg);
          color: #fff;
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
        }

        /* ── Hero Split ─────────────────────── */
        .bpd-hero {
          display: flex; min-height: 80vh;
        }
        @media (max-width: 1024px) {
          .bpd-hero { flex-direction: column; }
        }

        /* Left Info Panel */
        .bpd-info {
          width: 45%; padding: clamp(2rem, 5vw, 5rem);
          display: flex; flex-direction: column; justify-content: center;
          background: var(--bpd-bg);
        }
        @media (max-width: 1024px) {
          .bpd-info { width: 100%; order: 2; padding: 2rem 1.5rem; }
        }
        .bpd-info__back {
          font-size: .6rem; text-transform: uppercase; letter-spacing: .2em;
          color: var(--bpd-muted); text-decoration: none;
          transition: color .3s; margin-bottom: 3rem;
          display: inline-block;
        }
        .bpd-info__back:hover { color: #fff; }
        .bpd-info__category {
          font-size: .6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; color: var(--bpd-red);
          margin-bottom: .75rem;
        }
        .bpd-info__title {
          font-size: clamp(1.5rem, 3vw, 2.4rem);
          font-weight: 200; text-transform: uppercase;
          letter-spacing: .06em; line-height: 1.15;
          margin: 0 0 .5rem;
        }
        .bpd-info__collection {
          font-size: .7rem; text-transform: uppercase; letter-spacing: .15em;
          color: var(--bpd-muted); margin: 0 0 2rem;
        }

        /* Price */
        .bpd-price { margin-bottom: 2rem; }

        /* Meta — brand / avail */
        .bpd-meta { margin-bottom: 2rem; }
        .bpd-meta__row {
          display: flex; align-items: center; gap: 1rem;
          padding: .75rem 0;
          border-bottom: 1px solid var(--bpd-faint);
        }
        .bpd-meta__label {
          font-size: .6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .15em; color: var(--bpd-muted);
          min-width: 90px;
        }
        .bpd-meta__val {
          font-size: .8rem; font-weight: 400;
        }
        .bpd-meta__val--stock { color: #4ade80; }
        .bpd-meta__val--order { color: #fbbf24; }

        /* CTA */
        .bpd-cta {
          width: 100%; max-width: 380px;
          border: 1px solid var(--bpd-red) !important;
          background: transparent !important; color: #fff !important;
          padding: 1rem 2rem !important;
          font-size: .7rem !important; font-weight: 500 !important;
          text-transform: uppercase !important; letter-spacing: .2em !important;
          transition: background .3s, color .3s !important;
          cursor: pointer;
        }
        .bpd-cta:hover {
          background: var(--bpd-red) !important;
        }

        /* Links under CTA */
        .bpd-links {
          display: flex; gap: 2rem; margin-top: 1.5rem;
        }
        .bpd-links a {
          font-size: .6rem; text-transform: uppercase; letter-spacing: .1em;
          color: var(--bpd-muted); text-decoration: underline;
          text-underline-offset: 3px; transition: color .3s;
        }
        .bpd-links a:hover { color: #fff; }

        /* Right Gallery Panel */
        .bpd-gallery {
          width: 55%; position: relative;
          background: var(--bpd-card);
          display: flex; align-items: center; justify-content: center;
          padding: 3rem;
        }
        @media (max-width: 1024px) {
          .bpd-gallery { width: 100%; order: 1; aspect-ratio: 4/3; padding: 2rem; }
        }
        .bpd-gallery__main {
          position: relative; width: 100%; max-width: 600px; aspect-ratio: 1;
        }
        .bpd-gallery__main img {
          object-fit: contain;
        }

        /* Thumbnail strip */
        .bpd-thumbs {
          position: absolute; right: 2rem; top: 50%;
          transform: translateY(-50%);
          display: flex; flex-direction: column; gap: .5rem;
        }
        @media (max-width: 1024px) {
          .bpd-thumbs {
            position: relative; right: auto; top: auto; transform: none;
            flex-direction: row; justify-content: center;
            margin-top: 1rem;
          }
        }
        .bpd-thumb {
          width: 48px; height: 48px; border-radius: 6px;
          overflow: hidden; cursor: pointer;
          border: 2px solid transparent;
          opacity: .5; transition: all .3s;
        }
        .bpd-thumb--active {
          border-color: var(--bpd-red); opacity: 1;
        }
        .bpd-thumb:hover { opacity: .8; }
        .bpd-thumb img {
          object-fit: cover;
        }

        /* ── Specs Section ──────────────────── */
        .bpd-specs {
          border-top: 1px solid var(--bpd-faint);
          background: var(--bpd-bg);
          padding: 4rem clamp(2rem, 6vw, 8rem);
        }
        .bpd-specs__label {
          font-size: .6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; color: var(--bpd-red);
          margin-bottom: 2rem;
        }
        .bpd-specs__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0;
        }
        .bpd-specs__item {
          padding: 1.25rem 0;
          border-bottom: 1px solid var(--bpd-faint);
        }
        .bpd-specs__item-label {
          font-size: .55rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .15em; color: var(--bpd-muted);
          margin-bottom: .35rem;
        }
        .bpd-specs__item-val {
          font-size: .85rem; font-weight: 300; color: #fff;
        }

        /* ── Description Section ────────────── */
        .bpd-desc {
          border-top: 1px solid var(--bpd-faint);
          background: var(--bpd-bg);
          padding: 4rem clamp(2rem, 6vw, 8rem);
        }
        .bpd-desc__label {
          font-size: .6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; color: var(--bpd-red);
          margin-bottom: 1.5rem;
        }
        .bpd-desc__body {
          font-size: .85rem; font-weight: 300; color: rgba(255,255,255,.7);
          line-height: 1.8; max-width: 640px;
          padding-left: clamp(0rem, 5vw, 4rem);
        }
        .bpd-desc__body p { margin: 0 0 1rem; }

        /* ── Related ────────────────────────── */
        .bpd-related {
          border-top: 1px solid var(--bpd-faint);
          background: var(--bpd-bg);
          padding: 4rem clamp(2rem, 6vw, 8rem);
        }
        .bpd-related__label {
          font-size: .6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: .2em; color: var(--bpd-muted);
          margin-bottom: 2.5rem;
        }
        .bpd-related__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.5rem;
        }
        .bpd-rcard {
          background: var(--bpd-card); border-radius: 10px;
          overflow: hidden; text-decoration: none; color: #fff;
          transition: background .3s;
        }
        .bpd-rcard:hover { background: #161616; }
        .bpd-rcard__media {
          position: relative; aspect-ratio: 4/3; background: #0e0e0e;
        }
        .bpd-rcard__media img {
          object-fit: contain; padding: 1.5rem;
          transition: transform .5s;
        }
        .bpd-rcard:hover .bpd-rcard__media img { transform: scale(1.06); }
        .bpd-rcard__body { padding: 1rem 1.25rem 1.25rem; }
        .bpd-rcard__title {
          font-size: .8rem; font-weight: 400; margin: 0 0 .4rem;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .bpd-rcard__link {
          font-size: .6rem; text-transform: uppercase; letter-spacing: .15em;
          color: var(--bpd-muted); transition: color .3s;
        }
        .bpd-rcard:hover .bpd-rcard__link { color: var(--bpd-red); }
      `}</style>

      <div className="bpd">
        {/* ── Hero Split: Info left, Gallery right ── */}
        <div className="bpd-hero">
          {/* LEFT — Info */}
          <div className="bpd-info">
            <Link href={`/${resolvedLocale}/shop/brabus`} className="bpd-info__back">
              ← {isUa ? "До каталогу" : "Back to Catalog"}
            </Link>

            <p className="bpd-info__category">{productCategory}</p>

            <h1 className="bpd-info__title">{productTitle}</h1>

            <p className="bpd-info__collection">
              {collection || product.brand}
            </p>

            <div className="bpd-price">
              <ShopPrimaryPriceBox
                locale={resolvedLocale}
                isUa={isUa}
                price={pricing.effectivePrice}
              />
            </div>

            <div className="bpd-meta">
              <div className="bpd-meta__row">
                <span className="bpd-meta__label">{isUa ? "Бренд" : "Brand"}</span>
                <span className="bpd-meta__val">{product.brand}</span>
              </div>
              <div className="bpd-meta__row">
                <span className="bpd-meta__label">{isUa ? "Наявність" : "Availability"}</span>
                <span className={`bpd-meta__val ${isInStock ? "bpd-meta__val--stock" : "bpd-meta__val--order"}`}>
                  {isInStock ? (isUa ? "В наявності" : "In Stock") : (isUa ? "Під замовлення" : "Pre-order")}
                </span>
              </div>
            </div>

            <AddToCartButton
              slug={product.slug}
              locale={resolvedLocale}
              variantId={defaultVariant?.id ?? null}
              productName={productTitle}
              className="bpd-cta"
              label={isUa ? "Додати в кошик" : "Add to Cart"}
            />

            <div className="bpd-links">
              <Link href={`/${resolvedLocale}/#contact`}>
                {isUa ? "Перевірити сумісність" : "Check Compatibility"}
              </Link>
              <Link href={`/${resolvedLocale}/#contact`}>
                {isUa ? "Запит на встановлення" : "Request Installation"}
              </Link>
            </div>
          </div>

          {/* RIGHT — Gallery */}
          <div className="bpd-gallery">
            {activeImage && (
              <div className="bpd-gallery__main">
                <Image
                  src={activeImage}
                  alt={productTitle}
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="bpd-gallery__main-img"
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
            )}

            {cleanImages.length > 1 && (
              <div className="bpd-thumbs">
                {cleanImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`bpd-thumb ${idx === activeImageIdx ? "bpd-thumb--active" : ""}`}
                  >
                    <Image src={img} alt="" width={48} height={48} style={{ objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Specs ── */}
        {specItems.length > 0 && (
          <div className="bpd-specs">
            <p className="bpd-specs__label">
              {isUa ? "Характеристики" : "Specifications"}
            </p>
            <div className="bpd-specs__grid">
              {specItems.map((spec, idx) => (
                <div key={idx} className="bpd-specs__item">
                  <p className="bpd-specs__item-label">{spec.label}</p>
                  <p className="bpd-specs__item-val">{spec.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Description ── */}
        {(longDescription || shortDescription) && (
          <div className="bpd-desc">
            <p className="bpd-desc__label">{isUa ? "Опис" : "Description"}</p>
            <div
              className="bpd-desc__body"
              dangerouslySetInnerHTML={{ __html: longDescription || shortDescription || "" }}
            />
          </div>
        )}

        {/* ── Related ── */}
        {relatedProducts.length > 0 && (
          <div className="bpd-related">
            <p className="bpd-related__label">
              {isUa ? "Схожі товари" : "Related Products"}
            </p>
            <div className="bpd-related__grid">
              {relatedProducts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/${resolvedLocale}/shop/brabus/products/${rp.slug}`}
                  className="bpd-rcard"
                >
                  <div className="bpd-rcard__media">
                    <Image
                      src={rp.image?.replace(/^["']|["']$/g, "").trim() || ""}
                      alt={localizeShopProductTitle(resolvedLocale, rp)}
                      fill
                    />
                  </div>
                  <div className="bpd-rcard__body">
                    <h3 className="bpd-rcard__title">
                      {localizeShopProductTitle(resolvedLocale, rp)}
                    </h3>
                    <span className="bpd-rcard__link">
                      {isUa ? "Переглянути" : "View Details"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
