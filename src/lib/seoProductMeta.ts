/**
 * Product `<title>` / meta description builders.
 *
 * Only `<head>` metadata is produced here; visible page copy is untouched.
 *
 * Why this exists: Search Console shows thousands of product pages as
 * "crawled, not indexed". Many of them shared one title (several Remus
 * bundles, RaceChip engine variants) or one boilerplate description, so Google
 * treated them as duplicates. Customers also search by part number, so the
 * SKU belongs in the title and description when the name does not carry it.
 */

import type { ShopProduct } from "@/lib/shopCatalog";
import { buildVehiclePhrase, pickCategoryUa } from "@/lib/genericShopEditorialCopy";

/** Page metadata cuts longer titles mid-word with "…"; product titles stay within it. */
export const SEO_TITLE_MAX_LENGTH = 95;
const MIN_SHORT_NAME_LENGTH = 24;
/** Separators a long name may be cut at, from the strongest to the weakest. */
const NAME_BREAKS = [" — ", " – ", " | ", " (", ", ", " / ", " - "];
/** Short brand labels for titles ("KW Suspensions" products say "KW"). */
const BRAND_TITLE_LABELS: Record<string, string> = { "kw suspensions": "KW" };
const CYRILLIC = /[а-яіїєґ]/i;

type Locale = "ua" | "en";

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/g, "");
}

/** True when `needle` already appears in `haystack`, ignoring case and punctuation. */
export function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeToken(needle);
  if (!normalizedNeedle) return true;
  return normalizeToken(haystack).includes(normalizedNeedle);
}

/**
 * True when `hp` is already stated in `text` as its own labeled figure
 * ("177 hp", "177 к.с.", "177PS"). A bare substring test is wrong here: 112
 * sits inside "2011–2015" and 196 inside "1968cc".
 */
function includesLabeledPower(text: string, hp: number): boolean {
  // String.raw keeps the regex escapes (\s, \p{L}, \.) intact in the source.
  const label = String.raw`(?:hp|bhp|ps|cv|pk|к\.?\s*с\.?|л\.?\s*с\.?)`;
  const pattern = new RegExp(
    String.raw`(?<![\p{L}\p{N}.,])${hp}[\s ]*${label}(?![\p{L}\p{N}])`,
    "iu"
  );
  return pattern.test(text);
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Stored SEO strings that came out of an import template broken: empty
 * brackets ("для Porsche ()"), "та ін.." glued to a sentence end, unbalanced
 * brackets ("для BMW 5 (G30 та ін..") or a leaked "undefined"/"null". Such a
 * string is worse than the generated one, so the builders ignore it.
 */
export function isBrokenStoredSeoText(value: string): boolean {
  if (/\(\s*\)|\[\s*\]/.test(value)) return true;
  if (/та ін\.\./.test(value)) return true;
  if (/\b(?:undefined|null)\b/.test(value)) return true;
  const opening = (value.match(/\(/g) ?? []).length;
  const closing = (value.match(/\)/g) ?? []).length;
  return opening !== closing;
}

/** An admin-curated SEO string, unless it is empty or broken. */
function usableExplicit(value: string | null | undefined): string {
  const explicit = clean(value);
  return explicit && !isBrokenStoredSeoText(explicit) ? explicit : "";
}

function bracketsBalanced(value: string): boolean {
  return (value.match(/\(/g) ?? []).length === (value.match(/\)/g) ?? []).length;
}

/**
 * Every start of `name` that ends at a phrase boundary, leaves no bracket
 * open and is long enough to mean something, longest first.
 */
function phraseBoundaryCuts(name: string): string[] {
  const cuts = new Set<string>();
  for (const separator of NAME_BREAKS) {
    for (
      let index = name.lastIndexOf(separator);
      index > 0;
      index = name.lastIndexOf(separator, index - 1)
    ) {
      const cut = name.slice(0, index).trim();
      if (cut.length >= MIN_SHORT_NAME_LENGTH && bracketsBalanced(cut)) cuts.add(cut);
    }
  }
  return [...cuts].sort((a, b) => b.length - a.length);
}

const BRACKETED = /\s*\(([^()]*)\)/g;
const CODE_LIST = /^[^\s,]+(?:,\s*[^\s,]+)+$/;

/**
 * The name without bracketed asides of three or more words ("(включаючи
 * пружини та верхні опори)", "(1.5 ST EcoBoost)"); codes such as "(G87)" or
 * "(16, 5C1, 5C2)" stay.
 */
function withoutAsides(name: string): string {
  return clean(
    name.replace(BRACKETED, (match, inner: string) => {
      const content = inner.trim();
      const words = content.split(/\s+/).length;
      return words >= 3 && !CODE_LIST.test(content) ? "" : match;
    })
  );
}

/** Where the vehicle starts: after the first "для"/"for", else after the first dash; -1 when unknown. */
function vehiclePhraseStart(name: string): number {
  const lower = name.toLowerCase();
  for (const markers of [
    [" для ", " for "],
    [" — ", " – "],
  ]) {
    const found = markers
      .map((marker) => ({ index: lower.indexOf(marker), marker }))
      .filter(({ index }) => index > 0)
      .sort((a, b) => a.index - b.index)[0];
    if (found) return found.index + found.marker.length;
  }
  return -1;
}

/**
 * Phrase-boundary cuts of `name` that keep what the product is and the start
 * of the vehicle. A name without a "для"/"for"/dash may carry its vehicle
 * anywhere ("Накладка (матовий) Ducati Streetfighter V4"), so it is only cut
 * when it is over `maxLength` itself.
 */
function vehicleKeepingCuts(name: string, maxLength: number): string[] {
  const start = vehiclePhraseStart(name);
  if (start < 0 && name.length <= maxLength) return [];
  return phraseBoundaryCuts(name).filter((cut) => start < 0 || cut.length >= start + 2);
}

/**
 * Supplier part numbers belong in a title; internal codes (Shopify variant
 * ids of Burger, Urban's URB-… codes) and kit lists ("A + B*2") do not.
 */
function isTitleSku(sku: string): boolean {
  return (
    sku.length <= 20 &&
    !/\s\+\s|\*/.test(sku) &&
    !/^BURGER-V-\d+$/i.test(sku) &&
    !/^URB-[A-Z]+-\d+-V\d+$/i.test(sku)
  );
}

/** Importers appended the site name to stored titles; product titles do not carry it. */
const SITE_NAME_SUFFIX = /\s*[|–—-]\s*one\s*company(?:\s+(?:global|shop))?\s*$/i;
const SITE_NAME_TOKENS = ["onecompanyglobal", "onecompanyshop", "onecompany"];

/**
 * True when a stored title is only the product name plus its brand, SKU or
 * the site name: what importers wrote, not an admin-curated title.
 */
function isNameWithLabels(stored: string, name: string, labels: string[]): boolean {
  const normalizedName = normalizeToken(name);
  let rest = normalizeToken(stored);
  if (!normalizedName || !rest.includes(normalizedName)) return false;
  rest = rest.replace(normalizedName, "");
  for (const label of [...labels.map(normalizeToken), ...SITE_NAME_TOKENS]) {
    if (label) rest = rest.replace(label, "");
  }
  return rest === "";
}

/**
 * Title without redundant parts. An admin-curated `seoTitle` wins, except an
 * untranslated (Latin-only) one on a Ukrainian page and one that is only the
 * product name with its brand, SKU or the site name (importers write those);
 * a curated title too long to show is shortened like a name, without
 * additions.
 * Otherwise: `<name> <SKU> | <brand>` within the hard limit, nothing dropped
 * when it fits; else without long bracketed asides, then cut at a phrase
 * boundary that keeps the vehicle; only then the SKU, then the brand, go.
 */
export function buildProductSeoTitle(input: {
  explicitTitle?: string | null;
  title: string;
  sku?: string | null;
  brand?: string | null;
  maxLength?: number;
  locale?: Locale;
}): string {
  const maxLength = input.maxLength ?? SEO_TITLE_MAX_LENGTH;
  const name = clean(input.title);
  const rawSku = clean(input.sku);
  const sku = isTitleSku(rawSku) ? rawSku : "";
  const brand = clean(input.brand);
  const brandLabel = BRAND_TITLE_LABELS[brand.toLowerCase()] ?? brand;

  // The SKU and the brand are added only when `base` lacks them; a cut name
  // may have lost the SKU its full form ended with.
  const withSku = (base: string) =>
    !sku || includesNormalized(base, sku) ? base : `${base} ${sku}`;
  const withBrand = (base: string) =>
    !brandLabel || includesNormalized(base, brandLabel) || includesNormalized(base, brand)
      ? base
      : `${base} | ${brandLabel}`;
  const compose = (base: string) => withBrand(withSku(base));
  const fits = (limit: number) => (title: string) => title.length <= limit;

  const explicit = usableExplicit(input.explicitTitle).replace(SITE_NAME_SUFFIX, "");
  const curated =
    Boolean(explicit) &&
    !isNameWithLabels(explicit, name, [rawSku, brand, brandLabel]) &&
    (input.locale !== "ua" || CYRILLIC.test(explicit));
  if (curated) {
    if (explicit.length <= maxLength) return explicit;
    const shorter = withoutAsides(explicit);
    return [shorter, ...vehicleKeepingCuts(shorter, maxLength)].find(fits(maxLength)) ?? explicit;
  }

  // In order, the first that fits: the whole name with the SKU (titles of
  // same-name products differ by it) and the brand, then without long
  // asides, then cut at a phrase boundary that keeps the vehicle; only then
  // the SKU, then the brand, are dropped.
  const shorter = withoutAsides(name);
  const bases = shorter === name ? [name] : [name, shorter];
  const cuts = vehicleKeepingCuts(shorter, maxLength);
  const bare = (base: string) => base;
  for (const shape of [compose, withSku, withBrand, bare]) {
    const title = [...bases, ...cuts].map(shape).find(fits(maxLength));
    if (title) return title;
  }
  return name;
}

/** Vehicle named after "for" in an English supplier title, without tip sizes or codes. */
function seoVehiclePhrase(titleEn: string): string {
  const phrase = buildVehiclePhrase(titleEn)
    .split(" | ")[0]
    .replace(/\s+\d+\s?x\s?\d+(?:[.,]\d+)?\s?mm\b.*$/i, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s?mm\b.*$/i, "")
    .replace(/\s*\(\s*[\d\s]+\)\s*$/, "");
  return clean(phrase);
}

/**
 * Name for the Ukrainian `<title>` of a product whose name was never
 * translated (Remus and other supplier imports): the product type in
 * Ukrainian, the brand and the vehicle, or the original name after a dash.
 * A name that already has Ukrainian words is returned unchanged.
 */
export function buildUaSeoProductName(input: {
  title: string;
  titleEn?: string | null;
  brand?: string | null;
  categoryUa?: string | null;
  categoryEn?: string | null;
  productType?: string | null;
}): string {
  const title = clean(input.title);
  if (!title || CYRILLIC.test(title)) return title;
  const titleEn = clean(input.titleEn) || title;
  const category = clean(
    pickCategoryUa({
      titleEn,
      categoryUa: input.categoryUa,
      categoryEn: input.categoryEn,
      productType: input.productType,
    })
  );
  // "Компонент" is the editorial copy's catch-all and a category path
  // ("Для автомобілів > Ford") names no product type.
  if (!CYRILLIC.test(category) || category === "Компонент" || /[>/|]/.test(category)) {
    return title;
  }
  const brand = clean(input.brand);
  const lead = brand && !includesNormalized(category, brand) ? `${category} ${brand}` : category;
  const vehicle = seoVehiclePhrase(titleEn);
  return vehicle ? `${lead} для ${vehicle}` : `${lead} — ${title}`;
}

/** The product `<title>` for a locale, shared by every product route. */
export function buildLocalizedProductSeoTitle(
  locale: Locale,
  product: Pick<ShopProduct, "seoTitle" | "sku" | "brand" | "category" | "productType" | "title">,
  localizedTitle: string,
  maxLength?: number
): string {
  const title =
    locale === "ua"
      ? buildUaSeoProductName({
          title: localizedTitle,
          titleEn: product.title?.en,
          brand: product.brand,
          categoryUa: product.category?.ua,
          categoryEn: product.category?.en,
          productType: product.productType,
        })
      : localizedTitle;
  return buildProductSeoTitle({
    explicitTitle: product.seoTitle?.[locale],
    title,
    sku: product.sku,
    brand: product.brand,
    maxLength,
    locale,
  });
}

const THIN_DESCRIPTION_LENGTH = 70;

/**
 * Description with the SKU and a short Ukrainian/English delivery tail.
 * An admin-curated `seoDescription` always wins. A thin or missing source
 * description is extended so pages do not share one boilerplate sentence.
 */
export function buildProductSeoDescription(input: {
  locale: Locale;
  explicitDescription?: string | null;
  description?: string | null;
  title: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
}): string {
  const explicit = usableExplicit(input.explicitDescription);
  if (explicit) return explicit;

  const isUa = input.locale === "ua";
  const title = clean(input.title);
  const sku = clean(input.sku);
  const brand = clean(input.brand);
  const category = clean(input.category);
  const description = clean(input.description);
  const skuMissing = Boolean(sku) && !includesNormalized(`${title} ${description}`, sku);

  if (!description) {
    const skuPart = sku ? (isUa ? ` (арт. ${sku})` : ` (SKU ${sku})`) : "";
    const brandPart = brand ? (isUa ? ` — ${brand}` : ` by ${brand}`) : "";
    const categoryPart = category ? ` ${category}.` : "";
    return isUa
      ? `${title}${skuPart}${brandPart}.${categoryPart} Купити в Україні: підбір за авто, офіційне постачання, доставка по Україні та світу. One Company.`
      : `${title}${skuPart}${brandPart}.${categoryPart} Fitment check, official supply and worldwide delivery from One Company.`;
  }

  if (description.length >= THIN_DESCRIPTION_LENGTH && !skuMissing) return description;

  const skuTail = skuMissing ? (isUa ? ` Арт. ${sku}.` : ` SKU ${sku}.`) : "";
  const deliveryTail =
    description.length < THIN_DESCRIPTION_LENGTH
      ? isUa
        ? " Доставка по Україні та світу."
        : " Worldwide delivery."
      : "";
  const sentence = /[.!?…]$/.test(description) ? description : `${description}.`;
  return `${sentence}${skuTail}${deliveryTail}`;
}

/** Engine figures encoded in a RaceChip slug: `...-177hp-130kw-380nm`. */
export function parseRacechipSlugSpecs(
  slug: string
): { hp: number; kw: number; nm: number } | null {
  const match = /-(\d{2,4})hp-(\d{2,4})kw-(\d{2,4})nm$/.exec(slug);
  if (!match) return null;
  return { hp: Number(match[1]), kw: Number(match[2]), nm: Number(match[3]) };
}

/**
 * RaceChip variants of one car differ only by engine output, which the
 * product name omits, so many variants share an identical title. Put the
 * output into the title and description to make each one distinct.
 */
export function buildRacechipSeoMeta(input: {
  locale: Locale;
  slug: string;
  title: string;
  description?: string | null;
  sku?: string | null;
}): { title: string; description: string } {
  const isUa = input.locale === "ua";
  const specs = parseRacechipSlugSpecs(input.slug);
  const name = clean(input.title);
  const suffix = "RaceChip Ukraine";

  if (!specs) {
    return {
      title: buildProductSeoTitle({ title: name, brand: suffix }),
      description: buildProductSeoDescription({
        locale: input.locale,
        description: input.description,
        title: name,
        sku: input.sku,
        brand: "RaceChip",
      }),
    };
  }

  const power = isUa ? `${specs.hp} к.с.` : `${specs.hp} hp`;
  const stock = isUa
    ? `${specs.hp} к.с. / ${specs.kw} кВт / ${specs.nm} Нм`
    : `${specs.hp} hp / ${specs.kw} kW / ${specs.nm} Nm`;

  const titleWithPower = includesLabeledPower(name, specs.hp) ? name : `${name}, ${power}`;
  const title =
    `${titleWithPower} | ${suffix}`.length <= SEO_TITLE_MAX_LENGTH
      ? `${titleWithPower} | ${suffix}`
      : titleWithPower;

  const gain = clean(input.description);
  const lead = isUa ? `${name}: серійно ${stock}.` : `${name}: stock ${stock}.`;
  const description = gain
    ? `${lead} ${gain}${/[.!?…]$/.test(gain) ? "" : "."} ${
        isUa ? "Доставка по Україні." : "Delivery to Ukraine and worldwide."
      }`
    : `${lead} ${
        isUa
          ? "Чіп-тюнінг RaceChip GTS 5 з App Control. Доставка по Україні."
          : "RaceChip GTS 5 tuning module with App Control. Delivery to Ukraine and worldwide."
      }`;

  return { title, description };
}
