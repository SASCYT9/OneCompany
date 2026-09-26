import { CustomerGroup, Prisma, PrismaClient } from "@prisma/client";
import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
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
} from "@/lib/shopAdminSettings";
import {
  resolveCheckoutAudience,
  resolveShopPriceBands,
  resolveShopProductPricing,
  type ShopPriceAudience,
} from "@/lib/shopPricingAudience";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { isWheelForceWheel, WHEELFORCE_WHEEL_SET_SIZE } from "@/lib/wheelforceFamily";
import {
  addRevozportUkraineShippingToPriceSet,
  calculateRevozportShippingUsd,
  isRevozportBrand,
  isUkraineCountry,
  isUkraineShippingZone,
} from "@/lib/revozportShipping";
import {
  calculateShopLandedCost,
  normalizeShopLandedCostRule,
  resolveShopLandedCostRule,
  type ShopLandedCostBreakdown,
  type ShopLandedCostRule,
} from "@/lib/shopLandedCost";

type CheckoutRequestItem = {
  slug: string;
  quantity: number;
  variantId?: string | null;
};

/**
 * Landed-cost rules are deliberately disconnected from live checkout totals
 * until the production data and DDP/DAP assumptions have been approved.
 */
export function isShopLandedCostCheckoutEnabled(
  value = process.env.SHOP_LANDED_COST_CHECKOUT_ENABLED
) {
  return String(value ?? "").trim() === "1";
}

/**
 * Keeps new zone-scoped/included-shipping rules in preview mode until their
 * production totals have been approved independently from the existing rules.
 */
export function isShopAdvancedLogisticsPricingEnabled(
  value = process.env.SHOP_ADVANCED_LOGISTICS_PRICING_ENABLED
) {
  return String(value ?? "").trim() === "1";
}

export type CheckoutShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postcode?: string;
  country: string;
};

type ResolvedCheckoutItem = {
  sku?: string | null;
  variantTitle?: string | null;
  productSlug: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  total: number;
  image: string | null;
  priceSourceCurrency: ShopCurrencyCode;
  pricingSource: "b2c" | "b2b-explicit" | "b2b-discount";
  pricingBaseRegion: "default" | "europe";
  discountPercent: number | null;
  brandName: string | null;
  weightKg: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  /** Legacy supplier sea-freight quote to Ukraine, in USD, when available. */
  shippingToUaUsd: number | null;
  shippingIncludedInPrice: boolean;
};

type CheckoutRuleSnapshot = {
  id: string;
  name: string;
  currency?: ShopCurrencyCode;
  countries: string[];
  regions: string[];
  rate?: number;
  value?: number;
  mode?: "percent" | "fixed";
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
  shippingIncludedInPrice: boolean;
  taxableSubtotal: number;
  taxableShippingCost: number;
  taxAmount: number;
  total: number;
  landedCost: ShopLandedCostBreakdown | null;
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
  landedCostRules?: ShopLandedCostRule[];
  advancedLogisticsPricingEnabled?: boolean;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeMatchValue(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

function matchesLocation(ruleValues: string[], candidate?: string | null) {
  if (!ruleValues.length) return true;
  const normalizedCandidate = normalizeMatchValue(candidate);
  return ruleValues.some((entry) => {
    const rawEntry = String(entry ?? "").trim();
    if (rawEntry === "*") return true;
    const normalizedEntry = normalizeMatchValue(rawEntry);
    return normalizedEntry === normalizedCandidate;
  });
}

function resolveRequestedCurrency(settings: ShopSettingsRuntime, requested?: string) {
  const normalized = String(
    requested ?? settings.defaultCurrency
  ).toUpperCase() as ShopCurrencyCode;
  return settings.enabledCurrencies.includes(normalized) ? normalized : settings.defaultCurrency;
}

function convertAmount(
  amount: number,
  fromCurrency: ShopCurrencyCode,
  toCurrency: ShopCurrencyCode,
  rates: Record<ShopCurrencyCode, number>
) {
  if (fromCurrency === toCurrency) return roundMoney(amount);

  const amountInEur = fromCurrency === "EUR" ? amount : amount / rates[fromCurrency];
  const converted = toCurrency === "EUR" ? amountInEur : amountInEur * rates[toCurrency];
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
    new Set<ShopCurrencyCode>([settings.defaultCurrency, "EUR", "USD", "UAH"])
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

function resolveTaxRegion(settings: ShopSettingsRuntime, address: CheckoutShippingAddress) {
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

function pickTieredFee(
  brackets: NonNullable<ShopBrandShippingRule["brackets"]>,
  subtotal: number
): number {
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
  items: ResolvedCheckoutItem[],
  advancedLogisticsPricingEnabled: boolean
): ShippingCostResult {
  if (!zone) return { cost: 0, requiresQuote: false, brandsRequiringQuote: [] };
  if (advancedLogisticsPricingEnabled && zone.shippingMode === "included") {
    return { cost: 0, requiresQuote: false, brandsRequiringQuote: [] };
  }
  const resolvedZoneId = zone.id;
  const usesSupplierUkraineQuotes = isUkraineShippingZone(zone);
  const hasRevozportWeightRate = items.some(
    (item) =>
      !item.shippingIncludedInPrice &&
      isRevozportBrand(item.brandName) &&
      calculateRevozportShippingUsd(item.weightKg) != null
  );
  const hasSupplierUkraineQuote =
    usesSupplierUkraineQuotes &&
    items.some((item) => !item.shippingIncludedInPrice && item.shippingToUaUsd != null);

  // Revozport's weight rate and the legacy Ukraine quote must not be bypassed
  // by a generic free-shipping threshold.
  if (
    zone.freeOver != null &&
    subtotal >= zone.freeOver &&
    !hasRevozportWeightRate &&
    !hasSupplierUkraineQuote
  ) {
    return { cost: 0, requiresQuote: false, brandsRequiringQuote: [] };
  }

  let totalCost = zone.baseRate;
  const brandsRequiringQuote = new Set<string>();

  // A rule can be global (legacy behavior) or scoped to the matched checkout
  // zone. The scoped rule wins, then the brand's global rule, then the global
  // fallback. This makes it possible to configure, for example, one fixed
  // Eventuri tariff for EU and another for the USA without changing the
  // existing all-regions rules.
  const defaultRules = settings.brandShippingRules.filter(
    (r) => r.enabled && r.id === SHOP_BRAND_DEFAULT_RULE_ID
  );

  function resolveItemRule(itemBrandName: string | null): ShopBrandShippingRule | null {
    const normalizedBrand = itemBrandName?.trim().toLowerCase();

    if (normalizedBrand) {
      const brandRules = settings.brandShippingRules.filter(
        (r) =>
          r.enabled &&
          r.id !== SHOP_BRAND_DEFAULT_RULE_ID &&
          r.brandName.trim().toLowerCase() === normalizedBrand
      );
      const global = brandRules.find((r) => !r.shippingZoneId);
      if (!advancedLogisticsPricingEnabled && global) return global;
      const scoped = brandRules.find((r) => r.shippingZoneId === resolvedZoneId);
      if (advancedLogisticsPricingEnabled && scoped) return scoped;
      if (global) return global;
    }

    const globalDefault = defaultRules.find((r) => !r.shippingZoneId) ?? null;
    if (!advancedLogisticsPricingEnabled) return globalDefault;
    const scopedDefault = defaultRules.find((r) => r.shippingZoneId === resolvedZoneId);
    return scopedDefault ?? globalDefault;
  }

  if (zone.calcMode === "volumetric") {
    // Pre-compute per-brand subtotals (in zone.currency) for cart-level rules
    // (tiered / percent / manual_quote). These rules are applied ONCE per brand,
    // not per item, since they're conceptually about the whole cart line.
    const cartLevelBrandSubtotals = new Map<string, number>();
    const cartLevelBrandsSeen = new Set<string>();
    for (const item of items) {
      if (!item.brandName) continue;
      const rule = resolveItemRule(item.brandName);
      if (!rule) continue;
      if (rule.mode !== "tiered" && rule.mode !== "percent" && rule.mode !== "manual_quote")
        continue;
      const lineTotalZone = convertAmount(
        item.total,
        item.priceSourceCurrency,
        zone.currency,
        settings.currencyRates
      );
      // Key by item.brandName (NOT rule.brandName) — when default applies, each
      // brand still gets its own subtotal bucket so a tiered fallback charges
      // per brand, not once for the whole cart.
      cartLevelBrandSubtotals.set(
        item.brandName,
        (cartLevelBrandSubtotals.get(item.brandName) || 0) + lineTotalZone
      );
    }

    for (const item of items) {
      let itemCost = 0;
      let handledByRule = false;

      const revozportShippingUsd = isRevozportBrand(item.brandName)
        ? item.shippingIncludedInPrice
          ? null
          : calculateRevozportShippingUsd(item.weightKg)
        : null;
      const shippingUsd =
        revozportShippingUsd ??
        (!item.shippingIncludedInPrice && usesSupplierUkraineQuotes ? item.shippingToUaUsd : null);

      if (item.shippingIncludedInPrice) {
        handledByRule = true;
      } else if (shippingUsd != null) {
        itemCost =
          convertAmount(shippingUsd, "USD", zone.currency, settings.currencyRates) * item.quantity;
        handledByRule = true;
      }

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
      if (rule && !handledByRule) {
        handledByRule = true;
        const warehouseDeliveryCostForOne = actualWeight * rule.warehouseRatePerKg;
        // Use the item's brand for cart-level keying so default-rule applications
        // bucket per brand. brandsRequiringQuote messaging also reads better
        // ("Brabus needs a quote") than the literal default-rule label.
        const brandKey = item.brandName || rule.brandName || "default";

        if (rule.mode === "free") {
          itemCost = 0;
        } else if (rule.mode === "fixed") {
          const fixedFee = convertAmount(
            rule.value,
            rule.currency,
            zone.currency,
            settings.currencyRates
          );
          itemCost = (fixedFee + warehouseDeliveryCostForOne) * item.quantity;
        } else if (rule.mode === "multiplier") {
          itemCost =
            (standardCostForOne * rule.value + warehouseDeliveryCostForOne) * item.quantity;
        } else if (rule.mode === "tiered" || rule.mode === "percent") {
          // Cart-level rule: apply ONCE per brand, on first occurrence.
          // Subsequent items of the same brand only contribute warehouseRatePerKg.
          if (!cartLevelBrandsSeen.has(brandKey)) {
            cartLevelBrandsSeen.add(brandKey);
            const brandSubtotalZone = cartLevelBrandSubtotals.get(brandKey) || 0;
            const brandSubtotalRuleCurrency = convertAmount(
              brandSubtotalZone,
              zone.currency,
              rule.currency,
              settings.currencyRates
            );
            let feeRuleCurrency = 0;
            if (rule.mode === "tiered") {
              feeRuleCurrency = pickTieredFee(rule.brackets ?? [], brandSubtotalRuleCurrency);
            } else {
              feeRuleCurrency = brandSubtotalRuleCurrency * (rule.value / 100);
            }
            const feeZone = convertAmount(
              feeRuleCurrency,
              rule.currency,
              zone.currency,
              settings.currencyRates
            );
            itemCost = feeZone + warehouseDeliveryCostForOne * item.quantity;
          } else {
            itemCost = warehouseDeliveryCostForOne * item.quantity;
          }
        } else if (rule.mode === "manual_quote") {
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
    const actualItemCount =
      items.length > 0 ? items.reduce((sum, item) => sum + item.quantity, 0) : itemCount;
    if (items.length > 0) {
      totalCost += items.reduce((sum, item) => {
        if (item.shippingIncludedInPrice) return sum;
        const revozportShippingUsd = isRevozportBrand(item.brandName)
          ? item.shippingIncludedInPrice
            ? null
            : calculateRevozportShippingUsd(item.weightKg)
          : null;
        const shippingUsd =
          revozportShippingUsd ??
          (!item.shippingIncludedInPrice && usesSupplierUkraineQuotes
            ? item.shippingToUaUsd
            : null);
        if (shippingUsd == null) {
          return sum + zone.perItemRate * item.quantity;
        }
        return (
          sum +
          convertAmount(shippingUsd, "USD", zone.currency, settings.currencyRates) * item.quantity
        );
      }, 0);
    } else {
      totalCost += zone.perItemRate * actualItemCount;
    }
  }

  return {
    cost: convertAmount(totalCost, zone.currency, currency, settings.currencyRates),
    requiresQuote: brandsRequiringQuote.size > 0,
    brandsRequiringQuote: Array.from(brandsRequiringQuote),
  };
}

function calculateTaxAmount(
  region: ShopTaxRegion | null,
  taxableSubtotal: number,
  taxableShippingCost: number
) {
  if (!region || region.rate <= 0) return 0;
  const base = taxableSubtotal + (region.appliesToShipping ? taxableShippingCost : 0);
  if (base <= 0) return 0;
  return roundMoney(base * region.rate);
}

async function loadShopLandedCostRules(prisma: PrismaClient): Promise<ShopLandedCostRule[]> {
  try {
    const records = await prisma.shopTaxRegionRule.findMany({
      where: { isActive: true, landedCostEnabled: true },
      orderBy: [{ sortOrder: "asc" }, { regionCode: "asc" }],
    });
    return records.map((record) =>
      normalizeShopLandedCostRule({
        id: record.id,
        regionCode: record.regionCode,
        regionName: record.regionName,
        regionNameUa: record.regionNameUa,
        taxRate: record.taxRate,
        customsDutyPct: record.customsDutyPct,
        appliesToShipping: record.appliesToShipping,
        incoterm: record.incoterm as ShopLandedCostRule["incoterm"],
        brokerageFee: record.brokerageFee,
        handlingFee: record.handlingFee,
        insurancePct: record.insurancePct,
        riskReservePct: record.riskReservePct,
        importerOfRecord: record.importerOfRecord,
        ddpGuarantee: record.ddpGuarantee,
        isActive: record.isActive,
      })
    );
  } catch (error) {
    // Keep checkout compatible with databases that have not received the
    // landed-cost migration yet. The legacy JSON tax/shipping path remains the
    // safe fallback until the migration is deployed.
    console.warn("[shop-checkout] landed-cost rules unavailable", error);
    return [];
  }
}

function calculateEuropeTaxableSubtotal(items: ResolvedCheckoutItem[], subtotal: number) {
  if (!items.length) return subtotal;

  const taxableSubtotal = items.reduce(
    (sum, item) => sum + (item.pricingBaseRegion === "europe" ? item.total : 0),
    0
  );

  return roundMoney(Math.min(Math.max(0, taxableSubtotal), subtotal));
}

function calculateProportionalAmount(amount: number, numerator: number, denominator: number) {
  if (amount <= 0 || numerator <= 0 || denominator <= 0) return 0;
  const ratio = Math.min(1, numerator / denominator);
  return roundMoney(amount * ratio);
}

function calculateRegionalAdjustmentAmount(
  rule: ShopRegionalPricingRule | null,
  subtotal: number,
  currency: ShopCurrencyCode,
  settings: ShopSettingsRuntime
) {
  if (!rule) return 0;

  if (rule.mode === "percent") {
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
  shippingIncludedInPrice: boolean;
  taxableSubtotal: number;
  taxableShippingCost: number;
  taxAmount: number;
  total: number;
  landedCost: ShopLandedCostBreakdown | null;
  itemCount: number;
  items: ResolvedCheckoutItem[];
  shippingZone: ShopShippingZone | null;
  taxRegion: ShopTaxRegion | null;
  regionalPricingRule: ShopRegionalPricingRule | null;
}): Prisma.InputJsonValue {
  const {
    settings,
    currency,
    address,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    shippingIncludedInPrice,
    taxableSubtotal,
    taxableShippingCost,
    taxAmount,
    total,
    landedCost,
    itemCount,
    items,
    shippingZone,
    taxRegion,
    regionalPricingRule,
  } = params;

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
      variantId: item.variantId,
      sku: item.sku ?? null,
      variantTitle: item.variantTitle ?? null,
      brandName: item.brandName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      sourceCurrency: item.priceSourceCurrency,
      pricingSource: item.pricingSource,
      pricingBaseRegion: item.pricingBaseRegion,
      discountPercent: item.discountPercent,
      shippingToUaUsd: item.shippingToUaUsd,
      shippingIncludedInPrice: item.shippingIncludedInPrice,
    })),
    itemCount,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    shippingIncludedInPrice,
    taxableSubtotal,
    taxableShippingCost,
    taxAmount,
    total,
    landedCost,
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
  const rawTaxableSubtotal = calculateEuropeTaxableSubtotal(input.items, subtotal);
  const regionalPricingRule = resolveRegionalPricingRule(input.settings, input.shippingAddress);
  const rawRegionalAdjustmentAmount = calculateRegionalAdjustmentAmount(
    regionalPricingRule,
    subtotal,
    currency,
    input.settings
  );
  const adjustedSubtotal = roundMoney(Math.max(0, subtotal + rawRegionalAdjustmentAmount));
  const regionalAdjustmentAmount = roundMoney(adjustedSubtotal - subtotal);
  const taxableRegionalAdjustmentAmount = calculateProportionalAmount(
    regionalAdjustmentAmount,
    rawTaxableSubtotal,
    subtotal
  );
  const taxableSubtotal = roundMoney(
    Math.max(0, rawTaxableSubtotal + taxableRegionalAdjustmentAmount)
  );
  const shippingZone = resolveShippingZone(input.settings, input.shippingAddress, adjustedSubtotal);
  const shippingResult = calculateShippingCost(
    shippingZone,
    currency,
    input.settings,
    subtotal,
    itemCount,
    input.items,
    input.advancedLogisticsPricingEnabled === true
  );
  const shippingCost = shippingResult.cost;
  const shippingIncludedInPrice =
    input.items.length > 0 && input.items.every((item) => item.shippingIncludedInPrice);
  const taxableShippingCost = input.items.length
    ? calculateProportionalAmount(shippingCost, taxableSubtotal, adjustedSubtotal)
    : shippingCost;
  const configuredLandedCostRule = resolveShopLandedCostRule(
    input.landedCostRules ?? [],
    input.shippingAddress.country
  );
  const configuredTaxRegion = resolveTaxRegion(input.settings, input.shippingAddress);
  const taxRegion =
    configuredTaxRegion ??
    (configuredLandedCostRule
      ? {
          id: configuredLandedCostRule.id,
          name: configuredLandedCostRule.regionNameUa || configuredLandedCostRule.regionName,
          countries: [
            configuredLandedCostRule.regionCode,
            configuredLandedCostRule.regionName,
            configuredLandedCostRule.regionNameUa,
          ],
          regions: [],
          rate: configuredLandedCostRule.taxRate / 100,
          appliesToShipping: configuredLandedCostRule.appliesToShipping,
          enabled: true,
        }
      : null);
  const legacyTaxAmount = calculateTaxAmount(taxRegion, taxableSubtotal, taxableShippingCost);
  const landedCost = calculateShopLandedCost({
    rule: configuredLandedCostRule,
    country: input.shippingAddress.country,
    currency,
    subtotal: adjustedSubtotal,
    shippingCost,
    customsValue: adjustedSubtotal,
    freightAmount: shippingCost,
  });
  const taxAmount =
    landedCost?.mode === "DDP" ? landedCost.importVatAmount : landedCost ? 0 : legacyTaxAmount;
  const total = roundMoney(
    adjustedSubtotal +
      shippingCost +
      (landedCost?.mode === "DDP" ? landedCost.includedAmount : 0) +
      (landedCost?.mode === "DDP" ? 0 : taxAmount)
  );

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
    shippingIncludedInPrice,
    taxableSubtotal,
    taxableShippingCost,
    taxAmount,
    total,
    itemCount,
    items: input.items,
    shippingZone,
    taxRegion,
    regionalPricingRule,
    landedCost,
  });

  return {
    currency,
    pricingAudience: input.audience,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    shippingIncludedInPrice,
    taxableSubtotal,
    taxableShippingCost,
    taxAmount,
    total,
    landedCost,
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
    requiresQuote: shippingResult.requiresQuote || Boolean(landedCost?.requiresQuote),
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
    items?: Array<{
      total: number;
      quantity?: number;
      pricingBaseRegion: "default" | "europe";
      brandName?: string | null;
      weightKg?: number | null;
      length?: number | null;
      width?: number | null;
      height?: number | null;
      shippingToUaUsd?: number | null;
    }>;
    advancedLogisticsPricingEnabled?: boolean;
  }
) {
  const currency = resolveRequestedCurrency(settings, input.currency);
  const previewItems: ResolvedCheckoutItem[] = (input.items ?? []).map((item, index) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const total = roundMoney(Math.max(0, Number(item.total) || 0));
    return {
      productSlug: `preview-${index + 1}`,
      productId: null,
      variantId: null,
      title: `Preview item ${index + 1}`,
      quantity,
      unitPrice: roundMoney(total / quantity),
      total,
      image: null,
      priceSourceCurrency: currency,
      pricingSource: "b2c",
      pricingBaseRegion: item.pricingBaseRegion,
      discountPercent: null,
      brandName: item.brandName ?? null,
      weightKg: item.weightKg ?? null,
      length: item.length ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      shippingToUaUsd: item.shippingToUaUsd ?? null,
      shippingIncludedInPrice: false,
    };
  });
  const subtotal = previewItems.length
    ? roundMoney(previewItems.reduce((sum, item) => sum + item.total, 0))
    : input.subtotal;
  const itemCount = previewItems.length
    ? previewItems.reduce((sum, item) => sum + item.quantity, 0)
    : input.itemCount;

  return buildQuoteFromSummary({
    settings,
    shippingAddress: input.shippingAddress,
    currency,
    audience: "b2c",
    customerGroup: null,
    customerB2BDiscountPercent: null,
    subtotal,
    itemCount,
    items: previewItems,
    landedCostRules: [],
    advancedLogisticsPricingEnabled: input.advancedLogisticsPricingEnabled !== false,
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
  const landedCostRules = isShopLandedCostCheckoutEnabled()
    ? await loadShopLandedCostRules(prisma)
    : [];
  const currency = resolveRequestedCurrency(settings, input.currency);
  const pricingContext = await buildShopViewerPricingContextServer({
    prisma,
    settings,
    customerId: input.customerId,
    customerGroup: input.customerGroup,
    isAuthenticated: Boolean(input.customerId),
    customerB2BDiscountPercent: input.customerB2BDiscountPercent,
    priceCountry: input.shippingAddress.country,
  });
  const pricingAudience = resolveCheckoutAudience(pricingContext);

  const resolvedItems: ResolvedCheckoutItem[] = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const rawItem of input.items) {
    const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
    const product = await getShopProductBySlugServer(rawItem.slug);
    if (!product) continue;
    if (isWheelForceWheel(product) && quantity % WHEELFORCE_WHEEL_SET_SIZE !== 0) {
      throw new Error("WHEELFORCE_SET_OF_FOUR_REQUIRED");
    }

    const variant = rawItem.variantId
      ? product.variants?.find((entry) => entry.id === rawItem.variantId)
      : undefined;
    const variantWeightKg = variant?.weightKg ?? product.weightKg ?? null;
    const pricing = variant
      ? resolveShopPriceBands({
          b2cPrice: addRevozportUkraineShippingToPriceSet(
            variant.price,
            product.brand,
            input.shippingAddress.country,
            variantWeightKg,
            settings.currencyRates
          ),
          europePrice: variant.europePrice ?? product.europePrice ?? null,
          b2cCompareAt: variant.compareAt ?? null,
          b2bPrice: variant.b2bPrice ?? null,
          b2bCompareAt: variant.b2bCompareAt ?? null,
          context: pricingContext,
          brand: product.brand,
        })
      : resolveShopProductPricing(product, pricingContext);

    const { amount, sourceCurrency } = resolveUnitPrice(pricing.effectivePrice, currency, settings);
    const total = roundMoney(amount * quantity);
    const title =
      typeof product.title === "object" && product.title !== null
        ? product.title.en || product.title.ua || rawItem.slug
        : String(product.title);

    resolvedItems.push({
      sku: variant?.sku || product.sku || null,
      variantTitle: variant?.title || null,
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
      pricingBaseRegion: pricing.baseRegion,
      discountPercent: pricing.discountPercent,
      brandName: product.brand,
      weightKg: variant?.weightKg ?? product.weightKg ?? null,
      length: variant?.length ?? product.length ?? null,
      width: variant?.width ?? product.width ?? null,
      height: variant?.height ?? product.height ?? null,
      shippingToUaUsd: variant?.shippingToUaUsd ?? product.shippingToUaUsd ?? null,
      shippingIncludedInPrice:
        isUkraineCountry(input.shippingAddress.country) &&
        isRevozportBrand(product.brand) &&
        calculateRevozportShippingUsd(variantWeightKg) != null,
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
    landedCostRules,
    advancedLogisticsPricingEnabled: isShopAdvancedLogisticsPricingEnabled(),
  });
}
