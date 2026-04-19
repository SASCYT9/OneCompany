export const SHOP_PRODUCT_STOREFRONTS = ['main', 'urban', 'brabus'] as const;

export type ShopProductStorefront = (typeof SHOP_PRODUCT_STOREFRONTS)[number];

const STOREFRONT_TAG_PREFIX = 'store:';
const URBAN_KEYS = new Set(['urban', 'urban automotive']);
const BRABUS_KEYS = new Set(['brabus']);

export type StorefrontCollectionSignal = {
  handle?: string | null;
  brand?: string | null;
  isUrban?: boolean | null;
  title?:
    | {
        en?: string | null;
        ua?: string | null;
      }
    | null
    | undefined;
};

export type StorefrontInferenceInput = {
  slug?: string | null;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  collections?: StorefrontCollectionSignal[] | null;
};

export type StorefrontBackfillInput = StorefrontInferenceInput & {
  id: string;
};

export type StorefrontBackfillPlanItem = {
  id: string;
  storefront: ShopProductStorefront;
  tags: string[];
  changed: boolean;
};

export type StorefrontBackfillPlan = {
  items: StorefrontBackfillPlanItem[];
  updatedCount: number;
  storefrontCounts: Record<ShopProductStorefront, number>;
};

function normalizeKey(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function uniqueStrings(value: string[]) {
  return Array.from(new Set(value.filter(Boolean)));
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function normalizeStorefrontValue(value: unknown): ShopProductStorefront | null {
  const normalized = normalizeKey(typeof value === 'string' ? value.replace(/^store:/i, '') : String(value ?? ''));

  return SHOP_PRODUCT_STOREFRONTS.includes(normalized as ShopProductStorefront)
    ? (normalized as ShopProductStorefront)
    : null;
}

export function extractStorefrontTag(tags: readonly string[] | null | undefined): ShopProductStorefront | null {
  for (const tag of tags ?? []) {
    const trimmed = String(tag ?? '').trim();
    if (!trimmed.toLowerCase().startsWith(STOREFRONT_TAG_PREFIX)) {
      continue;
    }

    const storefront = normalizeStorefrontValue(trimmed);
    if (storefront) {
      return storefront;
    }
  }

  return null;
}

export function stripStorefrontTags(tags: readonly string[] | null | undefined) {
  return uniqueStrings(
    (tags ?? [])
      .map((tag) => String(tag ?? '').trim())
      .filter((tag) => tag && !tag.toLowerCase().startsWith(STOREFRONT_TAG_PREFIX))
  );
}

export function replaceStorefrontTag(
  tags: readonly string[] | null | undefined,
  storefront: ShopProductStorefront
) {
  return uniqueStrings([...stripStorefrontTags(tags), `${STOREFRONT_TAG_PREFIX}${storefront}`]);
}

export function inferLegacyStorefront(input: StorefrontInferenceInput): ShopProductStorefront | null {
  const brandKey = normalizeKey(input.brand);
  const vendorKey = normalizeKey(input.vendor);
  const slug = String(input.slug ?? '').trim().toLowerCase();
  const collections = input.collections ?? [];
  const tags = input.tags ?? [];

  const hasUrbanSignal =
    URBAN_KEYS.has(brandKey) ||
    URBAN_KEYS.has(vendorKey) ||
    slug.startsWith('urb-') ||
    collections.some((collection) => collection.isUrban === true) ||
    tags.some((tag) => {
      const normalizedTag = String(tag ?? '').trim().toLowerCase();
      return (
        normalizedTag === 'urban' ||
        normalizedTag.startsWith('urban-source:') ||
        normalizedTag.startsWith('urban-manufacturer:')
      );
    });

  const hasBrabusSignal =
    BRABUS_KEYS.has(brandKey) ||
    BRABUS_KEYS.has(vendorKey) ||
    slug.startsWith('brabus-') ||
    tags.some((tag) => normalizeKey(tag) === 'brabus');

  if (hasBrabusSignal) {
    return 'brabus';
  }

  if (hasUrbanSignal) {
    return 'urban';
  }

  return null;
}

export function resolveProductStorefront(input: StorefrontInferenceInput): ShopProductStorefront {
  return extractStorefrontTag(input.tags) ?? inferLegacyStorefront(input) ?? 'main';
}

export function buildStorefrontBackfillPlan(products: StorefrontBackfillInput[]): StorefrontBackfillPlan {
  const storefrontCounts: Record<ShopProductStorefront, number> = {
    main: 0,
    urban: 0,
    brabus: 0,
  };

  const items = products.map((product) => {
    const storefront = inferLegacyStorefront(product) ?? extractStorefrontTag(product.tags) ?? 'main';
    const tags = replaceStorefrontTag(product.tags, storefront);
    const currentTags = uniqueStrings((product.tags ?? []).map((tag) => String(tag ?? '').trim()).filter(Boolean));
    const changed = !sameStringArray(currentTags, tags);

    storefrontCounts[storefront] += 1;

    return {
      id: product.id,
      storefront,
      tags,
      changed,
    } satisfies StorefrontBackfillPlanItem;
  });

  return {
    items,
    updatedCount: items.filter((item) => item.changed).length,
    storefrontCounts,
  };
}
