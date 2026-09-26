import { randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import wheelOnlySetCatalog from "@/data/wheelforce/wheel-only-sets.json";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { buildAdminProductCreateData, type AdminShopProductPayload } from "@/lib/shopAdminCatalog";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductCreationWithClient,
  coordinateShopCatalogProductMutationWithClient,
} from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { revalidateShopStorefrontProducts } from "@/lib/shopStorefrontRevalidation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY_RATES, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { calculateWheelForcePrices, roundWheelForceCents } from "@/lib/wheelforcePricing";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
} from "@/lib/shopFitmentQuality";
import {
  normalizeSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  SUPPLIER_FITMENT_KEY,
  SUPPLIER_FITMENT_NAMESPACE,
} from "@/lib/shopImportFitment";

type WheelSpec = {
  sku: string;
  title: string;
  sizeSpec: string;
  quantity: number;
  unitSourcePriceEurGross: number;
  shippingWeightKg?: number | null;
  articleWeightKg?: number | null;
  imageUrls: string[];
};

type WheelSetAccessory = {
  sku: string;
  title: string;
  sourcePriceEurGross: number;
  quantity: number;
  imageUrl?: string | null;
};

type WheelSetRecord = {
  sku: string;
  slug: string;
  sourcePriceEurGross: number;
  availability: string;
  manufacturerSetTitle: string;
  manufacturerSetUrl: string;
  sourcePackages: Array<{ sku: string; url: string; title: string; vehicleLabel: string; availability: string }>;
  vehicleLabels: string[];
  front: WheelSpec;
  rear: WheelSpec;
  fitments: Array<{
    make: string;
    model: string;
    engine: string | null;
    power: string | null;
    yearText: string | null;
    yearFrom: number | null;
    yearTo: number | null;
  }>;
  accessoryOptions: WheelSetAccessory[];
};

const source = wheelOnlySetCatalog as unknown as {
  schemaVersion: number;
  generatedAt: string;
  manufacturerSetPagesFound: number;
  parsedManufacturerSetPages: number;
  extraComponentPagesFound: number;
  uniqueWheelOnlySets: number;
  soldOutSourcePackageCount: number;
  uniqueSetsUnavailableOrUnconfirmed: number;
  excludedPageCount: number;
  sets: WheelSetRecord[];
};

const WHEEL_SET_TAG = "wheelforce-wheelset";
const RAW_WHEEL_TAG = "wheels";
const BATCH_LIMIT = 10;
const CREATE_DOMAINS = ["CONTENT", "SEO", "MEDIA", "PRICE", "INVENTORY", "TAXONOMY", "FITMENT", "VISIBILITY"] as const;
const accessorySourceBySku = new Map<string, WheelSetAccessory>(
  source.sets.flatMap((set) => set.accessoryOptions).map((option) => [option.sku.toUpperCase(), option])
);

function pricesForManufacturerGross(sourceGrossEur: number, currencyRates: { EUR: number; USD: number; UAH: number }) {
  const { ukraine, europe } = calculateWheelForcePrices(sourceGrossEur, currencyRates);
  return {
    priceEur: ukraine.eur,
    priceUsd: ukraine.usd,
    priceUah: ukraine.uah,
    priceEurEurope: europe.eur,
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function safeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugPart(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugForSku(sku: string) {
  return `wheelforce-${sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function vehicleLabelUa(value: string) {
  return value
    .replace(/\bAUDI\b/gi, "Audi")
    .replace(/\bBMW\b/gi, "BMW")
    .replace(/\bMB\b/gi, "Mercedes-Benz")
    .replace(/\bMERCEDES[- ]BENZ\b/gi, "Mercedes-Benz")
    .replace(/\bTOYOTA\b/gi, "Toyota")
    .replace(/\bPORSCHE\b/gi, "Porsche")
    .replace(/\bVOLKSWAGEN\b/gi, "Volkswagen")
    .replace(/\bVW\b/gi, "Volkswagen");
}

function wheelModelAndFinish(component: WheelSpec) {
  const parts = component.title.split("|").map(safeText);
  return {
    model: (parts[0] ?? component.title).replace(/^WF\s*/i, "").trim(),
    finish: parts.slice(2).join(" | ").trim(),
  };
}

function fitmentContractForSet(set: WheelSetRecord) {
  const applicationMap = new Map<string, Record<string, unknown>>();
  for (const row of set.fitments) {
    const make = safeText(row.make);
    const model = safeText(row.model);
    if (!make || !model) continue;
    const engine = [safeText(row.engine), safeText(row.power)].filter(Boolean).join(" · ") || null;
    const chassis = [model, safeText(row.engine)].join(" ").match(/\b(?:[GFEW]\d{2,3}[A-Z0-9]?|[A-Z]\d{2})\b/i)?.[0] ?? null;
    const application = {
      vehicleType: "car",
      make,
      model,
      chassisCode: chassis,
      yearFrom: row.yearFrom,
      yearTo: row.yearTo,
      engine,
      fuel: null,
      bodyStyle: null,
      drivetrain: null,
      transmission: null,
      market: null,
      opfGpf: "unknown",
    };
    applicationMap.set(JSON.stringify(application).toLowerCase(), application);
  }
  const applications = [...applicationMap.values()];
  if (!applications.length) throw new Error(`Wheel set ${set.sku} has no valid manufacturer vehicle applications`);
  const normalized = normalizeSupplierFitmentContract({
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications,
    parentSku: null,
    source: {
      supplier: "WheelForce GmbH",
      sourceRef: set.manufacturerSetUrl,
      sourceUpdatedAt: source.generatedAt,
    },
    note: "Manufacturer vehicle fitment from a complete-wheel set; only its front and rear wheel pairs are offered.",
  });
  if (!normalized.data) {
    throw new Error(`Invalid WheelForce fitment for ${set.sku}: ${JSON.stringify(normalized.errors.slice(0, 3))}`);
  }
  return {
    contract: normalized.data,
    normalizedFitment: supplierContractToNormalizedFitment(normalized.data),
  };
}

const ACCESSORY_TITLES: Record<string, { en: string; ua: string }> = {
    WF14042: { en: "WheelForce Valve Cap Set — Black", ua: "Комплект ковпачків вентилів WheelForce — чорний" },
    WF14581: { en: "WheelForce Valve Cap Set — Silver", ua: "Комплект ковпачків вентилів WheelForce — сріблястий" },
    WF14047: { en: "WheelForce Luxury Forged Center Cap — Gloss Steel", ua: "Центральний ковпачок WheelForce Luxury Forged — Gloss Steel" },
    WF14048: { en: "WheelForce Luxury Forged Center Cap — Frozen Silver", ua: "Центральний ковпачок WheelForce Luxury Forged — Frozen Silver" },
    WF14046: { en: "WheelForce Luxury Forged Center Cap — Satin Bronze", ua: "Центральний ковпачок WheelForce Luxury Forged — Satin Bronze" },
    WF14049: { en: "WheelForce Luxury Forged Center Cap — Deep Black + Red", ua: "Центральний ковпачок WheelForce Luxury Forged — Deep Black + Red" },
    WF14050: { en: "WheelForce Luxury Forged Center Cap — Deep Black", ua: "Центральний ковпачок WheelForce Luxury Forged — Deep Black" },
    WF14055: { en: "WheelForce Multi-piece Forged V2 Center Cap — Deep Black", ua: "Центральний ковпачок WheelForce Multi-piece Forged V2 — Deep Black" },
    WF14053: { en: "WheelForce Multi-piece Forged V2 Center Cap — Gloss Steel", ua: "Центральний ковпачок WheelForce Multi-piece Forged V2 — Gloss Steel" },
    WF14054: { en: "WheelForce Multi-piece Forged V2 Center Cap — Frozen Silver", ua: "Центральний ковпачок WheelForce Multi-piece Forged V2 — Frozen Silver" },
    WF14611: { en: "WheelForce Multi-piece Forged V3 Center Cap — Deep Black", ua: "Центральний ковпачок WheelForce Multi-piece Forged V3 — Deep Black" },
    WF14613: { en: "WheelForce Multi-piece Forged V3 Center Cap — Gloss Steel", ua: "Центральний ковпачок WheelForce Multi-piece Forged V3 — Gloss Steel" },
    WF14614: { en: "WheelForce Multi-piece Forged V3 Center Cap — Frozen Silver", ua: "Центральний ковпачок WheelForce Multi-piece Forged V3 — Frozen Silver" },
    WF14615: { en: "WheelForce Multi-piece Forged V3 Center Cap — Light Gold", ua: "Центральний ковпачок WheelForce Multi-piece Forged V3 — Light Gold" },
    WF14616: { en: "WheelForce Multi-piece Forged V3 Center Cap — Satin Bronze", ua: "Центральний ковпачок WheelForce Multi-piece Forged V3 — Satin Bronze" },
    WF14051: { en: "WheelForce Center Cap — Deep Black + Red", ua: "Центральний ковпачок WheelForce — Deep Black + Red" },
    WF14312: { en: "WheelForce Center Cap — Deep Black", ua: "Центральний ковпачок WheelForce — Deep Black" },
    WF14313: { en: "WheelForce Center Cap — Gloss Steel", ua: "Центральний ковпачок WheelForce — Gloss Steel" },
    WF14314: { en: "WheelForce Center Cap — Frozen Silver", ua: "Центральний ковпачок WheelForce — Frozen Silver" },
    WF14315: { en: "WheelForce Center Cap — Satin Bronze", ua: "Центральний ковпачок WheelForce — Satin Bronze" },
    WF14065: { en: "WheelForce Orange Electric TPMS Sensor — Silver", ua: "Датчик тиску WheelForce Orange Electric TPMS — сріблястий" },
    WF14066: { en: "WheelForce Orange Electric TPMS Sensor — Black", ua: "Датчик тиску WheelForce Orange Electric TPMS — чорний" },
    WF14464: { en: "WheelForce Orange Electric TPMS Sensor — Grey", ua: "Датчик тиску WheelForce Orange Electric TPMS — сірий" },
    WF14075: { en: "WheelForce Wheel Bolts M14×1.5 60° — Black, set of 5", ua: "Колісні болти WheelForce M14×1,5 60° — чорні, комплект 5 шт." },
    WF14077: { en: "WheelForce Wheel Bolts M14×1.25 60° — Black, set of 5", ua: "Колісні болти WheelForce M14×1,25 60° — чорні, комплект 5 шт." },
    WF14574: { en: "WheelForce Wheel Bolts M14×1.25 60° — Silver, set of 5", ua: "Колісні болти WheelForce M14×1,25 60° — сріблясті, комплект 5 шт." },
    WF14604: { en: "WheelForce Wheel Bolts M14×1.5 60° — Silver, set of 5", ua: "Колісні болти WheelForce M14×1,5 60° — сріблясті, комплект 5 шт." },
    WF14726: { en: "WheelForce Flex Star GR5 Titanium Wheel Bolts", ua: "Титанові колісні болти WheelForce Flex Star GR5" },
    WF14806: { en: "WheelForce Care Pro Kit", ua: "Набір догляду WheelForce Care Pro" },
    WF14808: { en: "WheelForce Care Cleaner Kit", ua: "Набір для очищення WheelForce Care" },
    WF14772: { en: "WheelForce Care Reclean Wheel Cleaner, 1000 ml", ua: "Очищувач дисків WheelForce Care Reclean, 1000 мл" },
    WF14780: { en: "WheelForce Care Reshine Gel, 500 ml", ua: "Гель для догляду за дисками WheelForce Care Reshine, 500 мл" },
    WF14781: { en: "WheelForce Care Refinish Detailer Spray, 500 ml", ua: "Детейлінг-спрей WheelForce Care Refinish, 500 мл" },
    WF14582: { en: "WheelForce Grille Set for BMW M G8X", ua: "Комплект решіток WheelForce для BMW M G8X" },
    WF14583: { en: "WheelForce Stainless Steel Bottle, 550 ml", ua: "Термопляшка WheelForce з нержавної сталі, 550 мл" },
    WF14584: { en: "WheelForce Magnetic Power Bank, 5000 mAh", ua: "Магнітний павербанк WheelForce, 5000 мА·год" },
    WF14043: { en: "WheelForce Leather Key Fob", ua: "Шкіряний брелок WheelForce" },
    WF10000: { en: "WheelForce Hub Rings, 73.1–70.1 mm", ua: "Центрувальні кільця WheelForce, 73,1–70,1 мм" },
    WF14301: { en: "WheelForce Hub Rings, 73.1–67.1 mm", ua: "Центрувальні кільця WheelForce, 73,1–67,1 мм" },
    WF14072: { en: "WheelForce Hub Rings, 66.6–57.1 mm", ua: "Центрувальні кільця WheelForce, 66,6–57,1 мм" },
};

function accessoryTitle(sku: string, sourceTitle: string) {
  if (ACCESSORY_TITLES[sku]) return ACCESSORY_TITLES[sku];
  const plain = sourceTitle.replace(/^\s*\d+\s*x\s*/i, "").trim();
  return {
    en: `WheelForce ${plain.replace(/^WF\s*/i, "")}`,
    ua: `Аксесуар WheelForce ${sku}`,
  };
}

function accessoryCopy(sku: string, title: { ua: string; en: string }) {
  const isSensor = ["WF14065", "WF14066", "WF14464"].includes(sku);
  const isBolt = ["WF14075", "WF14077", "WF14574", "WF14604"].includes(sku);
  const isCap = title.en.includes("Center Cap");
  const detailUa = isSensor
    ? "Датчик контролю тиску в шинах для сумісного автомобіля. Перед замовленням звірте систему TPMS."
    : isBolt
      ? "Комплект із п’яти колісних болтів. Перед монтажем звірте різьбу та тип посадки."
      : sku === "WF14726"
        ? "Титанові колісні болти серії Flex Star GR5. Перед монтажем звірте різьбу та тип посадки."
      : isCap
        ? "Центральний ковпачок для сумісних дисків WheelForce. Перед замовленням звірте посадковий розмір."
        : sku === "WF14042" || sku === "WF14581"
          ? "Комплект ковпачків для вентилів коліс WheelForce."
          : ["WF10000", "WF14301", "WF14072"].includes(sku)
            ? "Центрувальні кільця для сумісних дисків і маточин. Перед замовленням звірте обидва діаметри."
            : sku === "WF14582"
              ? "Комплект решіток для BMW M G8X."
              : sku === "WF14583"
                ? "Термопляшка з нержавної сталі об’ємом 550 мл."
                : sku === "WF14584"
                  ? "Магнітний павербанк ємністю 5000 мА·год."
                  : sku === "WF14043"
                    ? "Шкіряний брелок для ключів."
                    : "Засіб або набір для очищення та догляду за дисками WheelForce.";
  const detailEn = isSensor
    ? "A tyre pressure sensor for a compatible vehicle. Check the vehicle's TPMS system before ordering."
    : isBolt
      ? "A set of five wheel bolts. Check the thread and seat type before fitting."
      : sku === "WF14726"
        ? "Flex Star GR5 titanium wheel bolts. Check the thread and seat type before fitting."
      : isCap
        ? "A centre cap for compatible WheelForce wheels. Check the fitting size before ordering."
        : sku === "WF14042" || sku === "WF14581"
          ? "A set of valve caps for WheelForce wheels."
          : ["WF10000", "WF14301", "WF14072"].includes(sku)
            ? "Hub rings for compatible wheels and hubs. Check both diameters before ordering."
            : sku === "WF14582"
              ? "A grille set for the BMW M G8X."
              : sku === "WF14583"
                ? "A 550 ml stainless steel bottle."
                : sku === "WF14584"
                  ? "A magnetic power bank with 5000 mAh capacity."
                  : sku === "WF14043"
                    ? "A leather key fob."
                    : "A product for cleaning and caring for WheelForce wheels.";
  return {
    shortUa: `${title.ua}. ${detailUa}`,
    shortEn: `${title.en}. ${detailEn}`,
    longUa: `<p>${escapeHtml(title.ua)}. ${escapeHtml(detailUa)}</p>`,
    longEn: `<p>${escapeHtml(title.en)}. ${escapeHtml(detailEn)}</p>`,
  };
}

function accessoryPayload(set: WheelSetRecord, rates: { EUR: number; USD: number; UAH: number }) {
  return set.accessoryOptions.map((option) => {
    const { ukraine, europe } = calculateWheelForcePrices(option.sourcePriceEurGross, rates);
    const titles = accessoryTitle(option.sku, option.title);
    return {
      sku: option.sku,
      slug: slugForSku(option.sku),
      titleUa: titles.ua,
      titleEn: titles.en,
      imageUrl: option.imageUrl,
      price: ukraine,
      europePrice: europe,
      quantity: option.quantity,
    };
  });
}

function localizedVehicleModel(value: string, locale: "ua" | "en") {
  if (locale === "en") return value.replace(/\bKlasse\b/gi, "Class");
  return vehicleLabelUa(value).replace(/\bKlasse\b/gi, "клас");
}

function fitmentPreview(set: WheelSetRecord) {
  const unique = new Map<string, WheelSetRecord["fitments"][number]>();
  for (const row of set.fitments) {
    const key = `${row.make}|${row.model}|${row.engine}|${row.yearFrom}|${row.yearTo}`.toLowerCase();
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}

function tagsForSet(set: WheelSetRecord) {
  const tags = new Set(["WheelForce", "wheel-set", "wheel-only-set", "wheelforce-wheelset"]);
  const tagKey = (value: string) => value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, "-");
  for (const row of set.fitments) {
    const make = safeText(row.make);
    const model = safeText(row.model);
    if (!make || !model) continue;
    const makeKey = tagKey(make);
    const modelKey = tagKey(model);
    tags.add(`fits-make:${makeKey}`);
    tags.add(`fits-model:${makeKey}:${modelKey}`);
    tags.add(`fits:${makeKey}-${modelKey}`);
  }
  return [...tags];
}

function payloadForSet(
  set: WheelSetRecord,
  currencyRates: { EUR: number; USD: number; UAH: number },
  published: boolean,
  sourceGeneratedAt: string
): AdminShopProductPayload {
  const sourceGrossEur = Number(set.sourcePriceEurGross);
  if (!Number.isFinite(sourceGrossEur) || sourceGrossEur <= 0) throw new Error(`Invalid source wheel-only price for ${set.sku}`);
  const { ukraine: localPrice, europe: europePrice } = calculateWheelForcePrices(sourceGrossEur, currencyRates);
  const front = wheelModelAndFinish(set.front);
  const rear = wheelModelAndFinish(set.rear);
  const model = front.model === rear.model ? front.model : `${front.model} / ${rear.model}`;
  const finish = front.finish === rear.finish ? front.finish : `${front.finish} / ${rear.finish}`;
  const vehicleLabel = set.vehicleLabels?.[0] || `${set.fitments[0]?.make ?? ""} ${set.fitments[0]?.model ?? ""}`.trim();
  const frontDiameter = set.front.sizeSpec.match(/^\d+(?:[.,]\d+)?/)?.[0] ?? "";
  const rearDiameter = set.rear.sizeSpec.match(/^\d+(?:[.,]\d+)?/)?.[0] ?? "";
  const sizeLabel = frontDiameter === rearDiameter ? `${frontDiameter}″` : `${frontDiameter}″/${rearDiameter}″`;
  const titleEn = `WheelForce ${model} ${finish} ${sizeLabel} wheel set for ${vehicleLabel}`;
  const titleUa = `Комплект дисків WheelForce ${model} ${finish} ${sizeLabel} для ${localizedVehicleModel(vehicleLabel, "ua")}`;
  const frontSpecEn = `${set.front.quantity} × ${set.front.sizeSpec}`;
  const rearSpecEn = `${set.rear.quantity} × ${set.rear.sizeSpec}`;
  const frontSpecUa = `${set.front.quantity} × ${set.front.sizeSpec}`;
  const rearSpecUa = `${set.rear.quantity} × ${set.rear.sizeSpec}`;
  const htmlList = (locale: "ua" | "en") => fitmentPreview(set).slice(0, 12).map((row) => {
    const vehicle = `${row.make} ${localizedVehicleModel(row.model, locale)}`.trim();
    const years = row.yearFrom
      ? row.yearTo ? ` (${row.yearFrom}–${row.yearTo})` : locale === "ua" ? ` (з ${row.yearFrom} року)` : ` (since ${row.yearFrom})`
      : "";
    const power = locale === "ua"
      ? safeText(row.power).replace(/\bKW\b/gi, "кВт").replace(/\bPS\b/gi, "к. с.")
      : safeText(row.power);
    const engine = [safeText(row.engine), power].filter(Boolean).join(" · ");
    return `<li>${escapeHtml(`${vehicle}${years}${engine ? ` — ${engine}` : ""}`)}</li>`;
  }).join("");
  const fitmentEn = `<h3>Compatible vehicles</h3><ul>${htmlList("en")}</ul>${set.fitments.length > 12 ? `<p>Compatibility data covers ${set.fitments.length} vehicle, engine and model-year configurations. Select your exact version before ordering.</p>` : ""}`;
  const fitmentUa = `<h3>Для яких автомобілів підходить</h3><ul>${htmlList("ua")}</ul>${set.fitments.length > 12 ? `<p>У переліку — ${set.fitments.length} конфігурацій автомобілів, двигунів і років випуску. Перед замовленням звірте точну версію авто.</p>` : ""}`;
  const descriptionEn = `<p>The WheelForce ${escapeHtml(model)} set in ${escapeHtml(finish)} gives the ${escapeHtml(vehicleLabel)} a precise front and rear wheel setup. It includes four rims: ${escapeHtml(frontSpecEn)} for the front axle and ${escapeHtml(rearSpecEn)} for the rear. The price covers the wheels only; tyres and installation are excluded.</p><h3>Front wheels</h3><p>${escapeHtml(frontSpecEn)} · Wheel SKU ${escapeHtml(set.front.sku)}</p><h3>Rear wheels</h3><p>${escapeHtml(rearSpecEn)} · Wheel SKU ${escapeHtml(set.rear.sku)}</p>${fitmentEn}`;
  const descriptionUa = `<p>WheelForce ${escapeHtml(model)} у виконанні ${escapeHtml(finish)} — комплект дисків для ${escapeHtml(localizedVehicleModel(vehicleLabel, "ua"))} з окремими параметрами для передньої та задньої осей. До комплекту входять чотири диски: ${escapeHtml(frontSpecUa)} спереду та ${escapeHtml(rearSpecUa)} ззаду. Ціна вказана за диски без шин і монтажу.</p><h3>Передні диски</h3><p>${escapeHtml(frontSpecUa)} · артикул ${escapeHtml(set.front.sku)}</p><h3>Задні диски</h3><p>${escapeHtml(rearSpecUa)} · артикул ${escapeHtml(set.rear.sku)}</p>${fitmentUa}`;
  const images = [...new Set([
    set.front.imageUrls?.[0],
    set.rear.imageUrls?.[0],
    ...(set.front.imageUrls?.slice(1, 3) ?? []),
    ...(set.rear.imageUrls?.slice(1, 3) ?? []),
  ].filter((url): url is string => Boolean(url && /^https:\/\/wheelforce\.de\//i.test(url))))];
  const options = accessoryPayload(set, currencyRates);
  const fitment = fitmentContractForSet(set);
  const weight = 2 * Number(set.front.shippingWeightKg ?? set.front.articleWeightKg ?? 0) +
    2 * Number(set.rear.shippingWeightKg ?? set.rear.articleWeightKg ?? 0);
  const setComponents = {
    front: { sku: set.front.sku, title: set.front.title, sizeSpec: set.front.sizeSpec, quantity: 2 },
    rear: { sku: set.rear.sku, title: set.rear.title, sizeSpec: set.rear.sizeSpec, quantity: 2 },
    vehicleLabels: set.vehicleLabels,
  };
  const metadata = [
    { namespace: "wheelforce_import", key: "wheel_set_components", value: JSON.stringify(setComponents), valueType: "json" },
    { namespace: "wheelforce_import", key: "source_set_packages", value: JSON.stringify(set.sourcePackages), valueType: "json" },
    { namespace: "wheelforce_import", key: "source_price_eur_gross", value: sourceGrossEur.toFixed(2), valueType: "number_decimal" },
    { namespace: "wheelforce_import", key: "price_formula", value: "Ukraine: sum of four manufacturer wheel prices × 1.10. Europe: sum of four VAT-inclusive source wheel prices ÷ 1.19 as the net price base; checkout adds destination VAT.", valueType: "multi_line_text_field" },
    { namespace: "wheelforce_import", key: "official_url", value: set.manufacturerSetUrl, valueType: "url" },
    { namespace: "wheelforce_import", key: "source_generated_at", value: sourceGeneratedAt, valueType: "date_time" },
    { namespace: "wheelforce_import", key: "accessory_options", value: JSON.stringify(options), valueType: "json" },
    { namespace: SUPPLIER_FITMENT_NAMESPACE, key: SUPPLIER_FITMENT_KEY, value: JSON.stringify(fitment.contract), valueType: "json" },
    { namespace: NORMALIZED_FITMENT_NAMESPACE, key: NORMALIZED_FITMENT_KEY, value: JSON.stringify(fitment.normalizedFitment), valueType: "json" },
  ];
  const seoUa = `Диски WheelForce ${model} ${finish} для ${localizedVehicleModel(vehicleLabel, "ua")}: передні ${frontSpecUa}, задні ${rearSpecUa}. Комплект із 4 дисків без шин.`;
  const seoEn = `WheelForce ${model} ${finish} for ${vehicleLabel}: ${frontSpecEn} front, ${rearSpecEn} rear. Four-wheel set without tyres.`;
  return {
    slug: set.slug,
    sku: set.sku,
    scope: "auto",
    storefront: "main",
    brand: "WheelForce",
    vendor: "WheelForce",
    productType: "Wheel Sets",
    productCategory: "Wheel Sets",
    categoryId: null,
    tags: tagsForSet(set),
    collectionIds: [],
    status: published ? "ACTIVE" : "DRAFT",
    titleUa,
    titleEn,
    categoryUa: "Комплекти дисків",
    categoryEn: "Wheel Sets",
    shortDescUa: `Комплект WheelForce ${model} ${finish} для ${localizedVehicleModel(vehicleLabel, "ua")}: ${frontSpecUa} спереду та ${rearSpecUa} ззаду. Чотири диски без шин.`,
    shortDescEn: `WheelForce ${model} ${finish} for ${vehicleLabel}: ${frontSpecEn} at the front and ${rearSpecEn} at the rear. Four rims, no tyres.`,
    longDescUa: descriptionUa,
    longDescEn: descriptionEn,
    bodyHtmlUa: descriptionUa,
    bodyHtmlEn: descriptionEn,
    leadTimeUa: "Під замовлення",
    leadTimeEn: "Made to order",
    stock: "preOrder",
    collectionUa: "Комплекти дисків",
    collectionEn: "Wheel Sets",
    priceEur: localPrice.eur,
    priceEurEurope: europePrice.eur,
    priceUsd: localPrice.usd,
    priceUah: localPrice.uah,
    priceEurB2b: null,
    priceUsdB2b: null,
    priceUahB2b: null,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    compareAtEurB2b: null,
    compareAtUsdB2b: null,
    compareAtUahB2b: null,
    weight: weight > 0 ? Math.round(weight * 100) / 100 : null,
    image: images[0] ?? null,
    seoTitleUa: titleUa,
    seoTitleEn: titleEn,
    seoDescriptionUa: seoUa.slice(0, 320),
    seoDescriptionEn: seoEn.slice(0, 320),
    isPublished: published,
    publishedAt: published ? new Date().toISOString() : null,
    gallery: images,
    highlights: {
      ua: ["Комплект із чотирьох дисків", `Передня вісь: ${frontSpecUa}`, `Задня вісь: ${rearSpecUa}`],
      en: ["Four-wheel set", `Front axle: ${frontSpecEn}`, `Rear axle: ${rearSpecEn}`],
    },
    media: images.map((src, index) => ({ src, altText: `${titleEn} — ${index === 0 ? "front fitment" : "rear fitment"}`, position: index + 1, mediaType: "IMAGE" })),
    options: [],
    variants: [{
      title: titleEn,
      sku: set.sku,
      position: 1,
      inventoryQty: 0,
      inventoryPolicy: "CONTINUE",
      fulfillmentService: "manual",
      priceEur: localPrice.eur,
      priceEurEurope: europePrice.eur,
      priceUsd: localPrice.usd,
      priceUah: localPrice.uah,
      priceEurB2b: null,
      priceUsdB2b: null,
      priceUahB2b: null,
      compareAtEur: null,
      compareAtUsd: null,
      compareAtUah: null,
      compareAtEurB2b: null,
      compareAtUsdB2b: null,
      compareAtUahB2b: null,
      weight: weight > 0 ? weight : null,
      requiresShipping: true,
      taxable: true,
      image: images[0] ?? null,
      isDefault: true,
    }],
    metafields: metadata,
  };
}

function safeBatchRange(body: Record<string, unknown>) {
  const offset = Number(body.offset ?? 0);
  const limit = Number(body.limit ?? BATCH_LIMIT);
  if (!Number.isInteger(offset) || offset < 0 || offset >= source.sets.length) {
    throw new TypeError("offset is outside the WheelForce set catalog");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > BATCH_LIMIT) {
    throw new TypeError(`limit must be between 1 and ${BATCH_LIMIT}`);
  }
  return { offset, limit, batch: source.sets.slice(offset, offset + limit) };
}

async function currencyRates() {
  const settingsRecord = await prisma.shopSettings.findFirst();
  return settingsRecord ? getShopSettingsRuntime(settingsRecord).currencyRates : DEFAULT_CURRENCY_RATES;
}

async function wheelSetCategoryId() {
  const category = await prisma.shopCategory.upsert({
    where: { slug: "wheel-sets" },
    create: { slug: "wheel-sets", titleUa: "Комплекти дисків", titleEn: "Wheel Sets", isPublished: true },
    update: {},
    select: { id: true },
  });
  return category.id;
}

async function wheelAccessoryCategoryId() {
  const category = await prisma.shopCategory.upsert({
    where: { slug: "wheelforce-accessories" },
    create: { slug: "wheelforce-accessories", titleUa: "Аксесуари WheelForce", titleEn: "WheelForce Accessories", isPublished: true },
    update: {},
    select: { id: true },
  });
  return category.id;
}

async function missingAccessorySlugs() {
  const slugs = [...new Set(source.sets.flatMap((set) => set.accessoryOptions.map((option) => slugForSku(option.sku))))];
  const found = await prisma.shopProduct.findMany({
    where: { slug: { in: slugs }, brand: { equals: "WheelForce", mode: "insensitive" } },
    select: { slug: true },
  });
  const foundSet = new Set(found.map((product) => product.slug));
  return slugs.filter((slug) => !foundSet.has(slug));
}

async function scheduleOutbox(limit: number) {
  after(async () => {
    try {
      await runShopCatalogOutboxRuntime({
        workerId: `wheelforce-wheelset-import:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
        limit: Math.min(50, Math.max(10, limit)),
      });
    } catch (error) {
      console.error("[wheelforce-wheelset-import] outbox processing deferred to cron", error);
    }
  });
}

function revalidateWheelForceProducts(slugs: readonly string[]) {
  try {
    revalidateShopStorefrontProducts(slugs.map((slug) => ({ slug, brand: "WheelForce" })));
  } catch (error) {
    // The database mutation has committed; normal ISR remains as a fallback.
    console.error("[wheelforce] storefront revalidation failed", error);
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const [legacyWheels, setProducts, priceProducts, brandProducts, missingAccessories] = await Promise.all([
      prisma.shopProduct.findMany({
        where: {
          brand: { equals: "WheelForce", mode: "insensitive" },
          status: "ACTIVE",
          isPublished: true,
          tags: { has: RAW_WHEEL_TAG },
        },
        orderBy: { sku: "asc" },
        select: { id: true, sku: true, slug: true, titleUa: true, catalogVersion: true },
      }),
      prisma.shopProduct.findMany({
        where: { brand: { equals: "WheelForce", mode: "insensitive" }, tags: { has: WHEEL_SET_TAG } },
        select: { slug: true, status: true, isPublished: true },
      }),
      prisma.shopProduct.findMany({
        where: {
          brand: { equals: "WheelForce", mode: "insensitive" },
          tags: { has: WHEEL_SET_TAG },
          status: "ACTIVE",
          isPublished: true,
        },
        orderBy: { titleUa: "asc" },
        select: {
          id: true,
          slug: true,
          sku: true,
          titleUa: true,
          priceEur: true,
          priceUah: true,
          priceEurEurope: true,
          metafields: {
            where: { namespace: "wheelforce_import", key: { in: ["source_price_eur_gross", "source_price_eur_gross_override"] } },
            select: { key: true, value: true },
          },
        },
      }),
      prisma.shopProduct.findMany({
        where: { brand: { equals: "WheelForce", mode: "insensitive" }, status: "ACTIVE", isPublished: true },
        select: { id: true, tags: true },
      }),
      missingAccessorySlugs(),
    ]);
    const activeSetCount = setProducts.filter((product) => product.status === "ACTIVE" && product.isPublished).length;
    const stagedSetCount = setProducts.filter((product) => product.status === "DRAFT" && !product.isPublished).length;
    const accessoryProductCount = brandProducts.filter((product) =>
      !product.tags.includes(WHEEL_SET_TAG) && !product.tags.includes(RAW_WHEEL_TAG)
    ).length;
    return NextResponse.json({
      source: {
        listedManufacturerSets: source.manufacturerSetPagesFound,
        parsedManufacturerSets: source.parsedManufacturerSetPages,
        verifiedWheelComponentPages: source.extraComponentPagesFound,
        uniqueAvailableWheelOnlySets: source.uniqueWheelOnlySets,
        excludedManufacturerPages: source.excludedPageCount,
        soldOutManufacturerPackages: source.soldOutSourcePackageCount,
        uniqueSetsUnavailableOrUnconfirmed: source.uniqueSetsUnavailableOrUnconfirmed,
        fitmentRows: source.sets.reduce((sum, set) => sum + set.fitments.length, 0),
        generatedAt: source.generatedAt,
        sample: source.sets.slice(0, 3).map((set) => ({
          slug: set.slug,
          vehicle: set.vehicleLabels[0] ?? "",
          front: set.front.sizeSpec,
          rear: set.rear.sizeSpec,
          manufacturerGrossEur: set.sourcePriceEurGross,
          accessoryOptions: set.accessoryOptions.length,
        })),
      },
      legacyWheelProducts: legacyWheels.map((product) => ({
        ...product,
        catalogVersion: product.catalogVersion.toString(),
      })),
      stagedSetCount,
      activeSetCount,
      accessoryProductCount,
      priceRows: priceProducts.map((product) => {
        const values = new Map(product.metafields.map((field) => [field.key, field.value]));
        const sourceGross = Number(values.get("source_price_eur_gross_override") ?? values.get("source_price_eur_gross"));
        return {
          id: product.id,
          slug: product.slug,
          sku: product.sku ?? "",
          titleUa: product.titleUa,
          sourceGrossEur: Number.isFinite(sourceGross) ? sourceGross : null,
          ukrainePriceUah: Number(product.priceUah ?? 0),
          europeNetEur: Number(product.priceEurEurope ?? 0),
        };
      }),
      missingAccessorySlugs: missingAccessories,
      batchLimit: BATCH_LIMIT,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("WheelForce wheel-set import preview", error);
    return NextResponse.json({ error: "Failed to prepare the WheelForce wheel-set import" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "update_set_price") {
      const slug = safeText(body.slug);
      const sourceGrossEur = Number(body.sourceGrossEur);
      if (!slug || !Number.isFinite(sourceGrossEur) || sourceGrossEur <= 0 || sourceGrossEur > 1_000_000) {
        return NextResponse.json({ error: "Вкажіть коректну ціну комплекту в євро" }, { status: 400 });
      }
      const product = await prisma.shopProduct.findFirst({
        where: {
          slug,
          brand: { equals: "WheelForce", mode: "insensitive" },
          tags: { has: WHEEL_SET_TAG },
          status: "ACTIVE",
          isPublished: true,
        },
        select: { id: true, slug: true, sku: true, catalogVersion: true },
      });
      if (!product) return NextResponse.json({ error: "Опублікований комплект WheelForce не знайдено" }, { status: 404 });
      const rates = await currencyRates();
      const prices = pricesForManufacturerGross(sourceGrossEur, rates);
      const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: product.id,
        expectedCatalogVersion: product.catalogVersion.toString(),
        changeDomains: ["PRICE"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          await tx.shopProduct.update({ where: { id: product.id }, data: prices });
          await tx.shopProductVariant.updateMany({ where: { productId: product.id }, data: prices });
          await tx.shopProductMetafield.upsert({
            where: { productId_namespace_key: { productId: product.id, namespace: "wheelforce_import", key: "source_price_eur_gross_override" } },
            create: { productId: product.id, namespace: "wheelforce_import", key: "source_price_eur_gross_override", value: roundWheelForceCents(sourceGrossEur).toFixed(2), valueType: "number_decimal" },
            update: { value: roundWheelForceCents(sourceGrossEur).toFixed(2), valueType: "number_decimal" },
          });
          await tx.shopProductMetafield.upsert({
            where: { productId_namespace_key: { productId: product.id, namespace: "wheelforce_import", key: "source_price_eur_gross" } },
            create: { productId: product.id, namespace: "wheelforce_import", key: "source_price_eur_gross", value: roundWheelForceCents(sourceGrossEur).toFixed(2), valueType: "number_decimal" },
            update: { value: roundWheelForceCents(sourceGrossEur).toFixed(2), valueType: "number_decimal" },
          });
          await writeAdminAuditLog(tx, session, {
            scope: "shop",
            action: "wheelforce-wheelset.price.update",
            entityType: "shop.product",
            entityId: product.id,
            metadata: { slug: product.slug, sku: product.sku, sourceGrossEur: roundWheelForceCents(sourceGrossEur), ...prices, catalogVersion: nextCatalogVersion },
          });
          return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
            type: "ADMIN",
            id: session.email,
            reason: "wheelforce-wheelset-price-update",
          });
        },
      });
      scheduleOutbox(1);
      revalidateWheelForceProducts([product.slug]);
      return NextResponse.json({ action, slug: product.slug, sourceGrossEur: roundWheelForceCents(sourceGrossEur), ...prices, outboxId: mutation.outboxId });
    }

    if (action === "refresh_accessories") {
      const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
      const limit = Math.min(1, Math.max(1, Math.floor(Number(body.limit) || 1)));
      const allBrandProducts = await prisma.shopProduct.findMany({
        where: { brand: { equals: "WheelForce", mode: "insensitive" }, status: "ACTIVE", isPublished: true },
        orderBy: [{ sku: "asc" }, { id: "asc" }],
        select: { id: true, slug: true, sku: true, titleEn: true, tags: true, categoryId: true, catalogVersion: true },
      });
      const accessories = allBrandProducts.filter((product) =>
        !product.tags.includes(WHEEL_SET_TAG) && !product.tags.includes(RAW_WHEEL_TAG)
      );
      const batch = accessories.slice(offset, offset + limit);
      const rates = await currencyRates();
      const categoryId = await wheelAccessoryCategoryId();
      const outboxIds: string[] = [];
      for (const product of batch) {
        const sku = product.sku?.toUpperCase() ?? "";
        const option = accessorySourceBySku.get(sku);
        const title = ACCESSORY_TITLES[sku] ?? null;
        if (!title && product.categoryId) continue;
        const copy = title ? accessoryCopy(sku, title) : null;
        const prices = option ? pricesForManufacturerGross(option.sourcePriceEurGross, rates) : null;
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: product.id,
          expectedCatalogVersion: product.catalogVersion.toString(),
          changeDomains: option
            ? ["CONTENT", "SEO", "PRICE", "TAXONOMY"]
            : title ? ["CONTENT", "SEO", "TAXONOMY"] : ["TAXONOMY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({
              where: { id: product.id },
              data: {
                categoryId: product.categoryId ?? categoryId,
                ...(title && copy ? {
                  titleUa: title.ua,
                  titleEn: title.en,
                  shortDescUa: copy.shortUa,
                  shortDescEn: copy.shortEn,
                  longDescUa: copy.longUa,
                  longDescEn: copy.longEn,
                  bodyHtmlUa: copy.longUa,
                  bodyHtmlEn: copy.longEn,
                  seoTitleUa: title.ua,
                  seoTitleEn: title.en,
                  seoDescriptionUa: copy.shortUa,
                  seoDescriptionEn: copy.shortEn,
                } : {}),
                ...(prices ?? {}),
              },
            });
            if (title || prices) {
              await tx.shopProductVariant.updateMany({
                where: { productId: product.id },
                data: { ...(title ? { title: title.en } : {}), ...(prices ?? {}) },
              });
            }
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "wheelforce-accessory.refresh",
              entityType: "shop.product",
              entityId: product.id,
              metadata: { sku: product.sku, sourceGrossEur: option?.sourcePriceEurGross ?? null, catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "wheelforce-accessory-copy-price-category-refresh",
            });
          },
        });
        outboxIds.push(mutation.outboxId);
      }
      if (outboxIds.length) {
        if (body.deferOutbox !== true) {
          try {
            await runShopCatalogOutboxRuntime({
              workerId: `wheelforce-accessories:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
              limit: outboxIds.length,
              outboxIds,
            });
          } catch (error) {
            console.error("[wheelforce-accessories] outbox processing deferred to cron", error);
            scheduleOutbox(outboxIds.length);
          }
        }
        if (body.deferOutbox !== true) revalidateWheelForceProducts(batch.map((product) => product.slug));
      }
      return NextResponse.json({ action, offset, processed: batch.length, refreshed: outboxIds.length, total: accessories.length });
    }

    if (action === "finalize_refresh") {
      const products = await prisma.shopProduct.findMany({
        where: { brand: { equals: "WheelForce", mode: "insensitive" }, status: "ACTIVE", isPublished: true },
        select: { slug: true },
      });
      revalidateWheelForceProducts(products.map((product) => product.slug));
      return NextResponse.json({ action, revalidated: products.length });
    }

    if (action === "stage") {
      if (await missingAccessorySlugs().then((missing) => missing.length > 0)) {
        return NextResponse.json({ error: "One or more configured WheelForce accessories are missing from the catalog" }, { status: 409 });
      }
      const { offset, batch } = safeBatchRange(body);
      const rates = await currencyRates();
      const categoryId = await wheelSetCategoryId();
      let created = 0;
      let alreadyStaged = 0;
      const outboxIds: string[] = [];
      for (const set of batch) {
        const payload = { ...payloadForSet(set, rates, false, source.generatedAt), categoryId };
        const existing = await prisma.shopProduct.findUnique({
          where: { slug: payload.slug },
          select: { id: true, brand: true, tags: true, status: true, isPublished: true },
        });
        if (existing) {
          if (existing.brand?.trim().toLowerCase() !== "wheelforce" || !existing.tags.includes(WHEEL_SET_TAG)) {
            return NextResponse.json({ error: `Slug collision for WheelForce wheel set ${payload.slug}` }, { status: 409 });
          }
          alreadyStaged += 1;
          continue;
        }
        const createData = buildAdminProductCreateData(payload);
        const mutation = await coordinateShopCatalogProductCreationWithClient(prisma, {
          changeDomains: [...CREATE_DOMAINS],
          async create(tx) {
            return (await tx.shopProduct.create({ data: createData, select: { id: true } })).id;
          },
          async snapshot(tx, productId, initialCatalogVersion) {
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "wheelforce-wheelset.stage",
              entityType: "shop.product",
              entityId: productId,
              metadata: { slug: payload.slug, sku: payload.sku, published: false },
            });
            return buildShopCatalogAdminSnapshot(tx, productId, initialCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "wheelforce.vehicle-specific-wheel-only-set.stage",
            });
          },
        });
        outboxIds.push(mutation.outboxId);
        created += 1;
      }
      if (outboxIds.length) scheduleOutbox(outboxIds.length);
      return NextResponse.json({ action, offset, processed: batch.length, created, alreadyStaged, total: source.sets.length });
    }

    if (action === "archive_legacy_wheels") {
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((value) => String(value).trim()).filter(Boolean))] : [];
      if (ids.length > BATCH_LIMIT) return NextResponse.json({ error: `Archive batches are limited to ${BATCH_LIMIT} products` }, { status: 400 });
      const selected = await prisma.shopProduct.findMany({
        where: { id: { in: ids } },
        select: { id: true, sku: true, brand: true, tags: true, status: true, isPublished: true, catalogVersion: true },
      });
      if (selected.length !== ids.length || selected.some((product) =>
        product.brand?.trim().toLowerCase() !== "wheelforce" || !product.tags.includes(RAW_WHEEL_TAG)
      )) {
        return NextResponse.json({ error: "Archive list changed; reload the import preview before continuing" }, { status: 409 });
      }
      const outboxIds: string[] = [];
      for (const product of selected) {
        if (product.status === "ARCHIVED" && !product.isPublished) continue;
        if (product.status !== "ACTIVE" || !product.isPublished) {
          return NextResponse.json({ error: `Wheel product ${product.sku ?? product.id} is no longer active` }, { status: 409 });
        }
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: product.id,
          expectedCatalogVersion: product.catalogVersion.toString(),
          changeDomains: ["VISIBILITY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({ where: { id: product.id }, data: { status: "ARCHIVED", isPublished: false, publishedAt: null } });
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "wheelforce-wheelset.archive-individual-wheel",
              entityType: "shop.product",
              entityId: product.id,
              metadata: { sku: product.sku, catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "replace-single-wheel-listings-with-vehicle-specific-wheel-sets",
            });
          },
        });
        outboxIds.push(mutation.outboxId);
      }
      if (outboxIds.length) scheduleOutbox(outboxIds.length);
      return NextResponse.json({ action, archived: outboxIds.length, alreadyArchived: selected.length - outboxIds.length });
    }

    if (action === "refresh_copy") {
      const { offset, batch } = safeBatchRange(body);
      const rates = await currencyRates();
      const categoryId = await wheelSetCategoryId();
      const bySlug = new Map((await prisma.shopProduct.findMany({
        where: { slug: { in: batch.map((set) => set.slug) } },
        select: {
          id: true,
          slug: true,
          sku: true,
          brand: true,
          tags: true,
          status: true,
          isPublished: true,
          catalogVersion: true,
          categoryId: true,
          metafields: {
            where: { namespace: "wheelforce_import", key: "source_price_eur_gross_override" },
            select: { value: true },
          },
        },
      })).map((product) => [product.slug, product]));
      const outboxIds: string[] = [];
      for (const set of batch) {
        const product = bySlug.get(set.slug);
        if (!product || product.brand?.trim().toLowerCase() !== "wheelforce" || !product.tags.includes(WHEEL_SET_TAG)) {
          return NextResponse.json({ error: `Published WheelForce set is missing: ${set.slug}` }, { status: 409 });
        }
        if (product.status !== "ACTIVE" || !product.isPublished) {
          return NextResponse.json({ error: `WheelForce set ${set.slug} is not published` }, { status: 409 });
        }
        const payload = payloadForSet(set, rates, true, source.generatedAt);
        const accessoryOptions = payload.metafields.find((field) =>
          field.namespace === "wheelforce_import" && field.key === "accessory_options"
        );
        const priceOverride = Number(product.metafields[0]?.value);
        const priceFields = Number.isFinite(priceOverride) && priceOverride > 0
          ? pricesForManufacturerGross(priceOverride, rates)
          : {
              priceEur: payload.priceEur,
              priceEurEurope: payload.priceEurEurope,
              priceUsd: payload.priceUsd,
              priceUah: payload.priceUah,
            };
        const copy = {
          sku: payload.sku,
          ...priceFields,
          categoryId: product.categoryId ?? categoryId,
          titleUa: payload.titleUa,
          titleEn: payload.titleEn,
          shortDescUa: payload.shortDescUa,
          shortDescEn: payload.shortDescEn,
          longDescUa: payload.longDescUa,
          longDescEn: payload.longDescEn,
          bodyHtmlUa: payload.bodyHtmlUa,
          bodyHtmlEn: payload.bodyHtmlEn,
          seoTitleUa: payload.seoTitleUa,
          seoTitleEn: payload.seoTitleEn,
          seoDescriptionUa: payload.seoDescriptionUa,
          seoDescriptionEn: payload.seoDescriptionEn,
        };
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: product.id,
          expectedCatalogVersion: product.catalogVersion.toString(),
          changeDomains: ["CONTENT", "SEO", "INVENTORY", "PRICE", "TAXONOMY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({ where: { id: product.id }, data: copy });
            await tx.shopProductVariant.updateMany({
              where: { productId: product.id },
              data: {
                sku: payload.sku,
                title: payload.titleEn,
                ...priceFields,
              },
            });
            if (accessoryOptions) {
              await tx.shopProductMetafield.upsert({
                where: {
                  productId_namespace_key: {
                    productId: product.id,
                    namespace: "wheelforce_import",
                    key: "accessory_options",
                  },
                },
                create: {
                  productId: product.id,
                  namespace: "wheelforce_import",
                  key: "accessory_options",
                  value: accessoryOptions.value,
                  valueType: "json",
                },
                update: { value: accessoryOptions.value, valueType: "json" },
              });
            }
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "wheelforce-wheelset.copy-refresh",
              entityType: "shop.product",
              entityId: product.id,
              metadata: { slug: product.slug, sku: product.sku, catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "refresh-wheelset-product-and-seo-copy",
            });
          },
        });
        outboxIds.push(mutation.outboxId);
      }
      if (outboxIds.length) {
        if (body.deferOutbox !== true) {
          try {
            const result = await runShopCatalogOutboxRuntime({
              workerId: `wheelforce-wheelset-copy:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
              limit: outboxIds.length,
              outboxIds,
            });
            const completedIds = new Set(result.results.filter((item) => item.status === "COMPLETED").map((item) => item.jobId));
            const deferredIds = outboxIds.filter((id) => !completedIds.has(id));
            if (deferredIds.length) scheduleOutbox(deferredIds.length);
          } catch (error) {
            console.error("[wheelforce-wheelset-copy] outbox processing deferred to cron", error);
            scheduleOutbox(outboxIds.length);
          }
        }
        if (body.deferOutbox !== true) revalidateWheelForceProducts(batch.map((set) => set.slug));
      }
      return NextResponse.json({ action, offset, refreshed: outboxIds.length, total: source.sets.length });
    }

    if (action === "publish") {
      const { offset, batch } = safeBatchRange(body);
      const bySlug = new Map((await prisma.shopProduct.findMany({
        where: { slug: { in: batch.map((set) => set.slug) } },
        select: { id: true, slug: true, sku: true, brand: true, tags: true, status: true, isPublished: true, catalogVersion: true },
      })).map((product) => [product.slug, product]));
      const outboxIds: string[] = [];
      let alreadyPublished = 0;
      for (const set of batch) {
        const product = bySlug.get(set.slug);
        if (!product || product.brand?.trim().toLowerCase() !== "wheelforce" || !product.tags.includes(WHEEL_SET_TAG)) {
          return NextResponse.json({ error: `Staged WheelForce set is missing: ${set.slug}` }, { status: 409 });
        }
        if (product.status === "ACTIVE" && product.isPublished) {
          alreadyPublished += 1;
          continue;
        }
        if (product.status !== "DRAFT" || product.isPublished) {
          return NextResponse.json({ error: `WheelForce set ${set.slug} is not an unpublished draft` }, { status: 409 });
        }
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: product.id,
          expectedCatalogVersion: product.catalogVersion.toString(),
          changeDomains: ["VISIBILITY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({ where: { id: product.id }, data: { status: "ACTIVE", isPublished: true, publishedAt: new Date() } });
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "wheelforce-wheelset.publish",
              entityType: "shop.product",
              entityId: product.id,
              metadata: { sku: product.sku, catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "publish-vehicle-specific-wheel-only-set",
            });
          },
        });
        outboxIds.push(mutation.outboxId);
      }
      if (outboxIds.length) scheduleOutbox(outboxIds.length);
      return NextResponse.json({ action, offset, published: outboxIds.length, alreadyPublished, total: source.sets.length });
    }

    return NextResponse.json({ error: "Unknown WheelForce wheel-set import action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (/^Catalog version conflict/.test(message)) return NextResponse.json({ error: "A product changed during import; refresh and resume." }, { status: 409 });
    if (/required|invalid|wheel set|fitment/i.test(message)) return NextResponse.json({ error: message }, { status: 400 });
    console.error("WheelForce wheel-set import", error);
    return NextResponse.json({ error: "WheelForce wheel-set import failed" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
