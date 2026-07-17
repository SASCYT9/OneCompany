import type { ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";

type GroundedIdentifierProduct = Pick<
  ShopAiProduct,
  "id" | "variantId" | "partNumber" | "name" | "description"
> &
  Partial<
    Pick<
      ShopAiProduct,
      | "price"
      | "priceSet"
      | "originalPrice"
      | "originalPriceSet"
      | "inStock"
      | "compatibility"
      | "matchBasis"
      | "matchStatus"
      | "facts"
    >
  >;

type GroundedOutputOptions = {
  currency?: ShopCurrencyCode;
};

const NUMBER_SOURCE = String.raw`\d+(?:[\s\u00a0.,]\d+)*`;
const PRICE_PATTERN = new RegExp(
  String.raw`(?:[$€₴]\s*(${NUMBER_SOURCE})|(${NUMBER_SOURCE})\s*(?:€|\$|₴|EUR|USD|UAH|грн(?:\.|ивень|ивні|ивня)?|євро|долар(?:ів|и)?))`,
  "giu"
);
const PRICE_WORD_PATTERN = new RegExp(
  String.raw`(?:price|costs?|priced\s+at|ціна|коштує|вартість)\s*(?::|is|становить|-)?\s*(${NUMBER_SOURCE})`,
  "giu"
);
const POWER_PATTERN = new RegExp(
  String.raw`(${NUMBER_SOURCE})\s*(?:hp|bhp|ps|к\.?\s*с\.?|кс)\b`,
  "giu"
);
const UNSUPPORTED_MEASUREMENT_PATTERN = new RegExp(
  String.raw`${NUMBER_SOURCE}\s*(?:n[·.\s-]?m|kw|w|mm|cm|kg|g|lb|lbs|cfm|psi|bar|dba?|°\s*[cf]|degrees?|inch(?:es)?|відсотк(?:и|ів)?|%)\b`,
  "giu"
);
const DEFINITIVE_COMPATIBILITY_PATTERN =
  /\b(?:fits?|compatible\s+with|is\s+compatible|designed\s+for|guaranteed\s+fit|confirmed\s+fitment|fitment\s+(?:is\s+)?confirmed|direct\s+replacement|підходить|сумісн(?:ий|а|е|і)\s+(?:з|із)|гарантован[а-яіїєґ]*\s+сумісн|підтверджен[а-яіїєґ]*\s+сумісн|сумісність\s+підтверджен[а-яіїєґ]*|точно\s+підходить|пряма\s+заміна)\b/giu;
const LEGAL_CLAIM_PATTERN =
  /\b(?:street[\s-]?legal|road[\s-]?legal|homologat(?:ed|ion)?|ece[\s-]?(?:approved|certified|r\d+)|t[üu]v[\s-]?(?:approved|certified)|сертифікован[а-яіїєґ]*|омологован[а-яіїєґ]*|легальн[а-яіїєґ]*\s+для\s+доріг|дозволен[а-яіїєґ]*\s+на\s+дорогах)\b/giu;

const MATERIAL_PATTERNS = [
  { value: "titanium", pattern: /\b(?:titanium|титан(?:ов(?:ий|а|е|і))?)\b/giu },
  {
    value: "stainless_steel",
    pattern: /\b(?:stainless\s+steel|нержав(?:іюча|іючої|ійна)\s+сталь)\b/giu,
  },
  {
    value: "carbon",
    pattern: /\b(?:carbon(?:\s+fiber)?|карбон(?:ов(?:ий|а|е|і))?)\b/giu,
  },
] as const;

function normalizeGroundedIdentifier(value: string) {
  return value
    .trim()
    .replace(/^#/, "")
    .replace(/[.,;:!?)}\]]+$/u, "")
    .toLocaleUpperCase("en-US");
}

function parseClaimNumber(value: string) {
  const compact = value.replace(/[\s\u00a0]/gu, "");
  if (!compact) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);
  if (separatorIndex < 0) {
    const parsed = Number(compact);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fractionLength = compact.length - separatorIndex - 1;
  const separatorCount = (compact.match(/[.,]/gu) ?? []).length;
  const thousandsOnly = separatorCount === 1 && fractionLength === 3;
  const normalized = thousandsOnly
    ? compact.replace(/[.,]/gu, "")
    : `${compact.slice(0, separatorIndex).replace(/[.,]/gu, "")}.${compact
        .slice(separatorIndex + 1)
        .replace(/[.,]/gu, "")}`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAllowedNumber(value: number | null, allowed: number[]) {
  if (value === null) return false;
  return allowed.some((candidate) => Math.abs(candidate - value) <= 0.01);
}

function collectAllowedPrices(
  products: GroundedIdentifierProduct[],
  currency: ShopCurrencyCode | undefined
) {
  const key = currency?.toLowerCase() as "eur" | "usd" | "uah" | undefined;
  return products.flatMap((product) => {
    const prices = [
      product.price,
      product.originalPrice,
      key ? product.priceSet?.[key] : null,
      key ? product.originalPriceSet?.[key] : null,
    ];
    if (!key) {
      prices.push(
        product.priceSet?.eur,
        product.priceSet?.usd,
        product.priceSet?.uah,
        product.originalPriceSet?.eur,
        product.originalPriceSet?.usd,
        product.originalPriceSet?.uah
      );
    }
    return prices.filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    );
  });
}

function claimedNumbers(message: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  const values: number[] = [];
  for (const match of message.matchAll(pattern)) {
    const raw = match.slice(1).find((value): value is string => Boolean(value));
    const parsed = raw ? parseClaimNumber(raw) : null;
    if (parsed !== null) values.push(parsed);
  }
  return values;
}

function validatesStructuredClaims(
  message: string,
  products: GroundedIdentifierProduct[],
  options: GroundedOutputOptions
) {
  const allowedPrices = collectAllowedPrices(products, options.currency);
  const priceClaims = [
    ...claimedNumbers(message, PRICE_PATTERN),
    ...claimedNumbers(message, PRICE_WORD_PATTERN),
  ];
  if (priceClaims.some((value) => !hasAllowedNumber(value, allowedPrices))) return false;

  const allowedPowerGains = products
    .map((product) => (product.facts?.powerGainVerified ? product.facts.powerGainHp : null))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const powerClaims = claimedNumbers(message, POWER_PATTERN);
  if (powerClaims.some((value) => !hasAllowedNumber(value, allowedPowerGains))) return false;
  if (
    /\b(?:adds?|gains?|increase[sd]?|boosts?|приріст|додає|збільшує)\s+(?:engine\s+)?power\b/iu.test(
      message
    ) &&
    allowedPowerGains.length === 0
  ) {
    return false;
  }

  UNSUPPORTED_MEASUREMENT_PATTERN.lastIndex = 0;
  if (UNSUPPORTED_MEASUREMENT_PATTERN.test(message)) return false;

  const allowedMaterials = new Set(
    products
      .map((product) => (product.facts?.materialVerified ? product.facts.material : null))
      .filter((value): value is NonNullable<NonNullable<ShopAiProduct["facts"]>["material"]> =>
        Boolean(value)
      )
  );
  for (const material of MATERIAL_PATTERNS) {
    material.pattern.lastIndex = 0;
    if (material.pattern.test(message) && !allowedMaterials.has(material.value)) return false;
  }

  const allowedOpf = new Set(
    products
      .map((product) => (product.facts?.opfGpfVerified ? product.facts.opfGpf : null))
      .filter((value): value is "with" | "without" => value === "with" || value === "without")
  );
  const claimsWithoutOpf =
    /\b(?:non[\s-]?(?:opf|gpf)|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))\b/iu.test(message);
  const claimsWithOpf =
    /\b(?:with\s+(?:opf|gpf)|compatible\s+with\s+(?:opf|gpf)|(?:opf|gpf)[\s-]?(?:compatible|сумісн[а-яіїєґ]*)|сумісн[а-яіїєґ]*\s+(?:з|із)\s+(?:opf|gpf))\b/iu.test(
      message
    );
  if (claimsWithoutOpf && !allowedOpf.has("without")) return false;
  if (claimsWithOpf && !allowedOpf.has("with")) return false;

  const installationTypes = new Set(
    products
      .map((product) =>
        product.facts?.installationTypeVerified ? product.facts.installationType : null
      )
      .filter(
        (value): value is NonNullable<NonNullable<ShopAiProduct["facts"]>["installationType"]> =>
          Boolean(value)
      )
  );
  if (
    /\b(?:plug[\s-]?and[\s-]?play|bolt[\s-]?on|direct\s+fit|no\s+modifications|без\s+доробок)\b/iu.test(
      message
    ) &&
    !installationTypes.has("direct_fit")
  ) {
    return false;
  }
  if (
    /\b(?:weld(?:ing)?\s+required|requires?\s+welding|потребує\s+зварюван)\b/iu.test(message) &&
    !installationTypes.has("welding_required")
  ) {
    return false;
  }
  if (
    /\b(?:professional\s+installation|професійн[а-яіїєґ]*\s+встановлен)\b/iu.test(message) &&
    !installationTypes.has("professional_installation")
  ) {
    return false;
  }

  DEFINITIVE_COMPATIBILITY_PATTERN.lastIndex = 0;
  if (
    DEFINITIVE_COMPATIBILITY_PATTERN.test(message) &&
    (products.length === 0 ||
      products.some(
        (product) =>
          product.matchBasis === "identity" ||
          (product.matchStatus !== "exact" && product.compatibility !== "confirmed")
      ))
  ) {
    return false;
  }

  LEGAL_CLAIM_PATTERN.lastIndex = 0;
  if (LEGAL_CLAIM_PATTERN.test(message)) return false;
  return true;
}

export function validateGroundedShopAiOutput(
  message: string,
  products: GroundedIdentifierProduct[],
  options: GroundedOutputOptions = {}
) {
  const allowedIds = new Set(
    products
      .flatMap((product) => [product.id, product.variantId])
      .filter((value): value is string => Boolean(value))
      .map(normalizeGroundedIdentifier)
  );
  const allowedSkus = new Set(
    products
      .map((product) => product.partNumber)
      .filter((value): value is string => Boolean(value))
      .map(normalizeGroundedIdentifier)
  );

  const uuidPattern =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  for (const match of message.matchAll(uuidPattern)) {
    if (!allowedIds.has(normalizeGroundedIdentifier(match[0]))) return false;
  }

  const labeledIdentifierPattern =
    /(?:sku|артикул|код(?:\s+товару)?|product\s+id|variant\s+id)\s*(?:(?:is|equals|є|це)\s+|[:#-]\s*)?([a-z0-9][a-z0-9._/-]{2,})/gi;
  for (const match of message.matchAll(labeledIdentifierPattern)) {
    const identifier = normalizeGroundedIdentifier(match[1]);
    if (!allowedIds.has(identifier) && !allowedSkus.has(identifier)) {
      return false;
    }
  }

  const hashIdentifierPattern = /#([a-z0-9][a-z0-9._/-]{2,})/gi;
  for (const match of message.matchAll(hashIdentifierPattern)) {
    const identifier = normalizeGroundedIdentifier(match[1]);
    if (!allowedSkus.has(identifier)) return false;
  }

  return validatesStructuredClaims(message, products, options);
}
