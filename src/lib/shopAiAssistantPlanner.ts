import type {
  ShopAiContext,
  ShopAiPlan,
  ShopAiRequiredDetail,
  ShopAiVehicle,
} from "@/lib/shopAiAssistantTypes";
import { BRAND_LOGO_MAP } from "@/lib/brandLogos";
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
  if (/(?:non[- ]?opf|non[- ]?gpf|without\s+(?:opf|gpf)|без\s+(?:opf|gpf))/iu.test(message)) {
    return "without" as const;
  }
  if (/\b(?:opf|gpf)\b/iu.test(message)) return "with" as const;
  return null;
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
  missingVehicle: boolean
) {
  const isUa = context.locale === "ua";
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
  const needsVehicle = Boolean(plan.category) || plan.intent === "compatibility";
  const missingVehicle = needsVehicle && (!plan.vehicle.make || !plan.vehicle.model);
  const requiredDetails = missingVehicle
    ? []
    : buildRequiredDetails(
        plan.category,
        plan.vehicle,
        plan.opfGpf ?? null,
        plan.vehicleResolution?.status
      );
  const needsClarification = missingVehicle || requiredDetails.length > 0;

  return {
    ...plan,
    requiredDetails,
    needsClarification,
    clarification: needsClarification
      ? buildClarification(context, plan.vehicle, requiredDetails, missingVehicle)
      : null,
  };
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
    year: cleanYear(source.year),
    engine: cleanText(source.engine),
    fuel: cleanText(source.fuel, 40),
    bodyStyle: cleanText(source.bodyStyle, 40),
    drivetrain: cleanText(source.drivetrain, 40),
    transmission: cleanText(source.transmission, 40),
    market: cleanText(source.market, 40),
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
  const inferredProductKind = inferShopAiProductKind(message, category);
  const productKind =
    inferredProductKind === "any"
      ? (cleanShopAiProductKind(source.productKind) ?? "any")
      : inferredProductKind;
  const brand = inferBrand(message) ?? cleanText(source.brand, 100);
  return finalizeShopAiPlan(
    {
      intent,
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
  const year = expanded.years[0] ?? null;
  const category = inferCategory(message);
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
        engine: inferEngineFromMessage(message),
        ...hardVehicleFacts,
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
