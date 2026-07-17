import { compactShopCode, isStructuredPartQuery } from "@/lib/shopVehicleSearch";

export function getShopAiExactSkuLookupToken(message: string) {
  const normalized = message.trim();
  if (!normalized || /\s/.test(normalized) || !isStructuredPartQuery(normalized)) return null;
  const token = compactShopCode(normalized);
  return token.length >= 4 ? token : null;
}
