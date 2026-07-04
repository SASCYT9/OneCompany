import { buildShopSearchText, normalizeShopSearchText } from "@/lib/shopSearch";

export type ShopStockCategoryGroupId =
  | "chipTuning"
  | "exhaust"
  | "brakes"
  | "suspension"
  | "cooling"
  | "performance"
  | "motoCarbon"
  | "carbonAero"
  | "wheels"
  | "lighting"
  | "interior"
  | "accessories"
  | "merch"
  | "other";

type LocalizedText = {
  ua?: string | null;
  en?: string | null;
};

export type ShopStockTaxonomyItem = {
  product: {
    brand?: string | null;
    vendor?: string | null;
    productType?: string | null;
    sku?: string | null;
    slug?: string | null;
    title?: LocalizedText | null;
    category?: LocalizedText | null;
    collection?: LocalizedText | null;
    shortDescription?: LocalizedText | null;
    longDescription?: LocalizedText | null;
    tags?: string[] | null;
    highlights?: LocalizedText[] | null;
    collections?: Array<{
      handle?: string | null;
      title?: LocalizedText | null;
      brand?: string | null;
    }> | null;
    variants?: Array<{
      sku?: string | null;
      title?: string | null;
      optionValues?: string[] | null;
    }> | null;
  };
  searchText?: string;
};

type ShopStockCategoryGroup = {
  id: ShopStockCategoryGroupId;
  ua: string;
  en: string;
  keywords: string[];
};

export const SHOP_STOCK_CATEGORY_GROUPS: ShopStockCategoryGroup[] = [
  {
    id: "chipTuning",
    ua: "Чіп-тюнінг",
    en: "Chip tuning",
    keywords: [
      "racechip",
      "chip tuning",
      "chip-tuning",
      "tuning box",
      "gts black",
      "gts5",
      "gts 5",
      "racechip rs",
      "racechip xlr",
      "jb plus",
      "jb+",
      "quick install tuner",
      "throttle tuning",
      "ecu tune",
      "ecu tuning",
      "чіп-тюнінг",
      "чіп тюнінг",
    ],
  },
  {
    id: "exhaust",
    ua: "Вихлопні системи",
    en: "Exhaust systems",
    keywords: [
      "akrapovic",
      "remus",
      "ipe",
      "exhaust",
      "cat back",
      "cat-back",
      "slip on",
      "slip-on",
      "evolution line",
      "link pipe",
      "downpipe",
      "downpipes",
      "muffler",
      "silencer",
      "tailpipe",
      "tailpipes",
      "connection tube",
      "replacement tube",
      "outlet tube",
      "catalyst",
      "catalytic",
      "sound kit",
      "sound controller",
      "sound package",
      "вихлоп",
      "випуск",
      "глушник",
      "даунпайп",
      "аппайп",
      "каталізатор",
      "насадки",
    ],
  },
  {
    id: "brakes",
    ua: "Гальмівна система",
    en: "Brake systems",
    keywords: [
      "girodisc",
      "brake",
      "brakes",
      "brake rotor",
      "brake rotors",
      "brake pad",
      "brake pads",
      "caliper",
      "rotor ring",
      "iron rotor",
      "гальм",
      "гальмівні диски",
      "гальмівні колодки",
      "супорт",
    ],
  },
  {
    id: "suspension",
    ua: "Підвіска",
    en: "Suspension",
    keywords: [
      "ohlins",
      "suspension",
      "coilover",
      "coilovers",
      "damper",
      "shock absorber",
      "shock",
      "spring kit",
      "lowering spring",
      "lowering kit",
      "підвіск",
      "амортиз",
      "пружин",
    ],
  },
  {
    id: "cooling",
    ua: "Охолодження та патрубки",
    en: "Cooling and hoses",
    keywords: [
      "do88",
      "csf",
      "cooling",
      "radiator",
      "radiators",
      "intercooler",
      "intercoolers",
      "oil cooler",
      "heat exchanger",
      "hose",
      "hoses",
      "coupler",
      "couplers",
      "silicone hose",
      "coolant",
      "охолодж",
      "радіатор",
      "інтеркулер",
      "масляні радіатори",
      "патруб",
      "шланг",
      "силіконов",
    ],
  },
  {
    id: "performance",
    ua: "Впуск, турбо і двигун",
    en: "Intake, turbo and engine",
    keywords: [
      "jb4",
      "intake",
      "air intake",
      "air filter",
      "filter bmc",
      "charge pipe",
      "charge pipes",
      "chargepipe",
      "turbo inlet",
      "inlet",
      "inlets",
      "silicone inlet",
      "silicone inlets",
      "turbo",
      "turbocharger",
      "blow off valve",
      "bov",
      "manifold",
      "charge air",
      "boost",
      "fuel",
      "injector",
      "injectors",
      "methanol injection",
      "water methanol",
      "sensor",
      "sensors",
      "engine tuning",
      "впуск",
      "повітряні фільтри",
      "турбо",
      "датчики",
      "двигун",
    ],
  },
  {
    id: "motoCarbon",
    ua: "Мото карбон",
    en: "Moto carbon",
    keywords: [
      "ilmberger",
      "ducati",
      "panigale",
      "diavel",
      "streetfighter",
      "xdiavel",
      "aprilia",
      "yamaha",
      "m 1000 rr",
      "m1000rr",
      "m 1000 r",
      "m1000r",
      "m 1000 xr",
      "m1000xr",
      "s 1000 rr",
      "s1000rr",
      "s 1000 r",
      "s1000r",
      "s 1000 xr",
      "s1000xr",
      "motorcycle carbon",
      "moto carbon",
    ],
  },
  {
    id: "carbonAero",
    ua: "Карбон і аеродинаміка",
    en: "Carbon and aero",
    keywords: [
      "adro",
      "carbon",
      "carbon fibre",
      "carbon fiber",
      "aero",
      "aerodynamics",
      "body kit",
      "bodykit",
      "body package",
      "aero kit",
      "widetrack",
      "roof rack",
      "roof attachment",
      "rear fascia",
      "front fascia",
      "fascia insert",
      "fascia inserts",
      "underrun protection",
      "front guard",
      "rear ladder",
      "diffuser",
      "splitter",
      "spoiler",
      "wing",
      "lip",
      "side skirt",
      "skirt",
      "bumper",
      "hood",
      "bonnet",
      "grille",
      "widebody",
      "карбон",
      "аеро",
      "дифузор",
      "спойлер",
      "обвіс",
      "пороги",
      "бампер",
      "підспойлер",
      "накладки",
    ],
  },
  {
    id: "wheels",
    ua: "Диски і колеса",
    en: "Wheels",
    keywords: [
      "wheel",
      "wheels",
      "rim",
      "rims",
      "tyre",
      "tyres",
      "tire",
      "tires",
      "wheel spacer",
      "spacers",
      "center cap",
      "monoblock",
      "alloy wheel",
      "alloy wheels",
      "диски",
      "колеса",
      "проставки",
    ],
  },
  {
    id: "lighting",
    ua: "Світло і електроніка",
    en: "Lighting and electronics",
    keywords: [
      "drl",
      "light bar",
      "light",
      "lights",
      "lamp",
      "lamps",
      "led",
      "lighting",
      "entry panels",
      "rgb entry panels",
      "електроніка",
      "світло",
      "фари",
      "ліхтар",
      "led",
    ],
  },
  {
    id: "interior",
    ua: "Інтер'єр",
    en: "Interior",
    keywords: [
      "interior",
      "steering wheel",
      "seat",
      "floor mat",
      "trunk mat",
      "velour",
      "leather",
      "trim parts",
      "pedal pads",
      "paddle shifter",
      "paddle shifters",
      "door lock pin",
      "door lock pins",
      "door panel",
      "door panels",
      "pedal",
      "cabin",
      "інтер'єр",
      "інтерєр",
      "салон",
      "кермо",
      "сидіння",
      "килимки",
    ],
  },
  {
    id: "accessories",
    ua: "Аксесуари і кріплення",
    en: "Accessories and hardware",
    keywords: [
      "accessory",
      "accessories",
      "hardware",
      "mount",
      "mounting",
      "bracket",
      "clamp",
      "clamps",
      "gasket",
      "adapter",
      "adaptor",
      "valve cap",
      "valve caps",
      "license plate",
      "jack pad",
      "tow hook",
      "door handle",
      "door handles",
      "replacement",
      "cover",
      "badge",
      "emblem",
      "key cover",
      "аксесуари",
      "хомут",
      "хомути",
      "кріплення",
      "адаптер",
      "прокладка",
      "кришка",
      "емблема",
    ],
  },
  {
    id: "merch",
    ua: "Мерч",
    en: "Merch",
    keywords: [
      "merch",
      "apparel",
      "clothing",
      "t-shirt",
      "shirt",
      "hoodie",
      "jacket",
      "watch",
      "luminor",
      "souvenir",
      "souvenirs",
      "usb",
      "flash drive",
      "мерч",
      "одяг",
      "сувеніри",
      "накопичувач",
      "кепка",
      "футболка",
      "худі",
    ],
  },
  {
    id: "other",
    ua: "Інше",
    en: "Other",
    keywords: [],
  },
];

const GROUP_BY_ID = new Map(SHOP_STOCK_CATEGORY_GROUPS.map((group) => [group.id, group]));

const STOCK_CATEGORY_RESOLUTION_ORDER: ShopStockCategoryGroupId[] = [
  "merch",
  "chipTuning",
  "exhaust",
  "brakes",
  "suspension",
  "cooling",
  "performance",
  "wheels",
  "motoCarbon",
  "interior",
  "carbonAero",
  "lighting",
  "accessories",
];

const STOCK_CATEGORY_RESOLUTION_GROUPS = STOCK_CATEGORY_RESOLUTION_ORDER.map(
  (groupId) => GROUP_BY_ID.get(groupId)!
);

const GROUP_LABEL_LOOKUP = new Map(
  SHOP_STOCK_CATEGORY_GROUPS.flatMap((group) => [
    [normalizeShopSearchText(group.id), group.id],
    [normalizeShopSearchText(group.ua), group.id],
    [normalizeShopSearchText(group.en), group.id],
  ])
);

function getLocalizedValue(value: LocalizedText | null | undefined, locale: string) {
  if (!value) return "";
  return locale === "en" ? value.en || value.ua || "" : value.ua || value.en || "";
}

export function getLocalizedShopStockProductCategory(
  product: ShopStockTaxonomyItem["product"],
  locale: string
) {
  return getLocalizedValue(product.category, locale);
}

function getCategoryCorpus(item: ShopStockTaxonomyItem, locale: string) {
  const product = item.product;
  const fieldText = buildShopSearchText([
    product.brand,
    product.vendor,
    product.productType,
    product.sku,
    product.slug,
    product.title?.ua,
    product.title?.en,
    getLocalizedValue(product.category, locale),
    product.category?.ua,
    product.category?.en,
    ...(product.tags ?? []),
    ...(product.variants ?? []).flatMap((variant) => [
      variant.sku,
      variant.title,
      variant.optionValues?.join(" "),
    ]),
  ]);

  return ` ${fieldText} `;
}

function corpusIncludesKeyword(corpus: string, keyword: string) {
  const normalizedKeyword = normalizeShopSearchText(keyword);
  return normalizedKeyword.length > 0 && corpus.includes(` ${normalizedKeyword} `);
}

export function getShopStockCategoryGroupForProduct(
  item: ShopStockTaxonomyItem,
  locale: string
): ShopStockCategoryGroup {
  const corpus = getCategoryCorpus(item, locale);
  return (
    STOCK_CATEGORY_RESOLUTION_GROUPS.find((group) =>
      group.keywords.some((keyword) => corpusIncludesKeyword(corpus, keyword))
    ) ?? GROUP_BY_ID.get("other")!
  );
}

export function getShopStockCategoryLabel(groupId: ShopStockCategoryGroupId, locale: string) {
  const group = GROUP_BY_ID.get(groupId) ?? GROUP_BY_ID.get("other")!;
  return locale === "en" ? group.en : group.ua;
}

export function getShopStockCategoryLabelForProduct(item: ShopStockTaxonomyItem, locale: string) {
  return getShopStockCategoryLabel(getShopStockCategoryGroupForProduct(item, locale).id, locale);
}

export function matchesShopStockCategory(
  item: ShopStockTaxonomyItem,
  selectedCategory: string,
  locale: string
) {
  const normalizedSelected = normalizeShopSearchText(selectedCategory);
  if (!normalizedSelected) return true;

  const selectedGroupId = GROUP_LABEL_LOOKUP.get(normalizedSelected);
  if (selectedGroupId) {
    return getShopStockCategoryGroupForProduct(item, locale).id === selectedGroupId;
  }

  const rawCategory = getLocalizedShopStockProductCategory(item.product, locale);
  return normalizeShopSearchText(rawCategory) === normalizedSelected;
}
