export const SHOP_LANDED_COST_MODES = ["DDP", "DAP", "QUOTE"] as const;
export type ShopLandedCostMode = (typeof SHOP_LANDED_COST_MODES)[number];

export type ShopLandedCostRule = {
  id: string;
  regionCode: string;
  regionName: string;
  regionNameUa: string;
  taxRate: number;
  customsDutyPct: number;
  appliesToShipping: boolean;
  incoterm: ShopLandedCostMode;
  brokerageFee: number;
  handlingFee: number;
  insurancePct: number;
  riskReservePct: number;
  importerOfRecord: string | null;
  ddpGuarantee: boolean;
  isActive: boolean;
};

export type ShopLandedCostBreakdown = {
  ruleId: string;
  ruleName: string;
  country: string;
  currency: string;
  mode: ShopLandedCostMode;
  guaranteed: boolean;
  importerOfRecord: string | null;
  customsValue: number;
  freightAmount: number;
  dutyAmount: number;
  insuranceAmount: number;
  brokerageAmount: number;
  handlingAmount: number;
  riskReserveAmount: number;
  importVatBase: number;
  importVatAmount: number;
  includedAmount: number;
  dueAtDeliveryAmount: number;
  requiresQuote: boolean;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value: unknown) {
  return Math.min(100, Math.max(0, finiteNumber(value)));
}

function normalizeCountry(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

export function normalizeShopLandedCostRule(
  input: Partial<ShopLandedCostRule>
): ShopLandedCostRule {
  const rawMode = String(input.incoterm ?? "DAP").toUpperCase();
  const incoterm = SHOP_LANDED_COST_MODES.includes(rawMode as ShopLandedCostMode)
    ? (rawMode as ShopLandedCostMode)
    : "DAP";

  return {
    id: String(input.id ?? ""),
    regionCode: String(input.regionCode ?? "")
      .trim()
      .toUpperCase(),
    regionName: String(input.regionName ?? "").trim(),
    regionNameUa: String(input.regionNameUa ?? input.regionName ?? "").trim(),
    taxRate: clampPercent(input.taxRate),
    customsDutyPct: clampPercent(input.customsDutyPct),
    appliesToShipping: input.appliesToShipping !== false,
    incoterm,
    brokerageFee: Math.max(0, finiteNumber(input.brokerageFee)),
    handlingFee: Math.max(0, finiteNumber(input.handlingFee)),
    insurancePct: clampPercent(input.insurancePct),
    riskReservePct: clampPercent(input.riskReservePct),
    importerOfRecord: input.importerOfRecord ? String(input.importerOfRecord).trim() : null,
    ddpGuarantee: input.ddpGuarantee === true,
    isActive: input.isActive !== false,
  };
}

export function resolveShopLandedCostRule(
  rules: ShopLandedCostRule[],
  country: string | null | undefined
) {
  const candidate = normalizeCountry(country);
  if (!candidate) return null;

  return (
    rules.find((rule) => {
      if (!rule.isActive) return false;
      return [rule.regionCode, rule.regionName, rule.regionNameUa]
        .map(normalizeCountry)
        .filter(Boolean)
        .some((value) => value === candidate);
    }) ?? null
  );
}

export function calculateShopLandedCost(input: {
  rule: ShopLandedCostRule | null;
  country: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  customsValue?: number;
  freightAmount?: number;
  taxableSubtotal?: number;
  taxableShippingCost?: number;
}): ShopLandedCostBreakdown | null {
  const rule = input.rule;
  if (!rule) return null;

  const customsValue = roundMoney(
    Math.max(0, finiteNumber(input.customsValue ?? input.taxableSubtotal ?? input.subtotal))
  );
  const freightAmount = roundMoney(
    Math.max(
      0,
      finiteNumber(input.freightAmount ?? input.taxableShippingCost ?? input.shippingCost)
    )
  );
  const dutyAmount = roundMoney(customsValue * (rule.customsDutyPct / 100));
  const insuranceAmount = roundMoney((customsValue + freightAmount) * (rule.insurancePct / 100));
  const brokerageAmount = roundMoney(rule.brokerageFee);
  const handlingAmount = roundMoney(rule.handlingFee);
  const riskReserveAmount = roundMoney(
    (freightAmount + dutyAmount + insuranceAmount + brokerageAmount + handlingAmount) *
      (rule.riskReservePct / 100)
  );
  const importVatBase = roundMoney(
    customsValue + (rule.appliesToShipping ? freightAmount : 0) + insuranceAmount + dutyAmount
  );
  const importVatAmount = roundMoney(importVatBase * (rule.taxRate / 100));
  const importCharges = roundMoney(
    dutyAmount +
      insuranceAmount +
      brokerageAmount +
      handlingAmount +
      riskReserveAmount +
      importVatAmount
  );

  return {
    ruleId: rule.id,
    ruleName: rule.regionNameUa || rule.regionName || rule.regionCode,
    country: input.country,
    currency: input.currency,
    mode: rule.incoterm,
    guaranteed: rule.incoterm === "DDP" && rule.ddpGuarantee && Boolean(rule.importerOfRecord),
    importerOfRecord: rule.importerOfRecord,
    customsValue,
    freightAmount,
    dutyAmount,
    insuranceAmount,
    brokerageAmount,
    handlingAmount,
    riskReserveAmount,
    importVatBase,
    importVatAmount,
    includedAmount: rule.incoterm === "DDP" ? importCharges : 0,
    dueAtDeliveryAmount: rule.incoterm === "DAP" || rule.incoterm === "QUOTE" ? importCharges : 0,
    requiresQuote: rule.incoterm === "QUOTE",
  };
}
