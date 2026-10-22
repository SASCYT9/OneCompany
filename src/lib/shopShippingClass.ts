import type { ShopProduct } from "@/lib/shopCatalog";

/**
 * Nova Poshta cost depends on weight and size, and most catalogues carry
 * neither, so every product gets one of four size classes from its type or
 * title. Merchant Center prices each class through `g:shipping_label`, and the
 * /delivery page states the same range. Prices approved by the owner
 * (2026-10-18).
 */
export type ShopShippingClass = "small" | "medium" | "large" | "oversize";

export const SHOP_SHIPPING_CLASS_PRICE_UAH: Readonly<Record<ShopShippingClass, number>> = {
  small: 300,
  medium: 800,
  large: 2000,
  oversize: 5000,
};

// First match wins. Specific small items and exhaust accessories come before
// the size words, so "wheel spacers" or "exhaust tips" are not priced as
// wheels or a whole exhaust system. `\b` only knows Latin letters, so the
// Cyrillic whole words use letter lookarounds instead. An accessory named
// after "with" / "з" comes with the product ("exhaust system with carbon
// tailpipes"), so it does not make the product an accessory.
const SHIPPING_CLASS_RULES: ReadonlyArray<readonly [RegExp, ShopShippingClass]> = [
  [
    /chip.?tuning|чип.?тюн|racechip|\bjb4\b|\btuners?\b|тюнер|licen[cs]e|ліценз|\bflash|прошив|\bobd\b|sensor|датчик|spark plug|свіч(?:к|ок)|spacer|проставк|wheel accessor|\blug\b|wheel (?:nut|bolt|lock)|емблем|emblem|badge|sticker|наклейк|decal|brake pads?|колодк|blow.?off|\bbov\b|flex.?fuel|methanol|метанол|top mount|опор[аи]|powerxtra|чохол для ключ|key (?:case|cover|fob)/iu,
    "small",
  ],
  // Trims, vents and DRL modules that sit on a bumper ship in a small box.
  [
    /\bdrl\b|daytime running|ходов\S* вогн|bumper (?:trims?|vents?|inserts?)|(?:fender|wing|door|window|pillar|bonnet|hood|engine bay(?: upper)?|middle) (?:trims?|vents?)|canards?|канард|headlight covers?|повітрозабірник\S* (?:\S+ )?бампер/iu,
    "small",
  ],
  [
    /(?<!(?:\b(?:with|incl\.?|including|and)|&|(?<![а-яіїєґ])(?:з|із|зі|та|і|й))\s+(?:\S+\s+){0,3})(?:exhaust tips?|насадк|tail ?pipes?|аксесуари вихлопної|exhaust accessor|clamp|хомут|gasket|прокладк|накладк\S* радіатор|radiator cover)/iu,
    "medium",
  ],
  // A steering wheel or bumper corners are not a set of wheels or a whole bumper.
  [
    /steering wheel|(?<![а-яіїєґ])керм[оа](?![а-яіїєґ])|bumper corners?|(?<![а-яіїєґ])кут\S* (?:\S+ )?бампер|door panels?/iu,
    "medium",
  ],
  [
    /body.?kit|обвіс|bumper|бампер|\bhoods?\b|bonnet|капот|boot ?lid|trunk ?lid|кришк\S* багажник|spoiler|спойлер|антикрил|\bwing\b(?!\s*mirror)|side skirt|side step|підніжк|поріг|пороги|\bsills?\b|wide.?body|\barch(?:es)?\b|(?<![а-яіїєґ])арк[иа](?![а-яіїєґ])|fender|крил[оа]|wheel ?sets?|комплект\S* (?:колісних )?дисків|\bwheels\b|\broof\b|(?<![а-яіїєґ])дах(?![а-яіїєґ])/iu,
    "oversize",
  ],
  [
    /exhaust|вихлоп|silencer|muffler|глушник|cat.?back|кат.?бек|slip.?on|evolution line|downpipe|даунпайп|апайп|catalyst|каталізатор|header|випускн\S* колектор|coilover|койловер|suspension kit|комплект\S* підвіски|shock|амортизатор|lift system|підйому підвіски|(?<!маслян\S*\s)радіатор|(?<!oil\s)radiator|intercooler|інтеркулер|diffuser|дифузор|front lip|splitter|сплітер|\bgrill|решітк|\bwheel\b|monoblock|cars \/ bundles/iu,
    "large",
  ],
  [
    /intake|впуск|air ?box|charge pipe|boost pipe|turbo inlet|brake rotor|гальмівн\S* диск|carbon.?ceramic|spring|пружин|strut brace|розпірк|oil cooler|маслян|catch can|fuel pump|паливн\S* насос|port injection|manifold|колектор|engine cover|кришк\S* двигун|heat shield|теплозахис|\btubes?\b|\bpipes?\b|(?<![а-яіїєґ])труб/iu,
    "medium",
  ],
  [
    /filter|фільтр|mirror|дзеркал|canard|\bvents?\b|accessor|аксесуар|billet|universal|патруб|\bhoses?\b|шланг|кріплен/iu,
    "small",
  ],
];

// Catch-all types that say nothing about size (iPE files whole exhaust
// systems under "Accessories"); the title decides for them.
const GENERIC_PRODUCT_TYPE =
  /^(?:accessories|performance parts?|premium tuning|carbon parts?|інше|other|universal products|engine accessories)$/iu;

// Motorcycle parts ship in smaller boxes than their car counterparts.
const MOTO_CLASS: Readonly<Record<ShopShippingClass, ShopShippingClass>> = {
  small: "small",
  medium: "medium",
  large: "medium",
  oversize: "large",
};

function classify(text: string): ShopShippingClass | null {
  if (!text.trim()) return null;
  for (const [pattern, shippingClass] of SHIPPING_CLASS_RULES) {
    if (pattern.test(text)) return shippingClass;
  }
  return null;
}

/**
 * Size class for Nova Poshta pricing: the curated product type or category
 * first, the title for generic types ("Premium Tuning", "Accessories");
 * unknown items count as medium, motorcycle parts one class smaller.
 */
export function resolveShopShippingClass(
  product: Pick<ShopProduct, "productType" | "category" | "title"> & {
    scope?: ShopProduct["scope"];
  }
): ShopShippingClass {
  const typeText = [product.productType, product.category?.en, product.category?.ua]
    .filter(Boolean)
    .join(" | ");
  const titleText = [product.title?.en, product.title?.ua].filter(Boolean).join(" | ");
  const typeClass = GENERIC_PRODUCT_TYPE.test(product.productType?.trim() ?? "")
    ? null
    : classify(typeText);
  const shippingClass = typeClass ?? classify(titleText) ?? "medium";
  return product.scope === "moto" ? MOTO_CLASS[shippingClass] : shippingClass;
}
