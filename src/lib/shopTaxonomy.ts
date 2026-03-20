import type { SupportedLocale } from '@/lib/seo';
import { localizeShopText } from '@/lib/shopText';

type LocalizedValue = {
  ua: string;
  en: string;
};

const SHOP_TAXONOMY_LABELS: Record<string, LocalizedValue> = {
  'productbase': { ua: 'Базовий продукт', en: 'Base product' },
  'bodykits': { ua: 'Обвіси', en: 'Body kits' },
  'exterior-styling': { ua: 'Зовнішній стайлінг', en: 'Exterior styling' },
  'front-bumper-add-ons': { ua: 'Накладки переднього бампера', en: 'Front bumper add-ons' },
  'side-skirts': { ua: 'Бічні пороги', en: 'Side skirts' },
  'spoilers': { ua: 'Спойлери', en: 'Spoilers' },
  'decal-and-lettering': { ua: 'Декалі та брендинг', en: 'Decals and branding' },
  'diffusers': { ua: 'Дифузори', en: 'Diffusers' },
  'exhaust': { ua: 'Вихлоп', en: 'Exhaust' },
  'floor-mats': { ua: 'Килимки', en: 'Floor mats' },
  'front-bumpers': { ua: 'Передні бампери', en: 'Front bumpers' },
  'grilles': { ua: 'Решітки', en: 'Grilles' },
  'hoods': { ua: 'Капоти', en: 'Hoods' },
  'rear-bumpers': { ua: 'Задні бампери', en: 'Rear bumpers' },
  'splitters': { ua: 'Спліттери', en: 'Splitters' },
  'tailpipes': { ua: 'Насадки вихлопу', en: 'Tailpipes' },
  'wheel-nuts': { ua: 'Колісні гайки', en: 'Wheel nuts' },
  'widebody-kits': { ua: 'Widebody комплекти', en: 'Widebody kits' },
};

function slugifyTaxonomyValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCaseAscii(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function localizeShopTaxonomyLabel(locale: SupportedLocale, value: LocalizedValue | string) {
  const source =
    typeof value === 'string'
      ? value
      : locale === 'ua'
        ? value.ua || value.en
        : value.en || value.ua;
  const normalized = slugifyTaxonomyValue(source);
  const mapped = SHOP_TAXONOMY_LABELS[normalized];

  if (mapped) {
    return localizeShopText(locale, mapped, { kind: 'label' });
  }

  if (typeof value !== 'string') {
    return localizeShopText(locale, value, { kind: 'label' });
  }

  return titleCaseAscii(source);
}

