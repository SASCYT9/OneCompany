import { CustomerGroup, Prisma, ShopPromotionType, type ShopPromotion, type PrismaClient } from '@prisma/client';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopCurrencyCode, ShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { localizeShopText } from '@/lib/shopText';

type PromotionApplicableItem = {
  productSlug: string;
  brand: string | null;
  categorySlug: string | null;
  total: number;
};

export type PromotionTargetItem = Omit<PromotionApplicableItem, 'total'>;

export type PromotionEvaluationInput = {
  storeKey: string;
  promoCode?: string | null;
  currency: ShopCurrencyCode;
  locale: SupportedLocale;
  customerGroup: CustomerGroup | null;
  settings: ShopSettingsRuntime;
  subtotal: number;
  shippingCost: number;
  items: PromotionApplicableItem[];
  now?: Date;
};

export type AppliedPromotionSummary = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  promotionType: ShopPromotionType;
  amount: number;
  itemDiscountAmount: number;
  shippingDiscountAmount: number;
  currency: ShopCurrencyCode;
  minimumSubtotal: number | null;
};

export type PromotionEvaluationResult = {
  promotion: AppliedPromotionSummary | null;
  discountAmount: number;
  itemDiscountAmount: number;
  shippingDiscountAmount: number;
  discountedSubtotal: number;
  discountedShippingCost: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

function normalizeTextList(values: string[]) {
  return values.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
}

function matchesCustomerGroup(promotion: ShopPromotion, customerGroup: CustomerGroup | null) {
  if (!promotion.customerGroup) {
    return true;
  }

  return promotion.customerGroup === (customerGroup ?? CustomerGroup.B2C);
}

function matchesUsageLimit(promotion: ShopPromotion) {
  return promotion.usageLimit == null || promotion.usageCount < promotion.usageLimit;
}

function matchesSchedule(promotion: ShopPromotion, now: Date) {
  if (promotion.startsAt && promotion.startsAt > now) return false;
  if (promotion.endsAt && promotion.endsAt < now) return false;
  return true;
}

function getEligibleItems(promotion: ShopPromotion, items: PromotionApplicableItem[]) {
  if (promotion.appliesToAll) {
    return items;
  }

  const productSlugs = normalizeTextList(promotion.productSlugs);
  const categorySlugs = normalizeTextList(promotion.categorySlugs);
  const brandNames = normalizeTextList(promotion.brandNames);

  return items.filter((item) => {
    const slug = item.productSlug.trim().toLowerCase();
    const categorySlug = String(item.categorySlug ?? '').trim().toLowerCase();
    const brand = String(item.brand ?? '').trim().toLowerCase();

    return (
      productSlugs.includes(slug) ||
      (categorySlug && categorySlugs.includes(categorySlug)) ||
      (brand && brandNames.includes(brand))
    );
  });
}

function matchesPromotionTarget(promotion: ShopPromotion, item: PromotionTargetItem) {
  return getEligibleItems(promotion, [{ ...item, total: 1 }]).length > 0;
}

function convertAmount(
  amount: number,
  fromCurrency: ShopCurrencyCode,
  toCurrency: ShopCurrencyCode,
  settings: ShopSettingsRuntime
) {
  if (fromCurrency === toCurrency) return roundMoney(amount);

  const rates = settings.currencyRates;
  const amountInEur = fromCurrency === 'EUR' ? amount : amount / rates[fromCurrency];
  const converted = toCurrency === 'EUR' ? amountInEur : amountInEur * rates[toCurrency];
  return roundMoney(converted);
}

function localizePromotion(locale: SupportedLocale, promotion: Pick<ShopPromotion, 'titleUa' | 'titleEn' | 'descriptionUa' | 'descriptionEn'>) {
  return {
    title: localizeShopText(locale, { ua: promotion.titleUa, en: promotion.titleEn }, { kind: 'label' }),
    description: promotion.descriptionUa || promotion.descriptionEn
      ? localizeShopText(locale, { ua: promotion.descriptionUa ?? '', en: promotion.descriptionEn ?? '' }, { kind: 'description' })
      : null,
  };
}

function buildPromotionAmount(params: {
  promotion: ShopPromotion;
  currency: ShopCurrencyCode;
  settings: ShopSettingsRuntime;
  eligibleSubtotal: number;
  shippingCost: number;
}) {
  const { promotion, currency, settings, eligibleSubtotal, shippingCost } = params;

  switch (promotion.promotionType) {
    case 'PERCENTAGE': {
      const discountValue = decimalToNumber(promotion.discountValue) ?? 0;
      const itemDiscountAmount = roundMoney(eligibleSubtotal * (discountValue / 100));
      return {
        itemDiscountAmount,
        shippingDiscountAmount: 0,
      };
    }
    case 'FIXED_AMOUNT': {
      const rawAmount = decimalToNumber(promotion.discountValue) ?? 0;
      const sourceCurrency = (String(promotion.currency ?? currency).toUpperCase() || currency) as ShopCurrencyCode;
      const convertedAmount = convertAmount(rawAmount, sourceCurrency, currency, settings);
      return {
        itemDiscountAmount: Math.min(roundMoney(convertedAmount), roundMoney(eligibleSubtotal)),
        shippingDiscountAmount: 0,
      };
    }
    case 'FREE_SHIPPING':
      return {
        itemDiscountAmount: 0,
        shippingDiscountAmount: roundMoney(shippingCost),
      };
    default:
      return {
        itemDiscountAmount: 0,
        shippingDiscountAmount: 0,
      };
  }
}

export async function evaluateShopPromotion(
  prisma: PrismaClient,
  input: PromotionEvaluationInput
): Promise<PromotionEvaluationResult> {
  const promoCode = String(input.promoCode ?? '').trim();
  if (!promoCode) {
    return {
      promotion: null,
      discountAmount: 0,
      itemDiscountAmount: 0,
      shippingDiscountAmount: 0,
      discountedSubtotal: roundMoney(input.subtotal),
      discountedShippingCost: roundMoney(input.shippingCost),
    };
  }

  const now = input.now ?? new Date();
  const promotion = await prisma.shopPromotion.findFirst({
    where: {
      storeKey: input.storeKey,
      isActive: true,
      code: { equals: promoCode, mode: 'insensitive' },
    },
  });

  if (!promotion) {
    throw new Error('PROMOTION_NOT_FOUND');
  }

  if (!matchesSchedule(promotion, now) || !matchesCustomerGroup(promotion, input.customerGroup) || !matchesUsageLimit(promotion)) {
    throw new Error('PROMOTION_UNAVAILABLE');
  }

  const minimumSubtotal = decimalToNumber(promotion.minimumSubtotal);
  if (minimumSubtotal != null && input.subtotal < minimumSubtotal) {
    throw new Error('PROMOTION_MINIMUM_NOT_MET');
  }

  const eligibleItems = getEligibleItems(promotion, input.items);
  if (!eligibleItems.length) {
    throw new Error('PROMOTION_NOT_APPLICABLE');
  }

  const eligibleSubtotal = roundMoney(eligibleItems.reduce((sum, item) => sum + item.total, 0));
  const localized = localizePromotion(input.locale, promotion);
  const amounts = buildPromotionAmount({
    promotion,
    currency: input.currency,
    settings: input.settings,
    eligibleSubtotal,
    shippingCost: input.shippingCost,
  });
  const itemDiscountAmount = Math.min(amounts.itemDiscountAmount, roundMoney(input.subtotal));
  const shippingDiscountAmount = Math.min(amounts.shippingDiscountAmount, roundMoney(input.shippingCost));
  const discountAmount = roundMoney(itemDiscountAmount + shippingDiscountAmount);

  return {
    promotion: {
      id: promotion.id,
      code: promotion.code,
      title: localized.title,
      description: localized.description,
      promotionType: promotion.promotionType,
      amount: discountAmount,
      itemDiscountAmount,
      shippingDiscountAmount,
      currency: input.currency,
      minimumSubtotal,
    },
    discountAmount,
    itemDiscountAmount,
    shippingDiscountAmount,
    discountedSubtotal: roundMoney(input.subtotal - itemDiscountAmount),
    discountedShippingCost: roundMoney(input.shippingCost - shippingDiscountAmount),
  };
}

export function serializeAdminPromotion(record: ShopPromotion) {
  return {
    id: record.id,
    storeKey: record.storeKey,
    code: record.code,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    descriptionUa: record.descriptionUa,
    descriptionEn: record.descriptionEn,
    promotionType: record.promotionType,
    discountValue: decimalToNumber(record.discountValue),
    currency: record.currency,
    minimumSubtotal: decimalToNumber(record.minimumSubtotal),
    usageLimit: record.usageLimit,
    usageCount: record.usageCount,
    customerGroup: record.customerGroup,
    appliesToAll: record.appliesToAll,
    productSlugs: record.productSlugs,
    categorySlugs: record.categorySlugs,
    brandNames: record.brandNames,
    startsAt: record.startsAt?.toISOString() ?? null,
    endsAt: record.endsAt?.toISOString() ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type StorefrontPromotionHighlight = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  promotionType: ShopPromotionType;
};

export async function getStorefrontPromotionHighlights(
  prisma: PrismaClient,
  input: {
    storeKey: string;
    locale: SupportedLocale;
    customerGroup: CustomerGroup | null;
    item: PromotionTargetItem;
    now?: Date;
  }
): Promise<StorefrontPromotionHighlight[]> {
  const now = input.now ?? new Date();
  const promotions = await prisma.shopPromotion.findMany({
    where: {
      storeKey: input.storeKey,
      isActive: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return promotions
    .filter((promotion) => matchesSchedule(promotion, now))
    .filter((promotion) => matchesCustomerGroup(promotion, input.customerGroup))
    .filter((promotion) => matchesUsageLimit(promotion))
    .filter((promotion) => matchesPromotionTarget(promotion, input.item))
    .map((promotion) => {
      const localized = localizePromotion(input.locale, promotion);
      return {
        id: promotion.id,
        code: promotion.code,
        title: localized.title,
        description: localized.description,
        promotionType: promotion.promotionType,
      } satisfies StorefrontPromotionHighlight;
    });
}
