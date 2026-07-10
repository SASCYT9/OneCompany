import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { chromium, type Page } from "playwright";

dotenv.config({ path: ".env.local" });

const AMS_BRAND_URL = "https://amsducati.com/brands/akrapovic";
const COMMIT = process.argv.includes("--commit");
const prisma = new PrismaClient();

// AMS and official Ducati product pages explicitly group these Ducati numbers
// under the same catalog item. Keep this narrow and evidence-based.
const AMS_SKU_ALIASES: Record<string, string[]> = {
  "96481775DA": ["96482441BA"],
  "96482292AA": ["96482291AA", "96482293BA"],
  "96482292BA": ["96482291BA"],
};

type AmsProduct = {
  sku: string;
  title: string;
  url: string;
  priceUsd: number;
  compareAtUsd: number | null;
};

function parseUsd(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractDucatiSku(value: string) {
  const matches = value.toUpperCase().match(/\b\d{8}[A-Z]{1,2}\b/g);
  return matches?.at(-1) ?? null;
}

async function scrapePage(page: Page, url: string): Promise<AmsProduct[]> {
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
      };
    })
  );

  return cards.flatMap((card) => {
    const sku = extractDucatiSku(card.title);
    const priceUsd = parseUsd(card.currentPrice);
    if (!sku || !priceUsd || !card.url) return [];

    return [
      {
        sku,
        title: card.title,
        url: card.url,
        priceUsd,
        compareAtUsd: parseUsd(card.compareAtPrice),
      },
    ];
  });
}

async function scrapeAmsCatalog() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ locale: "en-US" });

  try {
    const products: AmsProduct[] = [];
    for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
      const url = pageNumber === 1 ? AMS_BRAND_URL : `${AMS_BRAND_URL}?p=${pageNumber}`;
      const rows = await scrapePage(page, url);
      if (rows.length === 0) break;

      const previousUrls = new Set(products.map((product) => product.url));
      const freshRows = rows.filter((row) => !previousUrls.has(row.url));
      if (freshRows.length === 0) break;
      products.push(...freshRows);

      const hasNext = await page.locator("a.action.next").count();
      if (!hasNext) break;
    }

    return products;
  } finally {
    await browser.close();
  }
}

async function main() {
  const sourceProducts = await scrapeAmsCatalog();
  const sourceBySku = new Map(sourceProducts.map((product) => [product.sku, product]));
  const aliasSkus = new Set<string>();
  for (const [sourceSku, aliases] of Object.entries(AMS_SKU_ALIASES)) {
    const source = sourceBySku.get(sourceSku);
    if (!source) continue;
    for (const alias of aliases) {
      sourceBySku.set(alias, source);
      aliasSkus.add(alias);
    }
  }
  const [settings, products] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { key: "shop" }, select: { currencyRates: true } }),
    prisma.shopProduct.findMany({
      where: {
        scope: "moto",
        brand: { contains: "akrap", mode: "insensitive" },
        OR: [{ tags: { has: "Ducati" } }, { tags: { has: "fits-make:ducati" } }],
      },
      select: {
        id: true,
        sku: true,
        slug: true,
        titleEn: true,
        priceUsd: true,
        priceEur: true,
        variants: { select: { id: true, sku: true, priceUsd: true } },
      },
      orderBy: { sku: "asc" },
    }),
  ]);
  const currencyRates = (settings?.currencyRates ?? {}) as Record<string, unknown>;
  const eurToUsd = Number(currencyRates.USD) || 0;

  const matched = products.flatMap((product) => {
    const sku = product.sku?.trim().toUpperCase();
    const source = sku ? sourceBySku.get(sku) : null;
    if (!sku || !source) return [];
    const currentUsd = product.priceUsd ? Number(product.priceUsd) : null;
    const currentEur = product.priceEur ? Number(product.priceEur) : null;
    const currentDisplayUsd = currentUsd ?? (currentEur && eurToUsd ? currentEur * eurToUsd : null);
    return [
      {
        id: product.id,
        sku,
        slug: product.slug,
        title: product.titleEn,
        currentUsd,
        currentEur,
        currentDisplayUsd: currentDisplayUsd ? Math.round(currentDisplayUsd * 100) / 100 : null,
        amsUsd: source.priceUsd,
        differenceUsd: currentDisplayUsd
          ? Math.round((source.priceUsd - currentDisplayUsd) * 100) / 100
          : null,
        differencePercent: currentDisplayUsd
          ? Math.round((source.priceUsd / currentDisplayUsd - 1) * 100 * 100) / 100
          : null,
        compareAtUsd: source.compareAtUsd,
        sourceUrl: source.url,
        matchType: aliasSkus.has(sku) ? "verified-alias" : "exact",
        variantIds: product.variants.map((variant) => variant.id),
        changed: currentUsd !== source.priceUsd,
      },
    ];
  });
  const matchedSkus = new Set(matched.map((row) => row.sku));
  const unmatched = products
    .map((product) => product.sku)
    .filter((sku) => sku && !matchedSkus.has(sku));
  const representedSourceUrls = new Set(matched.map((row) => row.sourceUrl));
  const missingFromDatabase = sourceProducts.filter(
    (source) => !representedSourceUrls.has(source.url)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? "commit" : "dry-run",
    source: AMS_BRAND_URL,
    sourceProducts: sourceProducts.length,
    databaseProducts: products.length,
    exactMatches: matched.filter((row) => row.matchType === "exact").length,
    aliasMatches: matched.filter((row) => row.matchType === "verified-alias").length,
    changed: matched.filter((row) => row.changed).length,
    unmatchedSkus: unmatched,
    missingFromDatabase: missingFromDatabase.map((source) => ({
      sku: source.sku,
      title: source.title,
      priceUsd: source.priceUsd,
      compareAtUsd: source.compareAtUsd,
      sourceUrl: source.url,
    })),
    products: matched.map(({ id: _id, variantIds: _variantIds, ...row }) => row),
  };

  const outputDir = path.join(process.cwd(), "tmp", "amsducati-akrapovic");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "latest.json");
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.table(
    report.products.map((row) => ({
      sku: row.sku,
      currentUsd: row.currentDisplayUsd ?? "missing",
      amsUsd: row.amsUsd,
      difference: row.differencePercent == null ? "" : `${row.differencePercent}%`,
      sale: row.compareAtUsd ? `${row.compareAtUsd} -> ${row.amsUsd}` : "",
      match: row.matchType,
      changed: row.changed,
    }))
  );
  console.log(`AMS products: ${report.sourceProducts}`);
  console.log(`Ducati Akrapovic DB products: ${report.databaseProducts}`);
  console.log(`Exact SKU matches: ${report.exactMatches}`);
  console.log(`Verified alias matches: ${report.aliasMatches}`);
  console.log(`Unmatched SKUs: ${report.unmatchedSkus.join(", ") || "none"}`);
  console.log(`AMS products missing from DB: ${report.missingFromDatabase.length}`);
  console.log(`Report: ${outputPath}`);

  if (!COMMIT) {
    console.log("Dry run only. Re-run with --commit to write exact AMS USD prices.");
    return;
  }

  const changed = matched.filter((row) => row.changed);
  const backupDir = path.join(process.cwd(), "backups", "amsducati-akrapovic");
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(
    path.join(backupDir, `before-${stamp}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  await prisma.$transaction(async (tx) => {
    for (const row of changed) {
      const priceUsd = new Prisma.Decimal(row.amsUsd);
      await tx.shopProduct.update({ where: { id: row.id }, data: { priceUsd } });
      if (row.variantIds.length > 0) {
        await tx.shopProductVariant.updateMany({
          where: { id: { in: row.variantIds } },
          data: { priceUsd },
        });
      }
    }
  });

  console.log(`Updated ${changed.length} products and their variants.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
