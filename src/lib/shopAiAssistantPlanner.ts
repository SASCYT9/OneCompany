import type {
  ShopAiContext,
  ShopAiGoal,
  ShopAiPlan,
  ShopAiRequiredDetail,
  ShopAiVehicle,
} from "@/lib/shopAiAssistantTypes";
import { BRAND_LOGO_MAP } from "@/lib/brandLogos";
import { buildShopAiLexicalWebsearchQuery } from "@/lib/shopAiAssistantRanking";
import { getShopAiExactSkuLookupToken } from "@/lib/shopAiExactSku";
import { cleanShopAiProductKind, inferShopAiProductKind } from "@/lib/shopAiProductKind";
import { SHOP_STOCK_CATEGORY_GROUPS, type ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";
import { expandVehicleAliases } from "@/lib/shopVehicleSearch";

const CATEGORY_IDS = new Set<ShopStockCategoryGroupId>(
  SHOP_STOCK_CATEGORY_GROUPS.map((group) => group.id)
);

const CATEGORY_SIGNALS: Array<{ id: ShopStockCategoryGroupId; pattern: RegExp }> = [
  { id: "exhaust", pattern: /\b(exhaust|downpipe|muffler|вихлоп|глушник|даунпайп)\b/i },
  { id: "brakes", pattern: /\b(brake|rotor|caliper|гальм|диск|колодк)\b/i },
  { id: "suspension", pattern: /\b(suspension|coilover|spring|підвіск|амортиз|пружин)\b/i },
  { id: "cooling", pattern: /\b(intercooler|radiator|cooling|інтеркулер|радіатор|охолод)\b/i },
  { id: "performance", pattern: /\b(intake|turbo|engine|впуск|турбо|двигун)\b/i },
  { id: "chipTuning", pattern: /\b(chip|ecu|jb4|racechip|чіп|прошивк)\b/i },
  {
    id: "motoCarbon",
    pattern: /\b(moto\s*carbon|motorcycle\s*carbon|мотокарбон|карбон\s+для\s+мото)\b/i,
  },
  {
    id: "carbonAero",
    pattern: /\b(body kit|diffuser|spoiler|carbon|обвіс|дифузор|спойлер|карбон)\b/i,
  },
  { id: "wheels", pattern: /\b(wheel|rim|spacer|диск|колес|проставк)\b/i },
  { id: "interior", pattern: /\b(interior|steering|seat|салон|кермо|сидін)\b/i },
  { id: "lighting", pattern: /\b(light|lamp|headlight|світло|фара|ламп)\b/i },
  { id: "accessories", pattern: /\b(accessor(?:y|ies)|аксесуар)\b/i },
  { id: "merch", pattern: /\b(merch|merchandise|gift|подар(?:унок|ок)|мерч)\b/i },
];

const CATEGORY_SUBSTRINGS: Array<{ id: ShopStockCategoryGroupId; values: string[] }> = [
  {
    id: "exhaust",
    values: ["exhaust", "downpipe", "вихлоп", "выхлоп", "vykhlop", "глушник", "даунпайп"],
  },
  { id: "brakes", values: ["brake", "rotor", "гальм", "тормоз", "halma", "колодк"] },
  {
    id: "suspension",
    values: ["suspension", "coilover", "підвіск", "подвес", "pidvisk", "амортиз"],
  },
  {
    id: "cooling",
    values: [
      "cooling",
      "intercooler",
      "radiator",
      "охолод",
      "охлажд",
      "okholodzh",
      "інтеркулер",
      "радіатор",
    ],
  },
  {
    id: "performance",
    values: [
      "performance",
      "engine tuning",
      "intake",
      "turbo",
      "впуск",
      "турбо",
      "тюнінг двигун",
      "тюнинг двигател",
      "tiuninh dvyhun",
    ],
  },
  {
    id: "chipTuning",
    values: ["chip tuning", "racechip", "jb4", "чіп", "чип", "chyp tiuninh", "прошивк"],
  },
  {
    id: "motoCarbon",
    values: [
      "moto carbon",
      "motorcycle carbon",
      "мотокарбон",
      "карбон для мото",
      "karbon dlia moto",
    ],
  },
  {
    id: "carbonAero",
    values: ["body kit", "diffuser", "carbon", "karbonovyi obvis", "обвіс", "карбон"],
  },
  {
    id: "wheels",
    values: ["wheel", "spacer", "диски", "dysky", "колес", "проставк"],
  },
  {
    id: "interior",
    values: ["interior", "steering", "detali salonu", "салон", "кермо"],
  },
  {
    id: "lighting",
    values: ["lighting", "headlight", "lamp", "освітл", "освещ", "osvitl", "світло", "фара"],
  },
  {
    id: "accessories",
    values: ["accessory", "accessories", "аксесуар", "аксессуар", "aksesuar"],
  },
  { id: "merch", values: ["merch", "merchandise", "gift", "подарунок", "подарок", "мерч"] },
];

const EXPLICIT_CATEGORY_SUBSTRINGS: Array<{
  id: ShopStockCategoryGroupId;
  values: string[];
}> = [
  {
    id: "carbonAero",
    values: [
      "carbon aero",
      "carbon body kit",
      "карбоновий аерообвіс",
      "карбоновый обвес",
      "karbonovyi obvis",
    ],
  },
  {
    id: "interior",
    values: ["interior parts", "деталі салону", "детали салона", "detali salonu"],
  },
  {
    id: "motoCarbon",
    values: [
      "motorcycle carbon",
      "moto carbon",
      "карбон для мотоцикла",
      "карбон для мото",
      "karbon dlia mototsykla",
    ],
  },
  {
    id: "performance",
    values: [
      "performance upgrade",
      "engine tuning",
      "тюнінг двигуна",
      "тюнинг двигателя",
      "tiuninh dvyhuna",
    ],
  },
  {
    id: "chipTuning",
    values: ["chip tuning", "чип-тюнінг", "чіп-тюнінг", "chyp tiuninh"],
  },
];

const GOALS = new Set<ShopAiGoal>([
  "power",
  "sound",
  "handling",
  "braking",
  "appearance",
  "cooling",
  "comfort",
  "gift",
]);

const GOAL_SIGNALS: Array<{ goal: ShopAiGoal; pattern: RegExp }> = [
  {
    goal: "power",
    pattern:
      /(?:\b(?:power|horsepower|faster|performance|moshchnost|moshnost)\b|потужн|потужност|мощн|сил\s+більш|більше\s+сил)/iu,
  },
  {
    goal: "sound",
    pattern:
      /(?:\b(?:sound|louder|tone|zvuk|zvuch\w*)\b|звук|звуч|саунд|гучн|громч|вихлоп\s+щоб\s+чути)/iu,
  },
  {
    goal: "handling",
    pattern:
      /(?:\b(?:handling|cornering|stability|upravlyaemost)\b|керован|стійк|управляєм|управляем)/iu,
  },
  { goal: "braking", pattern: /(?:\b(?:braking|stopping)\b|гальм|тормоз)/iu },
  {
    goal: "appearance",
    pattern: /(?:\b(?:appearance|looks?|styling|design|vneshnost)\b|вигляд|зовнішн|внешн|красив)/iu,
  },
  {
    goal: "cooling",
    pattern: /(?:\b(?:cooling|temperature|overheat|ohlazhdenie)\b|охолод|перегрів|охлажд)/iu,
  },
  {
    goal: "comfort",
    pattern: /(?:\b(?:comfort|daily|quieter|komfort)\b|комфорт|зручн|тихіш|тише)/iu,
  },
  { goal: "gift", pattern: /(?:\b(?:gift|present|podarok)\b|подар(?:унок|ок)|сувенір)/iu },
];

const CATEGORY_GOALS: Partial<Record<ShopStockCategoryGroupId, ShopAiGoal>> = {
  chipTuning: "power",
  performance: "power",
  exhaust: "sound",
  suspension: "handling",
  brakes: "braking",
  carbonAero: "appearance",
  motoCarbon: "appearance",
  wheels: "appearance",
  lighting: "appearance",
  cooling: "cooling",
  interior: "comfort",
  merch: "gift",
};

const GOAL_CATEGORIES: Record<ShopAiGoal, ShopStockCategoryGroupId> = {
  power: "chipTuning",
  sound: "exhaust",
  handling: "suspension",
  braking: "brakes",
  appearance: "carbonAero",
  cooling: "cooling",
  comfort: "interior",
  gift: "merch",
};

function cleanText(value: unknown, maxLength = 120) {
  return (
    String(value ?? "")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, maxLength) || null
  );
}

function cleanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1950 && year <= 2035 ? year : null;
}

function cleanPrice(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null;
}

function cleanPowerGain(value: unknown) {
  const power = Number(value);
  return Number.isInteger(power) && power > 0 && power <= 2000 ? power : null;
}

function inferPowerGain(message: string) {
  const match = message.match(/\+\s*(\d{1,4})\s*(?:hp|bhp|к\.?\s*с\.?|сил)/i);
  return match ? cleanPowerGain(match[1]) : null;
}

function cleanOpfGpf(value: unknown): "with" | "without" | null {
  return value === "with" || value === "without" ? value : null;
}

function inferOpfGpf(message: string) {
  if (/(?:non[- ]?opf|non[- ]?gpf|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))/iu.test(message)) {
    return "without" as const;
  }
  if (/\b(?:opf|gpf)\b/iu.test(message)) return "with" as const;
  return null;
}

function cleanGoal(value: unknown): ShopAiGoal | null {
  const normalized = String(value ?? "").trim() as ShopAiGoal;
  return GOALS.has(normalized) ? normalized : null;
}

const GENERATED_ROUTING_GENERIC_WORDS = new Set([
  "a",
  "about",
  "advice",
  "advise",
  "an",
  "and",
  "anything",
  "can",
  "change",
  "choose",
  "could",
  "do",
  "first",
  "for",
  "from",
  "help",
  "how",
  "i",
  "improve",
  "in",
  "me",
  "my",
  "need",
  "next",
  "of",
  "on",
  "option",
  "options",
  "or",
  "please",
  "recommend",
  "should",
  "show",
  "something",
  "suggest",
  "tell",
  "the",
  "to",
  "upgrade",
  "want",
  "what",
  "which",
  "would",
  "you",
  "your",
  "будь",
  "варіанти",
  "варто",
  "ви",
  "далі",
  "допоможи",
  "змінити",
  "ласка",
  "мені",
  "можна",
  "покажи",
  "покращити",
  "порадь",
  "рекомендуй",
  "спочатку",
  "треба",
  "хочу",
  "щось",
  "що",
  "варианты",
  "дальше",
  "изменить",
  "мне",
  "можно",
  "первым",
  "покажи",
  "посоветуй",
  "рекомендуй",
  "сначала",
  "улучшить",
  "хочу",
  "что",
  "что-то",
]);

function hasGeneratedRoutingEvidence(message: string) {
  if (getShopAiExactSkuLookupToken(message) || inferBrand(message)) return true;

  const aliases = expandVehicleAliases(message);
  if (
    aliases.makes.length > 0 ||
    aliases.models.length > 0 ||
    aliases.chassis.length > 0 ||
    aliases.years.length > 0 ||
    aliases.engines.length > 0 ||
    inferChassisFromMessage(message) ||
    inferEngineFromMessage(message)
  ) {
    return true;
  }

  const tokens =
    message
      .normalize("NFKD")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const specificTokens = new Set(
    tokens.filter(
      (token) =>
        token.length >= 3 && !GENERATED_ROUTING_GENERIC_WORDS.has(token) && !/^\d{4}$/.test(token)
    )
  );

  if (specificTokens.size >= 2) return true;
  return specificTokens.size === 1 && /\b(?:find|search|show|need|want|looking)\b/iu.test(message);
}

export function inferShopAiGoal(
  message: string,
  category: ShopStockCategoryGroupId | null,
  generatedGoal?: unknown
): ShopAiGoal | null {
  return (
    GOAL_SIGNALS.find((candidate) => candidate.pattern.test(message))?.goal ??
    CATEGORY_GOALS[category ?? "other"] ??
    cleanGoal(generatedGoal)
  );
}

function buildRequiredDetails(
  category: ShopStockCategoryGroupId | null,
  vehicle: ShopAiVehicle,
  opfGpf: "with" | "without" | null,
  resolutionStatus?: NonNullable<ShopAiPlan["vehicleResolution"]>["status"]
) {
  const details: ShopAiRequiredDetail[] = [];
  if (!vehicle.make || !vehicle.model) return details;
  if (
    (!vehicle.chassis && !vehicle.year) ||
    (!vehicle.chassis && resolutionStatus === "ambiguous")
  ) {
    details.push("yearOrChassis");
  }
  if (category === "chipTuning" && !vehicle.engine) details.push("engine");
  if (category === "exhaust" && !opfGpf) details.push("opfGpf");
  return details;
}

function buildClarification(
  context: ShopAiContext,
  vehicle: ShopAiVehicle,
  requiredDetails: ShopAiRequiredDetail[],
  missingVehicle: boolean,
  missingCategory: boolean
) {
  const isUa = context.locale === "ua";
  if (missingCategory) {
    return isUa
      ? "Напишіть, що саме хочете змінити в автомобілі або мотоциклі — наприклад вихлоп, впуск, гальма чи підвіску."
      : "Tell me what you want to change on the vehicle — for example exhaust, intake, brakes or suspension.";
  }
  if (missingVehicle) {
    return isUa
      ? "Вкажіть марку, модель і рік авто або мото, щоб я перевірив сумісність."
      : "Tell me the vehicle make, model and year so I can verify compatibility.";
  }

  const vehicleIdentity = [vehicle.make, vehicle.model, vehicle.chassis].filter(Boolean).join(" ");
  const vehicleLabel = [vehicleIdentity, vehicle.year].filter(Boolean).join(", ");
  if (requiredDetails.includes("yearOrChassis")) {
    return isUa
      ? `Уточніть рік або код кузова для ${vehicleLabel || "цього авто"}, щоб я не змішав різні покоління.`
      : `Confirm the model year or chassis code for ${vehicleLabel || "this vehicle"} so I do not mix generations.`;
  }
  if (requiredDetails.includes("engine")) {
    return isUa
      ? `Уточніть двигун або його код для ${vehicleLabel || "цього авто"} — це обов’язково для точного підбору.`
      : `Confirm the engine or engine code for ${vehicleLabel || "this vehicle"}; it is required for an exact match.`;
  }
  if (requiredDetails.includes("opfGpf")) {
    return isUa
      ? `Я розпізнав ${vehicleLabel || "авто"}. Уточніть, авто з OPF/GPF чи без? Якщо не знаєте — це можна перевірити за VIN.`
      : `I identified ${vehicleLabel || "the vehicle"}. Does it have OPF/GPF? If you are unsure, we can verify it from the VIN.`;
  }
  return null;
}

export function finalizeShopAiPlan(plan: ShopAiPlan, context: ShopAiContext): ShopAiPlan {
  const missingVehicle = plan.category !== "merch" && (!plan.vehicle.make || !plan.vehicle.model);
  const missingCategory = !plan.category;
  const requiredDetails = missingVehicle
    ? []
    : buildRequiredDetails(
        plan.category,
        plan.vehicle,
        plan.opfGpf ?? null,
        plan.vehicleResolution?.status
      );
  const needsClarification = missingVehicle || missingCategory || requiredDetails.length > 0;

  return {
    ...plan,
    requiredDetails,
    needsClarification,
    clarification: needsClarification
      ? buildClarification(context, plan.vehicle, requiredDetails, missingVehicle, missingCategory)
      : null,
  };
}

/**
 * A specific catalog request may return reviewable products before all
 * fitment-critical facts are known. Broad requests still ask one clarification
 * first, while a brand or a concrete vehicle gives retrieval a safe anchor.
 */
export function shouldAskShopAiClarificationBeforeRetrieval(
  plan: ShopAiPlan,
  message = plan.searchQuery
) {
  if (!plan.needsClarification) return false;
  if (!plan.category) return true;
  if (plan.brand) return false;
  if (
    plan.vehicle.make &&
    (plan.vehicle.model || plan.vehicle.chassis || plan.vehicle.year || plan.vehicle.engine)
  ) {
    return false;
  }
  const lexicalTerms = buildShopAiLexicalWebsearchQuery(plan, message)
    .split(" OR ")
    .filter(Boolean);
  return lexicalTerms.length < 3;
}

function cleanChassis(value: unknown) {
  const chassis = cleanText(value, 60)?.toUpperCase().replace(/\s+/g, "") ?? null;
  if (!chassis) return null;
  return /^[A-Z][0-9O]{2,3}$/.test(chassis) ? chassis.replace(/O/g, "0") : chassis;
}

function inferChassisFromMessage(message: string) {
  const candidates = message.match(/\b[A-Za-z][0-9O]{2,3}\b/g) ?? [];
  return candidates.map(cleanChassis).find(Boolean) ?? null;
}

function inferEngineFromMessage(message: string) {
  return message.match(/\b(?:[BSN]\d{2}[A-Z0-9]*|EA\d{3})\b/i)?.[0]?.toUpperCase() ?? null;
}

function inferVehicleHardFacts(message: string) {
  const matchValue = (
    candidates: ReadonlyArray<{ value: string; pattern: RegExp }>
  ): string | null =>
    candidates.find((candidate) => candidate.pattern.test(message))?.value ?? null;
  return {
    fuel: matchValue([
      { value: "diesel", pattern: /\b(?:diesel|tdi|cdi|dci|дизел\w*)\b/iu },
      { value: "petrol", pattern: /\b(?:petrol|gasoline|бензин\w*)\b/iu },
      { value: "hybrid", pattern: /\b(?:hybrid|phev|mhev|гібрид\w*)\b/iu },
    ]),
    bodyStyle: matchValue([
      { value: "sedan", pattern: /\b(?:sedan|saloon|седан\w*)\b/iu },
      { value: "coupe", pattern: /\b(?:coupe|coupé|купе)\b/iu },
      { value: "wagon", pattern: /\b(?:wagon|estate|touring|універсал\w*)\b/iu },
      { value: "suv", pattern: /\b(?:suv|sav|кросовер\w*|позашляховик\w*)\b/iu },
      { value: "convertible", pattern: /\b(?:convertible|cabrio|кабріолет\w*)\b/iu },
    ]),
    drivetrain: matchValue([
      { value: "awd", pattern: /\b(?:awd|4wd|xdrive|quattro|4matic|повн\w*\s+прив\w*)\b/iu },
      { value: "rwd", pattern: /\b(?:rwd|задн\w*\s+прив\w*)\b/iu },
      { value: "fwd", pattern: /\b(?:fwd|передн\w*\s+прив\w*)\b/iu },
    ]),
    transmission: matchValue([
      { value: "dct", pattern: /\b(?:dct|dsg|dual[\s-]?clutch)\b/iu },
      { value: "manual", pattern: /\b(?:manual|механі(?:ка|чн\w*))\b/iu },
      { value: "automatic", pattern: /\b(?:automatic|автомат\w*|zf\s?8)\b/iu },
    ]),
    market: matchValue([
      { value: "eu", pattern: /\b(?:eu|europe|european|європ\w*)\b/iu },
      { value: "us", pattern: /\b(?:us|usa|north\s+america|американ\w*)\b/iu },
      { value: "uk", pattern: /\b(?:uk|united\s+kingdom|британ\w*)\b/iu },
    ]),
  };
}

function normalizeBrandSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferBrand(message: string) {
  const normalizedMessage = ` ${normalizeBrandSearch(message)} `;
  return (
    Object.keys(BRAND_LOGO_MAP)
      .filter((brand) => {
        const normalizedBrand = normalizeBrandSearch(brand);
        return normalizedBrand.length >= 3 && normalizedMessage.includes(` ${normalizedBrand} `);
      })
      .sort((left, right) => right.length - left.length)[0] ?? null
  );
}

function inferBrandOnly(message: string, brand: string | null) {
  if (!brand) return false;
  return /(?:^|\s)(?:тільки|лише|only|exclusively)(?:\s|$)/iu.test(message);
}

function inferStockOnly(message: string) {
  return /(?:тільки|лише|only)?\s*(?:в\s+наявності|in[\s-]*stock|available\s+now)/iu.test(message);
}

function cleanVehicle(value: unknown, context: ShopAiContext): ShopAiVehicle {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const requestedType = String(source.type ?? "unknown");
  const sourceMake = cleanText(source.make);
  const sourceModel = cleanText(source.model);
  const contextMake = cleanText(context.make);
  const contextModel = cleanText(context.model);
  const usesContextVehicle = Boolean(
    contextMake &&
      contextModel &&
      (!sourceMake || sourceMake.toLowerCase() === contextMake.toLowerCase()) &&
      (!sourceModel || sourceModel.toLowerCase() === contextModel.toLowerCase())
  );
  const scopedVehicleType =
    context.scope === "moto" ? "motorcycle" : context.scope === "auto" ? "car" : null;
  return {
    type:
      scopedVehicleType ??
      (requestedType === "car" || requestedType === "motorcycle" ? requestedType : "unknown"),
    make: sourceMake ?? contextMake,
    model: sourceModel ?? contextModel,
    chassis: usesContextVehicle
      ? (cleanChassis(context.chassis) ?? cleanChassis(source.chassis))
      : (cleanChassis(source.chassis) ?? cleanChassis(context.chassis)),
    year: cleanYear(source.year) ?? cleanYear(context.year),
    engine: cleanText(source.engine) ?? cleanText(context.engine, 100),
    fuel: cleanText(source.fuel, 40) ?? cleanText(context.fuel, 40),
    bodyStyle: cleanText(source.bodyStyle, 40) ?? cleanText(context.bodyStyle, 40),
    drivetrain: cleanText(source.drivetrain, 40),
    transmission: cleanText(source.transmission, 40),
    market: cleanText(source.market, 40),
  };
}

function inferCategory(message: string): ShopStockCategoryGroupId | null {
  if (inferPowerGain(message)) return "chipTuning";
  const normalized = message.toLowerCase();
  return (
    EXPLICIT_CATEGORY_SUBSTRINGS.find((entry) =>
      entry.values.some((value) => normalized.includes(value))
    )?.id ??
    CATEGORY_SUBSTRINGS.find((entry) => entry.values.some((value) => normalized.includes(value)))
      ?.id ??
    CATEGORY_SIGNALS.find((entry) => entry.pattern.test(message))?.id ??
    null
  );
}

function buildSearchQuery(message: string, vehicle: ShopAiVehicle, category: string | null) {
  const vehicleTerms = [vehicle.make, vehicle.model, vehicle.chassis, vehicle.year, vehicle.engine]
    .filter(Boolean)
    .join(" ");
  return [vehicleTerms, category, message].filter(Boolean).join(" ").trim().slice(0, 500);
}

function inferIntent(message: string, requestedIntent: string): ShopAiPlan["intent"] {
  const normalized = ` ${message.toLowerCase()} `;
  if (
    normalized.includes("порівн") ||
    normalized.includes("compare") ||
    normalized.includes("versus") ||
    normalized.includes(" vs ")
  ) {
    return "compare";
  }

  return (["recommend", "compare", "compatibility", "question"] as const).includes(
    requestedIntent as ShopAiPlan["intent"]
  )
    ? (requestedIntent as ShopAiPlan["intent"])
    : "recommend";
}

export function normalizeShopAiPlan(
  value: unknown,
  message: string,
  context: ShopAiContext
): ShopAiPlan {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const vehicle = cleanVehicle(source.vehicle, context);
  const rawCategory = String(source.category ?? "").trim() as ShopStockCategoryGroupId;
  const contextCategory = String(context.category ?? "").trim() as ShopStockCategoryGroupId;
  const inferredCategory = inferCategory(message);
  const messageGoal = inferShopAiGoal(message, null);
  const allowGeneratedRouting = hasGeneratedRoutingEvidence(message);
  const generatedGoal = allowGeneratedRouting ? cleanGoal(source.goal) : null;
  const category = inferredCategory
    ? inferredCategory
    : messageGoal
      ? GOAL_CATEGORIES[messageGoal]
      : CATEGORY_IDS.has(contextCategory)
        ? contextCategory
        : allowGeneratedRouting && CATEGORY_IDS.has(rawCategory)
          ? rawCategory
          : generatedGoal
            ? GOAL_CATEGORIES[generatedGoal]
            : null;
  const requestedIntent = String(source.intent ?? "recommend");
  const intent = inferIntent(message, requestedIntent);
  const opfGpf = inferOpfGpf(message) ?? cleanOpfGpf(source.opfGpf) ?? cleanOpfGpf(context.opfGpf);
  const inferredProductKind = inferShopAiProductKind(message, category);
  const productKind =
    inferredProductKind === "any"
      ? (cleanShopAiProductKind(source.productKind) ?? "any")
      : inferredProductKind;
  const brand = inferBrand(message) ?? cleanText(source.brand, 100);
  // Category and goal are routing decisions. Provider output is accepted only
  // when the message contains a concrete product or vehicle signal; an open
  // question cannot become a fabricated shopping intent.
  const goal = inferShopAiGoal(message, category, generatedGoal);
  return finalizeShopAiPlan(
    {
      intent,
      goal,
      vehicle,
      category,
      searchQuery:
        cleanText(source.searchQuery, 500) ?? buildSearchQuery(message, vehicle, category),
      minPrice: cleanPrice(source.minPrice),
      maxPrice: cleanPrice(source.maxPrice),
      brand,
      brandOnly: inferBrandOnly(message, brand) || source.brandOnly === true,
      stockOnly: inferStockOnly(message) || source.stockOnly === true,
      powerGainHp:
        inferPowerGain(message) ??
        cleanPowerGain(source.powerGainHp) ??
        cleanPowerGain(context.powerGainHp),
      opfGpf,
      productKind,
      needsClarification: false,
      clarification: null,
    },
    context
  );
}

export function buildFallbackShopAiPlan(message: string, context: ShopAiContext) {
  const exactSkuQuery = getShopAiExactSkuLookupToken(message);
  if (exactSkuQuery) {
    return {
      intent: "recommend" as const,
      goal: null,
      vehicle: {
        type:
          context.scope === "moto"
            ? ("motorcycle" as const)
            : context.scope === "auto"
              ? ("car" as const)
              : ("unknown" as const),
        // A structured SKU can contain tokens such as H00, F80 or G05. Only
        // retain vehicle facts that came from page/session context; never
        // reinterpret the SKU itself as fitment input.
        make: cleanText(context.make),
        model: cleanText(context.model),
        chassis: cleanChassis(context.chassis),
        year: cleanYear(context.year),
        engine: cleanText(context.engine, 100),
        fuel: cleanText(context.fuel, 40),
        bodyStyle: cleanText(context.bodyStyle, 40),
        drivetrain: null,
        transmission: null,
        market: null,
      },
      category: null,
      searchQuery: exactSkuQuery,
      minPrice: null,
      maxPrice: null,
      brand: null,
      brandOnly: false,
      stockOnly: false,
      powerGainHp: null,
      opfGpf: null,
      requiredDetails: [],
      productKind: "any" as const,
      needsClarification: false,
      clarification: null,
    };
  }

  const expanded = expandVehicleAliases([context.query, message].filter(Boolean).join(" "));
  const hardVehicleFacts = inferVehicleHardFacts(message);
  const maxPriceMatch = message.match(
    /(?:до|under|below|max(?:imum)?|budget)\s*[:\-]?\s*([\d\s.,]+)/i
  );
  const maxPrice = maxPriceMatch
    ? Number(maxPriceMatch[1].replace(/\s+/g, "").replace(",", "."))
    : null;
  const motorcycleMakes = new Set([
    "Aprilia",
    "Ducati",
    "Harley-Davidson",
    "Kawasaki",
    "KTM",
    "Triumph",
    "Yamaha",
  ]);
  const make = expanded.makes[0] ?? context.make ?? null;
  const model = expanded.models[0] ?? context.model ?? null;
  const chassis =
    expanded.chassis[0] ?? inferChassisFromMessage(message) ?? cleanChassis(context.chassis);
  const year = expanded.years[0] ?? cleanYear(context.year);
  const category = inferCategory(message) ?? (context.category as ShopStockCategoryGroupId | null);
  const searchQuery = [make, model, chassis, year].filter(Boolean).join(" ") || message;

  return normalizeShopAiPlan(
    {
      vehicle: {
        type:
          context.scope === "moto"
            ? "motorcycle"
            : context.scope === "auto"
              ? "car"
              : make && motorcycleMakes.has(make)
                ? "motorcycle"
                : make
                  ? "car"
                  : "unknown",
        make,
        model,
        chassis,
        year,
        engine:
          inferEngineFromMessage(message) ?? expanded.engines[0] ?? cleanText(context.engine, 100),
        fuel: hardVehicleFacts.fuel ?? context.fuel ?? null,
        bodyStyle: hardVehicleFacts.bodyStyle ?? context.bodyStyle ?? null,
        drivetrain: hardVehicleFacts.drivetrain ?? null,
        transmission: hardVehicleFacts.transmission ?? null,
        market: hardVehicleFacts.market ?? null,
      },
      category,
      searchQuery,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
      needsClarification: Boolean(category && (!make || !model)),
    },
    message,
    context
  );
}
