import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { chromium, type Page } from "playwright";

import { htmlToPlainText, sanitizeRichTextHtml } from "../src/lib/sanitizeRichTextHtml";
import {
  isBlobStorageConfigured,
  listAllBlobsByPrefix,
  putPublicBlob,
} from "../src/lib/runtimeBlobStorage";

dotenv.config({ path: ".env.local" });

const AMS_BRAND_URL = "https://amsducati.com/brands/akrapovic";
const AMS_EXHAUST_URL = "https://amsducati.com/ducati-accessories/exhaust/";
const AMS_LISTING_URLS = [AMS_BRAND_URL, AMS_EXHAUST_URL];
const COMMIT = process.argv.includes("--commit");
const prisma = new PrismaClient();

const REPRESENTED_AMS_SKUS = new Set([
  "96481775DA",
  "96482172AA",
  "96482292AA",
  "96482292BA",
  "96482501AA",
  "96482551AA",
]);

const INVALID_COMPONENT_SKU = "96423451BA";
const EXHAUST_CATEGORY_ADDITIONAL_AKRAPOVIC_SKUS = new Set([
  "96481682AA",
  "96481741AA",
  "96482212AA",
  "96482581AA",
]);

type AmsCard = {
  sku: string;
  title: string;
  url: string;
  priceUsd: number;
  compareAtUsd: number | null;
  outOfStock: boolean;
};

type AmsCandidate = AmsCard & {
  aliases: AmsCard[];
  descriptionHtml: string;
  descriptionText: string;
  images: string[];
};

type ProductCategory = {
  en: string;
  ua: string;
};

const FAMILY_PATTERNS = {
  "panigale-v4": /\bpanigale\s+v4\b/i,
  "streetfighter-v4": /\bstreetfighter\s+v4\b/i,
  "panigale-v2": /\bpanigale\s+v2\b/i,
  "streetfighter-v2": /\bstreetfighter\s+v2\b/i,
  "multistrada-v4": /\bmultistrada\s+v4\b/i,
  "diavel-v4": /\bdiavel\s+v4\b/i,
  "xdiavel-v4": /\bxdiavel\s+v4\b/i,
} as const;

type FamilyKey = keyof typeof FAMILY_PATTERNS;

function parseUsd(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractDucatiSku(value: string) {
  const matches = value.toUpperCase().match(/\b\d{8}[A-Z]{1,2}\b/g);
  return matches?.at(-1) ?? null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function productCategory(title: string): ProductCategory {
  if (/lower fairing|fairing kit/i.test(title)) {
    return { en: "Fairings", ua: "Обтічники" };
  }
  if (/dB killer/i.test(title)) {
    return { en: "Exhaust Accessories", ua: "Аксесуари вихлопної системи" };
  }
  if (/manifold|header/i.test(title)) {
    return { en: "Headers & Manifolds", ua: "Колектори та приймальні труби" };
  }
  if (/slip-on|silencer/i.test(title)) {
    return { en: "Slip-On Exhausts", ua: "Глушники Slip-On" };
  }
  if (/full race|full racing|full exhaust|exhaust system/i.test(title)) {
    return { en: "Full Exhaust Systems", ua: "Повні вихлопні системи" };
  }
  return { en: "Exhaust Accessories", ua: "Аксесуари вихлопної системи" };
}

function supportedFamiliesFromTags(tags: string[]) {
  const haystack = tags.join(" ").toLowerCase();
  const families = new Set<FamilyKey>();
  for (const family of Object.keys(FAMILY_PATTERNS) as FamilyKey[]) {
    const token = family.replace("-", " ");
    if (haystack.includes(family) || haystack.includes(token)) families.add(family);
  }
  if (haystack.includes("panigale-streetfighter-v2")) {
    families.add("panigale-v2");
    families.add("streetfighter-v2");
  }
  return families;
}

function cardMatchesSupportedMoto(title: string, supported: Set<FamilyKey>) {
  if (/lamborghini|speciale clienti|supersport|1299|desmo\s*450/i.test(title)) return false;
  return (Object.entries(FAMILY_PATTERNS) as [FamilyKey, RegExp][]).some(
    ([family, pattern]) => supported.has(family) && pattern.test(title)
  );
}

function candidatePreference(card: AmsCard) {
  let score = 0;
  if (/2025\+|2026/i.test(card.title)) score += 100;
  if (!card.outOfStock) score += 10;
  score += card.priceUsd / 100_000;
  return score;
}

function collapseCards(cards: AmsCard[]) {
  const groups = new Map<string, AmsCard[]>();
  for (const card of cards) {
    const group = groups.get(card.sku) ?? [];
    group.push(card);
    groups.set(card.sku, group);
  }

  return [...groups.values()].map((group) => {
    const selected = [...group].sort((a, b) => candidatePreference(b) - candidatePreference(a))[0];
    return { ...selected, aliases: group };
  });
}

async function scrapeCards(page: Page) {
  const products: AmsCard[] = [];
  for (const listingUrl of AMS_LISTING_URLS) {
    for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
      const url = pageNumber === 1 ? listingUrl : `${listingUrl}?p=${pageNumber}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForSelector("li.product-item", { timeout: 20_000 });
      const cards = await page.locator("li.product-item").evaluateAll((items) =>
        items.map((item) => {
          const link = item.querySelector<HTMLAnchorElement>(".product-item-link");
          const current =
            item.querySelector<HTMLElement>(".special-price .price") ??
            item.querySelector<HTMLElement>(".price-final_price .price") ??
            item.querySelector<HTMLElement>(".price-box .price");
          const old = item.querySelector<HTMLElement>(".old-price .price");
          return {
            title: link?.textContent?.trim() ?? "",
            url: link?.href ?? "",
            currentPrice: current?.textContent?.trim() ?? "",
            compareAtPrice: old?.textContent?.trim() ?? "",
            outOfStock: Boolean(item.querySelector(".stock.unavailable")),
          };
        })
      );

      const previousUrls = new Set(products.map((product) => product.url));
      const fresh = cards.flatMap((card) => {
        const sku = extractDucatiSku(card.title);
        const priceUsd = parseUsd(card.currentPrice);
        if (!sku || !priceUsd || !card.url || previousUrls.has(card.url)) return [];
        if (
          listingUrl === AMS_EXHAUST_URL &&
          !/akrapovi/i.test(card.title) &&
          !EXHAUST_CATEGORY_ADDITIONAL_AKRAPOVIC_SKUS.has(sku)
        ) {
          return [];
        }
        return [
          {
            sku,
            title: normalizeWhitespace(card.title),
            url: card.url,
            priceUsd,
            compareAtUsd: parseUsd(card.compareAtPrice),
            outOfStock: card.outOfStock,
          },
        ];
      });
      if (fresh.length === 0) break;
      products.push(...fresh);
      if (!(await page.locator("a.action.next").count())) break;
    }
  }
  return products;
}

function uniqueGalleryImages(urls: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const key = url.replace(/\/cache\/[a-f0-9]+\//i, "/cache/");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result.slice(0, 8);
}

async function scrapeDetail(page: Page, card: AmsCard & { aliases: AmsCard[] }) {
  await page.goto(card.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector(".product.attribute.description", { timeout: 20_000 });
  await page.waitForTimeout(800);
  const detail = await page.evaluate(() => {
    const description = document.querySelector<HTMLElement>(
      ".product.attribute.description .value"
    );
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".gallery-placeholder img")
    )
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean);
    return {
      descriptionHtml: description?.innerHTML ?? "",
      descriptionText: description?.textContent?.trim() ?? "",
      images,
    };
  });

  return {
    ...card,
    descriptionHtml: sanitizeRichTextHtml(detail.descriptionHtml),
    descriptionText: normalizeWhitespace(detail.descriptionText),
    images: uniqueGalleryImages(detail.images),
  } satisfies AmsCandidate;
}

function extractFitmentTags(candidate: AmsCandidate) {
  const combined = [
    candidate.title,
    candidate.descriptionText,
    ...candidate.aliases.map((alias) => alias.title),
  ].join(" ");
  const tags = new Set<string>([
    "Akrapovic",
    "Akrapovič",
    "Moto",
    "Ducati",
    "Ducati Performance",
    "source:amsducati",
    "fits-make:ducati",
  ]);

  for (const [family, pattern] of Object.entries(FAMILY_PATTERNS) as [FamilyKey, RegExp][]) {
    if (!pattern.test(combined)) continue;
    tags.add(
      family
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ")
    );
    tags.add(`fits-model:ducati:${family}`);
    tags.add(`fits:ducati-${family}`);
  }

  const years = new Set<number>();
  for (const match of combined.matchAll(/(20\d{2})\s*[-–]\s*(20\d{2})/g)) {
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), new Date().getFullYear());
    for (let year = start; year <= end; year += 1) years.add(year);
  }
  for (const match of combined.matchAll(/(20\d{2})\s*\+/g)) {
    const start = Number(match[1]);
    for (let year = start; year <= new Date().getFullYear(); year += 1) years.add(year);
  }
  for (const match of combined.matchAll(/\b(20\d{2})\b/g)) {
    const year = Number(match[1]);
    if (year >= 2010 && year <= new Date().getFullYear()) years.add(year);
  }
  [...years].sort().forEach((year) => tags.add(`fits-year:${year}`));
  return [...tags];
}

function vehicleLabel(tags: string[]) {
  return tags
    .filter((tag) => tag.startsWith("fits-model:ducati:"))
    .map((tag) =>
      tag
        .slice("fits-model:ducati:".length)
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ")
    )
    .join(", ");
}

function ukrainianCopy(candidate: AmsCandidate, tags: string[]) {
  const vehicles = vehicleLabel(tags) || "мотоциклів Ducati";
  const titleUa = candidate.title.replace(/Akrapovic/gi, "Akrapovič");
  const shortDescUa = `Офіційний товар Ducati Performance / Akrapovič для ${vehicles}. Артикул ${candidate.sku}.`;
  const longDescUa = `${shortDescUa} Актуальна сумісність і ціна перевірені за каталогом AMS Ducati. Перед встановленням перевірте вимоги щодо дорожньої омологації та програмування ECU.`;
  const bodyHtmlUa = `<p>${shortDescUa}</p><ul><li><strong>Артикул:</strong> ${candidate.sku}</li><li><strong>Сумісність:</strong> ${vehicles}</li><li><strong>Джерело:</strong> AMS Ducati</li></ul><p>Перед замовленням перевірте сумісність із роком випуску мотоцикла, вимоги щодо омологації та необхідність дилерського програмування ECU.</p>`;
  return { titleUa, shortDescUa, longDescUa, bodyHtmlUa };
}

async function uploadImages(candidate: AmsCandidate) {
  const urls: string[] = [];
  const prefix = `akrapovic-moto/ducati/${candidate.sku.toLowerCase()}/`;
  const existingBlobs = await listAllBlobsByPrefix(prefix);
  const existingByPath = new Map(existingBlobs.map((blob) => [blob.pathname, blob.url]));
  for (const [index, sourceUrl] of candidate.images.entries()) {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/126 Safari/537.36" },
    });
    if (!response.ok) throw new Error(`Image download failed ${response.status}: ${sourceUrl}`);
    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const sourcePath = new URL(sourceUrl).pathname;
    const extension = path.extname(sourcePath) || (contentType === "image/png" ? ".png" : ".jpg");
    const pathname = `${prefix}${index + 1}${extension}`;
    const existingUrl = existingByPath.get(pathname);
    if (existingUrl) {
      urls.push(existingUrl);
      continue;
    }
    const blob = await putPublicBlob(
      pathname,
      Buffer.from(await response.arrayBuffer()),
      contentType
    );
    urls.push(blob.url);
  }
  return urls;
}

async function main() {
  if (COMMIT && !isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for a catalog commit");
  }

  const existingDucati = await prisma.shopProduct.findMany({
    where: {
      scope: "moto",
      isPublished: true,
      OR: [{ tags: { has: "Ducati" } }, { tags: { has: "fits-make:ducati" } }],
    },
    select: { id: true, sku: true, tags: true },
  });
  const supported = supportedFamiliesFromTags(existingDucati.flatMap((product) => product.tags));

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ locale: "en-US" });
  let candidates: AmsCandidate[] = [];
  try {
    const cards = await scrapeCards(page);
    const relevantCards = cards.filter(
      (card) =>
        !REPRESENTED_AMS_SKUS.has(card.sku) && cardMatchesSupportedMoto(card.title, supported)
    );
    const collapsed = collapseCards(relevantCards);
    for (const [index, card] of collapsed.entries()) {
      console.log(`[${index + 1}/${collapsed.length}] ${card.sku} ${card.title}`);
      candidates.push(await scrapeDetail(page, card));
    }
  } finally {
    await browser.close();
  }

  const candidateSkus = candidates.map((candidate) => candidate.sku);
  const existing = await prisma.shopProduct.findMany({
    where: { sku: { in: candidateSkus } },
    include: { variants: true, media: true },
  });
  const existingBySku = new Map(existing.map((product) => [product.sku?.toUpperCase(), product]));
  const creates = candidates.filter((candidate) => !existingBySku.has(candidate.sku));
  const updates = candidates.filter((candidate) => existingBySku.has(candidate.sku));
  const invalidComponent = await prisma.shopProduct.findFirst({
    where: { sku: INVALID_COMPONENT_SKU },
    include: { variants: true, media: true },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? "commit" : "dry-run",
    sources: AMS_LISTING_URLS,
    supportedFamilies: [...supported].sort(),
    candidates: candidates.map((candidate) => ({
      sku: candidate.sku,
      title: candidate.title,
      priceUsd: candidate.priceUsd,
      compareAtUsd: candidate.compareAtUsd,
      images: candidate.images.length,
      action: existingBySku.has(candidate.sku) ? "update" : "create",
      sourceUrl: candidate.url,
    })),
    archiveInvalidComponent: Boolean(invalidComponent?.isPublished),
  };
  const reportDir = path.join(process.cwd(), "tmp", "amsducati-akrapovic");
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    path.join(reportDir, "catalog-latest.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.table(report.candidates.map(({ sourceUrl: _sourceUrl, ...row }) => row));
  console.log(`Create: ${creates.length}; update: ${updates.length}`);
  console.log(
    `Archive invalid component ${INVALID_COMPONENT_SKU}: ${report.archiveInvalidComponent}`
  );
  if (!COMMIT) {
    console.log("Dry run only. Re-run with --commit to write catalog changes.");
    return;
  }

  const backupDir = path.join(process.cwd(), "backups", "amsducati-akrapovic");
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(
    path.join(backupDir, `catalog-before-${stamp}.json`),
    JSON.stringify({ report, existing, invalidComponent }, null, 2),
    "utf8"
  );

  for (const candidate of candidates) {
    const current = existingBySku.get(candidate.sku);
    const tags = extractFitmentTags(candidate);
    const category = productCategory(candidate.title);
    const ua = ukrainianCopy(candidate, tags);
    const plainEnglish = htmlToPlainText(candidate.descriptionHtml) || candidate.descriptionText;
    const shortDescEn = plainEnglish.slice(0, 260);
    const priceUsd = new Prisma.Decimal(candidate.priceUsd);
    const compareAtUsd = candidate.compareAtUsd ? new Prisma.Decimal(candidate.compareAtUsd) : null;

    let imageUrls = current?.media.map((media) => media.src).filter(Boolean) ?? [];
    if (imageUrls.length === 0) imageUrls = await uploadImages(candidate);
    if (imageUrls.length === 0) throw new Error(`No images available for ${candidate.sku}`);

    if (current) {
      await prisma.$transaction(async (tx) => {
        await tx.shopProduct.update({
          where: { id: current.id },
          data: {
            titleEn: candidate.title,
            titleUa: ua.titleUa,
            categoryEn: category.en,
            categoryUa: category.ua,
            productType: category.en,
            shortDescEn,
            shortDescUa: ua.shortDescUa,
            longDescEn: plainEnglish,
            longDescUa: ua.longDescUa,
            bodyHtmlEn: candidate.descriptionHtml,
            bodyHtmlUa: ua.bodyHtmlUa,
            seoTitleEn: candidate.title,
            seoTitleUa: ua.titleUa,
            seoDescriptionEn: shortDescEn,
            seoDescriptionUa: ua.shortDescUa,
            priceUsd,
            compareAtUsd,
            image: imageUrls[0],
            gallery: imageUrls,
            tags,
            stock: candidate.outOfStock ? "outOfStock" : "inStock",
            isPublished: true,
            status: "ACTIVE",
          },
        });
        await tx.shopProductVariant.updateMany({
          where: { productId: current.id },
          data: { priceUsd, compareAtUsd, image: imageUrls[0] },
        });
      });
      continue;
    }

    await prisma.shopProduct.create({
      data: {
        slug: slugify(`ducati-akrapovic-${candidate.sku}`),
        sku: candidate.sku,
        scope: "moto",
        brand: "AKRAPOVIC",
        vendor: "Ducati Performance",
        titleEn: candidate.title,
        titleUa: ua.titleUa,
        categoryEn: category.en,
        categoryUa: category.ua,
        productType: category.en,
        shortDescEn,
        shortDescUa: ua.shortDescUa,
        longDescEn: plainEnglish,
        longDescUa: ua.longDescUa,
        bodyHtmlEn: candidate.descriptionHtml,
        bodyHtmlUa: ua.bodyHtmlUa,
        seoTitleEn: candidate.title,
        seoTitleUa: ua.titleUa,
        seoDescriptionEn: shortDescEn,
        seoDescriptionUa: ua.shortDescUa,
        priceUsd,
        compareAtUsd,
        image: imageUrls[0],
        gallery: imageUrls,
        tags,
        stock: candidate.outOfStock ? "outOfStock" : "inStock",
        isPublished: true,
        status: "ACTIVE",
        publishedAt: new Date(),
        variants: {
          create: {
            title: "Default Title",
            sku: candidate.sku,
            position: 1,
            inventoryQty: candidate.outOfStock ? 0 : 5,
            inventoryPolicy: "CONTINUE",
            priceUsd,
            compareAtUsd,
            image: imageUrls[0],
            isDefault: true,
            requiresShipping: true,
            taxable: true,
          },
        },
        media: {
          create: imageUrls.map((src, index) => ({
            mediaType: "IMAGE",
            src,
            position: index + 1,
          })),
        },
      },
    });
  }

  if (invalidComponent?.isPublished) {
    await prisma.shopProduct.update({
      where: { id: invalidComponent.id },
      data: { isPublished: false, status: "ARCHIVED" },
    });
  }

  console.log(
    `Catalog synchronized: ${creates.length} created, ${updates.length} updated, invalid component archived=${Boolean(invalidComponent?.isPublished)}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
