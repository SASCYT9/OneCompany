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

export const SEO_TITLE_MAX_LENGTH = 95;

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

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Title without redundant parts. An admin-curated `seoTitle` always wins.
 * Otherwise: `<name> <SKU> | <brand>`, dropping the SKU, then the brand, when
 * the result would not fit the title limit or the part is already in the name.
 */
export function buildProductSeoTitle(input: {
  explicitTitle?: string | null;
  title: string;
  sku?: string | null;
  brand?: string | null;
  maxLength?: number;
}): string {
  const explicit = clean(input.explicitTitle);
  if (explicit) return explicit;

  const maxLength = input.maxLength ?? SEO_TITLE_MAX_LENGTH;
  const name = clean(input.title);
  const sku = clean(input.sku);
  const brand = clean(input.brand);

  const needsSku = Boolean(sku) && !includesNormalized(name, sku);
  const needsBrand = Boolean(brand) && !includesNormalized(name, brand);

  const candidates: string[] = [];
  if (needsSku && needsBrand) candidates.push(`${name} ${sku} | ${brand}`);
  if (needsSku) candidates.push(`${name} ${sku}`);
  if (needsBrand) candidates.push(`${name} | ${brand}`);
  candidates.push(name);

  return candidates.find((candidate) => candidate.length <= maxLength) ?? name;
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
  const explicit = clean(input.explicitDescription);
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

  const titleWithPower = includesNormalized(name, `${specs.hp}`) ? name : `${name}, ${power}`;
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
