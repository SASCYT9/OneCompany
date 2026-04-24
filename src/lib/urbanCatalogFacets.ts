import { URBAN_COLLECTION_BRANDS, URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { resolveShopProductPricing } from '@/lib/shopPricingAudience';
import { localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
import { getUrbanCollectionHandleForProduct } from '@/lib/urbanCollectionMatcher';

export type UrbanCatalogFamily =
  | 'bodykits'
  | 'exterior'
  | 'wheels'
  | 'exhaust'
  | 'interior'
  | 'accessories';

export type UrbanModelFacet = {
  handle: string;
  label: string;
  brand: string;
  order: number;
};

export type UrbanCatalogEntry = {
  product: ShopProduct;
  title: string;
  brand: string;
  modelHandles: string[];
  modelFacets: UrbanModelFacet[];
  primaryModelHandle: string;
  primaryModelLabel: string;
  categoryLabel: string;
  family: UrbanCatalogFamily;
  isBodykit: boolean;
  bodykitRank: number;
  searchableText: string;
  sortablePrice: number;
  modelOrder: number;
  brandOrder: number;
};

export const URBAN_FAMILY_ORDER: UrbanCatalogFamily[] = [
  'bodykits',
  'exterior',
  'wheels',
  'exhaust',
  'interior',
  'accessories',
];

const CARD_BY_HANDLE = new Map(
  URBAN_COLLECTION_CARDS.map((card, index) => [
    card.collectionHandle,
    {
      ...card,
      order: index,
    },
  ])
);

const BRAND_ORDER = new Map<string, number>(
  URBAN_COLLECTION_BRANDS.map((brand, index) => [brand, index])
);

const BODYKIT_REGEX =
  /(body\s?kit|bodykits|bodykit|aero\s?kit|aerokit|widebody|widetrack|wide\s?track|обвіс|обвіси|аеродинамічний обвіс|кузовний обвіс|комплект обвіс|body conversion|bundle)/i;
const WHEEL_REGEX =
  /(wheel|wheels|wheel nut|wheel nuts|wheel spacer|wheel spacers|spacer|spacers|tyre|tyres|rim|rims|диск|диски|гайк|болт|проставк)/i;
const EXHAUST_REGEX = /(exhaust|tailpipe|tailpipes|вихлоп|насадк)/i;
const INTERIOR_REGEX = /(interior|floor mat|floor mats|interior kit|салон|килим|килимк)/i;
const ACCESSORY_REGEX =
  /(accessor|additional options|electrics|number plate|decal|lettering|logo|logos|cover|covers|mudguard|mudguards|trim|trims|option|options|аксесуар|електрик|наклейк|логотип)/i;
const EXPLICIT_BODYKIT_CATEGORY_REGEX =
  /(body\s?kit|bodykits|bodykit|widebody|wide\s?track|widetrack|bundle|bundles|arch|arches|wheel arches|обвіс|обвіси|widebody комплекти|комплект|комплекти|арки)/i;
const EXPLICIT_EXTERIOR_COMPONENT_REGEX =
  /(hood|hoods|bonnet|spoiler|spoilers|splitter|splitters|grille|grilles|mirror cap|mirror caps|mirror cover|mirror covers|vent|vents|roof light|roof lights|canard|canards|canard packs|diffuser|diffusers|side skirt|side skirts|side step|side steps|front lip|front lips|bumper add-ons|капот|капоти|спойлер|спойлери|спліттер|спліттери|решіт|дзеркал|вентиляц|дахове світло|канард|дифузор|пороги|підніжк)/i;

const EXACT_CATEGORY_UA_MAP: Record<string, string> = {
  accessories: 'Аксесуари',
  arches: 'Арки',
  bodykits: 'Обвіси',
  branding: 'Брендинг',
  bundles: 'Комплекти',
  'canard packs': 'Комплекти канардів',
  'car parts': 'Компоненти',
  covers: 'Накладки',
  'decal and lettering': 'Декалі та летеринг',
  decals: 'Декор',
  diffusers: 'Дифузори',
  'door inserts': 'Вставки дверей',
  electrics: 'Електрика',
  exhaust: 'Вихлоп',
  'front bumper add-ons': 'Накладки переднього бампера',
  'front bumpers': 'Передні бампери',
  'front lips': 'Передні спліттери',
  'floor mats': 'Килимки',
  grilles: 'Решітки',
  hoods: 'Капоти',
  interior: "Інтер'єр",
  'interior kit': "Комплект інтер'єру",
  'key chain': 'Брелоки',
  'light bars': 'Світлові модулі',
  lights: 'Світло',
  logos: 'Логотипи',
  'mirror caps': 'Накладки дзеркал',
  'mirror covers': 'Накладки дзеркал',
  mudflaps: 'Бризковики',
  mudguards: 'Бризковики',
  'number plate kits': 'Комплекти номерної рамки',
  'rear spoilers': 'Задні спойлери',
  roofs: 'Дахи',
  'roof lights': 'Дахове світло',
  'side panels': 'Бокові панелі',
  'side skirts': 'Бічні спідниці',
  'side steps': 'Підніжки',
  sills: 'Пороги',
  'side vents': 'Бокові вентиляційні елементи',
  spoilers: 'Спойлери',
  splitters: 'Спліттери',
  'tailgates trim': 'Накладки багажника',
  tailpipes: 'Насадки вихлопу',
  trims: 'Оздоблення',
  vents: 'Вентиляційні елементи',
  'wheel arches': 'Колісні арки',
  'wheel spacers': 'Колісні проставки',
  'wheel nuts': 'Колісні гайки',
  wheels: 'Диски',
  'wheel hardware': 'Колісна фурнітура',
  widebody: 'Widebody комплекти',
  'widebody kits': 'Widebody комплекти',
  productbase: 'Базовий товар',
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeUrbanCatalogValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getStructuredUrbanFamily(tags: string[] | undefined) {
  const token = (tags ?? []).find((tag) => tag.startsWith('urban-family:'));
  if (!token) return null;

  const family = token.slice('urban-family:'.length).trim() as UrbanCatalogFamily;
  return URBAN_FAMILY_ORDER.includes(family) ? family : null;
}

export function inferUrbanFamilyFromValues(values: string[]) {
  const haystack = normalizeUrbanCatalogValue(values.join(' '));

  if (WHEEL_REGEX.test(haystack)) return 'wheels';
  if (EXHAUST_REGEX.test(haystack)) return 'exhaust';
  if (INTERIOR_REGEX.test(haystack)) return 'interior';
  if (ACCESSORY_REGEX.test(haystack)) return 'accessories';
  if (BODYKIT_REGEX.test(haystack)) return 'bodykits';
  return 'exterior';
}

function inferUrbanFamilyFromExplicitTypeValues(values: string[]) {
  const haystack = normalizeUrbanCatalogValue(values.join(' '));

  if (WHEEL_REGEX.test(haystack)) return 'wheels';
  if (EXHAUST_REGEX.test(haystack)) return 'exhaust';
  if (INTERIOR_REGEX.test(haystack)) return 'interior';
  if (ACCESSORY_REGEX.test(haystack)) return 'accessories';
  if (EXPLICIT_EXTERIOR_COMPONENT_REGEX.test(haystack)) return 'exterior';
  if (EXPLICIT_BODYKIT_CATEGORY_REGEX.test(haystack)) return 'bodykits';
  return null;
}

export function getUrbanProductFamily(product: Pick<ShopProduct, 'tags' | 'productType' | 'category' | 'title' | 'collection'>) {
  const explicitTypeFamily = inferUrbanFamilyFromExplicitTypeValues([
    product.productType || '',
    product.category.en,
    product.category.ua,
  ]);

  if (explicitTypeFamily) {
    return explicitTypeFamily;
  }

  return (
    getStructuredUrbanFamily(product.tags) ??
    inferUrbanFamilyFromValues([
      product.productType || '',
      product.category.en,
      product.category.ua,
      product.title.en,
      product.title.ua,
      product.collection.en,
      product.collection.ua,
      ...(product.tags || []),
    ])
  );
}

export function structuredUrbanFamilyTag(family: UrbanCatalogFamily) {
  return `urban-family:${family}`;
}

export function getUrbanExactCategoryUa(labelEn: string | null | undefined) {
  const normalized = normalizeUrbanCatalogValue(String(labelEn ?? ''));
  const mapped = EXACT_CATEGORY_UA_MAP[normalized] ?? null;

  return {
    label: mapped ?? (labelEn ? normalizeWhitespace(labelEn) : null),
    isFallback: !mapped,
  };
}

export function getUrbanModelFacetsFromHandles(handles: string[]) {
  return handles
    .map((handle) => {
      const card = CARD_BY_HANDLE.get(handle);
      if (!card) return null;

      return {
        handle,
        label: card.title,
        brand: card.brand,
        order: card.order,
      } satisfies UrbanModelFacet;
    })
    .filter((item): item is UrbanModelFacet => Boolean(item))
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      return left.label.localeCompare(right.label, 'en');
    });
}

export function getUrbanModelFacets(product: ShopProduct) {
  const linkedModels = (product.collections ?? [])
    .filter((collection) => collection.isUrban && CARD_BY_HANDLE.has(collection.handle))
    .map((collection) => collection.handle);

  const directFacets = linkedModels
    .map((handle) => {
      const card = CARD_BY_HANDLE.get(handle);
      if (!card) return null;

      return {
        handle,
        label: card.title,
        brand: card.brand,
        order: card.order,
      } satisfies UrbanModelFacet;
    })
    .filter((item): item is UrbanModelFacet => Boolean(item));
  if (directFacets.length) {
    return directFacets;
  }

  const fallbackHandle = getUrbanCollectionHandleForProduct(product);
  return fallbackHandle ? getUrbanModelFacetsFromHandles([fallbackHandle]) : [];
}

function primaryPrice(price: ShopProduct['price']) {
  return price.eur || price.usd || price.uah || 0;
}

function inferBodykitRank(product: ShopProduct, family: UrbanCatalogFamily) {
  if (family !== 'bodykits') {
    return 50 + URBAN_FAMILY_ORDER.indexOf(family);
  }

  const typeHaystack = normalizeUrbanCatalogValue(
    [product.productType || '', product.category.en, product.category.ua].join(' ')
  );
  const titleHaystack = normalizeUrbanCatalogValue(
    [product.title.en, product.title.ua, product.collection.en, product.collection.ua].join(' ')
  );

  if (/\bbodykits?\b|\bbodykit\b|widebody/i.test(typeHaystack)) return 0;
  if (/\bbundles?\b/i.test(typeHaystack)) return 1;
  if (
    /widetrack|wide\s?track|aero\s?kit|aerokit|кузовний обвіс|аеродинамічний обвіс/i.test(
      titleHaystack
    )
  ) {
    return 2;
  }
  if (/kit|комплект/i.test(titleHaystack)) return 3;
  return 4;
}

export function buildUrbanCatalogEntries({
  locale,
  products,
  viewerContext,
}: {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
}) {
  const isUa = locale === 'ua';

  return products.map((product) => {
    const modelFacets = getUrbanModelFacets(product);
    const primaryModel = modelFacets[0] ?? null;
    const title = localizeShopProductTitle(locale, product);
    const family = getUrbanProductFamily(product);
    const pricing = viewerContext ? resolveShopProductPricing(product, viewerContext) : null;
    const categoryLabel =
      localizeShopText(locale, product.category) ||
      product.productType ||
      (isUa ? 'Urban компонент' : 'Urban component');
    const brand = product.brand || primaryModel?.brand || (isUa ? 'Інші Urban' : 'Other Urban');
    const primaryModelLabel =
      primaryModel?.label ||
      localizeShopText(locale, product.collection) ||
      (isUa ? 'Інші Urban компоненти' : 'Other Urban Components');

    const searchableText = normalizeUrbanCatalogValue(
      [
        title,
        categoryLabel,
        brand,
        primaryModelLabel,
        product.sku,
        product.productType || '',
        product.shortDescription.en,
        product.shortDescription.ua,
        ...modelFacets.map((facet) => facet.label),
        ...(product.tags || []),
      ].join(' ')
    );

    return {
      product,
      title,
      brand,
      modelHandles: modelFacets.map((facet) => facet.handle),
      modelFacets,
      primaryModelHandle: primaryModel?.handle ?? 'other-urban',
      primaryModelLabel,
      categoryLabel,
      family,
      isBodykit: family === 'bodykits',
      bodykitRank: inferBodykitRank(product, family),
      searchableText,
      sortablePrice: primaryPrice(pricing?.effectivePrice ?? product.price),
      modelOrder: primaryModel?.order ?? 999,
      brandOrder: BRAND_ORDER.get(brand) ?? 999,
    } satisfies UrbanCatalogEntry;
  });
}
