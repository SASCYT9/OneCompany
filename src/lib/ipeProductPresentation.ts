import type { ShopProductVariantSummary } from "@/lib/shopCatalog";

/**
 * iPE presentation rules, shared by the one product-page design: UA copy
 * fixes, removal of iPE's cross-promo banners, variant axes and labels, the
 * preferred cat-back default and the downpipe choice that only full systems
 * and downpipes need.
 */

/** iPE products, whatever the catalog label ("iPE exhaust", "iPE"). */
export function isIpeBrand(brand: string | null | undefined): boolean {
  return /^ipe\b/i.test((brand ?? "").trim());
}

/** Axes 1 and 2 hold "Full System / Downpipes" and the downpipe type. */
export function ipeHasConditionalDownpipeAxis(axes: IpeVariantOption[]): boolean {
  return (
    axes.some(
      (axis) =>
        axis.index === 1 &&
        axis.values.some((value) => value.trim().toLowerCase() === "full system") &&
        axis.values.some((value) => value.trim().toLowerCase() === "downpipes")
    ) &&
    axes.some((axis) => axis.index === 2 && axis.values.some((value) => /downpipe/i.test(value)))
  );
}

// Render-time UA-copy normalizer. Mirrors the import-side `sanitizeIpeUaCopy`
// in scripts/import-ipe-catalog.ts so already-imported products with stale
// translations still display the correct terminology without a reimport.
// JS \b only fires at ASCII word boundaries — Cyrillic letters are non-word
// to the engine, so \bП... never matches. Use Unicode-aware lookarounds
// against a Cyrillic letter class instead.
const CYR = "А-Яа-яІіЇїЄєҐґ";
const beforeCyr = `(?<![${CYR}])`;
const afterCyr = `(?![${CYR}])`;

export function normalizeIpeUaCopy(value: string): string {
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
      и: "Насадки",
      а: "Насадка",
      ів: "Насадок",
      ам: "Насадкам",
      ами: "Насадками",
      ах: "Насадках",
    };
    const lowerMap: Record<string, string> = {
      "": "насадка",
      и: "насадки",
      а: "насадка",
      ів: "насадок",
      ам: "насадкам",
      ами: "насадками",
      ах: "насадках",
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
export function stripIpeCrossPromoLinks(html: string): string {
  if (!html) return html;
  // <a href="...ipeofficial.com/products/..."> ...wrapped content... </a>
  // Some banners are bare <img> tags with the same alt-text style; remove
  // those too when their alt mentions a different iPE product line.
  let out = html.replace(
    /<a[^>]*href=(?:"|')[^"']*ipeofficial\.com\/products\/[^"']*(?:"|')[^>]*>[\s\S]*?<\/a>/gi,
    ""
  );
  out = out.replace(
    /<img[^>]*alt=(?:"|')[^"']*(?:click the button to enter the link|click here to enter the link|magnesium wheels|forged magnesium|other (?:iPE )?products?)[^"']*(?:"|')[^>]*\/?>/gi,
    ""
  );
  // Strip empty anchors and empty/redundant span wrappers that iPE's bodyHtml
  // collects from Word-style paste — they don't render anything but litter the
  // DOM (e.g. Ferrari 296 GTB had 18 stray `<a></a>` tags).
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<a[^>]*>\s*<\/a>/gi, "").replace(/<span[^>]*>\s*<\/span>/gi, "");
  } while (out !== prev);
  return out;
}

// Pull the OPF warning ("ПОПЕРЕДЖЕННЯ - Перед покупкою..." / "WARNING - Prior
// to purchase...") out of the body so the layout can render it as a styled
// callout instead of letting it sit inline as a buried <strong>.
export function extractOpfWarning(
  html: string,
  isUa: boolean
): { body: string; warning: string | null } {
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

export type IpeVariantOption = {
  name: string;
  values: string[];
  index: 0 | 1 | 2;
  commonSuffix?: string;
};

// If every value on an axis ends with the same parenthetical suffix (e.g. all
// downpipe options say "(OPF)"), strip it from the buttons and surface it once
// on the axis label. Removes redundant noise without losing information.
export function liftCommonAxisSuffix(values: string[]): { stripped: string[]; suffix: string } {
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

export function buildOptionAxes(variants: ShopProductVariantSummary[]): IpeVariantOption[] {
  const axes: IpeVariantOption[] = [];
  for (let i = 0; i < 3; i += 1) {
    const values = Array.from(
      new Set(
        variants.map((v) => v.optionValues?.[i]).filter((value): value is string => Boolean(value))
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

export function inferAxisName(sample: string, index: number): string {
  const s = sample.toLowerCase();
  if (/\bcat\s*back\b|\bcatback\b|\bfull\s*system\b/.test(s)) return "Exhaust System";
  if (/\bfront\s*pipe\b|\bequal[- ]length\b|\bfactory\b/.test(s)) return "Front Pipe Design";
  if (/\bdownpipe\b|\bcatted\b|\bcatless\b/.test(s)) return "Downpipe";
  if (/\btitanium\b|\bstainless\b/.test(s)) return "Material";
  return ["Configuration", "Design", "Option"][index] ?? "Option";
}

export function localizeAxisName(name: string, isUa: boolean): string {
  if (!isUa) return name;
  const map: Record<string, string> = {
    "Exhaust System": "Тип системи",
    "Front Pipe Design": "Передні труби",
    Downpipe: "Даунпайп",
    Material: "Матеріал",
    Design: "Дизайн",
    Configuration: "Конфігурація",
    Option: "Опція",
  };
  return map[name] ?? name;
}

export function localizeOptionValue(value: string, isUa: boolean): string {
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

export function pickPreferredCatbackVariant(
  variants: ShopProductVariantSummary[]
): ShopProductVariantSummary | null {
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

export function systemUsesDownpipeOption(system: string | undefined): boolean {
  const normalized = system?.trim().toLowerCase();
  return normalized === "full system" || normalized === "downpipes";
}
