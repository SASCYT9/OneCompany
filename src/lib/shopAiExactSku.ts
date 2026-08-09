import { compactShopCode, isStructuredPartQuery } from "@/lib/shopVehicleSearch";

const SKU_INTENT =
  /(?:^|\s)(?:артикул(?:ом|у|а)?|sku|part\s*(?:number|no\.?|#)|номер\s+детал[іи])\s*(?:[:#№=-]\s*)?/iu;
const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/iu;

function normalizeSkuCandidate(value: string) {
  return value
    .trim()
    .replace(/^["'«„“]+|["'»”.,!?;:]+$/gu, "")
    .trim();
}

function isSafeSkuCandidate(value: string, explicitIntent: boolean) {
  if (!value || VIN_PATTERN.test(value) || /\s/.test(value)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/+()-]{2,79}$/u.test(value)) return false;
  if (isStructuredPartQuery(value)) return true;
  if (/^\d{5,32}$/u.test(value)) return true;
  return explicitIntent && /[A-Za-z]/u.test(value) && /[._/+()-]/u.test(value);
}

export function getShopAiExactSkuLookupToken(message: string) {
  const normalized = message.trim();
  if (!normalized || VIN_PATTERN.test(normalized)) return null;

  let candidate = normalized;
  let explicitIntent = false;
  if (/\s/.test(normalized)) {
    const intent = SKU_INTENT.exec(normalized);
    if (!intent) return null;
    explicitIntent = true;
    const remainder = normalized.slice((intent.index ?? 0) + intent[0].length).trim();
    const tokens = remainder.split(/\s+/u).map(normalizeSkuCandidate).filter(Boolean);
    if (tokens.length !== 1) return null;
    candidate = tokens[0] ?? "";
  }

  candidate = normalizeSkuCandidate(candidate);
  if (!isSafeSkuCandidate(candidate, explicitIntent)) return null;
  const token = compactShopCode(candidate);
  return token.length >= 4 ? token : null;
}
