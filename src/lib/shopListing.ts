import type { SupportedLocale } from '@/lib/seo';
import type { ShopMoneySet, ShopProduct } from '@/lib/shopCatalog';
import { localizeShopText } from '@/lib/shopText';
import { localizeShopTaxonomyLabel } from '@/lib/shopTaxonomy';

export type ShopListingSortMode = 'featured' | 'newest' | 'priceLow' | 'priceHigh';
export type ShopListingAvailability = 'all' | 'inStock' | 'preOrder';

export type ShopListingQueryState = {
  q: string;
  sort: ShopListingSortMode;
  brand: string;
  category: string;
  tag: string;
  priceMin: number | null;
  priceMax: number | null;
  availability: ShopListingAvailability;
  store: string;
  collection: string;
};

export type ShopListingFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type ShopListingResult = {
  products: ShopProduct[];
  total: number;
  sort: ShopListingSortMode;
  appliedFilters: ShopListingQueryState;
  availableFilters: {
    brands: ShopListingFilterOption[];
    categories: ShopListingFilterOption[];
    tags: ShopListingFilterOption[];
    availability: ShopListingFilterOption[];
    priceRange: {
      min: number | null;
      max: number | null;
    };
  };
};

type QueryValue = string | string[] | undefined | null;
type QueryInput = URLSearchParams | Record<string, QueryValue>;

type ListingRates = {
  EUR: number;
  USD: number;
} | null;

type BuildShopListingResultOptions = {
  locale: SupportedLocale;
  currency: 'UAH' | 'EUR' | 'USD';
  rates: ListingRates;
  query: ShopListingQueryState;
  featuredComparator?: (left: ShopProduct, right: ShopProduct) => number;
};

export const SHOP_LISTING_DEFAULTS: ShopListingQueryState = {
  q: '',
  sort: 'featured',
  brand: 'all',
  category: 'all',
  tag: 'all',
  priceMin: null,
  priceMax: null,
  availability: 'all',
  store: '',
  collection: '',
};

const VALID_SORT_MODES = new Set<ShopListingSortMode>(['featured', 'newest', 'priceLow', 'priceHigh']);
const VALID_AVAILABILITY = new Set<ShopListingAvailability>(['all', 'inStock', 'preOrder']);

export const SHOP_FEATURED_BRAND_ORDER = [
  'Akrapovic',
  'KW Suspension',
  'Eventuri',
  'FI Exhaust',
  'Brembo',
  'HRE wheels',
  'Termignoni',
  'Ohlins',
  'SC-Project',
  'Rizoma',
  'Rotobox',
  'Jetprime',
] as const;

function getFirstQueryValue(input: QueryInput, key: string) {
  if (input instanceof URLSearchParams) {
    return input.get(key);
  }

  const raw = input[key];
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }

  return raw ?? null;
}

function normalizeString(value: string | null | undefined, fallback = '') {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizePositiveNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function slugifyValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getShopProductCategoryValue(product: ShopProduct) {
  const localizedSource = product.category.en || product.category.ua;
  return product.categoryNode?.slug || slugifyValue(localizedSource);
}

export function getShopProductCategoryLabel(product: ShopProduct, locale: SupportedLocale) {
  return localizeShopTaxonomyLabel(locale, product.category);
}

export function normalizeShopListingQuery(
  input: QueryInput,
  overrides: Partial<ShopListingQueryState> = {}
): ShopListingQueryState {
  const q = normalizeString(getFirstQueryValue(input, 'q'), overrides.q ?? SHOP_LISTING_DEFAULTS.q);
  const sortCandidate = normalizeString(getFirstQueryValue(input, 'sort'), overrides.sort ?? SHOP_LISTING_DEFAULTS.sort);
  const availabilityCandidate = normalizeString(
    getFirstQueryValue(input, 'availability'),
    overrides.availability ?? SHOP_LISTING_DEFAULTS.availability
  );

  let priceMin = normalizePositiveNumber(getFirstQueryValue(input, 'priceMin'));
  let priceMax = normalizePositiveNumber(getFirstQueryValue(input, 'priceMax'));

  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  return {
    q,
    sort: VALID_SORT_MODES.has(sortCandidate as ShopListingSortMode)
      ? (sortCandidate as ShopListingSortMode)
      : (overrides.sort ?? SHOP_LISTING_DEFAULTS.sort),
    brand: normalizeString(getFirstQueryValue(input, 'brand'), overrides.brand ?? SHOP_LISTING_DEFAULTS.brand),
    category: normalizeString(getFirstQueryValue(input, 'category'), overrides.category ?? SHOP_LISTING_DEFAULTS.category),
    tag: normalizeString(getFirstQueryValue(input, 'tag'), overrides.tag ?? SHOP_LISTING_DEFAULTS.tag),
    priceMin: priceMin ?? overrides.priceMin ?? SHOP_LISTING_DEFAULTS.priceMin,
    priceMax: priceMax ?? overrides.priceMax ?? SHOP_LISTING_DEFAULTS.priceMax,
    availability: VALID_AVAILABILITY.has(availabilityCandidate as ShopListingAvailability)
      ? (availabilityCandidate as ShopListingAvailability)
      : (overrides.availability ?? SHOP_LISTING_DEFAULTS.availability),
    store: normalizeString(getFirstQueryValue(input, 'store'), overrides.store ?? SHOP_LISTING_DEFAULTS.store),
    collection: normalizeString(getFirstQueryValue(input, 'collection'), overrides.collection ?? SHOP_LISTING_DEFAULTS.collection),
  };
}

export function buildFeaturedBrandComparator(brandOrder = SHOP_FEATURED_BRAND_ORDER) {
  const order = new Map<string, number>(brandOrder.map((brand, index) => [brand.toLowerCase(), index]));

  return (left: ShopProduct, right: ShopProduct) => {
    const leftOrder = order.get(left.brand.toLowerCase()) ?? 999;
    const rightOrder = order.get(right.brand.toLowerCase()) ?? 999;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.brand.localeCompare(right.brand);
  };
}

function resolveComparablePriceValue(
  price: ShopMoneySet,
  currency: BuildShopListingResultOptions['currency'],
  rates: ListingRates
) {
  if (currency === 'UAH') {
    return price.uah;
  }

  if (currency === 'EUR') {
    return rates && price.uah > 0 ? price.uah / rates.EUR : price.eur;
  }

  return rates && price.uah > 0 ? price.uah / rates.USD : price.usd;
}

function resolveNewestTimestamp(product: ShopProduct) {
  const timestampSource = product.createdAt || product.updatedAt;
  if (!timestampSource) {
    return 0;
  }

  const timestamp = Date.parse(timestampSource);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function buildShopListingResult(
  products: ShopProduct[],
  options: BuildShopListingResultOptions
): ShopListingResult {
  const { locale, currency, rates, query, featuredComparator } = options;
  const queryNeedle = query.q.trim().toLowerCase();

  const contextualProducts = products.filter((product) => {
    if (query.store && product.storeKey && product.storeKey !== query.store) {
      return false;
    }

    if (query.collection && !product.collections?.some((entry) => entry.handle === query.collection)) {
      return false;
    }

    return true;
  });

  const brandMap = new Map<string, ShopListingFilterOption>();
  const categoryMap = new Map<string, ShopListingFilterOption>();
  const tagMap = new Map<string, ShopListingFilterOption>();
  const availabilityMap = new Map<string, ShopListingFilterOption>();
  let priceRangeMin: number | null = null;
  let priceRangeMax: number | null = null;

  contextualProducts.forEach((product) => {
    const priceValue = resolveComparablePriceValue(product.price, currency, rates);
    priceRangeMin = priceRangeMin == null ? priceValue : Math.min(priceRangeMin, priceValue);
    priceRangeMax = priceRangeMax == null ? priceValue : Math.max(priceRangeMax, priceValue);

    const brandExisting = brandMap.get(product.brand);
    brandMap.set(product.brand, {
      value: product.brand,
      label: product.brand,
      count: (brandExisting?.count ?? 0) + 1,
    });

    const categoryValue = getShopProductCategoryValue(product);
    const categoryLabel = getShopProductCategoryLabel(product, locale);
    const categoryExisting = categoryMap.get(categoryValue);
    categoryMap.set(categoryValue, {
      value: categoryValue,
      label: categoryLabel,
      count: (categoryExisting?.count ?? 0) + 1,
    });

    (product.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => {
        const tagLabel = localizeShopTaxonomyLabel(locale, tag);
        const tagExisting = tagMap.get(tag);
        tagMap.set(tag, {
          value: tag,
          label: tagLabel,
          count: (tagExisting?.count ?? 0) + 1,
        });
      });

    const availabilityValue = product.stock === 'preOrder' ? 'preOrder' : 'inStock';
    const availabilityLabel =
      availabilityValue === 'inStock'
        ? locale === 'ua'
          ? 'В наявності'
          : 'In stock'
        : locale === 'ua'
          ? 'Під замовлення'
          : 'Pre-order';
    const availabilityExisting = availabilityMap.get(availabilityValue);
    availabilityMap.set(availabilityValue, {
      value: availabilityValue,
      label: availabilityLabel,
      count: (availabilityExisting?.count ?? 0) + 1,
    });
  });

  const filtered = contextualProducts
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => {
      if (query.brand !== 'all' && product.brand !== query.brand) {
        return false;
      }

      if (query.category !== 'all' && getShopProductCategoryValue(product) !== query.category) {
        return false;
      }

      if (query.tag !== 'all' && !(product.tags ?? []).includes(query.tag)) {
        return false;
      }

      if (query.availability !== 'all' && product.stock !== query.availability) {
        return false;
      }

      const priceValue = resolveComparablePriceValue(product.price, currency, rates);
      if (query.priceMin != null && priceValue < query.priceMin) {
        return false;
      }

      if (query.priceMax != null && priceValue > query.priceMax) {
        return false;
      }

      if (!queryNeedle) {
        return true;
      }

      const title = localizeShopText(locale, product.title, { kind: 'title' }).toLowerCase();
      const shortDescription = localizeShopText(locale, product.shortDescription, { kind: 'description' }).toLowerCase();
      const longDescription = localizeShopText(locale, product.longDescription, { kind: 'description' }).toLowerCase();
      const categoryLabel = getShopProductCategoryLabel(product, locale).toLowerCase();
      const collectionLabel = localizeShopText(locale, product.collection, { kind: 'label' }).toLowerCase();
      const tagLabels = (product.tags ?? []).map((tag) => localizeShopTaxonomyLabel(locale, tag).toLowerCase());

      return (
        title.includes(queryNeedle) ||
        shortDescription.includes(queryNeedle) ||
        longDescription.includes(queryNeedle) ||
        product.brand.toLowerCase().includes(queryNeedle) ||
        categoryLabel.includes(queryNeedle) ||
        collectionLabel.includes(queryNeedle) ||
        tagLabels.some((tag) => tag.includes(queryNeedle))
      );
    });

  filtered.sort((left, right) => {
    if (query.sort === 'priceLow' || query.sort === 'priceHigh') {
      const leftPrice = resolveComparablePriceValue(left.product.price, currency, rates);
      const rightPrice = resolveComparablePriceValue(right.product.price, currency, rates);
      if (leftPrice !== rightPrice) {
        return query.sort === 'priceLow' ? leftPrice - rightPrice : rightPrice - leftPrice;
      }
    } else if (query.sort === 'newest') {
      const leftTimestamp = resolveNewestTimestamp(left.product);
      const rightTimestamp = resolveNewestTimestamp(right.product);
      if (leftTimestamp !== rightTimestamp) {
        return rightTimestamp - leftTimestamp;
      }
    } else if (featuredComparator) {
      const featuredOrder = featuredComparator(left.product, right.product);
      if (featuredOrder !== 0) {
        return featuredOrder;
      }
    }

    return left.index - right.index;
  });

  return {
    products: filtered.map((entry) => entry.product),
    total: filtered.length,
    sort: query.sort,
    appliedFilters: query,
    availableFilters: {
      brands: Array.from(brandMap.values()).sort((left, right) => {
        const brandOrder = featuredComparator
          ? featuredComparator(
              { brand: left.value } as ShopProduct,
              { brand: right.value } as ShopProduct
            )
          : 0;
        if (brandOrder !== 0 && Number.isFinite(brandOrder)) {
          return brandOrder;
        }

        return right.count - left.count || left.label.localeCompare(right.label);
      }),
      categories: Array.from(categoryMap.values()).sort(
        (left, right) => right.count - left.count || left.label.localeCompare(right.label)
      ),
      tags: Array.from(tagMap.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
      availability: Array.from(availabilityMap.values()).sort((left, right) => left.label.localeCompare(right.label)),
      priceRange: {
        min: priceRangeMin == null ? null : Math.floor(priceRangeMin),
        max: priceRangeMax == null ? null : Math.ceil(priceRangeMax),
      },
    },
  };
}
