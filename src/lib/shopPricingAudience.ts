import type { CustomerGroup } from '@prisma/client';
import type { ShopSettingsRuntime } from '@/lib/shopAdminSettings';
import type { ShopProduct } from '@/lib/shopCatalog';

export type ShopPriceAudience = 'b2c' | 'b2b';
export type ShopResolvedPriceSource = 'b2c' | 'b2b-explicit' | 'b2b-discount';

export type ShopViewerPricingContext = {
  customerGroup: CustomerGroup | null;
  customerB2BDiscountPercent: number | null;
  defaultB2BDiscountPercent: number | null;
  b2bVisibilityMode: string;
  isAuthenticated: boolean;
};

export type ShopResolvedPricing = {
  audience: ShopPriceAudience;
  source: ShopResolvedPriceSource;
  b2bVisible: boolean;
  requestQuote: boolean;
  discountPercent: number | null;
  effectivePrice: {
    eur: number;
    usd: number;
    uah: number;
  };
  effectiveCompareAt: {
    eur: number;
    usd: number;
    uah: number;
  } | null;
  bands: {
    b2c: {
      price: {
        eur: number;
        usd: number;
        uah: number;
      };
      compareAt: {
        eur: number;
        usd: number;
        uah: number;
      } | null;
    };
    b2b: {
      price: {
        eur: number;
        usd: number;
        uah: number;
      };
      compareAt: {
        eur: number;
        usd: number;
        uah: number;
      } | null;
      source: Extract<ShopResolvedPriceSource, 'b2b-explicit' | 'b2b-discount'>;
      discountPercent: number | null;
    } | null;
  };
};

type PriceSet = {
  eur: number;
  usd: number;
  uah: number;
};

type CompareSet = {
  eur: number;
  usd: number;
  uah: number;
} | null;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeMoneySet(input?: Partial<PriceSet> | null): PriceSet {
  return {
    eur: roundMoney(Number(input?.eur ?? 0) || 0),
    usd: roundMoney(Number(input?.usd ?? 0) || 0),
    uah: roundMoney(Number(input?.uah ?? 0) || 0),
  };
}

function normalizeCompareSet(input?: Partial<PriceSet> | null): CompareSet {
  const normalized = normalizeMoneySet(input);
  if (!normalized.eur && !normalized.usd && !normalized.uah) {
    return null;
  }
  return normalized;
}

function clampDiscountPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 100);
}

function hasAnyPositiveValue(set?: Partial<PriceSet> | null) {
  return (
    Number(set?.eur ?? 0) > 0 ||
    Number(set?.usd ?? 0) > 0 ||
    Number(set?.uah ?? 0) > 0
  );
}

function hasPriceDifference(left: PriceSet, right: PriceSet) {
  return left.eur !== right.eur || left.usd !== right.usd || left.uah !== right.uah;
}

function applyPercentDiscount(base: PriceSet, discountPercent: number): PriceSet | null {
  const normalizedDiscount = clampDiscountPercent(discountPercent);
  if (normalizedDiscount <= 0) {
    return null;
  }

  const multiplier = 1 - normalizedDiscount / 100;
  return {
    eur: base.eur > 0 ? roundMoney(base.eur * multiplier) : 0,
    usd: base.usd > 0 ? roundMoney(base.usd * multiplier) : 0,
    uah: base.uah > 0 ? roundMoney(base.uah * multiplier) : 0,
  };
}

function resolveEffectiveDiscountPercent(context: ShopViewerPricingContext) {
  if (context.customerGroup === 'B2B_APPROVED') {
    const customerOverride = clampDiscountPercent(context.customerB2BDiscountPercent);
    if (customerOverride > 0) {
      return customerOverride;
    }
  }

  return clampDiscountPercent(context.defaultB2BDiscountPercent);
}

function mergeB2BPriceSet(
  base: PriceSet,
  explicitOverride: Partial<PriceSet> | null | undefined,
  discountPercent: number
) {
  const explicit = normalizeMoneySet(explicitOverride);
  const hasExplicit = hasAnyPositiveValue(explicitOverride);
  const discounted = applyPercentDiscount(base, discountPercent);

  if (!hasExplicit && !discounted) {
    return {
      price: null,
      source: 'b2c' as const,
      discountPercent: null,
    };
  }

  const price = {
    eur: explicit.eur > 0 ? explicit.eur : discounted?.eur ?? base.eur,
    usd: explicit.usd > 0 ? explicit.usd : discounted?.usd ?? base.usd,
    uah: explicit.uah > 0 ? explicit.uah : discounted?.uah ?? base.uah,
  };

  return {
    price,
    source: hasExplicit ? ('b2b-explicit' as const) : ('b2b-discount' as const),
    discountPercent: hasExplicit ? null : discountPercent,
  };
}

function mergeB2BCompareSet(
  b2cPrice: PriceSet,
  b2cCompareAt: CompareSet,
  b2bPrice: PriceSet | null,
  explicitOverride: Partial<PriceSet> | null | undefined
): CompareSet {
  if (!b2bPrice) {
    return null;
  }

  const priceDiffers = hasPriceDifference(b2cPrice, b2bPrice);
  const fallback = priceDiffers ? b2cPrice : b2cCompareAt;
  const explicit = normalizeCompareSet(explicitOverride);

  if (!explicit) {
    return fallback ?? null;
  }

  return {
    eur: explicit.eur > 0 ? explicit.eur : fallback?.eur ?? 0,
    usd: explicit.usd > 0 ? explicit.usd : fallback?.usd ?? 0,
    uah: explicit.uah > 0 ? explicit.uah : fallback?.uah ?? 0,
  };
}

export function buildShopViewerPricingContext(
  settings: ShopSettingsRuntime,
  customerGroup: CustomerGroup | null,
  isAuthenticated: boolean,
  customerB2BDiscountPercent?: number | null
): ShopViewerPricingContext {
  return {
    customerGroup,
    customerB2BDiscountPercent: customerB2BDiscountPercent ?? null,
    defaultB2BDiscountPercent: settings.defaultB2bDiscountPercent,
    b2bVisibilityMode: settings.b2bVisibilityMode,
    isAuthenticated,
  };
}

export function canViewerSeeB2BBands(context: ShopViewerPricingContext) {
  if (context.customerGroup === 'B2B_APPROVED') {
    return true;
  }
  return context.b2bVisibilityMode === 'public_dual';
}

export function resolveCheckoutAudience(context: ShopViewerPricingContext): ShopPriceAudience {
  return context.customerGroup === 'B2B_APPROVED' ? 'b2b' : 'b2c';
}

export function shouldPromptB2BQuote(context: ShopViewerPricingContext) {
  return context.b2bVisibilityMode === 'request_quote' && context.customerGroup !== 'B2B_APPROVED';
}

export function resolveShopPriceBands(input: {
  b2cPrice: PriceSet;
  b2cCompareAt?: Partial<PriceSet> | null;
  b2bPrice?: Partial<PriceSet> | null;
  b2bCompareAt?: Partial<PriceSet> | null;
  context: ShopViewerPricingContext;
}): ShopResolvedPricing {
  const b2cPrice = normalizeMoneySet(input.b2cPrice);
  const b2cCompareAt = normalizeCompareSet(input.b2cCompareAt);
  const effectiveDiscountPercent = resolveEffectiveDiscountPercent(input.context);
  const mergedB2B = mergeB2BPriceSet(b2cPrice, input.b2bPrice, effectiveDiscountPercent);
  const b2bPrice = mergedB2B.price;
  const b2bCompareAt = mergeB2BCompareSet(
    b2cPrice,
    b2cCompareAt,
    b2bPrice,
    input.b2bCompareAt
  );

  const audience = resolveCheckoutAudience(input.context);
  const effectivePrice = audience === 'b2b' && b2bPrice ? b2bPrice : b2cPrice;
  const effectiveCompareAt = audience === 'b2b' && b2bPrice ? b2bCompareAt : b2cCompareAt;
  const bandVisible = canViewerSeeB2BBands(input.context) && Boolean(b2bPrice);

  return {
    audience,
    source: audience === 'b2b' && b2bPrice ? mergedB2B.source : 'b2c',
    b2bVisible: bandVisible,
    requestQuote: shouldPromptB2BQuote(input.context),
    discountPercent: audience === 'b2b' && b2bPrice ? mergedB2B.discountPercent : null,
    effectivePrice,
    effectiveCompareAt,
    bands: {
      b2c: {
        price: b2cPrice,
        compareAt: b2cCompareAt,
      },
      b2b: b2bPrice
        ? {
            price: b2bPrice,
            compareAt: b2bCompareAt,
            source: mergedB2B.source === 'b2b-discount' ? 'b2b-discount' : 'b2b-explicit',
            discountPercent: mergedB2B.discountPercent,
          }
        : null,
    },
  };
}

export function resolveShopProductPricing(
  product: ShopProduct,
  context: ShopViewerPricingContext
) {
  return resolveShopPriceBands({
    b2cPrice: product.price,
    b2cCompareAt: product.compareAt ?? null,
    b2bPrice: product.b2bPrice ?? null,
    b2bCompareAt: product.b2bCompareAt ?? null,
    context,
  });
}
