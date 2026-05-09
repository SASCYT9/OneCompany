"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";
import {
  localizeShopDescription,
  localizeShopProductTitle,
  localizeShopText,
} from "@/lib/shopText";
import { sanitizeRichTextHtml } from "@/lib/sanitizeRichTextHtml";
import type { ShopProduct, ShopProductVariantSummary } from "@/lib/shopCatalog";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopResolvedPricing } from "@/lib/shopPricingAudience";

type Props = {
  locale: string;
  resolvedLocale: SupportedLocale;
  product: ShopProduct;
  pricing?: ShopResolvedPricing;
};

// Render-time UA-copy normalizer. Mirrors the import-side `sanitizeIpeUaCopy`
// in scripts/import-ipe-catalog.ts so already-imported products with stale
// translations still display the correct terminology without a reimport.
// JS \b only fires at ASCII word boundaries — Cyrillic letters are non-word
// to the engine, so \bП... never matches. Use Unicode-aware lookarounds
// against a Cyrillic letter class instead.
const CYR = "А-Яа-яІіЇїЄєҐґ";
const beforeCyr = `(?<![${CYR}])`;
const afterCyr = `(?![${CYR}])`;

function normalizeIpeUaCopy(value: string): string {
  if (!value) return value;
  let out = value;
  out = out.replace(
    new RegExp(`${beforeCyr}Передн(?:ій|ьому|ього)\\s+патрубо(?:к|ка|ку|ком|ці)${afterCyr}`, "gu"),
    "Передні труби"
  );
  out = out.replace(
    new RegExp(`${beforeCyr}Середн(?:ій|ьому|ього)\\s+патрубо(?:к|ка|ку|ком|ці)${afterCyr}`, "gu"),
    "Середні труби"
  );
  const tipMap = (lower: boolean) => (suffix: string) => {
    const upper: Record<string, string> = {
      "": "Насадка",
      "и": "Насадки",
      "а": "Насадка",
      "ів": "Насадок",
      "ам": "Насадкам",
      "ами": "Насадками",
      "ах": "Насадках",
    };
    const lowerMap: Record<string, string> = {
      "": "насадка",
      "и": "насадки",
      "а": "насадка",
      "ів": "насадок",
      "ам": "насадкам",
      "ами": "насадками",
      "ах": "насадках",
    };
    return (lower ? lowerMap : upper)[suffix ?? ""] ?? (lower ? "насадки" : "Насадки");
  };
  out = out.replace(
    new RegExp(`${beforeCyr}Наконечник(и|а|ів|ам|ами|ах)?${afterCyr}`, "gu"),
    (_m, suffix) => tipMap(false)(suffix ?? "")
  );
  out = out.replace(
    new RegExp(`${beforeCyr}наконечник(и|а|ів|ам|ами|ах)?${afterCyr}`, "gu"),
    (_m, suffix) => tipMap(true)(suffix ?? "")
  );
  out = out.replace(
    new RegExp(`${beforeCyr}керування\\s+клапаном${afterCyr}`, "giu"),
    "керування клапанами"
  );
  out = out.replace(
    new RegExp(`${beforeCyr}керуванням\\s+клапаном${afterCyr}`, "giu"),
    "керуванням клапанами"
  );
  out = out.replace(/клапанам[ИI]\b/g, "клапанами");
  return out;
}

// iPE's official Shopify body_html embeds promotional banners pointing at
// OTHER iPE products (e.g. an `<a href="ipeofficial.com/products/mfr-02-
// magnesium-wheels">` wrapping a "Forged Magnesium Wheels" image at the
// bottom of every exhaust description). Those don't belong on our PDP — they
// either dead-end (the wheels aren't in our catalog) or push the buyer off to
// iPE's own site mid-purchase. Strip them server-side before sanitization.
function stripIpeCrossPromoLinks(html: string): string {
  if (!html) return html;
  // <a href="...ipeofficial.com/products/..."> ...wrapped content... </a>
  // Some banners are bare <img> tags with the same alt-text style; remove
  // those too when their alt mentions a different iPE product line.
  let out = html.replace(
    /<a[^>]*href=(?:"|')[^"']*ipeofficial\.com\/products\/[^"']*(?:"|')[^>]*>[\s\S]*?<\/a>/gi,
    ''
  );
  out = out.replace(
    /<img[^>]*alt=(?:"|')[^"']*(?:click the button to enter the link|click here to enter the link|magnesium wheels|forged magnesium|other (?:iPE )?products?)[^"']*(?:"|')[^>]*\/?>/gi,
    ''
  );
  // Strip empty anchors and empty/redundant span wrappers that iPE's bodyHtml
  // collects from Word-style paste — they don't render anything but litter the
  // DOM (e.g. Ferrari 296 GTB had 18 stray `<a></a>` tags).
  let prev: string;
  do {
    prev = out;
    out = out
      .replace(/<a[^>]*>\s*<\/a>/gi, '')
      .replace(/<span[^>]*>\s*<\/span>/gi, '');
  } while (out !== prev);
  return out;
}

// Pull the OPF warning ("ПОПЕРЕДЖЕННЯ - Перед покупкою..." / "WARNING - Prior
// to purchase...") out of the body so the layout can render it as a styled
// callout instead of letting it sit inline as a buried <strong>.
function extractOpfWarning(html: string, isUa: boolean): { body: string; warning: string | null } {
  if (!html) return { body: html, warning: null };
  const tagged = /<aside[^>]*data-warning=["']opf["'][^>]*>([\s\S]*?)<\/aside>/i;
  const taggedMatch = html.match(tagged);
  if (taggedMatch) {
    const inner = taggedMatch[1].replace(/<\/?strong>/gi, "").trim();
    return { body: html.replace(tagged, ""), warning: inner };
  }
  const inline = isUa
    ? /(?:<strong>)?\s*ПОПЕРЕДЖЕННЯ\s*[-–—]\s*Перед\s+покупкою[^<\n]*?Дякуємо\.\s*(?:<\/strong>)?/i
    : /(?:<strong>)?\s*WARNING\s*[-–—]\s*Prior\s+to\s+purchase[^<\n]*?Thank\s+you\.\s*(?:<\/strong>)?/i;
  const inlineMatch = html.match(inline);
  if (inlineMatch) {
    const inner = inlineMatch[0].replace(/<\/?strong>/gi, "").trim();
    return { body: html.replace(inline, ""), warning: inner };
  }
  return { body: html, warning: null };
}

type VariantOption = {
  name: string;
  values: string[];
  index: 0 | 1 | 2;
  commonSuffix?: string;
};

// If every value on an axis ends with the same parenthetical suffix (e.g. all
// downpipe options say "(OPF)"), strip it from the buttons and surface it once
// on the axis label. Removes redundant noise without losing information.
function liftCommonAxisSuffix(values: string[]): { stripped: string[]; suffix: string } {
  if (values.length < 2) return { stripped: values, suffix: "" };
  const m = values[0].match(/\s*\(([^()]+)\)\s*$/);
  if (!m) return { stripped: values, suffix: "" };
  const fullSuffix = m[0];
  if (!values.every((v) => v.endsWith(fullSuffix))) {
    return { stripped: values, suffix: "" };
  }
  return {
    stripped: values.map((v) => v.slice(0, v.length - fullSuffix.length).trim()),
    suffix: m[1].trim(),
  };
}

function buildOptionAxes(variants: ShopProductVariantSummary[]): VariantOption[] {
  const axes: VariantOption[] = [];
  for (let i = 0; i < 3; i += 1) {
    const values = Array.from(
      new Set(
        variants
          .map((v) => v.optionValues?.[i])
          .filter((value): value is string => Boolean(value))
      )
    );
    if (values.length > 1) {
      const axisIndex = i as 0 | 1 | 2;
      const sample = variants.find((v) => v.optionValues?.[i])?.optionValues?.[i] ?? "";
      const { suffix } = liftCommonAxisSuffix(values);
      axes.push({
        name: inferAxisName(sample, axisIndex),
        values,
        index: axisIndex,
        commonSuffix: suffix || undefined,
      });
    }
  }
  return axes;
}

function inferAxisName(sample: string, index: number): string {
  const s = sample.toLowerCase();
  if (/\bcat\s*back\b|\bcatback\b|\bfull\s*system\b/.test(s)) return "Exhaust System";
  if (/\bfront\s*pipe\b|\bequal[- ]length\b|\bfactory\b/.test(s)) return "Front Pipe Design";
  if (/\bdownpipe\b|\bcatted\b|\bcatless\b/.test(s)) return "Downpipe";
  if (/\btitanium\b|\bstainless\b/.test(s)) return "Material";
  return ["Configuration", "Design", "Option"][index] ?? "Option";
}

function localizeAxisName(name: string, isUa: boolean): string {
  if (!isUa) return name;
  const map: Record<string, string> = {
    "Exhaust System": "Тип системи",
    "Front Pipe Design": "Передні труби",
    "Downpipe": "Даунпайп",
    "Material": "Матеріал",
    "Design": "Дизайн",
    "Configuration": "Конфігурація",
    "Option": "Опція",
  };
  return map[name] ?? name;
}

function localizeOptionValue(value: string, isUa: boolean): string {
  if (!isUa) return value;
  let out = value;
  // System families. Header Back System перекладаємо до Cat-back, бо
  // українські тюнери використовують саме "cat-back" для "від колектора".
  out = out.replace(/\bHeader Back System\b/g, "Система від колектора");
  out = out.replace(/\bFull System\b/g, "Повна система");
  out = out.replace(/\bCatback System\b/g, "Cat-back");
  out = out.replace(/\bCat\s*back\b/g, "Cat-back");
  // Standalone Header (тільки коли НЕ перед Back) → Колектор
  out = out.replace(/\bHeader\b(?!\s*Back)/g, "Колектор");
  out = out.replace(/\bFactory Front Pipe\b/g, "Заводська передня труба");
  out = out.replace(/\bEqual[- ]Length Front Pipe\b/g, "Equal-Length передня труба");
  out = out.replace(/\bCatted Downpipe\b/g, "Даунпайп з каталізатором");
  out = out.replace(/\bCatless Downpipe\b/g, "Даунпайп без каталізатора");
  out = out.replace(/\bNon[- ]Downpipe\b/g, "Без даунпайпа");
  // Tip finishes — кольори лишаємо англійською (як бренд-назви), додаємо "насадки"
  out = out.replace(/\bTips\s+Chrome\s+Silver\b/gi, "насадки Chrome Silver");
  out = out.replace(/\bTips\s+Chrome\s+Black\b/gi, "насадки Chrome Black");
  out = out.replace(/\bTips\s+Titanium\s+Blue\b/gi, "насадки Titanium Blue");
  out = out.replace(/\bTips\s+Carbon\s+Fiber\b/gi, "насадки Carbon Fiber");
  out = out.replace(/\bTips\s+Gold\b/gi, "насадки Gold");
  out = out.replace(/\bChrome Silver Tips\b/gi, "насадки Chrome Silver");
  out = out.replace(/\bChrome Black Tips\b/gi, "насадки Chrome Black");
  out = out.replace(/\bPolished Silver Tips\b/gi, "насадки Polished Silver");
  out = out.replace(/\bDouble triple Gold tips\b/gi, "подвійні потрійні насадки (золоті)");
  // Mufflers
  out = out.replace(/\bValvetronic Muffler\b/g, "Valvetronic-глушник");
  // Materials
  out = out.replace(/\bStainless Steel\b/g, "Нержавіюча сталь");
  // "with" в назвах варіантів iPE — це з'єднувач секцій, не прийменник.
  // Замінюємо на " · " щоб обійти граматичні відмінки в українській.
  out = out.replace(/\s+with\s+/gi, " · ");
  return out;
}

function pickPreferredCatbackVariant(variants: ShopProductVariantSummary[]): ShopProductVariantSummary | null {
  const score = (v: ShopProductVariantSummary) => {
    const j = (v.optionValues ?? []).join(" | ").toLowerCase();
    let s = 0;
    if (/\bcat\s*back\b|\bcatback\b/.test(j) && !/\bfull\s*system\b/.test(j)) s += 1000;
    if (/\bfactory\b/.test(j)) s += 100;
    if (/\bcatted\b/.test(j)) s += 50;
    if (/\bopf\b/.test(j) && !/\bnon[- ]?opf\b/.test(j)) s += 25;
    return s;
  };
  let best: ShopProductVariantSummary | null = null;
  let bestScore = -1;
  let bestPrice = Number.POSITIVE_INFINITY;
  for (const v of variants) {
    const sc = score(v);
    const price = v.price?.usd ?? Number.POSITIVE_INFINITY;
    if (sc > bestScore || (sc === bestScore && price < bestPrice)) {
      best = v;
      bestScore = sc;
      bestPrice = price;
    }
  }
  // Only return when at least one variant carries a real cat-back / factory
  // /catted / opf signal. Otherwise fall through to the explicit `isDefault`
  // flag set by the catalog editors. Without this guard, a "Catted Downpipe"
  // variant (score 50) would always beat the editor-marked default.
  return bestScore > 0 ? best : null;
}

// Classify a gallery image URL by the material hinted in its filename. iPE's
// CDN filenames are inconsistent: some carry explicit tokens like
// "titanium" / "stainlesssteel", some use short prefixes ("sscatback",
// "tiadapter"), and most generic shots have neither. Anything ambiguous
// returns null and is treated as "shown for both materials".
function classifyImageMaterial(url: string): "ti" | "ss" | null {
  const fileSegment = (url.split("/").pop() ?? url).split("?")[0].toLowerCase();
  if (/stainless\s*steel|stainlesssteel|stainless/.test(fileSegment)) return "ss";
  if (/titanium/.test(fileSegment)) return "ti";
  // Boundary-anchored short tokens: -ti-, _ti_, ti., -ss-, etc. Letter
  // boundaries on either side prevent matching inside words like "tip".
  if (/(?:^|[^a-z])ti(?:[^a-z]|$)/.test(fileSegment)) return "ti";
  if (/(?:^|[^a-z])ss(?:[^a-z]|$)/.test(fileSegment)) return "ss";
  // iPE-specific filename prefixes: "tiadapter", "ssadapter*", "sscatback".
  // Restrict to a small allowlist of known iPE asset stems so we don't
  // false-positive on stray English words.
  if (/^ti(adapter|catback|tip)/.test(fileSegment)) return "ti";
  if (/^ss(adapter|catback|tip)/.test(fileSegment)) return "ss";
  return null;
}

function rebaseIpeGalleryUrl(g: string, refImage: string | null | undefined): string {
  if (!g || !g.startsWith("/media/shop/")) return g;
  const ref = String(refImage ?? "");
  const m = ref.match(/^(https?:\/\/[^/]+\.blob\.vercel-storage\.com)\/media\/library\//i);
  if (!m) return g;
  return `${m[1]}/media/library/shop/${g.slice("/media/shop/".length)}`;
}

function variantMatches(variant: ShopProductVariantSummary, selected: string[]): boolean {
  for (let i = 0; i < selected.length; i += 1) {
    if (!selected[i]) continue;
    if (variant.optionValues?.[i] !== selected[i]) return false;
  }
  return true;
}

export function IpeShopProductDetailLayout({ locale, resolvedLocale, product, pricing }: Props) {
  const isUa = resolvedLocale === "ua";
  const variants = product.variants ?? [];
  const optionAxes = useMemo(() => buildOptionAxes(variants), [variants]);

  const initialVariant = useMemo(() => {
    // Editor-marked default wins. We rebuilt iPE variants from the official
    // pricelist + Excel and explicitly chose the canonical entry (Cat-back
    // for cars where it exists, Rear Valvetronic for split-system cars). The
    // catback-heuristic below is a fallback for products that came in via
    // older import paths without a real isDefault flag.
    return (
      variants.find((v) => v.isDefault) ??
      pickPreferredCatbackVariant(variants) ??
      variants[0] ??
      null
    );
  }, [variants]);

  const [selected, setSelected] = useState<string[]>(() => {
    return [0, 1, 2].map((i) => initialVariant?.optionValues?.[i] ?? "");
  });

  const currentVariant = useMemo(() => {
    if (!variants.length) return null;
    const exact = variants.find((v) => variantMatches(v, selected));
    return exact ?? initialVariant;
  }, [variants, selected, initialVariant]);

  const handleSelect = (axisIndex: number, value: string) => {
    setSelected((prev) => {
      const next = [...prev];
      next[axisIndex] = value;
      // If no variant matches this combo, lock other axes to a compatible
      // variant: pick the first variant that has the chosen value at this axis
      // and adopt its other option values.
      const compatible =
        variants.find((v) => variantMatches(v, next)) ??
        variants.find((v) => v.optionValues?.[axisIndex] === value);
      if (compatible) {
        return [0, 1, 2].map((i) =>
          i === axisIndex ? value : compatible.optionValues?.[i] ?? next[i] ?? ""
        );
      }
      return next;
    });
  };

  const productTitle = localizeShopProductTitle(resolvedLocale, product);
  const productCategory = localizeShopText(resolvedLocale, product.category);
  const longDescription = localizeShopDescription(resolvedLocale, product.longDescription);
  const shortDescription = localizeShopDescription(resolvedLocale, product.shortDescription);

  // shopCatalogServer already collapses bodyHtmlUa/En into longDescription for
  // products like iPE, so the rich HTML lives there.
  const bodySource = longDescription || shortDescription || "";
  const normalizedBody = isUa ? normalizeIpeUaCopy(bodySource) : bodySource;
  const bodyWithoutCrossPromo = stripIpeCrossPromoLinks(normalizedBody);
  const { body: bodyMinusOpf } = extractOpfWarning(bodyWithoutCrossPromo, isUa);
  const sanitizedBodyHtml = sanitizeRichTextHtml(bodyMinusOpf);

  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const cleanImages = useMemo(
    () =>
      gallery
        .map((img) => img?.replace(/^["']|["']$/g, "").trim())
        .filter(Boolean)
        .map((img) => rebaseIpeGalleryUrl(img as string, product.image)) as string[],
    [gallery, product.image]
  );

  // Bucket images by material. Prefer the pre-classified `galleryMaterials`
  // tag list shipped on the product (set at import time from the original
  // Shopify URLs before they got rebased to Vercel Blob and lost their
  // material hints). Fall back to runtime URL-pattern classification for
  // products that still carry meaningful filenames. Only kicks in when the
  // gallery has at least one Ti AND one SS image — otherwise filtering
  // would empty the "wrong" material tab.
  const imageBuckets = useMemo(() => {
    const ti: string[] = [];
    const ss: string[] = [];
    const generic: string[] = [];
    cleanImages.forEach((url, idx) => {
      const preTagged = product.galleryMaterials?.[idx];
      const tag = preTagged ?? classifyImageMaterial(url);
      if (tag === "ti") ti.push(url);
      else if (tag === "ss") ss.push(url);
      else generic.push(url);
    });
    const splitActive = ti.length > 0 && ss.length > 0;
    return { ti, ss, generic, splitActive };
  }, [cleanImages, product.galleryMaterials]);

  const activeMaterial: "ti" | "ss" | null = useMemo(() => {
    const joined = (currentVariant?.optionValues ?? []).join(" | ").toLowerCase();
    if (/\btitanium\b/.test(joined)) return "ti";
    if (/\bstainless\b/.test(joined)) return "ss";
    return null;
  }, [currentVariant]);

  const displayedImages = useMemo(() => {
    if (!imageBuckets.splitActive || !activeMaterial) return cleanImages;
    const matchBucket = activeMaterial === "ti" ? imageBuckets.ti : imageBuckets.ss;
    // Material-specific images first, then generic shots so the gallery
    // never collapses to a single thumbnail.
    return [...matchBucket, ...imageBuckets.generic];
  }, [cleanImages, imageBuckets, activeMaterial]);

  const [mainIdx, setMainIdx] = useState(0);
  // When a variant carries its own featured image, snap the main slot to that
  // image whenever the user changes options — otherwise buyers click between
  // Titanium / Stainless Steel (or different downpipe configs) and the picture
  // never moves, so the toggle feels broken. Falls back to image #0 if the
  // variant image isn't part of the (possibly material-filtered) gallery.
  useEffect(() => {
    const variantImage = currentVariant?.image
      ? rebaseIpeGalleryUrl(
          currentVariant.image.replace(/^["']|["']$/g, "").trim(),
          product.image
        )
      : null;
    if (variantImage) {
      const idx = displayedImages.findIndex((img) => img === variantImage);
      setMainIdx(idx >= 0 ? idx : 0);
      return;
    }
    setMainIdx(0);
  }, [displayedImages, currentVariant, product.image]);

  const priceUsd = currentVariant?.price?.usd ?? product.price?.usd ?? 0;
  const priceEur = currentVariant?.price?.eur ?? product.price?.eur ?? 0;
  const priceUah = currentVariant?.price?.uah ?? product.price?.uah ?? 0;

  return (
    <div className="ipe-pdp">
      <style jsx global>{`
        .ipe-pdp { color: #fff; min-height: 100dvh; padding: 7rem 1rem 8rem; }
        .ipe-pdp__container {
          max-width: 1400px; margin: 0 auto;
          display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 3rem;
        }
        @media (max-width: 960px) { .ipe-pdp__container { grid-template-columns: 1fr; } }
        .ipe-pdp__bc { font-size: .7rem; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.5); margin-bottom: 1.5rem; display: flex; gap: .5rem; flex-wrap: wrap; }
        .ipe-pdp__bc a:hover { color: #fff; }
        .ipe-pdp__title { font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 600; line-height: 1.15; margin: 0 0 .5rem; }
        .ipe-pdp__cat { font-size: .75rem; letter-spacing: .15em; text-transform: uppercase; color: rgba(255,255,255,.55); margin-bottom: 2rem; }
        .ipe-pdp__gallery-main { position: relative; aspect-ratio: 4/3; background: #0e0e10; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); }
        .ipe-pdp__gallery-main img { object-fit: contain; }
        .ipe-pdp__thumbs { display: flex; gap: .5rem; margin-top: 1rem; overflow-x: auto; padding-bottom: .25rem; }
        .ipe-pdp__thumb { width: 72px; height: 54px; flex-shrink: 0; background: #0e0e10; border-radius: 6px; overflow: hidden; border: 2px solid transparent; cursor: pointer; opacity: .6; transition: all .2s; position: relative; }
        .ipe-pdp__thumb img { object-fit: contain; }
        .ipe-pdp__thumb:hover { opacity: .9; }
        .ipe-pdp__thumb.is-active { opacity: 1; border-color: #c29d59; }

        .ipe-pdp__price-row { display: flex; align-items: baseline; gap: 1rem; margin-bottom: .5rem; }
        .ipe-pdp__price-note { font-size: .7rem; color: rgba(255,255,255,.55); letter-spacing: .1em; text-transform: uppercase; }

        .ipe-pdp__options { margin: 1.5rem 0; display: flex; flex-direction: column; gap: 1.25rem; }
        .ipe-pdp__option-label { font-size: .7rem; letter-spacing: .15em; text-transform: uppercase; color: rgba(255,255,255,.55); margin-bottom: .5rem; display: block; }
        .ipe-pdp__option-grid { display: flex; flex-wrap: wrap; gap: .5rem; }
        .ipe-pdp__option-btn {
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12);
          color: #ddd; padding: .55rem .9rem; border-radius: 6px; font-size: .85rem;
          cursor: pointer; transition: all .15s;
        }
        .ipe-pdp__option-btn:hover { border-color: rgba(255,255,255,.3); color: #fff; }
        .ipe-pdp__option-btn.is-active { background: #c29d59; border-color: #c29d59; color: #0e0e10; font-weight: 600; }

        .ipe-pdp__vin {
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px; padding: 1rem; margin: 1.25rem 0;
        }
        .ipe-pdp__vin-title { font-size: .8rem; letter-spacing: .12em; text-transform: uppercase; color: #c29d59; margin-bottom: .35rem; font-weight: 600; }
        .ipe-pdp__vin-text { font-size: .85rem; color: rgba(255,255,255,.78); line-height: 1.5; margin-bottom: .75rem; }
        .ipe-pdp__vin-cta {
          display: inline-block; padding: .55rem 1rem; border-radius: 6px;
          background: #c29d59; color: #0e0e10; font-weight: 600; font-size: .85rem;
          text-decoration: none; transition: filter .15s;
        }
        .ipe-pdp__vin-cta:hover { filter: brightness(1.1); }

        .ipe-pdp__cart { margin-top: 1rem; }
        .ipe-pdp__sku { margin-top: .75rem; font-size: .7rem; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.45); }

        .ipe-pdp__desc { margin-top: 3rem; padding: 2rem; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 12px; }
        .ipe-pdp__desc h2 { font-size: 1.05rem; letter-spacing: .08em; text-transform: uppercase; margin: 1rem 0 .5rem; color: #c29d59; }
        .ipe-pdp__desc h2:first-child { margin-top: 0; }
        .ipe-pdp__desc p { line-height: 1.65; color: rgba(255,255,255,.85); margin: 0 0 .75rem; font-size: .92rem; }
        .ipe-pdp__desc strong { color: #fff; }
      `}</style>

      <div className="ipe-pdp__container">
        <div>
          <div className="ipe-pdp__bc">
            <Link href={`/${locale}/shop`}>{isUa ? "Магазин" : "Shop"}</Link>
            <span>/</span>
            <Link href={`/${locale}/shop/ipe`}>iPE Exhaust</Link>
          </div>

          <div className="ipe-pdp__gallery-main">
            {displayedImages[mainIdx] ? (
              <ShopProductImage
                src={displayedImages[mainIdx]}
                alt={productTitle}
                fill
                sizes="(max-width: 960px) 100vw, 60vw"
              />
            ) : null}
          </div>
          {displayedImages.length > 1 ? (
            <div className="ipe-pdp__thumbs">
              {displayedImages.map((src, idx) => (
                <button
                  key={`${src}-${idx}`}
                  type="button"
                  className={`ipe-pdp__thumb ${idx === mainIdx ? "is-active" : ""}`}
                  onClick={() => setMainIdx(idx)}
                  aria-label={`${productTitle} ${idx + 1}`}
                >
                  <ShopProductImage src={src} alt={productTitle} fill sizes="80px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="ipe-pdp__title">{productTitle}</h1>
          {productCategory ? <div className="ipe-pdp__cat">{productCategory}</div> : null}

          <div className="ipe-pdp__price-row">
            <ShopPrimaryPriceBox
              locale={locale as any}
              isUa={isUa}
              price={{ eur: priceEur, usd: priceUsd, uah: priceUah }}
            />
          </div>
          {pricing ? (
            <div className="ipe-pdp__b2b">
              <ShopB2BPricingBand pricing={pricing} locale={locale as any} />
            </div>
          ) : null}
          {currentVariant && /catback|cat\s*back/i.test((currentVariant.optionValues ?? []).join(" ")) ? (
            <div className="ipe-pdp__price-note">
              {isUa ? "Ціна за Cat-back систему" : "Price for cat-back system"}
            </div>
          ) : null}

          {optionAxes.length > 0 ? (
            <div className="ipe-pdp__options">
              {optionAxes.map((axis) => {
                const axisLabel = localizeAxisName(axis.name, isUa);
                const labelWithSuffix = axis.commonSuffix
                  ? `${axisLabel} (${axis.commonSuffix})`
                  : axisLabel;
                const stripSuffix = (v: string) =>
                  axis.commonSuffix
                    ? v.replace(new RegExp(`\\s*\\(${axis.commonSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`), "").trim()
                    : v;
                return (
                  <div key={axis.index}>
                    <span className="ipe-pdp__option-label">{labelWithSuffix}</span>
                    <div className="ipe-pdp__option-grid">
                      {axis.values.map((value) => {
                        const active = selected[axis.index] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`ipe-pdp__option-btn ${active ? "is-active" : ""}`}
                            onClick={() => handleSelect(axis.index, value)}
                          >
                            {localizeOptionValue(stripSuffix(value), isUa)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="ipe-pdp__vin">
            <div className="ipe-pdp__vin-title">
              {isUa ? "Не впевнені у комплектації?" : "Not sure about your spec?"}
            </div>
            <div className="ipe-pdp__vin-text">
              {isUa
                ? "Надайте VIN код нашому спеціалісту — підтвердимо точну сумісність вашого автомобіля і допоможемо обрати правильну версію (OPF / Non-OPF, Catted / Catless)."
                : "Share your VIN with our specialist — we'll confirm exact fitment for your vehicle and help you pick the right spec (OPF / Non-OPF, Catted / Catless)."}
            </div>
            <a className="ipe-pdp__vin-cta" href="https://t.me/onecompany_ua" target="_blank" rel="noreferrer">
              {isUa ? "Написати спеціалісту" : "Contact specialist"}
            </a>
          </div>

          <div className="ipe-pdp__cart">
            <AddToCartButton
              slug={product.slug}
              variantId={currentVariant?.id ?? null}
              locale={locale}
              productName={productTitle}
            />
          </div>
          {(currentVariant?.sku || product.sku) ? (
            <div className="ipe-pdp__sku">
              {isUa ? "Артикул" : "SKU"}: {currentVariant?.sku ?? product.sku}
            </div>
          ) : null}
        </div>
      </div>

      {sanitizedBodyHtml ? (
        <div className="ipe-pdp__container" style={{ marginTop: "3rem", display: "block" }}>
          <div
            className="ipe-pdp__desc"
            dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml }}
          />
        </div>
      ) : null}
    </div>
  );
}
