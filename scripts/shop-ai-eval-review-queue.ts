import {
  SHOP_AI_EVAL_LANGUAGES,
  evaluateShopAiReleaseGate,
  validateShopAiEvalCases,
  type ShopAiEvalCase,
  type ShopAiEvalLanguage,
  type ShopAiReleaseGateConfig,
} from "./shop-ai-eval-harness";
import { compactShopCode } from "../src/lib/shopVehicleSearch";

export const SHOP_AI_EVAL_REVIEW_QUEUE_SCHEMA_VERSION = 2;

export type ShopAiEvalReviewSeed = {
  category: string;
  productId: string;
  variantId?: string | null;
  sku?: string | null;
  titleUa: string;
  titleEn: string;
  brand?: string | null;
  make?: string | null;
  model?: string | null;
  chassis?: string | null;
  year?: number | null;
  opfGpf?: "with" | "without" | null;
  sourceEvidenceId: string;
};

export type ShopAiEvalReviewQueueItem = {
  id: string;
  status: "pending" | "approved" | "rejected";
  category: string;
  language: ShopAiEvalLanguage;
  source: {
    kind: "catalog_seed";
    evidenceId: string;
    productId: string;
    variantId: string | null;
    sku: string | null;
  };
  oracle: {
    kind: "catalog_relevance" | "clarification" | "exact_sku" | "mutated_sku_no_match";
    automationEligibility: "deterministic" | "source_grounded_reviewable";
    fitmentClaimAllowed: false;
    rationale: string;
  };
  draftCase: ShopAiEvalCase;
  reviewer: string | null;
  reviewedAt: string | null;
  reviewEvidenceId: string | null;
  reviewerNotes: string | null;
};

export type ShopAiEvalReviewQueue = {
  schemaVersion: typeof SHOP_AI_EVAL_REVIEW_QUEUE_SCHEMA_VERSION;
  generatedAt: string;
  targetCases: number;
  items: ShopAiEvalReviewQueueItem[];
};

const CATEGORY_QUERY_TERMS: Record<string, Record<ShopAiEvalLanguage, string>> = {
  merch: {
    ua: "мерч",
    en: "merch",
    ru: "мерч",
    mixed: "merch для авто",
    translit: "merch dlia avto",
  },
  exhaust: {
    ua: "вихлоп",
    en: "exhaust",
    ru: "выхлоп",
    mixed: "exhaust для авто",
    translit: "vykhlop dlia avto",
  },
  carbonAero: {
    ua: "карбоновий аерообвіс",
    en: "carbon aero",
    ru: "карбоновый обвес",
    mixed: "carbon обвіс",
    translit: "karbonovyi obvis",
  },
  brakes: {
    ua: "гальма",
    en: "brakes",
    ru: "тормоза",
    mixed: "brakes для авто",
    translit: "halma dlia avto",
  },
  suspension: {
    ua: "підвіска",
    en: "suspension",
    ru: "подвеска",
    mixed: "suspension для авто",
    translit: "pidviska dlia avto",
  },
  performance: {
    ua: "тюнінг двигуна",
    en: "performance upgrade",
    ru: "тюнинг двигателя",
    mixed: "performance тюнінг",
    translit: "tiuninh dvyhuna",
  },
  chipTuning: {
    ua: "чип-тюнінг",
    en: "chip tuning",
    ru: "чип-тюнинг",
    mixed: "chip тюнінг",
    translit: "chyp tiuninh",
  },
  motoCarbon: {
    ua: "карбон для мотоцикла",
    en: "motorcycle carbon",
    ru: "карбон для мотоцикла",
    mixed: "moto carbon деталі",
    translit: "karbon dlia mototsykla",
  },
  cooling: {
    ua: "охолодження",
    en: "cooling upgrade",
    ru: "охлаждение",
    mixed: "cooling для авто",
    translit: "okholodzhennia dlia avto",
  },
  wheels: {
    ua: "диски",
    en: "wheels",
    ru: "диски",
    mixed: "wheels для авто",
    translit: "dysky dlia avto",
  },
  lighting: {
    ua: "освітлення",
    en: "lighting",
    ru: "освещение",
    mixed: "lighting для авто",
    translit: "osvitlennia dlia avto",
  },
  interior: {
    ua: "деталі салону",
    en: "interior parts",
    ru: "детали салона",
    mixed: "interior деталі",
    translit: "detali salonu",
  },
  accessories: {
    ua: "аксесуари",
    en: "accessories",
    ru: "аксессуары",
    mixed: "accessories для авто",
    translit: "aksesuary dlia avto",
  },
};

const VEHICLE_OPTIONAL_CATEGORIES = new Set(["merch"]);
const HARD_NEGATIVE_SHARE = 0.2;
const DEFAULT_EXACT_SKU_CASES = 10;

const QUERY_TEMPLATES: Record<
  ShopAiEvalLanguage,
  Array<(term: string, label: string) => string>
> = {
  ua: [
    (term, label) => `Покажи ${term}: ${label}`,
    (term, label) => `Підбери ${term} ${label}`,
    (term, label) => `Чи є в наявності ${label}, категорія ${term}?`,
    (term, label) => `Хочу порівняти ${label} серед товарів ${term}`,
    (term, label) => `Знайди точну позицію ${label} у розділі ${term}`,
    (term, label) => `Що відомо про ${label} як ${term}?`,
    (term, label) => `Потрібен варіант ${term}, назва ${label}`,
    (term, label) => `Перевір товар ${label} для запиту ${term}`,
  ],
  en: [
    (term, label) => `Show me ${term}: ${label}`,
    (term, label) => `Find ${label} in ${term}`,
    (term, label) => `Is ${label} available as a ${term} product?`,
    (term, label) => `Compare ${label} with other ${term} products`,
    (term, label) => `Open the exact ${term} item ${label}`,
    (term, label) => `What is confirmed about ${label} for ${term}?`,
    (term, label) => `I need ${term}, product name ${label}`,
    (term, label) => `Check the ${term} product ${label}`,
  ],
  ru: [
    (term, label) => `Пожалуйста, покажи ${term}: ${label}`,
    (term, label) => `Подбери мне ${term} ${label}`,
    (term, label) => `Есть ли сейчас ${label} в категории ${term}?`,
    (term, label) => `Сравни ${label} с другими товарами ${term}`,
    (term, label) => `Открой точную позицию ${label} в разделе ${term}`,
    (term, label) => `Какие данные подтверждены про ${label} как ${term}?`,
    (term, label) => `Мне нужен ${term}, товар называется ${label}`,
    (term, label) => `Проверь позицию ${label} по запросу ${term}`,
  ],
  mixed: [
    (term, label) => `Покажи ${term}: ${label}`,
    (term, label) => `Find мені ${term} ${label}`,
    (term, label) => `Is ${label} в наявності у ${term}?`,
    (term, label) => `Compare ${label} з іншими ${term}`,
    (term, label) => `Open точний товар ${label}, ${term}`,
    (term, label) => `Що confirmed про ${label} для ${term}?`,
    (term, label) => `Need ${term}, назва ${label}`,
    (term, label) => `Check товар ${label} у ${term}`,
  ],
  translit: [
    (term, label) => `Pokazhy ${term}: ${label}`,
    (term, label) => `Pidbery ${term} ${label}`,
    (term, label) => `Chy ye v naiavnosti ${label}, katehoriia ${term}?`,
    (term, label) => `Khochu porivniaty ${label} sered ${term}`,
    (term, label) => `Znaidy tochnu pozytsiiu ${label} u ${term}`,
    (term, label) => `Shcho pidtverdzheno pro ${label} dlia ${term}?`,
    (term, label) => `Potriben ${term}, nazva ${label}`,
    (term, label) => `Perevir tovar ${label} dlia ${term}`,
  ],
};

const CLARIFICATION_TEMPLATES: Record<ShopAiEvalLanguage, Array<(term: string) => string>> = {
  ua: [(term) => `Допоможи підібрати ${term}`, (term) => `Хочу встановити ${term}, з чого почати?`],
  en: [
    (term) => `Help me choose ${term}`,
    (term) => `I want a ${term} upgrade. What do you need from me?`,
  ],
  ru: [(term) => `Помоги подобрать ${term}`, (term) => `Хочу установить ${term}, с чего начать?`],
  mixed: [
    (term) => `Допоможи choose ${term}`,
    (term) => `Хочу ${term} upgrade, що треба уточнити?`,
  ],
  translit: [
    (term) => `Dopomozhy pidibraty ${term}`,
    (term) => `Khochu vstanovyty ${term}, z choho pochaty?`,
  ],
};

function cleanLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function queryTerm(category: string, language: ShopAiEvalLanguage) {
  return CATEGORY_QUERY_TERMS[category]?.[language] ?? category;
}

function buildDraftMessage(input: {
  seed: ShopAiEvalReviewSeed;
  language: ShopAiEvalLanguage;
  ordinal: number;
}) {
  const title = input.language === "en" ? input.seed.titleEn : input.seed.titleUa;
  const vehicle = cleanLabel(
    [input.seed.make, input.seed.model, input.seed.chassis, input.seed.year]
      .filter(Boolean)
      .join(" ")
  );
  const label = cleanLabel([input.seed.brand, title, vehicle].filter(Boolean).join(" "));
  const templates = QUERY_TEMPLATES[input.language];
  return templates[input.ordinal % templates.length](
    queryTerm(input.seed.category, input.language),
    label
  );
}

function buildClarificationMessage(
  category: string,
  language: ShopAiEvalLanguage,
  ordinal: number
) {
  const templates = CLARIFICATION_TEMPLATES[language];
  return templates[ordinal % templates.length](queryTerm(category, language));
}

function buildExactSkuMessage(sku: string, language: ShopAiEvalLanguage) {
  if (language === "en") return `Find exact SKU ${sku}`;
  if (language === "ru") return `Найди точный SKU ${sku}`;
  if (language === "translit") return `Znaidy tochnyi SKU ${sku}`;
  if (language === "mixed") return `Знайди exact SKU ${sku}`;
  return `Знайди точний артикул ${sku}`;
}

function buildUnknownSku(seed: ShopAiEvalReviewSeed, ordinal: number, knownSkuTokens: Set<string>) {
  const base = String(seed.sku ?? `ONEAI-${seed.productId}`)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._/+()-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    .slice(0, 48);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = `-ONEAI-NOMATCH-${String(ordinal + attempt + 1).padStart(4, "0")}`;
    const candidate = `${base || "SKU"}${suffix}`.slice(0, 79);
    const token = compactShopCode(candidate);
    if (!knownSkuTokens.has(token)) {
      knownSkuTokens.add(token);
      return candidate;
    }
  }
  throw new Error(`Could not build a unique no-match SKU for ${seed.productId}`);
}

function createQueueItem(input: {
  id: string;
  category: string;
  language: ShopAiEvalLanguage;
  seed: ShopAiEvalReviewSeed;
  draftCase: ShopAiEvalCase;
  oracle: ShopAiEvalReviewQueueItem["oracle"];
}): ShopAiEvalReviewQueueItem {
  return {
    id: input.id,
    status: "pending",
    category: input.category,
    language: input.language,
    source: {
      kind: "catalog_seed",
      evidenceId: input.seed.sourceEvidenceId,
      productId: input.seed.productId,
      variantId: input.seed.variantId ?? null,
      sku: input.seed.sku ?? null,
    },
    oracle: input.oracle,
    draftCase: input.draftCase,
    reviewer: null,
    reviewedAt: null,
    reviewEvidenceId: null,
    reviewerNotes: null,
  };
}

export function buildShopAiEvalReviewQueue(input: {
  seeds: ShopAiEvalReviewSeed[];
  categories: readonly string[];
  targetCases?: number;
  generatedAt?: Date;
  knownSkuTokens?: Iterable<string>;
}): ShopAiEvalReviewQueue {
  const targetCases = input.targetCases ?? 500;
  if (!Number.isInteger(targetCases) || targetCases < input.categories.length) {
    throw new Error("Review queue target must be an integer covering every category");
  }
  const seedByCategory = new Map<string, ShopAiEvalReviewSeed[]>();
  for (const category of input.categories) {
    const seeds = input.seeds
      .filter((seed) => seed.category === category)
      .sort(
        (left, right) =>
          Number(Boolean(right.make && right.model)) - Number(Boolean(left.make && left.model)) ||
          Number(Boolean(right.sku)) - Number(Boolean(left.sku)) ||
          left.productId.localeCompare(right.productId)
      );
    if (seeds.length === 0)
      throw new Error(`Review queue has no real catalog seed for ${category}`);
    seedByCategory.set(category, seeds);
  }

  const skuSeeds = input.seeds
    .filter((seed) => Boolean(seed.sku))
    .filter(
      (seed, index, seeds) =>
        seeds.findIndex(
          (candidate) => compactShopCode(candidate.sku ?? "") === compactShopCode(seed.sku ?? "")
        ) === index
    );
  const hardNegativeTarget = Math.floor(targetCases * HARD_NEGATIVE_SHARE);
  if (hardNegativeTarget > 0 && skuSeeds.length === 0) {
    throw new Error("Review queue needs at least one real SKU seed for hard-negative coverage");
  }
  const exactSkuTarget = Math.min(DEFAULT_EXACT_SKU_CASES, skuSeeds.length);
  const categoryCaseTarget = targetCases - hardNegativeTarget - exactSkuTarget;
  if (categoryCaseTarget < input.categories.length) {
    throw new Error(
      "Review queue target is too small for category, exact-SKU and hard-negative coverage"
    );
  }
  const basePerCategory = Math.floor(categoryCaseTarget / input.categories.length);
  const remainder = categoryCaseTarget % input.categories.length;
  const items: ShopAiEvalReviewQueueItem[] = [];
  const knownSkuTokens = new Set(
    [
      ...(input.knownSkuTokens ?? []),
      ...skuSeeds.map((seed) => compactShopCode(seed.sku ?? "")),
    ].filter(Boolean)
  );
  let globalIndex = 0;

  input.categories.forEach((category, categoryIndex) => {
    const categoryTarget = basePerCategory + (categoryIndex < remainder ? 1 : 0);
    const seeds = seedByCategory.get(category) as ShopAiEvalReviewSeed[];
    const clarificationTarget = VEHICLE_OPTIONAL_CATEGORIES.has(category)
      ? 0
      : Math.floor(categoryTarget / 3);
    const resultTarget = categoryTarget - clarificationTarget;
    for (let index = 0; index < categoryTarget; index += 1) {
      const seed = seeds[index % seeds.length];
      const language = SHOP_AI_EVAL_LANGUAGES[globalIndex % SHOP_AI_EVAL_LANGUAGES.length];
      const clarification = index >= resultTarget;
      const message = clarification
        ? buildClarificationMessage(category, language, index - resultTarget)
        : buildDraftMessage({ seed, language, ordinal: index });
      const id = `review-${slugPart(category)}-${clarification ? "clarify" : "catalog"}-${String(index + 1).padStart(3, "0")}-${slugPart(seed.productId)}`;
      const draftCase: ShopAiEvalCase = {
        id,
        locale: language === "en" ? "en" : "ua",
        message,
        metadata: {
          language,
          tags: ["review-draft", clarification ? "clarification" : "catalog-relevance"],
        },
        expect: clarification
          ? { mode: "clarification", category, needsClarification: true }
          : {
              mode: "results",
              category,
              needsClarification: false,
              expectedProductIds: [seed.productId],
              ...(seed.make ? { make: seed.make } : {}),
              ...(seed.model ? { model: seed.model } : {}),
              ...(seed.chassis ? { chassis: seed.chassis } : {}),
              ...(seed.year ? { year: seed.year } : {}),
            },
      };
      items.push(
        createQueueItem({
          id,
          category,
          language,
          seed,
          draftCase,
          oracle: clarification
            ? {
                kind: "clarification",
                automationEligibility: "deterministic",
                fitmentClaimAllowed: false,
                rationale: "The query names a category but omits the vehicle required for fitment.",
              }
            : {
                kind: "catalog_relevance",
                automationEligibility: "source_grounded_reviewable",
                fitmentClaimAllowed: false,
                rationale:
                  "The expected product identity is grounded in the active catalog; fitment remains reviewable unless separate trusted evidence exists.",
              },
        })
      );
      globalIndex += 1;
    }
  });

  for (let index = 0; index < exactSkuTarget; index += 1) {
    const seed = skuSeeds.at(index);
    if (!seed?.sku) throw new Error(`Missing exact-SKU seed at index ${index}`);
    const language = SHOP_AI_EVAL_LANGUAGES[globalIndex % SHOP_AI_EVAL_LANGUAGES.length];
    const sku = seed.sku;
    const id = `review-exact-sku-${String(index + 1).padStart(3, "0")}-${slugPart(seed.productId)}`;
    const draftCase: ShopAiEvalCase = {
      id,
      locale: language === "en" ? "en" : "ua",
      message: buildExactSkuMessage(sku, language),
      metadata: { language, tags: ["review-draft", "exact-sku", "machine-checkable"] },
      expect: {
        mode: "results",
        needsClarification: false,
        expectedProductIds: [seed.productId],
        ...(seed.variantId ? { expectedVariantIds: [seed.variantId] } : {}),
      },
    };
    items.push(
      createQueueItem({
        id,
        category: seed.category,
        language,
        seed,
        draftCase,
        oracle: {
          kind: "exact_sku",
          automationEligibility: "deterministic",
          fitmentClaimAllowed: false,
          rationale: "Exact SKU is a catalog identity assertion, not a vehicle-fitment assertion.",
        },
      })
    );
    globalIndex += 1;
  }

  for (let index = 0; index < hardNegativeTarget; index += 1) {
    const seed = skuSeeds.at(index % skuSeeds.length);
    if (!seed) throw new Error(`Missing hard-negative SKU seed at index ${index}`);
    const language = SHOP_AI_EVAL_LANGUAGES[globalIndex % SHOP_AI_EVAL_LANGUAGES.length];
    const unknownSku = buildUnknownSku(seed, index, knownSkuTokens);
    const id = `review-sku-no-match-${String(index + 1).padStart(3, "0")}-${slugPart(seed.productId)}`;
    const draftCase: ShopAiEvalCase = {
      id,
      locale: language === "en" ? "en" : "ua",
      message: buildExactSkuMessage(unknownSku, language),
      metadata: {
        language,
        tags: ["review-draft", "sku-hard-negative", "machine-checkable"],
        hardNegative: {
          dimensions: seed.variantId ? ["product", "variant", "semantic"] : ["product", "semantic"],
          note: "A one-off synthetic SKU is absent from the active catalog; the source product and variant are explicit forbidden near matches.",
        },
      },
      expect: {
        mode: "no_match",
        needsClarification: false,
        forbiddenProductIds: [seed.productId],
        ...(seed.variantId ? { forbiddenVariantIds: [seed.variantId] } : {}),
      },
    };
    items.push(
      createQueueItem({
        id,
        category: seed.category,
        language,
        seed,
        draftCase,
        oracle: {
          kind: "mutated_sku_no_match",
          automationEligibility: "deterministic",
          fitmentClaimAllowed: false,
          rationale:
            "The generated SKU token is checked against the known catalog token set and must not resolve to a product.",
        },
      })
    );
    globalIndex += 1;
  }

  if (items.length !== targetCases) {
    throw new Error(`Review queue produced ${items.length}/${targetCases} cases`);
  }
  if (new Set(items.map((item) => item.draftCase.message)).size !== items.length) {
    throw new Error("Review queue produced duplicate messages");
  }

  return {
    schemaVersion: SHOP_AI_EVAL_REVIEW_QUEUE_SCHEMA_VERSION,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    targetCases,
    items,
  };
}

export function compileApprovedShopAiEvalReviewQueue(
  queue: ShopAiEvalReviewQueue,
  config: ShopAiReleaseGateConfig
) {
  const errors: string[] = [];
  if (queue.schemaVersion !== SHOP_AI_EVAL_REVIEW_QUEUE_SCHEMA_VERSION) {
    errors.push(`unsupported review queue schema ${queue.schemaVersion}`);
  }
  const approved = queue.items.filter((item) => item.status === "approved");
  const cases = approved.map((item) => {
    if (!item.reviewer?.trim()) errors.push(`${item.id}: reviewer is required`);
    if (!item.reviewedAt?.trim()) errors.push(`${item.id}: reviewedAt is required`);
    if (!item.reviewEvidenceId?.trim()) errors.push(`${item.id}: reviewEvidenceId is required`);
    return {
      ...item.draftCase,
      metadata: {
        ...item.draftCase.metadata,
        language: item.language,
        reviewer: item.reviewer?.trim() ?? "",
        reviewedAt: item.reviewedAt?.trim() ?? "",
        reviewEvidenceId: item.reviewEvidenceId?.trim() ?? "",
      },
    } satisfies ShopAiEvalCase;
  });
  if (approved.length !== queue.targetCases) {
    errors.push(`approved ${approved.length}/${queue.targetCases} review cases`);
  }
  const validated = validateShopAiEvalCases(cases);
  if (!validated.ok) errors.push(...validated.errors);
  const gate = validated.ok ? evaluateShopAiReleaseGate(validated.value, config) : null;
  if (gate && !gate.passed) errors.push(...gate.errors);
  return {
    ok: errors.length === 0,
    errors,
    cases: validated.ok ? validated.value : [],
    gate,
  };
}
