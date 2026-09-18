type OfficialVariant = { id: number; sku: string; price: string; title: string };
type OfficialImage = { src: string; variant_ids?: number[] };
export type OfficialRevozportProduct = {
  handle: string;
  title: string;
  variants: OfficialVariant[];
  images: OfficialImage[];
};

export type RevozportSource = {
  sku: string;
  titleEn: string;
  productType?: string | null;
  longDescUa: string;
  image: string | null;
  gallery: string[];
  priceUsd: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
  source: {
    officialUrl: string;
    seaShippingUsd: number | null;
    shippingWeightLbs: number | null;
    productWeightLbs: number | null;
  };
};

export const REVOZPORT_SHIPPING_RATE_USD_PER_KG = 25;
const REVOZPORT_ESTIMATED_WEIGHT_SAFETY_MULTIPLIER = 1.1;

const ESTIMATED_SHIPPING_WEIGHT_BY_TYPE_KG: Record<string, number> = {
  hood: 39.92,
  "rear trunk": 19.96,
  "side skirts": 9.98,
  "side fender": 9.98,
  "fender arches": 9.98,
  "rear wing": 9.98,
  "rear diffuser": 7.98,
  undertray: 7.98,
  "front lip": 4.99,
  splitters: 4.99,
  splitter: 4.99,
  "front splitter": 4.99,
  spoiler: 4.99,
  bumper: 7.98,
  grill: 3.18,
  "air intake vents": 1.5,
  "air intake": 3.18,
  vents: 1.5,
  vent: 1.5,
  canard: 1.5,
  mirror: 1.5,
  tailpipe: 3.18,
};
const DEFAULT_ESTIMATED_SHIPPING_WEIGHT_KG = 4.99;

function findWeightBaseline(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  for (const [partType, candidate] of Object.entries(ESTIMATED_SHIPPING_WEIGHT_BY_TYPE_KG)) {
    if (normalized.includes(partType)) return { candidate, partType };
  }
  return null;
}

export function estimateRevozportShippingWeightKg(source: RevozportSource) {
  let estimate = DEFAULT_ESTIMATED_SHIPPING_WEIGHT_KG;
  let matchedType = "generic carbon aero";
  // Prefer the structured product type. Searching the full title first can
  // misclassify "hood fins" as a full hood or a canard as a bumper part.
  const match = findWeightBaseline(source.productType) ?? findWeightBaseline(source.titleEn);
  if (match) {
    estimate = match.candidate;
    matchedType = match.partType;
  }

  const productWeightKg =
    source.source.productWeightLbs != null && source.source.productWeightLbs > 0
      ? source.source.productWeightLbs * 0.45359237
      : null;
  if (productWeightKg != null) estimate = Math.max(estimate, productWeightKg * 1.8);

  if (
    source.length != null &&
    source.width != null &&
    source.height != null &&
    source.length > 0 &&
    source.width > 0 &&
    source.height > 0
  ) {
    const volumeM3 = (source.length * source.width * source.height) / 1_000_000;
    const maxDimensionCm = Math.max(source.length, source.width, source.height);
    if (volumeM3 >= 0.28 || maxDimensionCm >= 180) estimate = Math.max(estimate, 9.98);
  }

  return {
    weightKg: Math.round(estimate * REVOZPORT_ESTIMATED_WEIGHT_SAFETY_MULTIPLIER * 1000) / 1000,
    source: `estimated_${productWeightKg != null ? "from_product_weight" : "by_part_type"}:${matchedType}`,
  } as const;
}

const PART_NAMES: Record<string, string> = {
  "front lip": "Карбонова передня губа",
  "front lip diffuser": "Карбоновий передній спліттер",
  "front splitter": "Карбоновий передній спліттер",
  "front grill": "Карбонова передня решітка",
  "front kidney grille": "Карбонова решітка радіатора",
  grill: "Карбонова решітка",
  grille: "Карбонова решітка",
  "front grill trim": "Карбонова накладка передньої решітки",
  "front bumper canards": "Карбонові канарди переднього бампера",
  "front canards": "Карбонові передні канарди",
  "rear bumper canards": "Карбонові канарди заднього бампера",
  "bumper canards": "Карбонові канарди бампера",
  hood: "Карбоновий капот",
  "front hood": "Карбоновий капот",
  "hood fins": "Карбонові аеродинамічні накладки капота",
  "side skirts": "Карбонові бічні пороги",
  "rear spoiler": "Карбоновий задній спойлер",
  "rear wing spoiler": "Карбонове заднє антикрило",
  "rear roof spoiler": "Карбоновий спойлер даху",
  "roof spoiler": "Карбоновий спойлер даху",
  "rear diffuser": "Карбоновий задній дифузор",
  "rear diffuser skid plate": "Карбонова захисна панель заднього дифузора",
  "front bumper vents": "Карбонові вентиляційні елементи переднього бампера",
  "rear bumper vents": "Карбонові вентиляційні елементи заднього бампера",
  "front bumper air intake": "Карбоновий повітрозабірник переднього бампера",
  "front bumper air intake vent": "Карбоновий повітрозабірник переднього бампера",
  "front bumper air intake vents": "Карбонові повітрозабірники переднього бампера",
  "front bumper air intake covers": "Карбонові накладки повітрозабірників переднього бампера",
  "side fender vents": "Карбонові вентиляційні накладки крил",
  "side fenders": "Карбонові крила",
  "side fender": "Карбонове крило",
  "rear trunk": "Карбонова кришка багажника",
  "rear trunk lid": "Карбонова кришка багажника",
  "front bumper trim": "Карбонова накладка переднього бампера",
  "air intake trim": "Карбонова накладка повітрозабірника",
  "rear bumper splitter": "Карбоновий спліттер заднього бампера",
  "wheel arch cover trims": "Карбонові накладки колісних арок",
  "door trim": "Карбонова накладка дверей",
  "fender flares": "Карбонові розширювачі колісних арок",
  "widebody fender flares": "Карбонові розширювачі арок Widebody",
  "mirror covers": "Карбонові накладки дзеркал",
  mirrors: "Карбонові дзеркала",
  "front inner fender liners set (2 pcs)": "Карбонові передні підкрилки, комплект із 2 шт.",
  "track undertray kit": "Комплект карбонових панелей днища для треку",
  "trunk trim": "Карбонова накладка багажника",
  "rear trunk trim": "Карбонова накладка кришки багажника",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!
  );
}

function officialHandle(value: string) {
  try {
    return new URL(value).pathname.replace(/\/$/, "").split("/").pop();
  } catch {
    return null;
  }
}

export function matchOfficialRevozport(
  source: RevozportSource,
  products: OfficialRevozportProduct[]
) {
  const matches = products.flatMap((product) =>
    product.variants
      .filter((variant) => variant.sku?.trim().toUpperCase() === source.sku.trim().toUpperCase())
      .map((variant) => ({ product, variant }))
  );
  const linked = matches.filter(
    ({ product }) => product.handle === officialHandle(source.source.officialUrl)
  );
  return linked.length === 1 ? linked[0] : matches.length === 1 ? matches[0] : null;
}

export function revozportEditorialTitle(source: RevozportSource) {
  const cleaned = source.titleEn
    .replace(/\u00a0/g, " ")
    .replace(/\bSpolier\b/gi, "Spoiler")
    .replace(/\bDiffsuer\b/gi, "Diffuser")
    .replace(/\bSkrits\b/gi, "Skirts")
    .replace(/\bBmper\b/gi, "Bumper")
    .replace(/ Vents or BMW /, " Vents for BMW ")
    .replace(/G90Sedan/g, "G90 Sedan")
    .replace(/G99Touring/g, "G99 Touring")
    .replace(
      /^2025 BMW G99 M5 wagon revozport dry carbon spoiler$/i,
      "Dry Carbon Fiber Rear Spoiler for BMW M5 G99 Touring 2025"
    );
  if (/^RZ-/i.test(cleaned)) return null;
  const pieces = cleaned.match(/^(\d+) Pieces /i)?.[1];
  const stripped = cleaned
    .replace(/^\d+ Pieces /i, "")
    .replace(/^(?:Dry )?Carbon(?: Fiber)? /i, "");
  const split = stripped.split(/\s+for\s+/i);
  const noun = PART_NAMES[split[0].trim().toLowerCase()];
  if (!noun || split.length !== 2) return null;
  return {
    titleUa: `${noun} для ${split[1].trim()}${pieces ? ` (комплект: ${pieces} шт.)` : ""}`,
    titleEn: cleaned,
    fitment: split[1].trim(),
    partUa: noun,
  };
}

export function buildRevozportEnrichment(
  source: RevozportSource,
  products: OfficialRevozportProduct[]
) {
  const official = matchOfficialRevozport(source, products);
  const titles = revozportEditorialTitle(source);
  const officialImages =
    official?.product.images
      .filter(
        (image) => !image.variant_ids?.length || image.variant_ids.includes(official.variant.id)
      )
      .map((image) => (image.src.startsWith("//") ? `https:${image.src}` : image.src))
      .filter((url) => /^https:\/\/(?:cdn\.shopify\.com|revozport\.com)\//.test(url)) ?? [];
  const gallery = [
    ...new Set(
      [source.image, ...officialImages, ...(source.gallery ?? [])].filter((url): url is string =>
        Boolean(url)
      )
    ),
  ].slice(0, 10);
  const image = source.image || gallery[0] || null;
  const ua = titles?.titleUa;
  const en = titles?.titleEn;
  const material = source.longDescUa.match(/<li>Матеріал: ([^<]*)<\/li>/)?.[1];
  const materialUa = material === "Dry CF" ? "Сухий карбон (Dry CF)" : material;
  const dimensionsKnown = [source.length, source.width, source.height].every(
    (n) => n != null && n > 0
  );
  const dimensions = dimensionsKnown
    ? [source.length, source.width, source.height].map((n) => n!.toFixed(1)).join(" × ")
    : null;
  const sourceShippingKg =
    source.source.shippingWeightLbs != null && source.source.shippingWeightLbs > 0
      ? (source.source.shippingWeightLbs * 0.45359237).toFixed(3)
      : null;
  const estimatedShipping =
    sourceShippingKg == null ? estimateRevozportShippingWeightKg(source) : null;
  const shippingKg = sourceShippingKg ?? estimatedShipping!.weightKg.toFixed(3);
  const shippingWeightEstimated = sourceShippingKg == null;
  const shippingWeightSource =
    sourceShippingKg != null ? "workbook_shipping_weight" : estimatedShipping!.source;
  const productKg =
    source.source.productWeightLbs != null && source.source.productWeightLbs > 0
      ? (source.source.productWeightLbs * 0.45359237).toFixed(3)
      : null;
  const list = (values: Array<string | null | undefined>) =>
    `<ul>${values
      .filter(Boolean)
      .map((v) => `<li>${escapeHtml(v!)}</li>`)
      .join("")}</ul>`;
  const specsUa = list([
    `Артикул: ${source.sku}`,
    materialUa ? `Матеріал: ${materialUa}` : null,
    dimensions ? `Габарити упаковки: ${dimensions} см` : null,
    shippingKg ? `Вага відправлення: ${shippingKg} кг` : null,
    productKg ? `Вага деталі: ${productKg} кг` : null,
  ]);
  const specsEn = list([
    `SKU: ${source.sku}`,
    material ? `Material: ${material}` : null,
    dimensions ? `Package dimensions: ${dimensions} cm` : null,
    shippingKg ? `Shipping weight: ${shippingKg} kg` : null,
    productKg ? `Product weight: ${productKg} kg` : null,
  ]);
  const shortDescUa = titles
    ? `${titles.partUa} Revozport для ${titles.fitment}. ${materialUa ? `Матеріал: ${materialUa}.` : ""}`.trim()
    : null;
  const shortDescEn = en ? `${en}. ${material ? `Material: ${material}.` : ""}`.trim() : null;
  const calculatedShippingUsd = shippingKg
    ? Math.round(Number(shippingKg) * REVOZPORT_SHIPPING_RATE_USD_PER_KG * 100) / 100
    : null;
  const longDescUa = ua
    ? `<p>${escapeHtml(shortDescUa!)}</p><h3>Сумісність</h3><p>${escapeHtml(titles!.fitment)}. Перед замовленням звірте кузов, рік випуску та комплектацію автомобіля.</p><h3>Характеристики</h3>${specsUa}<h3>Доставка</h3><p>Вартість доставки та умови поставки уточнюються для країни отримання.</p>`
    : null;
  const longDescEn = en
    ? `<p>${escapeHtml(shortDescEn!)}</p><h3>Compatibility</h3><p>${escapeHtml(titles!.fitment)}. Confirm the body style, model year and trim before ordering.</p><h3>Specifications</h3>${specsEn}<h3>Delivery</h3><p>Shipping costs and delivery terms are confirmed for the destination country.</p>`
    : null;
  return {
    official,
    data: {
      ...(titles
        ? {
            titleUa: ua!,
            titleEn: en!,
            shortDescUa: shortDescUa!,
            shortDescEn: shortDescEn!,
            longDescUa: longDescUa!,
            longDescEn: longDescEn!,
            bodyHtmlUa: longDescUa!,
            bodyHtmlEn: longDescEn!,
            seoTitleUa: `${ua} | Revozport — One Company`,
            seoTitleEn: `${en} | Revozport — One Company`,
            seoDescriptionUa: shortDescUa!.slice(0, 160),
            seoDescriptionEn: shortDescEn!.slice(0, 160),
          }
        : {}),
      ...(image ? { image, gallery } : {}),
    },
    regionalDraft: {
      sku: source.sku,
      ukraine: {
        source: "workbook MSRP + $25/kg shipping rule",
        baseUsd: source.priceUsd,
        shippingWeightKg: shippingKg ? Number(shippingKg) : null,
        shippingWeightEstimated,
        shippingWeightSource,
        shippingUsd: calculatedShippingUsd,
        quoteOrigin: null,
        quoteDestination: null,
        status: "Arithmetic estimate only; customs and taxes are separate",
        deliveredUsd:
          source.priceUsd != null && source.priceUsd > 0 && calculatedShippingUsd != null
            ? Math.round((source.priceUsd + calculatedShippingUsd) * 100) / 100
            : null,
      },
      europe: {
        source: "official exact SKU",
        baseUsd: official ? Number(official.variant.price) : null,
        shipping: "separate",
        taxStatus: "pending seller details",
      },
      america: {
        source: "official exact SKU",
        baseUsd: official ? Number(official.variant.price) : null,
        shipping: "separate",
        taxStatus: "pending seller details",
      },
      officialUrl: official ? `https://revozport.com/products/${official.product.handle}` : null,
      applied: false,
      finalPricingReady: false,
    },
  };
}
