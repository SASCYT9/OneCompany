import type {
  ShopAiContext,
  ShopAiPlan,
  ShopAiProductKind,
  ShopAiRequiredDetail,
  ShopAiVehicle,
} from "@/lib/shopAiAssistantTypes";
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
    id: "carbonAero",
    pattern: /\b(body kit|diffuser|spoiler|carbon|обвіс|дифузор|спойлер|карбон)\b/i,
  },
  { id: "wheels", pattern: /\b(wheel|rim|spacer|диск|колес|проставк)\b/i },
  { id: "interior", pattern: /\b(interior|steering|seat|салон|кермо|сидін)\b/i },
  { id: "lighting", pattern: /\b(light|lamp|headlight|світло|фара|ламп)\b/i },
];

const CATEGORY_SUBSTRINGS: Array<{ id: ShopStockCategoryGroupId; values: string[] }> = [
  { id: "exhaust", values: ["exhaust", "downpipe", "вихлоп", "глушник", "даунпайп"] },
  { id: "brakes", values: ["brake", "rotor", "гальм", "колодк"] },
  { id: "suspension", values: ["suspension", "coilover", "підвіск", "амортиз"] },
  { id: "cooling", values: ["intercooler", "radiator", "інтеркулер", "радіатор"] },
  { id: "performance", values: ["intake", "turbo", "впуск", "турбо"] },
  { id: "chipTuning", values: ["racechip", "jb4", "чіп", "прошивк"] },
  { id: "carbonAero", values: ["body kit", "diffuser", "carbon", "обвіс", "карбон"] },
  { id: "wheels", values: ["wheel", "spacer", "колес", "проставк"] },
  { id: "interior", values: ["interior", "steering", "салон", "кермо"] },
  { id: "lighting", values: ["headlight", "lamp", "світло", "фара"] },
];

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
  if (/\b(?:non[- ]?opf|non[- ]?gpf|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))\b/iu.test(message)) {
    return "without" as const;
  }
  if (/\b(?:opf|gpf)\b/iu.test(message)) return "with" as const;
  return null;
}

function cleanProductKind(value: unknown): ShopAiProductKind | null {
  return (["system", "downpipe", "link_pipe", "tips", "any"] as string[]).includes(String(value))
    ? (value as ShopAiProductKind)
    : null;
}

function inferProductKind(
  message: string,
  category: ShopStockCategoryGroupId | null
): ShopAiProductKind {
  if (category !== "exhaust") return "any";
  if (/\b(?:tailpipe|exhaust tips?|tips?|насад\w*)\b/iu.test(message)) return "tips";
  if (/\b(?:downpipe|даунпайп\w*)\b/iu.test(message)) return "downpipe";
  if (/\b(?:link[ -]?pipe|з'єднувальн\w*\s+труб\w*)\b/iu.test(message)) return "link_pipe";
  return "system";
}

function buildRequiredDetails(
  category: ShopStockCategoryGroupId | null,
  vehicle: ShopAiVehicle,
  opfGpf: "with" | "without" | null
) {
  const details: ShopAiRequiredDetail[] = [];
  if (vehicle.make && vehicle.model && !vehicle.chassis && !vehicle.year) {
    details.push("yearOrChassis");
  }
  if (category === "chipTuning" && !vehicle.engine) details.push("engine");
  if (category === "exhaust" && !opfGpf) details.push("opfGpf");
  return details;
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
  return {
    type: requestedType === "car" || requestedType === "motorcycle" ? requestedType : "unknown",
    make: sourceMake ?? contextMake,
    model: sourceModel ?? contextModel,
    chassis: usesContextVehicle
      ? (cleanChassis(context.chassis) ?? cleanChassis(source.chassis))
      : (cleanChassis(source.chassis) ?? cleanChassis(context.chassis)),
    year: cleanYear(source.year),
    engine: cleanText(source.engine),
  };
}

function inferCategory(message: string): ShopStockCategoryGroupId | null {
  if (inferPowerGain(message)) return "chipTuning";
  const normalized = message.toLowerCase();
  return (
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
  const category = inferredCategory
    ? inferredCategory
    : CATEGORY_IDS.has(rawCategory)
      ? rawCategory
      : CATEGORY_IDS.has(contextCategory)
        ? contextCategory
        : null;
  const requestedIntent = String(source.intent ?? "recommend");
  const intent = inferIntent(message, requestedIntent);
  const opfGpf = inferOpfGpf(message) ?? cleanOpfGpf(source.opfGpf) ?? cleanOpfGpf(context.opfGpf);
  const productKind =
    inferProductKind(message, category) === "any"
      ? (cleanProductKind(source.productKind) ?? "any")
      : inferProductKind(message, category);
  const needsVehicle = Boolean(category) || intent === "compatibility";
  const modelClarification = needsVehicle && (!vehicle.make || !vehicle.model);
  const needsClarification = modelClarification;
  const fallbackClarification =
    context.locale === "ua"
      ? "Вкажіть марку, модель і рік авто або мото, щоб я перевірив сумісність."
      : "Tell me the make, model and year of the car or motorcycle so I can check compatibility.";

  const requestedClarification = cleanText(source.clarification, 300);
  const localizedClarification =
    context.locale === "ua" &&
    requestedClarification &&
    !/[А-ЯІЇЄҐа-яіїєґ]/.test(requestedClarification)
      ? null
      : requestedClarification;

  return {
    intent,
    vehicle,
    category,
    searchQuery: cleanText(source.searchQuery, 500) ?? buildSearchQuery(message, vehicle, category),
    minPrice: cleanPrice(source.minPrice),
    maxPrice: cleanPrice(source.maxPrice),
    powerGainHp:
      inferPowerGain(message) ??
      cleanPowerGain(source.powerGainHp) ??
      cleanPowerGain(context.powerGainHp),
    opfGpf,
    requiredDetails: buildRequiredDetails(category, vehicle, opfGpf),
    productKind,
    needsClarification,
    clarification: needsClarification ? (localizedClarification ?? fallbackClarification) : null,
  };
}

export function buildFallbackShopAiPlan(message: string, context: ShopAiContext) {
  const expanded = expandVehicleAliases([context.query, message].filter(Boolean).join(" "));
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
  const year = expanded.years[0] ?? null;
  const category = inferCategory(message);
  const searchQuery = [make, model, chassis, year].filter(Boolean).join(" ") || message;

  return normalizeShopAiPlan(
    {
      vehicle: {
        type: make && motorcycleMakes.has(make) ? "motorcycle" : make ? "car" : "unknown",
        make,
        model,
        chassis,
        year,
        engine: inferEngineFromMessage(message),
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
