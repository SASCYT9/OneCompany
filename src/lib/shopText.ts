import type { ShopProduct } from '@/lib/shopCatalog';
import type { SupportedLocale } from '@/lib/seo';
import { getUrbanProductTitleOverrideForLocale } from '@/lib/urbanProductOverrides';

type LocalizedValue = {
  ua: string;
  en: string;
};

export function containsCyrillic(value: string | null | undefined) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(String(value ?? ''));
}

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  nbsp: ' ',
  quot: '"',
  '#39': "'",
  '#x27': "'",
  '#34': '"',
  '#x22': '"',
  '#38': '&',
  '#x26': '&',
  '#160': ' ',
  '#xa0': ' ',
  '#8217': '’',
  '#x2019': '’',
};

export function decodeHtmlEntities(value: string | null | undefined) {
  return String(value ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = String(entity).toLowerCase();
    return HTML_ENTITY_MAP[normalized] ?? match;
  });
}

function normalizeWhitespace(value: string | null | undefined) {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

const UK_UA_TO_EN_GLOSSARY: Array<[RegExp, string]> = [
  [/аеродинамічний обвіс/gi, 'aerodynamic body kit'],
  [/аерокіт/gi, 'aero kit'],
  [/змінний кузов/gi, 'body conversion'],
  [/у зборі/gi, 'assembled'],
  [/в зборі/gi, 'assembled'],
  [/дюймові/gi, 'inch'],
  [/ковані диски/gi, 'forged wheels'],
  [/ковані/gi, 'forged'],
  [/візуальне вуглецеве волокно/gi, 'visual carbon fiber'],
  [/вуглецеве волокно/gi, 'carbon fiber'],
  [/карбонового/gi, 'carbon'],
  [/карбоновий/gi, 'carbon'],
  [/карбонова/gi, 'carbon'],
  [/карбонове/gi, 'carbon'],
  [/волокна/gi, 'fiber'],
  [/диски/gi, 'wheels'],
  [/комплект/gi, 'kit'],
  [/комплекти/gi, 'kits'],
  [/пара/gi, 'pair'],
  [/збірний/gi, 'assembled'],
  [/верхній/gi, 'upper'],
  [/нижній/gi, 'lower'],
  [/переднього/gi, 'front'],
  [/передньої/gi, 'front'],
  [/передній/gi, 'front'],
  [/заднього колеса/gi, 'rear wheel carrier'],
  [/заднього/gi, 'rear'],
  [/задньої стійки/gi, 'rear pillar'],
  [/задньої/gi, 'rear'],
  [/задній/gi, 'rear'],
  [/лівий/gi, 'left'],
  [/правий/gi, 'right'],
  [/бічний/gi, 'side'],
  [/даховий/gi, 'roof'],
  [/світловий/gi, 'light'],
  [/кластер/gi, 'cluster'],
  [/емблемою/gi, 'emblem'],
  [/оздоблення/gi, 'trim'],
  [/накладки/gi, 'trim pieces'],
  [/накладка/gi, 'trim piece'],
  [/кріплення/gi, 'mount'],
  [/спойлер/gi, 'spoiler'],
  [/бампер/gi, 'bumper'],
  [/капот/gi, 'hood'],
  [/решітка/gi, 'grille'],
  [/значок/gi, 'badge'],
  [/болт/gi, 'bolt'],
  [/колеса/gi, 'wheel'],
  [/конічний/gi, 'conical'],
  [/чорний/gi, 'black'],
  [/сатин чорний/gi, 'satin black'],
  [/срібний/gi, 'silver'],
  [/обід/gi, 'rim'],
  [/стійки/gi, 'pillar trims'],
  [/серії/gi, 'Series'],
];

const UKRAINIAN_TO_LATIN_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
  ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  А: 'A', Б: 'B', В: 'V', Г: 'H', Ґ: 'G', Д: 'D', Е: 'E', Є: 'Ye', Ж: 'Zh', З: 'Z', И: 'Y', І: 'I',
  Ї: 'Yi', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U',
  Ф: 'F', Х: 'Kh', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Shch', Ь: '', Ю: 'Yu', Я: 'Ya',
};

function transliterateUkrainian(value: string) {
  return value
    .split('')
    .map((char) => UKRAINIAN_TO_LATIN_MAP[char] ?? char)
    .join('');
}

function sentenceCaseWords(value: string) {
  return value
    .split(/(\s+|\/|-|–|—|\(|\))/)
    .map((part) => {
      if (!part || /^[\s/–—()_-]+$/.test(part)) return part;
      if (/^[A-Z0-9"'.]+$/.test(part)) return part;
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateShopTitleFromUa(value: string | null | undefined) {
  let next = normalizeWhitespace(value);
  if (!next) return '';

  for (const [pattern, replacement] of UK_UA_TO_EN_GLOSSARY) {
    next = next.replace(pattern, replacement);
  }

  next = next
    .replace(/\sта 2(\b|$)/giu, ' and 2$1')
    .replace(/\sта 1(\b|$)/giu, ' and 1$1')
    .replace(/\sта\s/giu, ' and ')
    .replace(/\sдля\s/giu, ' for ')
    .replace(/\sз\s/giu, ' with ');

  next = transliterateUkrainian(next)
    .replace(/\s+/g, ' ')
    .replace(/\s([/,-])/g, '$1')
    .replace(/([(/-])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return sentenceCaseWords(next);
}

function normalizeTitleForLookup(value: string | null | undefined) {
  return normalizeWhitespace(value).toLowerCase();
}

function titleHasAny(value: string, needles: string[]) {
  const normalized = normalizeTitleForLookup(value);
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

function appendTitleQualifier(baseTitle: string, qualifier: string) {
  const title = normalizeWhitespace(baseTitle);
  const suffix = normalizeWhitespace(qualifier);
  if (!title || !suffix || titleHasAny(title, [suffix])) return title;

  return `${title} - ${suffix}`;
}

function titleAlreadyImpliesUrbanQualifier(locale: SupportedLocale, title: string, qualifier: string) {
  if (locale !== 'ua') return false;

  const normalizedTitle = normalizeTitleForLookup(title);
  const normalizedQualifier = normalizeTitleForLookup(qualifier);
  if (normalizedQualifier === 'передній') return /передн/.test(normalizedTitle);
  if (normalizedQualifier === 'задній') return /задн/.test(normalizedTitle);
  if (normalizedQualifier === 'верхній') return /верхн/.test(normalizedTitle);
  if (normalizedQualifier === 'нижній') return /нижн/.test(normalizedTitle);
  if (normalizedQualifier === 'бічні вентиляційні елементи') {
    return /(боков|бічн).{0,32}вентиляц/.test(normalizedTitle);
  }

  return false;
}

function buildUrbanTitleQualifiers(locale: SupportedLocale, titleEn: string) {
  const en = normalizeTitleForLookup(titleEn);
  const qualifiers: string[] = [];
  const push = (ua: string, enValue: string, existingTokens: string[] = [enValue]) => {
    const value = locale === 'ua' ? ua : enValue;
    if (!qualifiers.includes(value) && !titleHasAny(qualifiers.join(' '), existingTokens)) {
      qualifiers.push(value);
    }
  };

  const looksLikeWheelFitment = /\b(wheel|wheels|rim|rims)\b/.test(en) || /\bet\s*[0-9]+/.test(en);
  if (/\bfront\b/.test(en)) push(looksLikeWheelFitment ? 'передня вісь' : 'передній', 'Front', ['front']);
  if (/\brear\b/.test(en)) push(looksLikeWheelFitment ? 'задня вісь' : 'задній', 'Rear', ['rear']);
  if (/\bupper\b/.test(en)) push('верхній', 'Upper', ['upper']);
  if (/\blower\b/.test(en)) push('нижній', 'Lower', ['lower']);
  if (/\blwb\b/.test(en)) push('LWB', 'LWB');
  if (/\bswb\b/.test(en)) push('SWB', 'SWB');
  if (/\bl1\b/.test(en)) push('L1', 'L1');
  if (/\bl2\b/.test(en)) push('L2', 'L2');
  if (/\bhex\b/.test(en)) push('Hex', 'Hex');
  if (/\bchequer\b/.test(en)) push('Chequer', 'Chequer');
  if (/\bpre[-\s]?facelift\b/.test(en)) push('Pre-Facelift', 'Pre-Facelift', ['pre-facelift', 'pre facelift']);
  if (/\bfacelift\b/.test(en) && !/\bpre[-\s]?facelift\b/.test(en)) push('Facelift', 'Facelift', ['facelift']);
  if (/\b2020\+/.test(en)) push('2020+', '2020+');
  if (/\b2017\s*-\s*2020\b/.test(en)) push('2017-2020', '2017-2020');
  if (/\b2013\s*-\s*2017\b/.test(en)) push('2013-2017', '2013-2017');
  if (/\b2018\s*-\s*2022\b/.test(en)) push('2018-2022', '2018-2022');
  if (/\b2018\s+onwards\b/.test(en)) push('2018+', '2018+');
  if (/\bpre\s*2017\b/.test(en)) push('до 2017', 'Pre 2017');
  if (/\bxrs\b/.test(en)) push('XRS', 'XRS');
  if (/\bsvr style\b/.test(en)) push('SVR Style', 'SVR Style');
  if (/-\s*svr\s*-|\(svr\b|\bsvr\s*\(/.test(en)) push('версія SVR', 'SVR version');
  if (/-\s*sport\s*-|\(sport\b|\bsport\s*\(/.test(en)) push('версія Sport', 'Sport version');
  if (/\bnon visual carbon\b/.test(en)) push('Non Visual Carbon', 'Non Visual Carbon');
  if (/\bpolished face\b/.test(en)) push('Polished Face', 'Polished Face');
  if (/\bside vents?\b/.test(en)) push('бічні вентиляційні елементи', 'Side Vents');
  if (/\btop vents?\b/.test(en)) push('верхні вентиляційні елементи', 'Top Vents');
  if (/\bb9\.5\b/.test(en)) push('покоління B9.5', 'B9.5 generation');
  if (/\bb9\b/.test(en) && !/\bb9\.5\b/.test(en)) push('покоління B9', 'B9 generation');
  if (/\btuning fork\b/.test(en)) push('tuning fork', 'Tuning Fork');
  if (/\beyebrow\b/.test(en)) push('eyebrow', 'Eyebrow');
  if (/\bdiscovery\s+5\.5\b/.test(en)) push('Discovery 5.5', 'Discovery 5.5');
  if (/\bsaloon\b/.test(en)) push('Saloon', 'Saloon');
  if (/\bhatchback\b/.test(en)) push('Hatchback', 'Hatchback');
  if (/\bseries\s+1\b/.test(en)) push('Series 1', 'Series 1');
  if (/\bseries\s+2\b/.test(en)) push('Series 2', 'Series 2');
  if (/\bplain\b/.test(en) && /\burban shield\b/.test(en)) push('Plain або Urban Shield', 'Plain or Urban Shield');
  if (/\boem splitter\b/.test(en)) {
    push(/\bwithout\b/.test(en) ? 'без OEM splitter' : 'з OEM splitter', /\bwithout\b/.test(en) ? 'without OEM splitter' : 'with OEM splitter');
  }

  const etMatches = [...en.matchAll(/\bet\s*([0-9]+)/g)].map((match) => `ET${match[1]}`);
  for (const et of etMatches) push(et, et);

  const spacerMatch = en.match(/\b([0-9]{2})\s*mm\b/);
  if (spacerMatch) push(`${spacerMatch[1]} мм`, `${spacerMatch[1]}mm`, [`${spacerMatch[1]}mm`, `${spacerMatch[1]} мм`]);

  if (/\bd-pillar trim\b/.test(en)) push('D-Pillar', 'D-Pillar');
  if (/\bbumper intake trims?\b/.test(en)) push('впуски бампера', 'Bumper Intake Trims');
  if (/\bupper turning signal trim\b/.test(en)) push('верхні повторювачі повороту', 'Upper Turning Signal Trim');
  if (/\bwing mirrors?\b/.test(en)) push('корпуси дзеркал', 'Wing Mirrors');
  if (/\bbumper overrider set\b/.test(en)) push('over-rider, 4 шт.', 'Bumper Overrider Set');
  if (/\bskid pan cover\b/.test(en)) push('skid pan', 'Skid Pan Cover');

  return qualifiers;
}

function disambiguateUrbanTitle(locale: SupportedLocale, product: Pick<ShopProduct, 'slug' | 'title'>, baseTitle: string) {
  if (!product.slug.startsWith('urb-')) return baseTitle;

  let title = normalizeWhitespace(baseTitle);
  const titleEn = normalizeWhitespace(product.title.en);
  for (const qualifier of buildUrbanTitleQualifiers(locale, titleEn)) {
    if (!titleHasAny(title, [qualifier]) && !titleAlreadyImpliesUrbanQualifier(locale, title, qualifier)) {
      title = appendTitleQualifier(title, qualifier);
    }
  }

  return title;
}

function humanizeSlug(slug: string) {
  const raw = normalizeWhitespace(slug)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return '';

  const brandTokens = new Set([
    'BMW', 'Audi', 'Bentley', 'Mercedes', 'Benz', 'Rolls', 'Royce', 'Lamborghini', 'Land', 'Rover',
    'Range', 'Volkswagen', 'Porsche', 'Ferrari', 'Urus', 'Cullinan', 'Defender', 'Urban', 'Automotive',
    'RSQ8', 'RS6', 'RS7', 'RS4', 'RS3', 'G', 'Class', 'W465', 'L460', 'L461', 'L494', 'UAE', 'SUV', 'OEM',
    'UV', 'UF', 'MK', 'SportContact', 'Continental'
  ]);

  return raw
    .split(' ')
    .filter(Boolean)
    .map((token) => {
      if (/^\d+[a-z]{0,3}$/i.test(token) || /^[a-z]{1,4}\d+[a-z0-9-]*$/i.test(token) || /^[A-Z0-9/-]+$/.test(token)) {
        return token.toUpperCase();
      }
      if (brandTokens.has(token)) {
        return token;
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(' ');
}

export function localizeShopText(
  locale: SupportedLocale,
  value: LocalizedValue,
  options?: {
    slugFallback?: string;
    emptyIfCyrillicInEn?: boolean;
  }
) {
  const ua = normalizeWhitespace(value.ua);
  const en = normalizeWhitespace(value.en);

  if (locale === 'ua') {
    return ua || en;
  }

  if (en && !containsCyrillic(en)) {
    return en;
  }

  if (options?.emptyIfCyrillicInEn) {
    return '';
  }

  if (options?.slugFallback) {
    const slugTitle = humanizeSlug(options.slugFallback);
    if (slugTitle) {
      return slugTitle;
    }
  }

  return en || ua;
}

// DO88 title fixes for known supplier-data typos. Cheaper than a per-SKU
// override table — just one regex covers the recurring pattern.
function fixDo88TitleTypos(title: string): string {
  if (!title) return title;
  // "Audi RS6 RS7 8C" → "Audi RS6 RS7 C8" (chassis code is C8, not 8C)
  return title.replace(/\bRS([67](?:\s+RS[67])?)\s+8C\b/gi, 'RS$1 C8');
}

// Öhlins ships every product with a leading internal SKU pattern in its title:
//   "OHLINS BMV GX11 Комплект койловерів ..."
//   "OHLINS POS 6Y10 Амортизатор задній ..."
// The prefix is brand + 2–4-letter family (BMV/BMS/POV/POS/HOV/HOS/TOV/TOS/NIS/
// SUS/TES/VWS/LOV/ALV/FOV/SUV...) + 4–8-char SKU. None of it is meaningful to a
// retail buyer — the brand badge sits on the card already, and product.sku
// retains the full code for search and B2B reference.
function stripOhlinsSkuPrefix(title: string): string {
  if (!title) return title;
  return title.replace(
    /^\s*ÖHLINS\s+[A-Z]{2,4}\s+[A-Z0-9-]{3,10}\s+/i,
    ''
  ).replace(
    /^\s*OHLINS\s+[A-Z]{2,4}\s+[A-Z0-9-]{3,10}\s+/i,
    ''
  );
}

/**
 * Patches Ukrainian descriptions where the supplier left English fragments
 * mid-sentence (mostly GFB / VTA boost-control valve listings).
 */
export function fixDo88UaDescriptionFragments(value: string): string {
  if (!value) return value;
  let out = value;
  // English connector "and" between two tokens → "та"
  // Accept any letter/digit on either side (model codes are upper/lower/digits).
  out = out.replace(/([\p{L}\p{N}])\s+and\s+([\p{L}\p{N}])/gu, '$1 та $2');
  // Common phrase fragments left in English
  out = out
    .replace(/\bLate-Model\b/gi, 'останнього покоління')
    .replace(/\bModels\b\.?/g, 'моделі')
    .replace(/\bSuits\b/g, 'Підходить для');
  return out;
}

function applyDo88LocaleFixes(locale: SupportedLocale, value: string): string {
  if (!value) return value;
  let out = fixDo88TitleTypos(value);
  if (locale === 'ua') {
    out = fixDo88UaDescriptionFragments(out);
  }
  return out;
}

function applyShopTitleFixes(
  locale: SupportedLocale,
  product: Pick<ShopProduct, 'slug' | 'brand' | 'vendor'>,
  title: string
): string {
  let out = applyDo88LocaleFixes(locale, title);
  const brand = (product.brand || product.vendor || '').toLowerCase();
  const isOhlins =
    brand === 'ohlins' || brand === 'öhlins' || product.slug.startsWith('ohlins-');
  if (isOhlins) {
    out = stripOhlinsSkuPrefix(out);
  }
  return out;
}

export function localizeShopProductTitle(
  locale: SupportedLocale,
  product: Pick<ShopProduct, 'slug' | 'title' | 'brand' | 'vendor'>
) {
  const overrideTitle = getUrbanProductTitleOverrideForLocale(product.slug, locale);
  if (overrideTitle) {
    return applyShopTitleFixes(locale, product, overrideTitle);
  }

  if (locale === 'en') {
    const translatedFromDb = normalizeWhitespace(product.title.en);
    if (translatedFromDb && !containsCyrillic(translatedFromDb)) {
      return applyShopTitleFixes(locale, product, disambiguateUrbanTitle(locale, product, translatedFromDb));
    }

    const translatedFromUa = translateShopTitleFromUa(product.title.ua);
    if (translatedFromUa && !containsCyrillic(translatedFromUa)) {
      return applyShopTitleFixes(locale, product, disambiguateUrbanTitle(locale, product, translatedFromUa));
    }
  }

  return applyShopTitleFixes(
    locale,
    product,
    disambiguateUrbanTitle(locale, product, localizeShopText(locale, product.title, { slugFallback: product.slug }))
  );
}

export function localizeShopDescription(
  locale: SupportedLocale,
  value: LocalizedValue
) {
  const text = localizeShopText(locale, value, {
    emptyIfCyrillicInEn: locale === 'en',
  });
  return locale === 'ua' ? fixDo88UaDescriptionFragments(text) : text;
}
