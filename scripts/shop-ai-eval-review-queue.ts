import {
  SHOP_AI_EVAL_LANGUAGES,
  evaluateShopAiReleaseGate,
  validateShopAiEvalCases,
  type ShopAiEvalCase,
  type ShopAiEvalLanguage,
  type ShopAiReleaseGateConfig,
} from "./shop-ai-eval-harness";

export const SHOP_AI_EVAL_REVIEW_QUEUE_SCHEMA_VERSION = 1;

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
  exactSku: boolean;
}) {
  if (input.exactSku && input.seed.sku) {
    if (input.language === "en") return `Find exact SKU ${input.seed.sku}`;
    if (input.language === "ru") return `Найди точный SKU ${input.seed.sku}`;
    if (input.language === "translit") return `Znaidy tochnyi SKU ${input.seed.sku}`;
    if (input.language === "mixed") return `Знайди exact SKU ${input.seed.sku}`;
    return `Знайди точний артикул ${input.seed.sku}`;
  }
  const title = input.language === "en" ? input.seed.titleEn : input.seed.titleUa;
  const label = cleanLabel(
    [input.seed.brand, title, input.seed.sku ? `SKU ${input.seed.sku}` : null]
      .filter(Boolean)
      .join(" ")
  );
  const templates = QUERY_TEMPLATES[input.language];
  return templates[input.ordinal % templates.length](
    queryTerm(input.seed.category, input.language),
    label
  );
}

export function buildShopAiEvalReviewQueue(input: {
  seeds: ShopAiEvalReviewSeed[];
  categories: readonly string[];
  targetCases?: number;
  generatedAt?: Date;
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
          Number(Boolean(right.sku)) - Number(Boolean(left.sku)) ||
          left.productId.localeCompare(right.productId)
      );
    if (seeds.length === 0)
      throw new Error(`Review queue has no real catalog seed for ${category}`);
    seedByCategory.set(category, seeds);
  }

  const basePerCategory = Math.floor(targetCases / input.categories.length);
  const remainder = targetCases % input.categories.length;
  const items: ShopAiEvalReviewQueueItem[] = [];
  let globalIndex = 0;

  input.categories.forEach((category, categoryIndex) => {
    const categoryTarget = basePerCategory + (categoryIndex < remainder ? 1 : 0);
    const seeds = seedByCategory.get(category) as ShopAiEvalReviewSeed[];
    for (let index = 0; index < categoryTarget; index += 1) {
      const seed = seeds[index % seeds.length];
      const language = SHOP_AI_EVAL_LANGUAGES[globalIndex % SHOP_AI_EVAL_LANGUAGES.length];
      const exactSku = index === 0 && Boolean(seed.sku);
      const hardNegativeCandidate = globalIndex % 5 === 0;
      const message = buildDraftMessage({
        seed,
        language,
        ordinal: Math.floor(index / seeds.length),
        exactSku,
      });
      const id = `review-${slugPart(category)}-${String(index + 1).padStart(3, "0")}-${slugPart(seed.productId)}`;
      const tags = ["review-draft", exactSku ? "exact-sku" : "catalog-seed"];
      const hardDimensions = seed.chassis
        ? (["chassis", "semantic"] as const)
        : (["category", "semantic"] as const);
      const draftCase: ShopAiEvalCase = {
        id,
        locale: language === "en" ? "en" : "ua",
        message,
        metadata: {
          language,
          tags,
          ...(hardNegativeCandidate
            ? {
                hardNegative: {
                  dimensions: [...hardDimensions],
                  note: "Reviewer must confirm that semantically similar products cannot become a wrong exact match.",
                },
              }
            : {}),
        },
        expect: {
          mode: "results",
          category,
          needsClarification: false,
          expectedProductIds: [seed.productId],
          ...(seed.variantId ? { expectedVariantIds: [seed.variantId] } : {}),
          ...(seed.make ? { make: seed.make } : {}),
          ...(seed.model ? { model: seed.model } : {}),
          ...(seed.chassis ? { chassis: seed.chassis } : {}),
          ...(seed.year ? { year: seed.year } : {}),
          ...(seed.opfGpf ? { opfGpf: seed.opfGpf } : {}),
        },
      };
      items.push({
        id,
        status: "pending",
        category,
        language,
        source: {
          kind: "catalog_seed",
          evidenceId: seed.sourceEvidenceId,
          productId: seed.productId,
          variantId: seed.variantId ?? null,
          sku: seed.sku ?? null,
        },
        draftCase,
        reviewer: null,
        reviewedAt: null,
        reviewEvidenceId: null,
        reviewerNotes: null,
      });
      globalIndex += 1;
    }
  });

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
