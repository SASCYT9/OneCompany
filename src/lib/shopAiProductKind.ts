import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";
import { normalizeShopSearchText } from "@/lib/shopSearch";

export const SHOP_AI_PRODUCT_KINDS = [
  "system",
  "downpipe",
  "link_pipe",
  "tips",
  "tuning_box",
  "ecu_tune",
  "tcu_tune",
  "throttle_controller",
  "pad",
  "rotor",
  "caliper",
  "kit",
  "coilover_kit",
  "damper",
  "spring",
  "service_part",
  "cancellation_kit",
  "intercooler",
  "radiator",
  "oil_cooler",
  "heat_exchanger",
  "intake",
  "charge_pipe",
  "turbo_inlet",
  "turbo",
  "diffuser",
  "splitter",
  "spoiler",
  "side_skirt",
  "hood",
  "fender",
  "cover",
  "trim",
  "body_kit",
  "moto_panel",
  "wheel",
  "wheel_set",
  "headlight",
  "tail_light",
  "bulb",
  "adapter",
  "mount",
  "hardware",
  "apparel",
  "souvenir",
  "interior_part",
  "any",
] as const;

export type ShopAiProductKind = (typeof SHOP_AI_PRODUCT_KINDS)[number];

const PRODUCT_KIND_SET = new Set<string>(SHOP_AI_PRODUCT_KINDS);

type LocalizedProductKindTerms = ReadonlyArray<readonly [ShopAiProductKind, ReadonlyArray<string>]>;

const LOCALIZED_PRODUCT_KIND_TERMS: Partial<
  Record<ShopStockCategoryGroupId, LocalizedProductKindTerms>
> = {
  exhaust: [
    ["tips", ["насадк", "наконечник"]],
    ["downpipe", ["даунпайп"]],
    ["link_pipe", ["лінк пайп", "линк пайп", "з'єднувальн труб"]],
    ["system", ["вихлопн систем", "выхлопн систем", "глушник"]],
  ],
  brakes: [
    ["pad", ["гальмівн колодк", "тормозн колодк", "колодк"]],
    ["rotor", ["гальмівн диск", "тормозн диск"]],
    ["caliper", ["супорт"]],
    ["kit", ["гальмівн комплект", "тормозн комплект"]],
  ],
  suspension: [
    ["coilover_kit", ["койловер", "коиловер"]],
    ["damper", ["амортизатор"]],
    ["spring", ["пружин"]],
  ],
  cooling: [
    ["intercooler", ["інтеркулер", "интеркулер"]],
    ["oil_cooler", ["маслян радіатор", "маслян радиатор"]],
    ["heat_exchanger", ["теплообмінник", "теплообменник"]],
    ["radiator", ["радіатор", "радиатор"]],
  ],
  performance: [
    ["turbo_inlet", ["турбо впуск", "турбо інлет", "турбо инлет"]],
    ["charge_pipe", ["патрубок наддув", "пайп наддув"]],
    ["intake", ["впуск", "впускн систем"]],
    ["turbo", ["турбін", "турбин"]],
  ],
  carbonAero: [
    ["diffuser", ["дифузор", "диффузор"]],
    ["splitter", ["спліттер", "сплиттер"]],
    ["spoiler", ["спойлер"]],
    ["side_skirt", ["порог"]],
    ["hood", ["капот"]],
    ["fender", ["крило", "крыло"]],
    ["body_kit", ["обвіс", "обвес"]],
  ],
  wheels: [
    ["wheel_set", ["комплект дисків", "комплект дисков"]],
    ["wheel", ["диск", "колес"]],
  ],
  lighting: [
    ["headlight", ["фара"]],
    ["tail_light", ["ліхтар", "фонар"]],
    ["bulb", ["ламп"]],
  ],
  interior: [["interior_part", ["кермо", "руль", "сидін", "сиден", "педал"]]],
};

function inferLocalizedProductKind(
  text: string,
  categories: ReadonlyArray<ShopStockCategoryGroupId>
) {
  const normalized = normalizeShopSearchText(text);
  for (const category of categories) {
    for (const [kind, terms] of LOCALIZED_PRODUCT_KIND_TERMS[category] ?? []) {
      if (
        terms.some((term) => {
          const normalizedTerm = normalizeShopSearchText(term);
          return normalizedTerm.length > 0 && normalized.includes(normalizedTerm);
        })
      ) {
        return kind;
      }
    }
  }
  return null;
}

export function cleanShopAiProductKind(value: unknown): ShopAiProductKind | null {
  const candidate = String(value ?? "").trim();
  return PRODUCT_KIND_SET.has(candidate) ? (candidate as ShopAiProductKind) : null;
}

function firstMatch(text: string, candidates: ReadonlyArray<[ShopAiProductKind, RegExp]>) {
  return candidates.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

export function inferShopAiProductKind(
  text: string,
  category: ShopStockCategoryGroupId | null
): ShopAiProductKind {
  const groups: Partial<
    Record<ShopStockCategoryGroupId, ReadonlyArray<[ShopAiProductKind, RegExp]>>
  > = {
    exhaust: [
      ["tips", /(?:\btailpipes?\b|\bexhaust tips?\b|насад\p{L}*|наконечник\p{L}*)/iu],
      ["downpipe", /(?:\bdownpipes?\b|даунпайп\p{L}*)/iu],
      [
        "link_pipe",
        /(?:\blink[ -]?pipes?\b|\bconnection tubes?\b|л[іи]нк[ -]?пайп\p{L}*|з['’]єднувальн\p{L}*\s+труб\p{L}*)/iu,
      ],
      [
        "system",
        /(?:\bexhaust systems?\b|\bsport exhaust\b|\bracing exhaust\b|\bcat[ -]?back\b|\baxle[ -]?back\b|\bslip[ -]?on\b|\bevolution line\b|\bmufflers?\b|\bsilencers?\b|вихлопн\p{L}*\s+систем\p{L}*|глушник\p{L}*)/iu,
      ],
    ],
    chipTuning: [
      ["throttle_controller", /(?:throttle|accelerator)\s+(?:controller|tuning)|\bxlr\b/iu],
      ["tcu_tune", /\b(?:tcu|gearbox|transmission)\s+(?:map|tune|tuning)\b/iu],
      ["ecu_tune", /\b(?:ecu\s+(?:map|tune|tuning)|stage\s*[1-4])\b/iu],
      ["tuning_box", /\b(?:racechip|tuning\s+box|piggyback|powerxtra)\b/iu],
    ],
    brakes: [
      ["pad", /\b(?:brake\s+pads?|колодк\p{L}*)\b/iu],
      ["rotor", /\b(?:brake\s+(?:disc|rotor)|rotor\s+ring|гальмівн\p{L}*\s+диск\p{L}*)\b/iu],
      ["caliper", /\b(?:caliper|супорт\p{L}*)\b/iu],
      ["kit", /\b(?:big\s+brake|brake\s+kit|гальмівн\p{L}*\s+комплект\p{L}*)\b/iu],
    ],
    suspension: [
      ["cancellation_kit", /\b(?:edc|pasm)\s+(?:cancellation|delete)\s+kit\b/iu],
      ["coilover_kit", /\b(?:coilovers?|road\s*&\s*track|coilover\s+kit)\b/iu],
      ["damper", /\b(?:damper|shock\s+absorber|амортизатор\p{L}*)\b/iu],
      ["spring", /\b(?:lowering\s+springs?|spring\s+kit|пружин\p{L}*)\b/iu],
      ["service_part", /\b(?:service|rebuild|replacement)\s+(?:part|kit)\b/iu],
    ],
    cooling: [
      ["intercooler", /\b(?:intercooler|інтеркулер\p{L}*)\b/iu],
      ["oil_cooler", /\b(?:oil\s+cooler|маслян\p{L}*\s+радіатор\p{L}*)\b/iu],
      ["heat_exchanger", /\b(?:heat\s+exchanger|теплообмінник\p{L}*)\b/iu],
      ["radiator", /\b(?:radiator|радіатор\p{L}*)\b/iu],
    ],
    performance: [
      ["charge_pipe", /\b(?:charge[ -]?pipe|патруб\p{L}*\s+наддув\p{L}*)\b/iu],
      ["turbo_inlet", /\b(?:turbo\s+inlet|турбо\s+інлет)\b/iu],
      ["intake", /\b(?:air\s+intake|intake\s+system|впуск\p{L}*)\b/iu],
      ["turbo", /\b(?:turbocharger|турбін\p{L}*)\b/iu],
    ],
    carbonAero: [
      ["diffuser", /\b(?:diffuser|дифузор\p{L}*)\b/iu],
      ["splitter", /\b(?:splitter|спліттер\p{L}*)\b/iu],
      ["spoiler", /\b(?:spoiler|спойлер\p{L}*)\b/iu],
      ["side_skirt", /\b(?:side\s+skirts?|порог\p{L}*)\b/iu],
      ["hood", /\b(?:hood|bonnet|капот\p{L}*)\b/iu],
      ["fender", /\b(?:fender|wing\s+panel|крил\p{L}*)\b/iu],
      ["cover", /\b(?:cover|накладк\p{L}*)\b/iu],
      ["trim", /\b(?:trim|оздоблен\p{L}*)\b/iu],
      ["body_kit", /\b(?:body\s+kit|обвіс\p{L}*)\b/iu],
    ],
    motoCarbon: [
      ["moto_panel", /\b(?:fairing|panel|обвіс\p{L}*)\b/iu],
      ["cover", /\b(?:cover|накладк\p{L}*)\b/iu],
    ],
    wheels: [
      [
        "wheel_set",
        /\b(?:set\s+of\s+(?:4|four)\s+wheels|комплект\s+(?:4|чотир\p{L}*)\s+диск\p{L}*)\b/iu,
      ],
      ["wheel", /\b(?:wheel|alloy|rim|диск\p{L}*)\b/iu],
    ],
    lighting: [
      ["headlight", /\b(?:headlight|headlamp|фар\p{L}*)\b/iu],
      ["tail_light", /\b(?:tail\s+light|rear\s+light|ліхтар\p{L}*)\b/iu],
      ["bulb", /\b(?:bulb|ламп\p{L}*)\b/iu],
    ],
    accessories: [
      ["adapter", /\b(?:adapter|adaptor|адаптер\p{L}*)\b/iu],
      ["mount", /\b(?:mount|bracket|кріплен\p{L}*)\b/iu],
      ["hardware", /\b(?:hardware|clamp|gasket|хомут\p{L}*|прокладк\p{L}*)\b/iu],
    ],
    merch: [
      ["apparel", /\b(?:shirt|t-shirt|hoodie|jacket|cap|одяг\p{L}*|футболк\p{L}*|худі)\b/iu],
      ["souvenir", /\b(?:mug|keychain|sticker|souvenir|чашк\p{L}*|брелок\p{L}*)\b/iu],
    ],
    interior: [
      ["interior_part", /\b(?:steering|paddle|trim|seat|pedal|керм\p{L}*|сидін\p{L}*)\b/iu],
    ],
  };

  if (category) {
    const localizedMatch = inferLocalizedProductKind(text, [category]);
    if (localizedMatch) return localizedMatch;
    const match = firstMatch(text, groups[category] ?? []);
    if (match) return match;
    return category === "exhaust" ? "system" : "any";
  }

  const localizedMatch = inferLocalizedProductKind(
    text,
    Object.keys(LOCALIZED_PRODUCT_KIND_TERMS) as ShopStockCategoryGroupId[]
  );
  if (localizedMatch) return localizedMatch;
  for (const candidates of Object.values(groups)) {
    const match = firstMatch(text, candidates ?? []);
    if (match) return match;
  }
  return "any";
}

const EN_LABELS: Partial<Record<ShopAiProductKind, string>> = {
  system: "Complete exhaust system",
  downpipe: "Downpipe",
  link_pipe: "Link pipe",
  tips: "Exhaust tips",
  tuning_box: "Tuning box",
  ecu_tune: "ECU tune",
  tcu_tune: "TCU tune",
  throttle_controller: "Throttle controller",
  pad: "Brake pads",
  rotor: "Brake rotor",
  caliper: "Brake caliper",
  kit: "Brake kit",
  coilover_kit: "Coilover kit",
  damper: "Damper",
  spring: "Spring",
  service_part: "Service part",
  cancellation_kit: "Cancellation kit",
  oil_cooler: "Oil cooler",
  heat_exchanger: "Heat exchanger",
  charge_pipe: "Charge pipe",
  turbo_inlet: "Turbo inlet",
  side_skirt: "Side skirt",
  body_kit: "Body kit",
  moto_panel: "Moto panel",
  wheel_set: "Wheel set",
  headlight: "Headlight",
  tail_light: "Tail light",
  interior_part: "Interior part",
};

const UA_LABELS: Partial<Record<ShopAiProductKind, string>> = {
  system: "повна вихлопна система",
  tips: "Насадки",
  tuning_box: "Тюнінг-бокс",
  ecu_tune: "Прошивка ECU",
  tcu_tune: "Прошивка TCU",
  throttle_controller: "Контролер педалі",
  pad: "Гальмівні колодки",
  rotor: "Гальмівний диск",
  caliper: "Гальмівний супорт",
  kit: "Гальмівний комплект",
  coilover_kit: "Комплект койловерів",
  damper: "Амортизатор",
  spring: "Пружина",
  service_part: "Сервісна деталь",
  cancellation_kit: "Комплект відключення",
  intercooler: "Інтеркулер",
  radiator: "Радіатор",
  oil_cooler: "Масляний радіатор",
  heat_exchanger: "Теплообмінник",
  intake: "Впуск",
  charge_pipe: "Патрубок наддуву",
  turbo_inlet: "Турбо-інлет",
  turbo: "Турбіна",
  diffuser: "Дифузор",
  splitter: "Спліттер",
  spoiler: "Спойлер",
  side_skirt: "Поріг",
  hood: "Капот",
  fender: "Крило",
  cover: "Накладка",
  trim: "Оздоблення",
  body_kit: "Обвіс",
  moto_panel: "Мото-панель",
  wheel: "Колісний диск",
  wheel_set: "Комплект дисків",
  headlight: "Фара",
  tail_light: "Задній ліхтар",
  bulb: "Лампа",
  adapter: "Адаптер",
  mount: "Кріплення",
  hardware: "Монтажний комплект",
  apparel: "Одяг",
  souvenir: "Сувенір",
  interior_part: "Деталь салону",
};

export function formatShopAiProductKind(
  kind: ShopAiProductKind | null | undefined,
  locale: "ua" | "en"
) {
  if (!kind || kind === "any") return null;
  const labels = locale === "ua" ? UA_LABELS : EN_LABELS;
  return (
    labels[kind] ??
    kind
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function shopAiProductKindQueryTerm(kind: ShopAiProductKind | null | undefined) {
  if (!kind || kind === "any") return null;
  return EN_LABELS[kind] ?? kind.replaceAll("_", " ");
}
