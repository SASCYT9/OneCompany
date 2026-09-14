export const MST_PRICE_MARKUP_RATE = 1.1;
export const MST_GBP_TO_USD_RATE = 1.37;

export type MstCategoryKey = "intake" | "turbo-pipes";

export type MstOfficialProduct = {
  handle: string;
  officialUrl: string;
  titleEn: string;
  images: string[];
  manufacturerAvailability: string | null;
};

export type MstSenditPrice = {
  matchedSku: string;
  url: string;
  title: string;
  incVatGbp: number;
  exVatGbp: number | null;
  availability: string | null;
};

export type MstCatalogProduct = {
  handle: string;
  slug: string;
  sku: string;
  categoryKey: MstCategoryKey;
  categoryEn: string;
  categoryUa: string;
  titleEn: string;
  titleUa: string;
  shortDescEn: string;
  shortDescUa: string;
  sellingPointsEn: string[];
  sellingPointsUa: string[];
  tags: string[];
  images: string[];
  source: {
    officialUrl: string;
    senditUrl: string | null;
    senditMatchedSku: string | null;
    manufacturerAvailability: string | null;
    senditAvailability: string | null;
  };
  pricing: {
    status: "matched" | "missing";
    sourceIncVatGbp: number | null;
    sourceExVatGbp: number | null;
    markupPct: 10;
    sellGbp: number | null;
    gbpToUsdRate: 1.37;
    priceUsd: number | null;
  };
};

const SENDIT_SKU_ALIASES: Readonly<Record<string, string>> = {
  "MST-BW-F90M5": "MST-BW-F90M5-BK",
};

const CATEGORY_COPY: Record<
  MstCategoryKey,
  { en: string; ua: string; descriptionEn: string; descriptionUa: string }
> = {
  intake: {
    en: "Intake Systems",
    ua: "Впускні системи",
    descriptionEn: "intake system",
    descriptionUa: "впускна система",
  },
  "turbo-pipes": {
    en: "Turbo Inlet & Boost Pipes",
    ua: "Турбо-інлети та буст-пайпи",
    descriptionEn: "turbo inlet or boost pipe",
    descriptionUa: "турбо-інлет або буст-пайп",
  },
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundUpToNearestFive(value: number) {
  return Math.ceil((value - Number.EPSILON) / 5) * 5;
}

export function calculateMstRetailPrice(sourceIncVatGbp: number) {
  if (!Number.isFinite(sourceIncVatGbp) || sourceIncVatGbp <= 0) {
    throw new Error("MST source price must be a positive finite GBP amount");
  }
  const sellGbp = roundMoney(sourceIncVatGbp * MST_PRICE_MARKUP_RATE);
  return {
    sourceIncVatGbp: roundMoney(sourceIncVatGbp),
    sellGbp,
    priceUsd: roundUpToNearestFive(sellGbp * MST_GBP_TO_USD_RATE),
  };
}

export function canonicalMstSku(handle: string) {
  return handle.trim().toUpperCase().replace(/^MST-/, "");
}

export function senditSkuCandidates(sku: string) {
  const partNumber = canonicalMstSku(sku);
  const canonical = `MST-${partNumber}`;
  return Array.from(new Set([canonical, SENDIT_SKU_ALIASES[canonical]].filter(Boolean)));
}

export function isRequestedMstProduct(handle: string, title: string) {
  const normalizedHandle = handle.trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  if (!(normalizedHandle.startsWith("bw-") || normalizedHandle.startsWith("ty-sup"))) return false;
  if (normalizedHandle.endsWith("dp") || /\bdownpipe\b|\bexhaust\b/.test(normalizedTitle))
    return false;
  if (normalizedHandle === "bw-miu03") return false;
  if (/\b(clear cover|replacement filter|air filter only)\b/.test(normalizedTitle)) return false;
  return /\b(intake|induction|inlet|boost|hose)\b/.test(normalizedTitle);
}

export function classifyMstProduct(title: string): MstCategoryKey {
  // Compatibility caveats often say "compatible with MST Intake Kits" even
  // when the product itself is a standalone inlet. Ignore parenthetical text
  // when classifying the sold component.
  const normalized = title.replace(/\([^)]*\)/g, " ").toLowerCase();
  const isIntakeSystem =
    /cold air intake|induction kit|intake system|intake kit|intake\s*(?:\+|and)\s*inlet/.test(
      normalized
    );
  const isPipe = /turbo inlet|inlet pipe|inlet kit|intake hose|inlet hose|boost pipe/.test(
    normalized
  );
  return isPipe && !isIntakeSystem ? "turbo-pipes" : "intake";
}

function withoutSkuSuffix(title: string) {
  return title
    .replace(/^MST(?: Performance)?\s+/i, "")
    .replace(/\s*\([A-Z]{2}-[A-Z0-9-]+\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function localizeMstTitleUa(title: string, sku: string) {
  const normalized = title.replace(/\([^)]*\)/g, " ").toLowerCase();
  const type =
    /cold air intake/.test(normalized) && /inlet/.test(normalized)
      ? "комплект холодного впуску та турбо-інлета"
      : /cold air intake/.test(normalized)
        ? "система холодного впуску"
        : /induction kit|intake system|intake kit/.test(normalized) && /inlet/.test(normalized)
          ? "комплект впуску та турбо-інлета"
          : /induction kit|intake system|intake kit/.test(normalized)
            ? "система впуску"
            : /hose/.test(normalized)
              ? "інлет-патрубок"
              : "турбо-інлет";
  return `MST Performance ${type} для ${applicationText(title)} (${sku})`
    .replace(/\s+/g, " ")
    .trim();
}

function applicationText(title: string) {
  return withoutSkuSuffix(title)
    .replace(/\([A-Z]{2}-[A-Z0-9-]+\)/gi, "")
    .replace(/\(\*?Only[^)]*\)/gi, "")
    .replace(/\bCold Air Intake(?: System)?\b/gi, "")
    .replace(/\bIntake Induction Kit\b/gi, "")
    .replace(/\bIntake System\b/gi, "")
    .replace(/\bIntake Kit\b/gi, "")
    .replace(/\bInduction Kit\b/gi, "")
    .replace(/\bSilicone Turbo Inlet Hose\b/gi, "")
    .replace(/\bTurbo Inlet Pipe Kit\b/gi, "")
    .replace(/\bTurbo Inlet Pipe\b/gi, "")
    .replace(/\bTurbo Inlet Kit\b/gi, "")
    .replace(/\bInlet Hose\b|\bIntake Hose\b/gi, "")
    .replace(/\bInlet Kit\b/gi, "")
    .replace(/\bInlet\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\s*\+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s/+-]+|[\s/+-]+$/g, "");
}

function compatibilityNotes(title: string) {
  const notes = Array.from(title.matchAll(/\(\*?(Only[^)]*)\)/gi), (match) => match[1].trim());
  if (!notes.length) return { en: "", ua: "" };
  const en = ` Manufacturer note: ${notes.join("; ")}.`;
  const uaNotes = notes.map((note) =>
    note
      .replace(/^Only for U\.S\.-spec$/i, "Лише для автомобілів у специфікації США")
      .replace(/^Only for /i, "Лише для ")
      .replace(/^Only compatible with /i, "Сумісно лише з ")
      .replace(/MST Intake Kits/gi, "комплектами впуску MST")
      .replace(/and Pure/gi, "та Pure")
  );
  return { en, ua: ` Примітка виробника: ${uaNotes.join("; ")}.` };
}

function automotiveTokens(value: string) {
  const matches =
    value.toUpperCase().match(/\b(?:A9[01]|[EFGU]\d{2,3}|[BNS]\d{2}|M\d{1,3}I?|X\dM?|Z4)\b/g) ?? [];
  return Array.from(new Set(matches));
}

export function buildMstTags(
  product: Pick<MstOfficialProduct, "handle" | "titleEn">,
  category: MstCategoryKey
) {
  const tags = new Set<string>([
    "MST Performance",
    `category:${category === "intake" ? "intake" : "turbo-pipes"}`,
    "store:main",
  ]);
  if (product.handle.startsWith("bw-") || /\bBMW\b|\bZ4\b/i.test(product.titleEn)) tags.add("BMW");
  if (product.handle.startsWith("ty-sup") || /\bToyota\b|\bSupra\b/i.test(product.titleEn)) {
    tags.add("Toyota");
    tags.add("Supra");
    tags.add("A90");
  }
  for (const token of automotiveTokens(product.titleEn)) tags.add(token);
  return Array.from(tags);
}

export function buildMstCatalogProduct(
  official: MstOfficialProduct,
  sendit: MstSenditPrice | null
): MstCatalogProduct {
  const sku = canonicalMstSku(official.handle);
  const categoryKey = classifyMstProduct(official.titleEn);
  const category = CATEGORY_COPY[categoryKey];
  const application = applicationText(official.titleEn) || official.titleEn;
  const compatibility = compatibilityNotes(official.titleEn);
  const price = sendit ? calculateMstRetailPrice(sendit.incVatGbp) : null;
  const normalizedTitle = official.titleEn.replace(/\([^)]*\)/g, " ").toLowerCase();
  const isCombinedIntake =
    categoryKey === "intake" &&
    /\b(?:intake|induction)\b/.test(normalizedTitle) &&
    /\binlet\b/.test(normalizedTitle);
  const isSiliconePipe = categoryKey === "turbo-pipes" && /\bsilicone\b/.test(normalizedTitle);
  const pipeDescriptionEn = /\bboost pipe\b/.test(normalizedTitle)
    ? "boost pipe"
    : /\bhose\b/.test(normalizedTitle)
      ? "inlet hose"
      : "turbo inlet";
  const pipeDescriptionUa = /\bboost pipe\b/.test(normalizedTitle)
    ? "буст-пайпа"
    : /\bhose\b/.test(normalizedTitle)
      ? "інлет-патрубка"
      : "турбо-інлета";
  const richerDescription =
    categoryKey === "intake"
      ? {
          en: isCombinedIntake
            ? `Bring out more of the character of ${application} with a complete MST Performance airflow upgrade. By improving the route from the air filter to the turbo inlet, the kit helps reduce unnecessary restriction, sharpen throttle response and deliver a richer induction and turbo soundtrack. Every component is designed to integrate neatly in the engine bay; the exact layout and included parts vary by SKU and are shown in the official product photos.${compatibility.en} Confirm the model year, engine generation, turbo configuration and regional specification on the official MST fitment page before ordering.`
            : `Let the engine in ${application} breathe more freely with an MST Performance intake system. The optimized airflow path helps reduce restriction, support a smoother supply of air and make throttle response feel more immediate, while adding a richer induction and turbo soundtrack. Its vehicle-specific layout is designed to integrate neatly in the engine bay; the exact configuration and included parts are shown in the official product photos.${compatibility.en} Confirm the model year, engine generation, turbo configuration and regional specification on the official MST fitment page before ordering.`,
          ua: isCombinedIntake
            ? `Розкрийте характер ${application} разом із комплексним рішенням MST Performance. Комплект оновлює повітряний тракт від фільтра до входу турбіни, допомагаючи зменшити зайвий опір, зробити реакцію на акселератор гострішою та додати насичений звук впуску й турбіни. Кожен елемент розроблений для охайної інтеграції в моторний відсік; точна конфігурація та склад залежать від SKU і показані на офіційних фото товару.${compatibility.ua} Перед замовленням звірте модельний рік, покоління двигуна, конфігурацію турбіни та регіональну специфікацію на офіційній сторінці сумісності MST.`
            : `Дайте двигуну ${application} дихати вільніше з впускною системою MST Performance. Оптимізований повітряний тракт допомагає зменшити опір, підтримує рівномірніший потік і робить реакцію на акселератор живішою, а звук впуску й турбіни — більш насиченим. Модельна конструкція акуратно інтегрується в моторний відсік; точна конфігурація та склад комплекту показані на офіційних фото товару.${compatibility.ua} Перед замовленням звірте модельний рік, покоління двигуна, конфігурацію турбіни та регіональну специфікацію на офіційній сторінці сумісності MST.`,
        }
      : {
          en: `Remove a restrictive section from the airflow path of ${application} with this MST Performance ${pipeDescriptionEn}. Its optimized geometry helps the turbo breathe more freely, supports consistent airflow under load and makes the car feel more responsive. It is a focused upgrade that also complements further intake tuning; compatibility with the factory or an upgraded intake depends on the exact SKU and the supplied configuration is shown in the official product photos.${compatibility.en} Confirm the model year, engine generation, turbo configuration and regional specification on the official MST fitment page before ordering.`,
          ua: `Приберіть зайве звуження на шляху повітря у ${application} за допомогою ${pipeDescriptionUa} MST Performance. Оптимізована геометрія допомагає турбіні дихати вільніше, підтримує стабільний потік під навантаженням і робить відгук автомобіля більш безпосереднім. Це влучне точкове оновлення, яке добре доповнює подальший тюнінг впуску; сумісність зі штатною або модернізованою системою залежить від SKU, а точне виконання показано на офіційних фото товару.${compatibility.ua} Перед замовленням звірте модельний рік, покоління двигуна, конфігурацію турбіни та регіональну специфікацію на офіційній сторінці сумісності MST.`,
        };
  const sellingPoints =
    categoryKey === "intake"
      ? isCombinedIntake
        ? {
            en: [
              "Complete airflow-path upgrade from the filter to the turbo inlet",
              "Fewer local restrictions and a smoother supply of air",
              "Sharper response with a more engaging induction and turbo sound",
            ],
            ua: [
              "Комплексне оновлення тракту від фільтра до входу турбіни",
              "Менше локальних звужень і рівномірніший потік повітря",
              "Жвавіша реакція та виразніший звук впуску й турбіни",
            ],
          }
        : {
            en: [
              "Freer airflow with less restriction than the factory intake path",
              "More immediate throttle response and a richer turbo sound",
              "Vehicle-specific layout for a neat engine-bay installation",
            ],
            ua: [
              "Вільніший потік повітря та менший опір у впускному тракті",
              "Жвавіша реакція на акселератор і насиченіший звук турбіни",
              "Модельна конструкція для охайної інтеграції під капотом",
            ],
          }
      : {
          en: [
            "Optimized internal path in place of a more restrictive factory section",
            "Supports consistent airflow and a more immediate turbo response",
            isSiliconePipe
              ? "Heat-resistant silicone construction for dependable operation under load"
              : "Application-specific configuration designed for the stated fitment",
          ],
          ua: [
            "Оптимізований прохід замість більш обмежувальної штатної ділянки",
            "Стабільніший потік повітря та більш безпосередня реакція турбіни",
            isSiliconePipe
              ? "Термостійкий силіконовий патрубок для надійної роботи під навантаженням"
              : "Конфігурація розроблена під заявлене застосування",
          ],
        };
  return {
    handle: official.handle,
    slug: `mst-${official.handle}`,
    sku,
    categoryKey,
    categoryEn: category.en,
    categoryUa: category.ua,
    titleEn: official.titleEn,
    titleUa: localizeMstTitleUa(official.titleEn, sku),
    shortDescEn: richerDescription.en,
    shortDescUa: richerDescription.ua,
    sellingPointsEn: sellingPoints.en,
    sellingPointsUa: sellingPoints.ua,
    tags: buildMstTags(official, categoryKey),
    images: Array.from(new Set(official.images.filter((image) => /^https:\/\//i.test(image)))),
    source: {
      officialUrl: official.officialUrl,
      senditUrl: sendit?.url ?? null,
      senditMatchedSku: sendit?.matchedSku ?? null,
      manufacturerAvailability: official.manufacturerAvailability,
      senditAvailability: sendit?.availability ?? null,
    },
    pricing: {
      status: sendit ? "matched" : "missing",
      sourceIncVatGbp: sendit?.incVatGbp ?? null,
      sourceExVatGbp: sendit?.exVatGbp ?? null,
      markupPct: 10,
      sellGbp: price?.sellGbp ?? null,
      gbpToUsdRate: 1.37,
      priceUsd: price?.priceUsd ?? null,
    },
  };
}
