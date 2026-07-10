import type { ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";

export function extractDeclaredPowerGain(product: ShopAiProduct) {
  const evidence = `${product.name} ${product.description}`;
  const match = evidence.match(/\+\s*(\d{1,4})\s*(?:hp|bhp|к\.?\s*с\.?|сил)/i);
  return match ? Number(match[1]) : null;
}

export function filterShopAiProductsForPowerGoal(products: ShopAiProduct[], plan: ShopAiPlan) {
  if (!plan.powerGainHp) return products;
  return products.filter((product) => extractDeclaredPowerGain(product) !== null);
}

function shortProductName(product: ShopAiProduct) {
  return product.name.split("—")[0]?.trim() || product.brand;
}

export function buildShopAiPowerGoalAnswer(input: {
  locale: "ua" | "en";
  plan: ShopAiPlan;
  products: ShopAiProduct[];
}) {
  const target = input.plan.powerGainHp;
  if (!target) return null;

  const vehicle = [input.plan.vehicle.make, input.plan.vehicle.model, input.plan.vehicle.chassis]
    .filter(Boolean)
    .join(" ");
  const candidates = input.products
    .map((product) => ({ product, gain: extractDeclaredPowerGain(product) }))
    .filter((item): item is { product: ShopAiProduct; gain: number } => item.gain !== null)
    .sort((left, right) => right.gain - left.gain);
  const best = candidates[0];

  if (!best) {
    return input.locale === "ua"
      ? `Для ${vehicle || "цього авто"} немає товару з підтвердженим приростом +${target} к.с.`
      : `There is no product with a confirmed +${target} hp gain for ${vehicle || "this vehicle"}.`;
  }

  const productName = shortProductName(best.product);
  if (best.gain < target) {
    return input.locale === "ua"
      ? `Для ${vehicle || "цього авто"} є ${productName} із заявленими +${best.gain} к.с. До цілі +${target} к.с. він не дотягує; точного рішення в каталозі немає.`
      : `${productName} is confirmed for ${vehicle || "this vehicle"} with a stated +${best.gain} hp. It does not reach the +${target} hp target, and there is no exact catalog match.`;
  }

  if (best.gain > target) {
    return input.locale === "ua"
      ? `${productName} для ${vehicle || "цього авто"} має заявлений приріст +${best.gain} к.с., що перевищує ціль +${target} к.с.`
      : `${productName} for ${vehicle || "this vehicle"} has a stated +${best.gain} hp gain, exceeding the +${target} hp target.`;
  }

  return input.locale === "ua"
    ? `${productName} для ${vehicle || "цього авто"} має заявлений приріст +${best.gain} к.с., що відповідає цілі +${target} к.с.`
    : `${productName} for ${vehicle || "this vehicle"} has a stated +${best.gain} hp gain, meeting the +${target} hp target.`;
}
