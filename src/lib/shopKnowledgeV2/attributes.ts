import { hashKnowledgeValue } from "@/lib/shopKnowledgeV2/hash";
import {
  getShopKnowledgeCategoryEvidencePolicy,
  SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES,
} from "@/lib/shopKnowledgeV2/policy";
import { collectKnowledgeTextSources, htmlToKnowledgeText } from "@/lib/shopKnowledgeV2/text";
import type {
  KnowledgeAttributeValue,
  KnowledgeSourceProduct,
  ShopKnowledgeEvidenceDraft,
  ShopProductAttributeDraft,
} from "@/lib/shopKnowledgeV2/types";
import {
  getShopStockCategoryGroupForProduct,
  type ShopStockCategoryGroupId,
} from "@/lib/shopStockTaxonomy";

type AttributeMatch = {
  key: string;
  value: KnowledgeAttributeValue;
  match: RegExpMatchArray;
  confidence?: "high" | "medium" | "low";
};

export type CategoryAttributeExtraction = {
  categoryGroup: ShopStockCategoryGroupId;
  attributes: ShopProductAttributeDraft[];
  evidence: ShopKnowledgeEvidenceDraft[];
  fitmentCriticalKeys: string[];
  claimCriticalKeys: string[];
  optionalMerchandisingKeys: string[];
  requiredHardKeys: string[];
  missingFitmentKeys: string[];
  missingClaimKeys: string[];
  missingHardKeys: string[];
};

export { SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES } from "@/lib/shopKnowledgeV2/policy";

function sourceProductForTaxonomy(product: KnowledgeSourceProduct) {
  return {
    product: {
      brand: product.brand,
      vendor: product.vendor,
      productType: product.productType,
      sku: product.sku,
      slug: product.slug,
      title: { ua: product.titleUa, en: product.titleEn },
      category: { ua: product.categoryUa, en: product.categoryEn },
      collection: { ua: product.collectionUa, en: product.collectionEn },
      shortDescription: { ua: product.shortDescUa, en: product.shortDescEn },
      longDescription: { ua: product.longDescUa, en: product.longDescEn },
      tags: product.tags,
      variants: product.variants.map((variant) => ({
        sku: variant.sku,
        title: variant.title,
        optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
          (value): value is string => Boolean(value)
        ),
      })),
    },
  };
}

export function resolveKnowledgeCategoryGroup(
  product: KnowledgeSourceProduct
): ShopStockCategoryGroupId {
  return getShopStockCategoryGroupForProduct(sourceProductForTaxonomy(product), "ua").id;
}

function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern);
}

function matchEnum(
  text: string,
  key: string,
  candidates: ReadonlyArray<{ value: string; pattern: RegExp }>
): AttributeMatch | null {
  for (const candidate of candidates) {
    const match = firstMatch(text, candidate.pattern);
    if (match) return { key, value: candidate.value, match };
  }
  return null;
}

function matchNumber(text: string, key: string, pattern: RegExp, group = 1): AttributeMatch | null {
  const match = firstMatch(text, pattern);
  if (!match) return null;
  const rawValue = String(match[group] ?? "").trim();
  if (!rawValue) return null;
  const value = Number(rawValue.replace(",", "."));
  return Number.isFinite(value) ? { key, value, match } : null;
}

function matchDimensionsMm(text: string): AttributeMatch | null {
  const match = firstMatch(
    text,
    /\b(\d{2,4}(?:[.,]\d+)?)\s*[x×]\s*(\d{2,4}(?:[.,]\d+)?)\s*[x×]\s*(\d{2,4}(?:[.,]\d+)?)\s*mm\b/iu
  );
  if (!match) return null;
  const dimensions = match
    .slice(1, 4)
    .map((value) => String(value).replace(",", "."))
    .join("x");
  return { key: "dimensionsMm", value: dimensions, match };
}

function packageDependency(text: string): AttributeMatch | null {
  return matchEnum(text, "packageDependency", [
    {
      value: "m_sport",
      pattern: /\b(?:requires?|only\s+with|for|with)\s+(?:the\s+)?m[\s-]?sport\s+package\b/iu,
    },
    {
      value: "amg_line",
      pattern: /\b(?:requires?|only\s+with|for|with)\s+(?:the\s+)?amg[\s-]?line\s+package\b/iu,
    },
    {
      value: "sportdesign",
      pattern: /\b(?:requires?|only\s+with|for|with)\s+(?:the\s+)?sport[\s-]?design\s+package\b/iu,
    },
    {
      value: "competition",
      pattern: /\b(?:requires?|only\s+with|for|with)\s+(?:the\s+)?competition\s+package\b/iu,
    },
    {
      value: "widebody",
      pattern:
        /\b(?:requires?|only\s+with|for|with)\s+(?:the\s+)?wide[\s-]?body(?:\s+package)?\b/iu,
    },
  ]);
}

function commonMaterial(text: string): AttributeMatch | null {
  return matchEnum(text, "material", [
    { value: "titanium", pattern: /\b(?:titanium|titan|титан(?:ов\w*)?)\b/iu },
    {
      value: "stainless_steel",
      pattern: /\b(?:stainless(?:\s+steel)?|inox|нержавіюч\w*\s+стал\w*)\b/iu,
    },
    { value: "carbon", pattern: /\b(?:carbon(?:\s+fiber)?|карбон(?:ов\w*)?)\b/iu },
    { value: "aluminum", pattern: /\b(?:aluminium|aluminum|алюміні\w*)\b/iu },
  ]);
}

function commonPosition(text: string): AttributeMatch | null {
  return matchEnum(text, "position", [
    { value: "front_left", pattern: /\b(?:front[\s/-]*left|передн\w*\s+лів\w*)\b/iu },
    { value: "front_right", pattern: /\b(?:front[\s/-]*right|передн\w*\s+прав\w*)\b/iu },
    { value: "rear_left", pattern: /\b(?:rear[\s/-]*left|задн\w*\s+лів\w*)\b/iu },
    { value: "rear_right", pattern: /\b(?:rear[\s/-]*right|задн\w*\s+прав\w*)\b/iu },
    { value: "front", pattern: /\b(?:front|передн\w*)\b/iu },
    { value: "rear", pattern: /\b(?:rear|back|задн\w*)\b/iu },
    { value: "left", pattern: /\b(?:left|лів\w*)\b/iu },
    { value: "right", pattern: /\b(?:right|прав\w*)\b/iu },
  ]);
}

function extractExhaust(text: string): AttributeMatch[] {
  const productKind = matchEnum(text, "productKind", [
    {
      value: "downpipe",
      pattern: /\b(?:down[\s-]?pipe|даунпайп\w*|front\s+pipe|cat\s+pipe)\b/iu,
    },
    {
      value: "link_pipe",
      pattern: /\b(?:link[\s-]?pipe|mid[\s-]?pipe|з'єднувальн\w*\s+труб\w*)\b/iu,
    },
    { value: "tips", pattern: /\b(?:tail[\s-]?pipe|exhaust\s+tips?|насадк\w*)\b/iu },
    {
      value: "system",
      pattern:
        /\b(?:complete|full)\s+(?:exhaust\s+)?system\b|\b(?:cat[\s-]?back|evolution\s+line)\b|повн\w*\s+вихлопн\w*\s+систем/iu,
    },
    { value: "system", pattern: /\bslip[\s-]?on\b/iu },
    { value: "system", pattern: /\b(?:muffler|silencer|глушник\w*)\b/iu },
  ]);
  const negativeOpf = firstMatch(
    text,
    /\b(?:non[\s-]?(?:opf|gpf)|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))\b/iu
  );
  const positiveOpf = negativeOpf
    ? null
    : firstMatch(text, /\b(?:with|for|compatible\s+with|для|з)\s+(?:an?\s+)?(?:opf|gpf)\b/iu);
  const opfGpf = negativeOpf
    ? ({ key: "opfGpf", value: "without", match: negativeOpf } satisfies AttributeMatch)
    : positiveOpf
      ? ({ key: "opfGpf", value: "with", match: positiveOpf } satisfies AttributeMatch)
      : null;
  return [
    productKind,
    opfGpf,
    commonMaterial(text),
    matchEnum(text, "valves", [
      { value: "valved", pattern: /\b(?:valved|valvetronic|exhaust\s+valves?|клапанн\w*)\b/iu },
      {
        value: "non_valved",
        pattern: /\b(?:non[\s-]?valved|without\s+valves?|без\s+клапан\w*)\b/iu,
      },
    ]),
    matchEnum(text, "homologation", [
      { value: "e_mark", pattern: /\b(?:e[\s-]?marked?|e[\s-]?approved|ece)\b/iu },
      { value: "road_legal", pattern: /\b(?:road[\s-]?legal|street[\s-]?legal|омологован\w*)\b/iu },
      {
        value: "race_only",
        pattern: /\b(?:race\s+use\s+only|track\s+only|not\s+road\s+legal)\b/iu,
      },
    ]),
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractChipTuning(text: string): AttributeMatch[] {
  return [
    matchEnum(text, "productKind", [
      { value: "tuning_box", pattern: /\b(?:racechip|tuning\s+box|piggyback|powerxtra)\b/iu },
      { value: "ecu_tune", pattern: /\b(?:ecu\s+(?:map|tune|tuning)|stage\s*[1-4])\b/iu },
      { value: "tcu_tune", pattern: /\b(?:tcu|gearbox|transmission)\s+(?:map|tune|tuning)\b/iu },
      {
        value: "throttle_controller",
        pattern: /\b(?:throttle|accelerator)\s+(?:controller|tuning)|\bxlr\b/iu,
      },
    ]),
    matchEnum(text, "tuningFamily", [
      { value: "ecu", pattern: /\b(?:ecu|engine\s+control|stage\s*[1-4])\b/iu },
      { value: "tcu", pattern: /\b(?:tcu|gearbox|transmission)\s+(?:map|tune|tuning)\b/iu },
      {
        value: "throttle",
        pattern: /\b(?:throttle|accelerator)\s+(?:controller|tuning)|\bxlr\b/iu,
      },
      { value: "piggyback", pattern: /\b(?:racechip|tuning\s+box|piggyback|powerxtra)\b/iu },
    ]),
    matchEnum(text, "fuel", [
      { value: "diesel", pattern: /\b(?:diesel|tdi|cdi|dci|дизел\w*)\b/iu },
      { value: "petrol", pattern: /\b(?:petrol|gasoline|tfsi|tsi|бензин\w*)\b/iu },
      { value: "hybrid", pattern: /\b(?:hybrid|phev|mhev|гібрид\w*)\b/iu },
    ]),
    matchNumber(
      text,
      "stockPowerHp",
      /\b(?:stock|standard|factory|original|series)\s+(?:power\s*)?:?\s*(\d{2,4})\s*(?:hp|bhp|ps)\b/iu
    ),
    matchNumber(
      text,
      "stockTorqueNm",
      /\b(?:stock|standard|factory|original|series)\s+(?:torque\s*)?:?\s*(\d{2,4})\s*(?:nm|n·m)\b/iu
    ),
    matchNumber(
      text,
      "powerGainHp",
      /(?:\+\s*(\d{1,4})\s*(?:hp|bhp|ps|к\.?\s*с\.?)|(?:gain|increase|приріст)[^\d+]{0,24}\+?\s*(\d{1,4})\s*(?:hp|bhp|ps|к\.?\s*с\.?))/iu,
      1
    ) ??
      (() => {
        const match = firstMatch(
          text,
          /(?:gain|increase|приріст)[^\d+]{0,24}\+?\s*(\d{1,4})\s*(?:hp|bhp|ps|к\.?\s*с\.?)/iu
        );
        return match
          ? ({ key: "powerGainHp", value: Number(match[1]), match } satisfies AttributeMatch)
          : null;
      })(),
    matchNumber(text, "torqueGainNm", /\+\s*(\d{1,4})\s*(?:nm|нм|н·м)\b/iu),
    matchEnum(text, "engine", [
      {
        value:
          firstMatch(
            text,
            /\b(?:[bsn]\d{2}(?:tu\d?)?|ea\d{3}|m\d{2,3}|k\d{2}[a-z]\d?)\b/iu
          )?.[0].toUpperCase() ?? "",
        pattern: /\b(?:[bsn]\d{2}(?:tu\d?)?|ea\d{3}|m\d{2,3}|k\d{2}[a-z]\d?)\b/iu,
      },
    ]),
  ].filter(
    (item): item is AttributeMatch =>
      Boolean(item) && !(item?.key === "engine" && item.value === "")
  );
}

function extractBrakes(text: string): AttributeMatch[] {
  const setPosition = matchEnum(text, "setPosition", [
    { value: "pair", pattern: /\b(?:pair|set\s+of\s+2)\b/iu },
    { value: "left", pattern: /\bleft\b/iu },
    { value: "right", pattern: /\bright\b/iu },
  ]);
  return [
    setPosition,
    matchEnum(text, "productKind", [
      { value: "pad", pattern: /\b(?:brake\s+pads?|колодк\w*)\b/iu },
      {
        value: "rotor",
        pattern: /\b(?:brake\s+(?:disc|rotor)|rotor\s+ring|гальмівн\w*\s+диск\w*)\b/iu,
      },
      { value: "caliper", pattern: /\b(?:caliper|супорт\w*)\b/iu },
      { value: "kit", pattern: /\b(?:big\s+brake|brake\s+kit|гальмівн\w*\s+комплект\w*)\b/iu },
    ]),
    (() => {
      const position = commonPosition(text);
      return position ? { ...position, key: "axle" } : null;
    })(),
    matchEnum(text, "brakeSystem", [
      { value: "ccb", pattern: /\b(?:ccb|carbon[\s-]?ceramic|керамічн\w*)\b/iu },
      { value: "iron", pattern: /\b(?:iron|steel)\s+(?:disc|rotor)|чавунн\w*\s+диск/iu },
    ]),
    matchNumber(text, "diameterMm", /\b(\d{3})\s*mm\b/iu),
    matchEnum(text, "setPosition", [
      { value: "left", pattern: /\b(?:left|лів\w*)\b/iu },
      { value: "right", pattern: /\b(?:right|прав\w*)\b/iu },
      { value: "pair", pattern: /\b(?:pair|set\s+of\s+2|комплект|пара)\b/iu },
    ]),
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractSuspension(text: string): AttributeMatch[] {
  const loweringRange = firstMatch(
    text,
    /\b(?:lowering|lowered)[^\d]{0,20}(\d{1,3})(?:\s*(?:-|to|–)\s*(\d{1,3}))?\s*mm\b/iu
  );
  const loweringMin = loweringRange
    ? ({
        key: "loweringMinMm",
        value: Number(loweringRange[1]),
        match: loweringRange,
      } satisfies AttributeMatch)
    : null;
  const loweringMax = loweringRange
    ? ({
        key: "loweringMaxMm",
        value: Number(loweringRange[2] ?? loweringRange[1]),
        match: loweringRange,
      } satisfies AttributeMatch)
    : null;
  return [
    matchEnum(text, "productKind", [
      { value: "coilover_kit", pattern: /\b(?:coilovers?|road\s*&\s*track|coilover\s+kit)\b/iu },
      { value: "damper", pattern: /\b(?:damper|shock\s+absorber|амортизатор\w*)\b/iu },
      { value: "spring", pattern: /\b(?:lowering\s+springs?|spring\s+kit|пружин\w*)\b/iu },
      { value: "service_part", pattern: /\b(?:service|rebuild|replacement)\s+(?:part|kit)\b/iu },
      { value: "cancellation_kit", pattern: /\b(?:edc|pasm)\s+(?:cancellation|delete)\s+kit\b/iu },
    ]),
    (() => {
      const position = commonPosition(text);
      return position ? { ...position, key: "axle" } : null;
    })(),
    matchEnum(text, "edcCompatibility", [
      { value: "required", pattern: /\b(?:for|with)\s+(?:edc|pasm|adaptive\s+damp\w*)\b/iu },
      { value: "delete_kit", pattern: /\b(?:edc|pasm)\s+(?:cancellation|delete)\s+kit\b/iu },
      { value: "without", pattern: /\b(?:without|non[\s-]?)(?:edc|pasm)\b/iu },
    ]),
    loweringMin,
    loweringMax,
    matchNumber(
      text,
      "loweringMinMm",
      /\b(?:lowering|lowered|занижен\w*)[^\d]{0,20}(\d{1,3})\s*mm/iu
    ),
    matchNumber(
      text,
      "loweringMaxMm",
      /\b(?:lowering|lowered|занижен\w*)[^\d]{0,20}\d{1,3}\s*(?:-|to|–)\s*(\d{1,3})\s*mm/iu
    ),
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractPerformanceOrCooling(text: string, category: ShopStockCategoryGroupId) {
  const productKind = matchEnum(text, "productKind", [
    { value: "intercooler", pattern: /\b(?:intercooler|інтеркулер\w*)\b/iu },
    { value: "radiator", pattern: /\b(?:radiator|радіатор\w*)\b/iu },
    { value: "oil_cooler", pattern: /\b(?:oil\s+cooler|маслян\w*\s+радіатор\w*)\b/iu },
    { value: "heat_exchanger", pattern: /\b(?:heat\s+exchanger|теплообмінник\w*)\b/iu },
    { value: "intake", pattern: /\b(?:air\s+intake|intake\s+system|впуск\w*)\b/iu },
    { value: "charge_pipe", pattern: /\b(?:charge[\s-]?pipe|патруб\w*\s+наддув\w*)\b/iu },
    { value: "turbo_inlet", pattern: /\b(?:turbo\s+inlet|турбо\s+інлет)\b/iu },
    { value: "turbo", pattern: /\b(?:turbocharger|турбін\w*)\b/iu },
  ]);
  return [
    productKind,
    category === "cooling"
      ? matchEnum(text, "circuit", [
          {
            value: "engine_coolant",
            pattern: /\b(?:engine\s+coolant|water\s+radiator|охолоджувальн\w*\s+рідин\w*)\b/iu,
          },
          { value: "charge_air", pattern: /\b(?:charge\s+air|intercooler|інтеркулер\w*)\b/iu },
          { value: "engine_oil", pattern: /\b(?:engine\s+oil|oil\s+cooler|маслян\w*)\b/iu },
          { value: "transmission", pattern: /\b(?:transmission|gearbox)\s+(?:cooler|cooling)\b/iu },
        ])
      : null,
    matchEnum(text, "transmission", [
      { value: "automatic", pattern: /\b(?:automatic|dct|dsg|zf8|автоматичн\w*)\b/iu },
      { value: "manual", pattern: /\b(?:manual\s+transmission|механічн\w*)\b/iu },
    ]),
    matchDimensionsMm(text),
    matchNumber(
      text,
      "diameterMm",
      /\b(?:diameter|ø|діаметр)\s*:?\s*(\d{2,3}(?:[.,]\d+)?)\s*mm\b/iu
    ),
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractBodyPart(text: string, category: ShopStockCategoryGroupId): AttributeMatch[] {
  return [
    matchEnum(text, "productKind", [
      { value: "diffuser", pattern: /\b(?:diffuser|дифузор\w*)\b/iu },
      { value: "splitter", pattern: /\b(?:splitter|спліттер\w*)\b/iu },
      { value: "spoiler", pattern: /\b(?:spoiler|спойлер\w*)\b/iu },
      { value: "side_skirt", pattern: /\b(?:side\s+skirts?|порог\w*)\b/iu },
      { value: "hood", pattern: /\b(?:hood|bonnet|капот\w*)\b/iu },
      { value: "fender", pattern: /\b(?:fender|wing\s+panel|крил\w*)\b/iu },
      { value: "cover", pattern: /\b(?:cover|накладк\w*)\b/iu },
      { value: "trim", pattern: /\b(?:trim|оздоблен\w*)\b/iu },
      {
        value: category === "motoCarbon" ? "moto_panel" : "body_kit",
        pattern: /\b(?:fairing|panel|body\s+kit|обвіс\w*)\b/iu,
      },
    ]),
    commonPosition(text),
    commonMaterial(text),
    category === "motoCarbon"
      ? matchEnum(text, "roadUse", [
          { value: "road", pattern: /\b(?:road|street)[\s-]?(?:legal|use)?\b/iu },
          { value: "race", pattern: /\b(?:race|racing|track)[\s-]?(?:only|use)?\b/iu },
        ])
      : null,
    packageDependency(text),
    matchEnum(text, "bodyStyle", [
      { value: "sedan", pattern: /\b(?:sedan|saloon|седан\w*)\b/iu },
      { value: "coupe", pattern: /\b(?:coupe|coupé|купе)\b/iu },
      { value: "wagon", pattern: /\b(?:wagon|estate|touring|універсал\w*)\b/iu },
      { value: "suv", pattern: /\b(?:suv|sav|кросовер\w*|позашляховик\w*)\b/iu },
      { value: "convertible", pattern: /\b(?:convertible|cabrio|кабріолет\w*)\b/iu },
    ]),
    matchEnum(text, "facelift", [
      { value: "facelift", pattern: /\b(?:facelift|lci|рестайл\w*)\b/iu },
      { value: "pre_facelift", pattern: /\b(?:pre[\s-]?facelift|pre[\s-]?lci|дорестайл\w*)\b/iu },
    ]),
    matchEnum(text, "finish", [
      { value: "gloss", pattern: /\b(?:gloss|glossy|глянц\w*)\b/iu },
      { value: "matte", pattern: /\b(?:matt|matte|матов\w*)\b/iu },
      { value: "forged", pattern: /\b(?:forged|кован\w*)\b/iu },
      { value: "paint_ready", pattern: /\b(?:primed|paint\s+ready|під\s+фарбуван\w*)\b/iu },
    ]),
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractWheels(text: string): AttributeMatch[] {
  const productKind = matchEnum(text, "productKind", [
    {
      value: "wheel_set",
      pattern: /\b(?:set\s+of\s+(?:4|four)(?:\s+\w+){0,4}\s+wheels?|four[\s-]wheel\s+set)\b/iu,
    },
    { value: "wheel", pattern: /\b(?:wheels?|alloys?|rims?)\b/iu },
  ]);
  const setPosition = matchEnum(text, "setPosition", [
    { value: "set_of_4", pattern: /\b(?:set\s+of\s+(?:4|four)|four[\s-]wheel\s+set)\b/iu },
    { value: "pair", pattern: /\b(?:pair|set\s+of\s+(?:2|two))\b/iu },
    { value: "single", pattern: /\b(?:single|one)\s+wheel\b/iu },
  ]);
  return [
    productKind,
    setPosition,
    matchEnum(text, "productKind", [
      { value: "wheel", pattern: /\b(?:wheel|alloy|rim|диск\w*)\b/iu },
      {
        value: "wheel_set",
        pattern: /\b(?:set\s+of\s+(?:4|four)\s+wheels|комплект\s+(?:4|чотир\w*)\s+диск\w*)\b/iu,
      },
    ]),
    (() => {
      const match = firstMatch(text, /\b(\d{1,2})\s*[x×]\s*(\d{3}(?:[.,]\d+)?)\b/iu);
      return match
        ? ({
            key: "pcd",
            value: `${match[1]}x${match[2].replace(",", ".")}`,
            match,
          } satisfies AttributeMatch)
        : null;
    })(),
    matchNumber(
      text,
      "centerBoreMm",
      /\b(?:cb|centre\s+bore|center\s+bore|ступиц\w*)\s*:?\s*(\d{2,3}(?:[.,]\d+)?)\s*mm?\b/iu
    ),
    matchNumber(text, "diameterIn", /\b(\d{2})\s*(?:(?:inch|inches)\b|[″"])/iu),
    matchNumber(text, "widthIn", /\b(\d{1,2}(?:[.,]\d+)?)\s*j\s*[x×]\s*(?:1?\d{2})\b/iu),
    matchNumber(text, "offsetEt", /\bET\s*([+-]?\d{1,3}(?:[.,]\d+)?)\b/iu),
    matchNumber(text, "loadKg", /\b(?:load|навантажен\w*)\s*:?\s*(\d{3,4})\s*kg\b/iu),
    (() => {
      const position = commonPosition(text);
      return position ? { ...position, key: "axle" } : null;
    })(),
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractSimpleProduct(text: string, category: ShopStockCategoryGroupId): AttributeMatch[] {
  const productKind =
    category === "lighting"
      ? matchEnum(text, "productKind", [
          { value: "headlight", pattern: /\b(?:headlight|headlamp|фар\w*)\b/iu },
          { value: "tail_light", pattern: /\b(?:tail\s+light|rear\s+light|ліхтар\w*)\b/iu },
          { value: "bulb", pattern: /\b(?:bulb|ламп\w*)\b/iu },
        ])
      : category === "accessories"
        ? matchEnum(text, "productKind", [
            { value: "adapter", pattern: /\b(?:adapter|adaptor|адаптер\w*)\b/iu },
            { value: "mount", pattern: /\b(?:mount|bracket|кріплен\w*)\b/iu },
            { value: "hardware", pattern: /\b(?:hardware|clamp|gasket|хомут\w*|прокладк\w*)\b/iu },
          ])
        : category === "merch"
          ? matchEnum(text, "productKind", [
              {
                value: "apparel",
                pattern: /\b(?:shirt|t-shirt|hoodie|jacket|cap|одяг\w*|футболк\w*|худі)\b/iu,
              },
              {
                value: "souvenir",
                pattern: /\b(?:mug|keychain|sticker|souvenir|чашк\w*|брелок\w*)\b/iu,
              },
            ])
          : matchEnum(text, "productKind", [
              {
                value: "interior_part",
                pattern: /\b(?:steering|paddle|trim|seat|pedal|керм\w*|сидін\w*)\b/iu,
              },
            ]);

  return [
    productKind,
    commonPosition(text),
    category === "accessories"
      ? (() => {
          const match = firstMatch(
            text,
            /\b(?:for|fits|compatible\s+with|для)\s+(?:part|product|system|kit|комплект\w*)?\s*([A-Z0-9][A-Z0-9._/-]{3,})\b/u
          );
          return match
            ? ({
                key: "parentProduct",
                value: match[1],
                match,
                confidence: "medium",
              } satisfies AttributeMatch)
            : null;
        })()
      : null,
  ].filter((item): item is AttributeMatch => Boolean(item));
}

function extractMatches(text: string, categoryGroup: ShopStockCategoryGroupId): AttributeMatch[] {
  switch (categoryGroup) {
    case "exhaust":
      return extractExhaust(text);
    case "chipTuning":
      return extractChipTuning(text);
    case "brakes":
      return extractBrakes(text);
    case "suspension":
      return extractSuspension(text);
    case "cooling":
    case "performance":
      return extractPerformanceOrCooling(text, categoryGroup);
    case "carbonAero":
    case "motoCarbon":
      return extractBodyPart(text, categoryGroup);
    case "wheels":
      return extractWheels(text);
    case "interior":
      return [
        ...extractSimpleProduct(text, categoryGroup),
        ...extractBodyPart(text, categoryGroup),
      ];
    case "lighting":
    case "accessories":
    case "merch":
      return extractSimpleProduct(text, categoryGroup);
    case "other":
      return [];
  }
}

function valueType(value: KnowledgeAttributeValue): ShopProductAttributeDraft["valueType"] {
  if (Array.isArray(value)) return "string_list";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

function excerptForMatch(text: string, match: RegExpMatchArray): string {
  const index = match.index ?? text.indexOf(match[0]);
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + match[0].length + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function extractCategoryAttributesFromText(
  productId: string,
  textValue: string,
  categoryGroup: ShopStockCategoryGroupId,
  variantId: string | null = null
): Omit<CategoryAttributeExtraction, "categoryGroup"> {
  const text = htmlToKnowledgeText(textValue);
  const policy = getShopKnowledgeCategoryEvidencePolicy(categoryGroup);
  const fitmentCriticalKeys = [...policy.fitmentCritical];
  const claimCriticalKeys = [...policy.claimCritical];
  const optionalMerchandisingKeys = [...policy.optionalMerchandising];
  const requiredHardKeys = [...SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES[categoryGroup]];
  const uniqueMatches = new Map<string, AttributeMatch>();
  for (const match of extractMatches(text, categoryGroup)) {
    if (!uniqueMatches.has(match.key)) uniqueMatches.set(match.key, match);
  }

  const evidence: ShopKnowledgeEvidenceDraft[] = [];
  const attributes: ShopProductAttributeDraft[] = [];
  for (const match of uniqueMatches.values()) {
    const excerpt = excerptForMatch(text, match.match);
    const evidenceIdentity = {
      productId,
      variantId,
      fieldPath: `attributes.${match.key}`,
      source: "category_adapter" as const,
      sourceField: "aggregate",
      locale: "neutral" as const,
      excerpt,
    };
    const evidenceKey = hashKnowledgeValue(evidenceIdentity);
    evidence.push({
      evidenceKey,
      ...evidenceIdentity,
      sourceHash: hashKnowledgeValue(text),
      confidence: match.confidence ?? "high",
      verifiedAt: null,
      verifiedBy: null,
      contentHash: hashKnowledgeValue({
        ...evidenceIdentity,
        confidence: match.confidence ?? "high",
      }),
    });
    attributes.push({
      key: match.key,
      value: match.value,
      valueType: valueType(match.value),
      isHard: fitmentCriticalKeys.includes(match.key),
      source: "category_adapter",
      confidence: match.confidence ?? "high",
      evidenceKey,
      contentHash: hashKnowledgeValue({
        productId,
        variantId,
        key: match.key,
        value: match.value,
        evidenceKey,
      }),
    });
  }

  const presentKeys = new Set(attributes.map((attribute) => attribute.key));
  return {
    attributes,
    evidence,
    fitmentCriticalKeys,
    claimCriticalKeys,
    optionalMerchandisingKeys,
    requiredHardKeys,
    missingFitmentKeys: fitmentCriticalKeys.filter((key) => !presentKeys.has(key)),
    missingClaimKeys: claimCriticalKeys.filter((key) => !presentKeys.has(key)),
    missingHardKeys: requiredHardKeys.filter((key) => !presentKeys.has(key)),
  };
}

export function extractCategoryAttributes(
  product: KnowledgeSourceProduct,
  categoryGroup = resolveKnowledgeCategoryGroup(product)
): CategoryAttributeExtraction {
  const text = collectKnowledgeTextSources(product)
    .filter((source) => source.variantId === null && source.sourceField !== "option")
    .map((source) => source.text)
    .join("\n\n");
  return {
    categoryGroup,
    ...extractCategoryAttributesFromText(product.id, text, categoryGroup),
  };
}
