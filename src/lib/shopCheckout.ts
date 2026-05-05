import { CustomerGroup, Prisma, PrismaClient } from '@prisma/client';
import { getShopProductBySlugServer } from '@/lib/shopCatalogServer';
import {
  getOrCreateShopSettings,
  getShopSettingsRuntime,
  SHOP_BRAND_DEFAULT_RULE_ID,
  type ShopBrandShippingRule,
  type ShopCurrencyCode,
  type ShopRegionalPricingRule,
  type ShopSettingsRuntime,
  type ShopShippingZone,
  type ShopTaxRegion,
} from '@/lib/shopAdminSettings';
import {
  buildShopViewerPricingContext,
  resolveCheckoutAudience,
  resolveShopPriceBands,
  resolveShopProductPricing,
  type ShopPriceAudience,
} from '@/lib/shopPricingAudience';

type CheckoutRequestItem = {
  slug: string;
  quantity: number;
  variantId?: string | null;
};

export type CheckoutShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postcode?: string;
  country: string;
};

type ResolvedCheckoutItem = {
  productSlug: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  total: number;
  image: string | null;
  priceSourceCurrency: ShopCurrencyCode;
  pricingSource: 'b2c' | 'b2b-explicit' | 'b2b-discount';
  discountPercent: number | null;
  brandName: string | null;
  weightKg: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
};

type CheckoutRuleSnapshot = {
  id: string;
  name: string;
  currency?: ShopCurrencyCode;
  countries: string[];
  regions: string[];
  rate?: number;
  value?: number;
  mode?: 'percent' | 'fixed';
  baseRate?: number;
  perItemRate?: number;
  freeOver?: number | null;
  appliesToShipping?: boolean;
  etaMinDays?: number | null;
  etaMaxDays?: number | null;
};

export type CheckoutQuote = {
  currency: ShopCurrencyCode;
  pricingAudience: ShopPriceAudience;
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  items: ResolvedCheckoutItem[];
  shippingZone: CheckoutRuleSnapshot | null;
  taxRegion: CheckoutRuleSnapshot | null;
  regionalPricingRule: CheckoutRuleSnapshot | null;
  showTaxesIncludedNotice: boolean;
  pricingSnapshot: Prisma.InputJsonValue;
  /**
   * True when at least one item in the cart is governed by a brand shipping
   * rule with `mode: 'manual_quote'`. Storefront should block standard
   * checkout and show a "Запит на прорахунок" (request a quote) flow.
   */
  requiresQuote: boolean;
  /** Brand names that triggered manual_quote (for UI messaging). */
  brandsRequiringQuote: string[];
};

type CheckoutQuoteSummaryInput = {
  settings: ShopSettingsRuntime;
  shippingAddress: CheckoutShippingAddress;
  currency?: string;
  audience: ShopPriceAudience;
  customerGroup: CustomerGroup | null;
  customerB2BDiscountPercent: number | null;
  subtotal: number;
  itemCount: number;
  items: ResolvedCheckoutItem[];
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeMatchValue(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ');
}

function matchesLocation(ruleValues: string[], candidate?: string | null) {
  if (!ruleValues.length) return true;
  const normalizedCandidate = normalizeMatchValue(candidate);
  return ruleValues.some((entry) => {
    const rawEntry = String(entry ?? '').trim();
    if (rawEntry === '*') return true;
    const normalizedEntry = normalizeMatchValue(rawEntry);
    return normalizedEntry === normalizedCandidate;
  });
}

function resolveRequestedCurrency(settings: ShopSettingsRuntime, requested?: string) {
  const normalized = String(requested ?? settings.defaultCurrency).toUpperCase() as ShopCurrencyCode;
  return settings.enabledCurrencies.includes(normalized) ? normalized : settings.defaultCurrency;
}

function convertAmount(
  amount: number,
  fromCurrency: ShopCurrencyCode,
  toCurrency: ShopCurrencyCode,
  rates: Record<ShopCurrencyCode, number>
) {
  if (fromCurrency === toCurrency) return roundMoney(amount);

  const amountInEur = fromCurrency === 'EUR' ? amount : amount / rates[fromCurrency];
  const converted = toCurrency === 'EUR' ? amountInEur : amountInEur * rates[toCurrency];
  return roundMoney(converted);
}

function resolveUnitPrice(
  price: { eur: number; usd: number; uah: number },
  currency: ShopCurrencyCode,
  settings: ShopSettingsRuntime
) {
  const directPrices: Record<ShopCurrencyCode, number> = {
    EUR: Number(price.eur || 0),
    USD: Number(price.usd || 0),
    UAH: Number(price.uah || 0),
  };

  if (directPrices[currency] > 0) {
    return {
      amount: roundMoney(directPrices[currency]),
      sourceCurrency: currency,
    };
  }

  const fallbacks = Array.from(
    new Set<ShopCurrencyCode>([
      settings.defaultCurrency,
      'EUR',
      'USD',
      'UAH',
    ])
  );

  for (const fallbackCurrency of fallbacks) {
    const candidate = directPrices[fallbackCurrency];
    if (candidate > 0) {
      return {
        amount: convertAmount(candidate, fallbackCurrency, currency, settings.currencyRates),
        sourceCurrency: fallbackCurrency,
      };
    }
  }

  return {
    amount: 0,
    sourceCurrency: settings.defaultCurrency,
  };
}

function resolveShippingZone(
  settings: ShopSettingsRuntime,
  address: CheckoutShippingAddress,
  subtotal: number
) {
  const matched = settings.shippingZones.find((zone) => {
    if (!zone.enabled) return false;
    if (!matchesLocation(zone.countries, address.country)) return false;
    if (!matchesLocation(zone.regions, address.region)) return false;
    if (zone.minimumSubtotal != null && subtotal < zone.minimumSubtotal) return false;
    return true;
  });

  return matched ?? null;
}

function resolveTaxRegion(
  settings: ShopSettingsRuntime,
  address: CheckoutShippingAddress
) {
  const matched = settings.taxRegions.find((region) => {
    if (!region.enabled) return false;
    if (!matchesLocation(region.countries, address.country)) return false;
    if (!matchesLocation(region.regions, address.region)) return false;
    return true;
  });

  return matched ?? null;
}

function resolveRegionalPricingRule(
  settings: ShopSettingsRuntime,
  address: CheckoutShippingAddress
) {
  const matched = settings.regionalPricingRules.find((rule) => {
    if (!rule.enabled) return false;
    if (!matchesLocation(rule.countries, address.country)) return false;
    if (!matchesLocation(rule.regions, address.region)) return false;
    return true;
  });

  return matched ?? null;
}

type ShippingCostResult = {
  cost: number;
  requiresQuote: boolean;
  brandsRequiringQuote: string[];
};

function pickTieredFee(brackets: NonNullable<ShopBrandShippingRule['brackets']>, subtotal: number): number {
  // brackets are normalized ascending by maxAmount; null (open-ended) is last.
  for (const b of brackets) {
    if (b.maxAmount === null) return b.fee;
    if (subtotal <= b.maxAmount) return b.fee;
  }
  // Fallback if no open-ended bracket and subtotal exceeds all caps:
  return brackets[brackets.length - 1]?.fee ?? 0;
}

function calculateShippingCost(
  zone: ShopShippingZone | null,
  currency: ShopCurrencyCode,
  settings: ShopSettingsRuntime,
  subtotal: number,
  itemCount: number,
  items: ResolvedCheckoutItem[]
): ShippingCostResult {
  if (!zone) return { cost: 0, requiresQuote: false, brandsRequiringQuote: [] };
  if (zone.freeOver != null && subtotal >= zone.freeOver) {
    return { cost: 0, requiresQuote: false, brandsRequiringQuote: [] };
  }

  let totalCost = zone.baseRate;
  const brandsRequiringQuote = new Set<string>();

  // Default fallback rule (special id '__default__') applies to any item whose
  // brand has no dedicated rule. Read once up front.
  const defaultRule = settings.brandShippingRules.find(
    (r) => r.enabled && r.id === SHOP_BRAND_DEFAULT_RULE_ID,
  );

  /** Resolve the rule that should govern shipping for an item: brand-specific
   * first, then the global default. Returns null if neither applies. */
  function resolveItemRule(itemBrandName: string | null): ShopBrandShippingRule | null {
    if (itemBrandName) {
      const specific = settings.brandShippingRules.find(
        (r) =>
          r.enabled &&
          r.id !== SHOP_BRAND_DEFAULT_RULE_ID &&
          r.brandName.toLowerCase() === itemBrandName.toLowerCase(),
      );
      if (specific) return specific;
    }
    return defaultRule ?? null;
  }

  if (zone.calcMode === 'volumetric') {
    // Pre-compute per-brand subtotals (in zone.currency) for cart-level rules
    // (tiered / percent / manual_quote). These rules are applied ONCE per brand,
    // not per item, since they're conceptually about the whole cart line.
    const cartLevelBrandSubtotals = new Map<string, number>();
    const cartLevelBrandsSeen = new Set<string>();
    for (const item of items) {
      if (!item.brandName) continue;
      const rule = resolveItemRule(item.brandName);
      if (!rule) continue;
      if (rule.mode !== 'tiered' && rule.mode !== 'percent' && rule.mode !== 'manual_quote') continue;
      const lineTotalZone = convertAmount(item.total, item.priceSourceCurrency, zone.currency, settings.currencyRates);
      // Key by item.brandName (NOT rule.brandName) — when default applies, each
      // brand still gets its own subtotal bucket so a tiered fallback charges
      // per brand, not once for the whole cart.
      cartLevelBrandSubtotals.set(item.brandName, (cartLevelBrandSubtotals.get(item.brandName) || 0) + lineTotalZone);
    }

    for (const item of items) {
      let itemCost = 0;
      let handledByRule = false;

      // Primary dimensions and fallback logic
      const w = item.weightKg ?? zone.fallbackWeightKg;
      const l = item.length ?? zone.fallbackLength;
      const wd = item.width ?? zone.fallbackWidth;
      const h = item.height ?? zone.fallbackHeight;

      // Calculate Volumetric Weight Formula: Volume / Divisor
      const volumeWeight = (l * wd * h) / zone.volumetricDivisor;
      const actualWeight = w;

      const physicalDeliveryCost = actualWeight * zone.ratePerKg;
      const volumeSurcharge = Math.max(0, volumeWeight - actualWeight) * zone.volSurchargePerKg;

      const standardCostForOne = physicalDeliveryCost + volumeSurcharge;

      const rule = resolveItemRule(item.brandName);
      if (rule) {
        handledByRule = true;
        const warehouseDeliveryCostForOne = actualWeight * rule.warehouseRatePerKg;
        // Use the item's brand for cart-level keying so default-rule applications
        // bucket per brand. brandsRequiringQuote messaging also reads better
        // ("Brabus needs a quote") than the literal default-rule label.
        const brandKey = item.brandName || rule.brandName || 'default';

        if (rule.mode === 'free') {
          itemCost = 0;
        } else if (rule.mode === 'fixed') {
          const fixedFee = convertAmount(rule.value, rule.currency, zone.currency, settings.currencyRates);
          itemCost = (fixedFee + warehouseDeliveryCostForOne) * item.quantity;
        } else if (rule.mode === 'multiplier') {
          itemCost = (standardCostForOne * rule.value + warehouseDeliveryCostForOne) * item.quantity;
        } else if (rule.mode === 'tiered' || rule.mode === 'percent') {
          // Cart-level rule: apply ONCE per brand, on first occurrence.
          // Subsequent items of the same brand only contribute warehouseRatePerKg.
          if (!cartLevelBrandsSeen.has(brandKey)) {
            cartLevelBrandsSeen.add(brandKey);
            const brandSubtotalZone = cartLevelBrandSubtotals.get(brandKey) || 0;
            const brandSubtotalRuleCurrency = convertAmount(brandSubtotalZone, zone.currency, rule.currency, settings.currencyRates);
            let feeRuleCurrency = 0;
            if (rule.mode === 'tiered') {
              feeRuleCurrency = pickTieredFee(rule.brackets ?? [], brandSubtotalRuleCurrency);
            } else {
              feeRuleCurrency = brandSubtotalRuleCurrency * (rule.value / 100);
            }
            const feeZone = convertAmount(feeRuleCurrency, rule.currency, zone.currency, settings.currencyRates);
            itemCost = feeZone + warehouseDeliveryCostForOne * item.quantity;
          } else {
            itemCost = warehouseDeliveryCostForOne * item.quantity;
          }
        } else if (rule.mode === 'manual_quote') {
          brandsRequiringQuote.add(brandKey);
          itemCost = 0;
        }
      }

      if (!handledByRule) {
        itemCost = standardCostForOne * item.quantity;
      }

      totalCost += itemCost;
    }
  } else {
    const actualItemCount = items.length > 0 ? items.reduce((sum, item) => sum + item.quantity, 0) : itemCount;
    totalCost += zone.perItemRate * actualItemCount;
  }

  return {
    cost: convertAmount(totalCost, zone.currency, currency, settings.currencyRates),
    requiresQuote: brandsRequiringQuote.size > 0,
    brandsRequiringQuote: Array.from(brandsRequiringQuote),
  };
}

function calculateTaxAmount(
  region: ShopTaxRegion | null,
  subtotal: number,
  shippingCost: number
) {
  if (!region || region.rate <= 0) return 0;
  const base = subtotal + (region.appliesToShipping ? shippingCost : 0);
  return roundMoney(base * region.rate);
}

function calculateRegionalAdjustmentAmount(
  rule: ShopRegionalPricingRule | null,
  subtotal: number,
  currency: ShopCurrencyCode,
  settings: ShopSettingsRuntime
) {
  if (!rule) return 0;

  if (rule.mode === 'percent') {
    return roundMoney(subtotal * (rule.value / 100));
  }

  return convertAmount(rule.value, rule.currency, currency, settings.currencyRates);
}

function buildPricingSnapshot(params: {
  settings: ShopSettingsRuntime;
  currency: ShopCurrencyCode;
  audience: ShopPriceAudience;
  customerGroup: CustomerGroup | null;
  customerB2BDiscountPercent: number | null;
  address: CheckoutShippingAddress;
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  items: ResolvedCheckoutItem[];
  shippingZone: ShopShippingZone | null;
  taxRegion: ShopTaxRegion | null;
  regionalPricingRule: ShopRegionalPricingRule | null;
}): Prisma.InputJsonValue {
  const { settings, currency, address, subtotal, regionalAdjustmentAmount, shippingCost, taxAmount, total, itemCount, items, shippingZone, taxRegion, regionalPricingRule } = params;

  return {
    computedAt: new Date().toISOString(),
    currency,
    audience: params.audience,
    customerGroup: params.customerGroup,
    customerB2BDiscountPercent: params.customerB2BDiscountPercent,
    defaultB2BDiscountPercent: settings.defaultB2bDiscountPercent,
    defaultCurrency: settings.defaultCurrency,
    enabledCurrencies: settings.enabledCurrencies,
    currencyRates: settings.currencyRates,
    matchedAddress: {
      country: address.country,
      region: address.region ?? null,
      city: address.city,
      postcode: address.postcode ?? null,
    },
    items: items.map((item) => ({
      slug: item.productSlug,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      sourceCurrency: item.priceSourceCurrency,
      pricingSource: item.pricingSource,
      discountPercent: item.discountPercent,
      })),
    itemCount,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    taxAmount,
    total,
    shippingZone: shippingZone
      ? {
          id: shippingZone.id,
          name: shippingZone.name,
          countries: shippingZone.countries,
          regions: shippingZone.regions,
          currency: shippingZone.currency,
          baseRate: shippingZone.baseRate,
          perItemRate: shippingZone.perItemRate,
          freeOver: shippingZone.freeOver,
          minimumSubtotal: shippingZone.minimumSubtotal,
          etaMinDays: shippingZone.etaMinDays,
          etaMaxDays: shippingZone.etaMaxDays,
        }
      : null,
    taxRegion: taxRegion
      ? {
          id: taxRegion.id,
          name: taxRegion.name,
          countries: taxRegion.countries,
          regions: taxRegion.regions,
          rate: taxRegion.rate,
          appliesToShipping: taxRegion.appliesToShipping,
        }
      : null,
    regionalPricingRule: regionalPricingRule
      ? {
          id: regionalPricingRule.id,
          name: regionalPricingRule.name,
          countries: regionalPricingRule.countries,
          regions: regionalPricingRule.regions,
          mode: regionalPricingRule.mode,
          value: regionalPricingRule.value,
          currency: regionalPricingRule.currency,
        }
      : null,
    showTaxesIncludedNotice: settings.showTaxesIncludedNotice,
  };
}

function buildQuoteFromSummary(input: CheckoutQuoteSummaryInput): CheckoutQuote {
  const currency = resolveRequestedCurrency(input.settings, input.currency);
  const subtotal = roundMoney(Math.max(0, Number(input.subtotal) || 0));
  const itemCount = Math.max(0, Math.floor(Number(input.itemCount) || 0));
  const regionalPricingRule = resolveRegionalPricingRule(input.settings, input.shippingAddress);
  const rawRegionalAdjustmentAmount = calculateRegionalAdjustmentAmount(regionalPricingRule, subtotal, currency, input.settings);
  const adjustedSubtotal = roundMoney(Math.max(0, subtotal + rawRegionalAdjustmentAmount));
  const regionalAdjustmentAmount = roundMoney(adjustedSubtotal - subtotal);
  const shippingZone = resolveShippingZone(input.settings, input.shippingAddress, adjustedSubtotal);
  const shippingResult = calculateShippingCost(shippingZone, currency, input.settings, subtotal, itemCount, input.items);
  const shippingCost = shippingResult.cost;
  const taxRegion = resolveTaxRegion(input.settings, input.shippingAddress);
  const taxAmount = calculateTaxAmount(taxRegion, adjustedSubtotal, shippingCost);
  const total = roundMoney(adjustedSubtotal + shippingCost + taxAmount);

  const pricingSnapshot = buildPricingSnapshot({
    settings: input.settings,
    currency,
    audience: input.audience,
    customerGroup: input.customerGroup,
    customerB2BDiscountPercent: input.customerB2BDiscountPercent,
    address: input.shippingAddress,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    taxAmount,
    total,
    itemCount,
    items: input.items,
    shippingZone,
    taxRegion,
    regionalPricingRule,
  });

  return {
    currency,
    pricingAudience: input.audience,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    taxAmount,
    total,
    itemCount,
    items: input.items,
    shippingZone: shippingZone
      ? {
          id: shippingZone.id,
          name: shippingZone.name,
          currency: shippingZone.currency,
          countries: shippingZone.countries,
          regions: shippingZone.regions,
          baseRate: shippingZone.baseRate,
          perItemRate: shippingZone.perItemRate,
          freeOver: shippingZone.freeOver,
          etaMinDays: shippingZone.etaMinDays,
          etaMaxDays: shippingZone.etaMaxDays,
        }
      : null,
    taxRegion: taxRegion
      ? {
          id: taxRegion.id,
          name: taxRegion.name,
          countries: taxRegion.countries,
          regions: taxRegion.regions,
          rate: taxRegion.rate,
          appliesToShipping: taxRegion.appliesToShipping,
        }
      : null,
    regionalPricingRule: regionalPricingRule
      ? {
          id: regionalPricingRule.id,
          name: regionalPricingRule.name,
          currency: regionalPricingRule.currency,
          countries: regionalPricingRule.countries,
          regions: regionalPricingRule.regions,
          value: regionalPricingRule.value,
          mode: regionalPricingRule.mode,
        }
      : null,
    showTaxesIncludedNotice: input.settings.showTaxesIncludedNotice,
    pricingSnapshot,
    requiresQuote: shippingResult.requiresQuote,
    brandsRequiringQuote: shippingResult.brandsRequiringQuote,
  };
}

export function buildCheckoutSettingsPreview(
  settings: ShopSettingsRuntime,
  input: {
    shippingAddress: CheckoutShippingAddress;
    currency?: string;
    subtotal: number;
    itemCount: number;
  }
) {
  return buildQuoteFromSummary({
    settings,
    shippingAddress: input.shippingAddress,
    currency: input.currency,
    audience: 'b2c',
    customerGroup: null,
    customerB2BDiscountPercent: null,
    subtotal: input.subtotal,
    itemCount: input.itemCount,
    items: [],
  });
}

export async function buildCheckoutQuote(
  prisma: PrismaClient,
  input: {
    items: CheckoutRequestItem[];
    shippingAddress: CheckoutShippingAddress;
    currency?: string;
    customerGroup?: CustomerGroup | null;
    customerId?: string | null;
    customerB2BDiscountPercent?: number | null;
  }
): Promise<CheckoutQuote> {
  const settingsRecord = await getOrCreateShopSettings(prisma);
  const settings = getShopSettingsRuntime(settingsRecord);
  const currency = resolveRequestedCurrency(settings, input.currency);
  const pricingContext = buildShopViewerPricingContext(
    settings,
    input.customerGroup ?? null,
    Boolean(input.customerId),
    input.customerB2BDiscountPercent ?? null
  );
  const pricingAudience = resolveCheckoutAudience(pricingContext);

  const resolvedItems: ResolvedCheckoutItem[] = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const rawItem of input.items) {
    const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
    const product = await getShopProductBySlugServer(rawItem.slug);
    if (!product) continue;

    const variant = rawItem.variantId
      ? product.variants?.find((entry) => entry.id === rawItem.variantId)
      : undefined;
    const pricing = variant
      ? resolveShopPriceBands({
          b2cPrice: variant.price,
          b2cCompareAt: variant.compareAt ?? null,
          b2bPrice: variant.b2bPrice ?? null,
          b2bCompareAt: variant.b2bCompareAt ?? null,
          context: pricingContext,
        })
      : resolveShopProductPricing(product, pricingContext);

    const { amount, sourceCurrency } = resolveUnitPrice(pricing.effectivePrice, currency, settings);
    const total = roundMoney(amount * quantity);
    const title =
      typeof product.title === 'object' && product.title !== null
        ? product.title.en || product.title.ua || rawItem.slug
        : String(product.title);

    resolvedItems.push({
      productSlug: rawItem.slug,
      productId: product.id ?? null,
      variantId: variant?.id ?? rawItem.variantId ?? null,
      title,
      quantity,
      unitPrice: amount,
      total,
      image: product.image ?? null,
      priceSourceCurrency: sourceCurrency,
      pricingSource: pricing.source,
      discountPercent: pricing.discountPercent,
      brandName: product.brand,
      weightKg: variant?.weightKg ?? product.weightKg ?? null,
      length: variant?.length ?? product.length ?? null,
      width: variant?.width ?? product.width ?? null,
      height: variant?.height ?? product.height ?? null,
    });
    subtotal = roundMoney(subtotal + total);
    itemCount += quantity;
  }

  return buildQuoteFromSummary({
    settings,
    shippingAddress: input.shippingAddress,
    currency,
    audience: pricingAudience,
    customerGroup: input.customerGroup ?? null,
    customerB2BDiscountPercent: input.customerB2BDiscountPercent ?? null,
    subtotal,
    itemCount,
    items: resolvedItems,
  });
}
