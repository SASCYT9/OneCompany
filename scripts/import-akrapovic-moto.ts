import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { putPublicBlob, isBlobStorageConfigured } from "../src/lib/runtimeBlobStorage.js";
import { buildAkrapovicEditorialCopy } from "../src/lib/akrapovicEditorialCopy.js";

const prisma = new PrismaClient();

const MODEL_IDS = [
  { id: 377, brand: "BMW", canonicalModel: "S 1000 RR" },
  { id: 1389, brand: "BMW", canonicalModel: "M 1000 RR" },
  { id: 375, brand: "BMW", canonicalModel: "S 1000 R / M 1000 R" },
  { id: 723, brand: "BMW", canonicalModel: "S 1000 XR / M 1000 XR" },
  { id: 1099, brand: "BMW", canonicalModel: "F 900 R" },
  { id: 1298, brand: "BMW", canonicalModel: "R 1300 GS / ADVENTURE" },
  { id: 1419, brand: "BMW", canonicalModel: "R 1300 R / RS" },
  { id: 1446, brand: "Ducati", canonicalModel: "Panigale / Streetfighter V2" },
  { id: 1441, brand: "Ducati", canonicalModel: "Multistrada V4 / S / RS / RALLY" },
];

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const translateModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;

async function translateToUkrainian(htmlText: string): Promise<string> {
  if (!translateModel || !htmlText) return "";

  const prompt = `You are a professional translator specializing in premium automotive and motorcycle performance parts.
Translate the following English HTML product description into Ukrainian.

CRITICAL INSTRUCTIONS:
- Translate only the actual text content. Keep ALL HTML tags, classes, and structure EXACTLY as they are.
- Keep official line names in English or their recognized forms (e.g., "Evolution Line", "Slip-On Line" must stay as Latin "Evolution Line", "Slip-On Line").
- Maintain a premium, high-end tone suitable for luxury brands.
- Do not add any extra conversational text or explanations. Only return the translated HTML.

HTML TO TRANSLATE:
${htmlText}`;

  try {
    const result = await translateModel.generateContent(prompt);
    let translated = result.response.text();
    if (translated.startsWith("```html")) {
      translated = translated.replace(/^```html\s*/, "").replace(/\s*```$/, "");
    } else if (translated.startsWith("```")) {
      translated = translated.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return translated.trim();
  } catch (err: any) {
    console.error("  Translation error via Gemini:", err.message);
    return "";
  }
}

function cleanPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ") // replace tags with spaces
    .replace(/\s+/g, " ") // collapse whitespaces
    .trim();
}

function getShortDesc(text: string, maxLen = 160): string {
  const plain = cleanPlainText(text);
  if (plain.length <= maxLen) return plain;
  const truncated = plain.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > maxLen * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }
  return truncated.trim() + "...";
}

async function getJson(path: string): Promise<any> {
  const url = `https://api2.akrapovic.com${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.akrapovic.com",
        Referer: "https://www.akrapovic.com/",
      },
      timeout: 15000,
    });
    if (!res.ok) {
      console.error(`Error fetching ${url}: ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.error(`Network error fetching ${url}:`, err.message);
    return null;
  }
}

function getFallbackPricing(sku: string, title: string) {
  const skuUpper = sku.toUpperCase();
  const titleLower = title.toLowerCase();

  if (skuUpper.includes("SO") || titleLower.includes("slip-on") || titleLower.includes("slip on")) {
    return {
      priceEur: 1250.0,
      priceUsd: 1380.0,
      priceUah: 55000.0,
    };
  } else if (
    skuUpper.includes("EVO") ||
    skuUpper.includes("APLT") ||
    skuUpper.includes("R5") ||
    skuUpper.includes("R7") ||
    titleLower.includes("evolution") ||
    titleLower.includes("racing")
  ) {
    return {
      priceEur: 2850.0,
      priceUsd: 3100.0,
      priceUah: 125000.0,
    };
  } else if (/^[ELPV]|^CB|^F/i.test(skuUpper)) {
    return {
      priceEur: 650.0,
      priceUsd: 720.0,
      priceUah: 28000.0,
    };
  } else {
    return {
      priceEur: 980.0,
      priceUsd: 1080.0,
      priceUah: 43000.0,
    };
  }
}

function generateSlug(brand: string, sku: string): string {
  return `${brand.toLowerCase()}-${sku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

async function uploadToBlob(originalUrl: string, sku: string, index: number): Promise<string> {
  if (!isBlobStorageConfigured()) {
    return originalUrl;
  }
  try {
    const ext = originalUrl.split(".").pop()?.split("?")[0] || "png";
    const blobPathname = `akrapovic-moto/${sku.replace(/[^a-zA-Z0-9]/g, "_")}_${index}.${ext}`;

    console.log(`Downloading image: ${originalUrl}`);
    const response = await fetch(originalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const contentType =
      ext === "webp" ? "image/webp" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

    console.log(`Uploading to Vercel Blob: ${blobPathname}`);
    const blobResult = await putPublicBlob(blobPathname, buffer, contentType);
    return blobResult.url;
  } catch (err: any) {
    console.error(`Failed to upload ${originalUrl} to blob storage:`, err.message);
    return originalUrl;
  }
}

function buildSpecsList(
  sku: string,
  titleEn: string,
  techData: any,
  modelYears: Map<string, Set<number>>,
  locale: "en" | "ua"
): string {
  const isUa = locale === "ua";
  const items: string[] = [];

  // Extract metadata using similar rules to editorial copy
  const titleLower = titleEn.toLowerCase();
  let line = "Exhaust System";
  let lineUa = "Вихлопна система";
  if (titleLower.includes("evolution")) {
    line = "Evolution Line";
    lineUa = "Evolution Line";
  } else if (titleLower.includes("slip-on") || titleLower.includes("slip on")) {
    if (titleLower.includes("race")) {
      line = "Slip-On Race Line";
      lineUa = "Slip-On Race Line";
    } else {
      line = "Slip-On Line";
      lineUa = "Slip-On Line";
    }
  } else if (titleLower.includes("optional header") || titleLower.includes("header")) {
    line = "Optional Header";
    lineUa = "Колектор / приймальна труба";
  } else if (titleLower.includes("link pipe") || titleLower.includes("linkpipe")) {
    line = "Link Pipe";
    lineUa = "Сполучна труба";
  }

  let material = "";
  let materialUa = "";
  if (titleLower.includes("titanium")) {
    material = "Titanium";
    materialUa = "Титан";
  } else if (titleLower.includes("carbon")) {
    material = "Carbon Fiber";
    materialUa = "Карбон";
  } else if (titleLower.includes("stainless steel") || titleLower.includes("ss")) {
    material = "Stainless Steel";
    materialUa = "Нержавіюча сталь";
  }

  // Add SKU / Article
  items.push(isUa ? `<li>Артикул: ${sku}</li>` : `<li>Part Number: ${sku}</li>`);

  // Add Line
  items.push(isUa ? `<li>Лінійка: ${lineUa}</li>` : `<li>Product Line: ${line}</li>`);

  // Add Material if found
  if (material) {
    items.push(isUa ? `<li>Матеріал: ${materialUa}</li>` : `<li>Material: ${material}</li>`);
  }

  // Technical Specs
  if (techData) {
    // Power gain
    if (techData.MaxPowerIncreasekW) {
      const kw =
        techData.MaxPowerIncreasekW > 0
          ? `+${techData.MaxPowerIncreasekW}`
          : techData.MaxPowerIncreasekW;
      const hp = techData.MaxPowerIncreaseHpMetric
        ? ` (+${techData.MaxPowerIncreaseHpMetric} HP)`
        : "";
      const rpm = techData.MaxPowerIncreaseRpm
        ? isUa
          ? ` при ${techData.MaxPowerIncreaseRpm} об/хв`
          : ` at ${techData.MaxPowerIncreaseRpm} rpm`
        : "";
      items.push(
        isUa
          ? `<li>Потужність: ${kw} кВт${hp}${rpm}</li>`
          : `<li>Power Gain: ${kw} kW${hp}${rpm}</li>`
      );
    }

    // Torque gain
    if (techData.MaxTorqueIncreaseNm) {
      const nm =
        techData.MaxTorqueIncreaseNm > 0
          ? `+${techData.MaxTorqueIncreaseNm}`
          : techData.MaxTorqueIncreaseNm;
      const rpm = techData.MaxTorqueIncreaseRpm
        ? isUa
          ? ` при ${techData.MaxTorqueIncreaseRpm} об/хв`
          : ` at ${techData.MaxTorqueIncreaseRpm} rpm`
        : "";
      items.push(
        isUa ? `<li>Крутний момент: ${nm} Нм${rpm}</li>` : `<li>Torque Gain: ${nm} Nm${rpm}</li>`
      );
    }

    // Weight decrease
    if (techData.WeightDecreaseKg) {
      const kg =
        techData.WeightDecreaseKg > 0 ? `-${techData.WeightDecreaseKg}` : techData.WeightDecreaseKg;
      const pct = techData.WeightDecreasePct ? ` (-${techData.WeightDecreasePct}%)` : "";
      const orig = techData.WeightOrigKg
        ? isUa
          ? ` (Оригінал: ${techData.WeightOrigKg} кг)`
          : ` (Original: ${techData.WeightOrigKg} kg)`
        : "";
      items.push(
        isUa
          ? `<li>Зниження ваги: ${kg} кг${pct}${orig}</li>`
          : `<li>Weight Decrease: ${kg} kg${pct}${orig}</li>`
      );
    } else if (techData.WeightAkrKg) {
      const orig = techData.WeightOrigKg
        ? isUa
          ? ` (Оригінал: ${techData.WeightOrigKg} кг)`
          : ` (Original: ${techData.WeightOrigKg} kg)`
        : "";
      items.push(
        isUa
          ? `<li>Вага: ${techData.WeightAkrKg} кг${orig}</li>`
          : `<li>Weight: ${techData.WeightAkrKg} kg${orig}</li>`
      );
    }

    // Noise level
    if (techData.NoiseAkrdB) {
      const rpm = techData.NoiseAkrRpm
        ? isUa
          ? ` при ${techData.NoiseAkrRpm} об/хв`
          : ` at ${techData.NoiseAkrRpm} rpm`
        : "";
      const orig = techData.NoiseOrigdB
        ? isUa
          ? ` (Оригінал: ${techData.NoiseOrigdB} дБ)`
          : ` (Original: ${techData.NoiseOrigdB} dB)`
        : "";
      items.push(
        isUa
          ? `<li>Рівень шуму: ${techData.NoiseAkrdB} дБ${rpm}${orig}</li>`
          : `<li>Noise Level: ${techData.NoiseAkrdB} dB${rpm}${orig}</li>`
      );
    }

    // Installation time
    if (techData.InstallationTimeMin) {
      items.push(
        isUa
          ? `<li>Час встановлення: ${techData.InstallationTimeMin} хв</li>`
          : `<li>Installation Time: ${techData.InstallationTimeMin} min</li>`
      );
    }

    // ECU Remapping
    if (techData.EcuRemapping !== undefined) {
      const remap = techData.EcuRemapping === 1;
      items.push(
        isUa
          ? `<li>Перепрошивка ECU: ${remap ? "Рекомендовано" : "Не потрібно"}</li>`
          : `<li>ECU Remapping: ${remap ? "Recommended" : "Not required"}</li>`
      );
    }
  }

  // Add Compatible Years / Vehicles
  if (modelYears && modelYears.size > 0) {
    const compatParts = Array.from(modelYears.entries()).map(([modelName, yearsSet]) => {
      const years = Array.from(yearsSet).sort((a, b) => a - b);
      const range = formatYearRange(years);
      return `${modelName} (${range})`;
    });
    const compatStr = compatParts.join(", ");
    items.push(isUa ? `<li>Сумісність: ${compatStr}</li>` : `<li>Compatibility: ${compatStr}</li>`);
  }

  return `<ul>\n${items.map((i) => `  ${i}`).join("\n")}\n</ul>`;
}

function formatYearRange(years: number[]): string {
  if (!years || years.length === 0) return "";
  const sorted = [...years].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) {
    return `${min}`;
  }
  return `${min}-${max}`;
}

async function main() {
  console.log("=== Starting Live Akrapovič Moto Import (2019-2026) ===");

  if (!isBlobStorageConfigured()) {
    console.warn(
      "WARNING: Vercel Blob Storage is not configured. Images will fallback to direct URLs."
    );
  }

  // Map to hold aggregated data by SKU
  // SKU -> { productId, brand, modelYears: Map<modelName, Set<year>>, fitsTags: Set<string> }
  const skuAggregates = new Map<
    string,
    {
      productId: number;
      brand: string;
      modelYears: Map<string, Set<number>>;
      fitsTags: Set<string>;
    }
  >();

  // --- PASS 1: SCAN AND AGGREGATE MODEL YEARS ---
  for (const model of MODEL_IDS) {
    console.log(
      `\nScanning model years for: ${model.brand} ${model.canonicalModel} (ID: ${model.id})...`
    );

    // Fetch all years for this model
    const yearsRes = await getJson(`/en/models/${model.id}/years`);
    if (!yearsRes || !Array.isArray(yearsRes) || yearsRes.length === 0) {
      console.log(`No years found for model ID: ${model.id}`);
      continue;
    }

    const validYears = yearsRes
      .map((item: any) => ({
        yearId: item.ModelYear?.ModelYearId,
        yearNumber: item.ModelYear?.ModelYear ? Number(item.ModelYear.ModelYear) : 0,
      }))
      .filter((y) => y.yearNumber >= 2019 && y.yearNumber <= 2026);

    console.log(`Found ${validYears.length} valid years (2019-2026) for model ID: ${model.id}`);

    for (const yearItem of validYears) {
      console.log(
        `  Querying products for year ${yearItem.yearNumber} (YearId: ${yearItem.yearId})...`
      );
      const productsRes = await getJson(
        `/en/products/motorcycle?ModelId=${model.id}&Year=${yearItem.yearId}`
      );

      if (!productsRes || !productsRes.Items || productsRes.Items.length === 0) {
        continue;
      }

      for (const item of productsRes.Items) {
        const sku = item.Product?.SalesId;
        const productId = item.Product?.ProductId;
        if (!sku || !productId) continue;

        const canonicalModelSlug = model.canonicalModel
          .toLowerCase()
          .replace(/\s*\/\s*/g, "-")
          .replace(/\s+/g, "-");

        const newFitsTags = [
          `fits-make:${model.brand.toLowerCase()}`,
          `fits-model:${model.brand.toLowerCase()}:${canonicalModelSlug}`,
          `fits:${model.brand.toLowerCase()}-${canonicalModelSlug}`,
          `fits-year:${yearItem.yearNumber}`,
        ];

        if (!skuAggregates.has(sku)) {
          skuAggregates.set(sku, {
            productId,
            brand: model.brand,
            modelYears: new Map<string, Set<number>>(),
            fitsTags: new Set<string>(),
          });
        }

        const aggregate = skuAggregates.get(sku)!;
        if (!aggregate.modelYears.has(model.canonicalModel)) {
          aggregate.modelYears.set(model.canonicalModel, new Set<number>());
        }
        aggregate.modelYears.get(model.canonicalModel)!.add(yearItem.yearNumber);
        newFitsTags.forEach((t) => aggregate.fitsTags.add(t));
      }
    }
  }

  console.log(`\nScan complete. Found ${skuAggregates.size} unique SKUs to import.`);

  // --- PASS 2: FETCH DETAILS, TRANSLATE AND SAVE ---
  let count = 0;
  for (const [sku, aggregate] of skuAggregates.entries()) {
    count++;
    console.log(
      `\n[${count}/${skuAggregates.size}] Processing detailed page for SKU: ${sku} (ProductId: ${aggregate.productId})...`
    );

    // Fetch detailed product page info
    const detail = await getJson(`/en/products/motorcycle/${aggregate.productId}`);
    if (!detail) {
      console.error(`  Failed to fetch detailed info for SKU: ${sku}`);
      continue;
    }

    const commercialName = detail.Product?.CommercialName || "Exhaust System";

    const brand = aggregate.brand;

    // Sort and build compatibility string
    const modelStrings = Array.from(aggregate.modelYears.entries()).map(([modelName, yearsSet]) => {
      const years = Array.from(yearsSet).sort((a, b) => a - b);
      const range = formatYearRange(years);
      return `${modelName} (${range})`;
    });
    const compatibilityStr = modelStrings.join(", ");

    // Construct premium titles
    const titleEn = `Akrapovič ${commercialName} for ${brand} ${compatibilityStr} (${sku})`;

    // Localize with buildAkrapovicEditorialCopy (to parse and translate model name words if needed)
    const editorial = buildAkrapovicEditorialCopy({
      slug: generateSlug("AKRAPOVIC", sku),
      titleEn,
      shortDescEn: detail.Description || "",
    });

    // Custom Ukrainian title using editorial's translated vehicle name
    const titleUa = `${commercialName} — Akrapovič для ${brand} ${compatibilityStr} (${sku})`;

    const rawDescriptionHtml = detail.Description || "";
    let translatedDescriptionHtml = "";

    if (rawDescriptionHtml && apiKey) {
      console.log(`  Translating description for ${sku} via Gemini...`);
      translatedDescriptionHtml = await translateToUkrainian(rawDescriptionHtml);
      // Wait 500ms to avoid rate limit
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Build specs list
    const specsListEn = buildSpecsList(
      sku,
      titleEn,
      detail.TechnicalData,
      aggregate.modelYears,
      "en"
    );
    const specsListUa = buildSpecsList(
      sku,
      titleEn,
      detail.TechnicalData,
      aggregate.modelYears,
      "ua"
    );

    const bodyHtmlEn = rawDescriptionHtml
      ? `${rawDescriptionHtml}\n\n<h3>Specifications</h3>\n${specsListEn}`
      : `<h3>Specifications</h3>\n${specsListEn}`;

    const bodyHtmlUa = translatedDescriptionHtml
      ? `${translatedDescriptionHtml}\n\n<h3>Характеристики</h3>\n${specsListUa}`
      : rawDescriptionHtml
        ? `${rawDescriptionHtml}\n\n<h3>Характеристики</h3>\n${specsListUa}` // Fallback if translation fails
        : `<h3>Характеристики</h3>\n${specsListUa}`;

    const modelNamesStr = Array.from(aggregate.modelYears.keys()).join(" / ");
    const defaultDesc = `High-performance Akrapovič ${commercialName} exhaust component for ${aggregate.brand} ${modelNamesStr}.`;
    const cleanDescEn = cleanPlainText(rawDescriptionHtml || defaultDesc);
    const cleanDescUa = cleanPlainText(translatedDescriptionHtml || cleanDescEn);

    const shortDescEn = getShortDesc(cleanDescEn, 160);
    const shortDescUa = getShortDesc(cleanDescUa, 160);

    const longDescEn = cleanDescEn;
    const longDescUa = cleanDescUa;

    // Default pricing
    const pricing = getFallbackPricing(sku, titleEn);

    // Prepare images
    let mainImageUrl = detail.Product?.ImageUrl || null;
    const mediaCreate: any[] = [];
    const galleryUrls: string[] = [];

    if (detail.ProductImages && detail.ProductImages.length > 0) {
      console.log(`  Processing ${detail.ProductImages.length} gallery images...`);
      let idx = 1;
      for (const imgItem of detail.ProductImages) {
        const imgUrl = imgItem.Image || imgItem.Thumbnail;
        if (imgUrl) {
          const blobUrl = await uploadToBlob(imgUrl, sku, idx);
          if (idx === 1 && !mainImageUrl) {
            mainImageUrl = blobUrl;
          }
          galleryUrls.push(blobUrl);
          mediaCreate.push({
            mediaType: "IMAGE",
            src: blobUrl,
            position: idx,
          });
          idx++;
        }
      }
    } else if (mainImageUrl) {
      const blobUrl = await uploadToBlob(mainImageUrl, sku, 1);
      mainImageUrl = blobUrl;
      galleryUrls.push(blobUrl);
      mediaCreate.push({
        mediaType: "IMAGE",
        src: blobUrl,
        position: 1,
      });
    }

    // Prepare metafields (specs, sounds)
    const metafieldsCreate: any[] = [];

    // Technical specs metafields
    if (detail.TechnicalData) {
      metafieldsCreate.push({
        namespace: "akrapovic",
        key: "technical_data",
        value: JSON.stringify(detail.TechnicalData),
        valueType: "json",
      });
    }

    // Sounds metafield
    if (detail.Sounds && detail.Sounds.length > 0) {
      console.log(`  Found ${detail.Sounds.length} sound files.`);
      metafieldsCreate.push({
        namespace: "akrapovic",
        key: "sounds",
        value: JSON.stringify(detail.Sounds),
        valueType: "json",
      });
    }

    const slug = generateSlug("AKRAPOVIC", sku);

    const modelWords = Array.from(aggregate.modelYears.keys()).flatMap((m) => m.split(/\s+/));

    // Construct tags array
    const tags = Array.from(
      new Set([
        "Akrapovic",
        "Akrapovič",
        "Moto",
        aggregate.brand,
        ...modelWords,
        ...Array.from(aggregate.fitsTags),
      ])
    );

    // Check if product exists in DB
    const existingProduct = await prisma.shopProduct.findFirst({ where: { sku } });

    // Defensive pricing checks: preserve existing DB pricing if it exists
    let priceEur = pricing.priceEur;
    let priceUsd = pricing.priceUsd;
    let priceUah = pricing.priceUah;
    let compareAtEur: number | null = null;
    let compareAtUsd: number | null = null;
    let compareAtUah: number | null = null;

    if (existingProduct) {
      priceEur = existingProduct.priceEur ? Number(existingProduct.priceEur) : priceEur;
      priceUsd = existingProduct.priceUsd ? Number(existingProduct.priceUsd) : priceUsd;
      priceUah = existingProduct.priceUah ? Number(existingProduct.priceUah) : priceUah;
      compareAtEur = existingProduct.compareAtEur ? Number(existingProduct.compareAtEur) : null;
      compareAtUsd = existingProduct.compareAtUsd ? Number(existingProduct.compareAtUsd) : null;
      compareAtUah = existingProduct.compareAtUah ? Number(existingProduct.compareAtUah) : null;
    }

    if (existingProduct) {
      console.log(`  Product with SKU ${sku} already exists in DB. Updating...`);
      const mergedTags = Array.from(new Set([...(existingProduct.tags || []), ...tags]));

      // Delete existing media & metafields to recreate them clean
      await prisma.shopProductMedia.deleteMany({ where: { productId: existingProduct.id } });
      await prisma.shopProductMetafield.deleteMany({ where: { productId: existingProduct.id } });

      await prisma.shopProduct.update({
        where: { id: existingProduct.id },
        data: {
          titleEn,
          titleUa: titleUa,
          shortDescEn,
          shortDescUa: shortDescUa,
          longDescEn,
          longDescUa,
          bodyHtmlEn,
          bodyHtmlUa,
          seoTitleEn: titleEn,
          seoTitleUa: titleUa,
          seoDescriptionEn: shortDescEn,
          seoDescriptionUa: shortDescUa,
          image: mainImageUrl || existingProduct.image,
          gallery: galleryUrls.length > 0 ? galleryUrls : existingProduct.gallery,
          tags: mergedTags,
          scope: "moto",
          media: {
            create: mediaCreate,
          },
          metafields: {
            create: metafieldsCreate,
          },
        },
      });
    } else {
      console.log(`  Creating new Moto product for SKU: ${sku}`);
      await prisma.shopProduct.create({
        data: {
          slug,
          sku,
          scope: "moto",
          brand: "AKRAPOVIC",
          vendor: "AKRAPOVIC",
          titleEn,
          titleUa: titleUa,
          categoryEn: "Exhaust Systems",
          categoryUa: "Вихлопні системи",
          shortDescEn,
          shortDescUa: shortDescUa,
          longDescEn,
          longDescUa,
          bodyHtmlEn,
          bodyHtmlUa,
          seoTitleEn: titleEn,
          seoTitleUa: titleUa,
          seoDescriptionEn: shortDescEn,
          seoDescriptionUa: shortDescUa,
          priceEur,
          priceUsd: null,
          priceUah: null,
          compareAtEur,
          compareAtUsd: null,
          compareAtUah: null,
          image: mainImageUrl,
          gallery: galleryUrls,
          isPublished: true,
          status: "ACTIVE",
          tags,
          variants: {
            create: {
              title: titleEn,
              sku,
              position: 1,
              inventoryQty: 5,
              inventoryPolicy: "CONTINUE",
              priceEur,
              priceUsd: null,
              priceUah: null,
              image: mainImageUrl,
              isDefault: true,
              requiresShipping: true,
              taxable: true,
            },
          },
          media: {
            create: mediaCreate,
          },
          metafields: {
            create: metafieldsCreate,
          },
        },
      });
    }
  }

  console.log("\n=== Seeding Live Akrapovič Moto Complete! ===");
}

main()
  .catch((err) => {
    console.error("Fatal error during live import:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
