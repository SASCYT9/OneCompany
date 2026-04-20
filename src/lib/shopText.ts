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

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
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

export function localizeShopProductTitle(locale: SupportedLocale, product: Pick<ShopProduct, 'slug' | 'title'>) {
  const overrideTitle = getUrbanProductTitleOverrideForLocale(product.slug, locale);
  if (overrideTitle) {
    return overrideTitle;
  }

  if (locale === 'en') {
    const translatedFromDb = normalizeWhitespace(product.title.en);
    if (translatedFromDb && !containsCyrillic(translatedFromDb)) {
      return translatedFromDb;
    }

    const translatedFromUa = translateShopTitleFromUa(product.title.ua);
    if (translatedFromUa && !containsCyrillic(translatedFromUa)) {
      return translatedFromUa;
    }
  }

  return localizeShopText(locale, product.title, { slugFallback: product.slug });
}

export function localizeShopDescription(
  locale: SupportedLocale,
  value: LocalizedValue
) {
  return localizeShopText(locale, value, {
    emptyIfCyrillicInEn: locale === 'en',
  });
}
