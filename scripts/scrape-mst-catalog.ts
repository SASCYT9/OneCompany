import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

import {
  buildMstCatalogProduct,
  canonicalMstSku,
  isRequestedMstProduct,
  senditSkuCandidates,
  type MstOfficialProduct,
  type MstCatalogProduct,
  type MstSenditPrice,
} from "../src/lib/mstCatalog";

const MST_SITEMAP = "https://www.mst-performance.com/sitemap.xml?locale=en";
const SENDIT_SEARCH = "https://sendit.parts/search.php";
const OUTPUT_PATH = path.resolve("data/mst-products.json");
const REPORT_PATH = path.resolve("artifacts/mst-import/scrape-report.json");

type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  image?: string | string[];
  offers?: { availability?: string; price?: string | number; priceCurrency?: string };
};

type SenditSearchCard = {
  sku: string;
  title: string;
  url: string;
};

const PRICING_FORMULA = {
  expression: "ceil((round(Sendit inc. VAT GBP × 1.10, 2) × 1.37) / 5) × 5",
  markupPct: 10,
  gbpToUsdRate: 1.37,
  usdRounding: "up to the next multiple of 5",
  baseCurrency: "USD",
} as const;

function money(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchText(url: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "OneCompany MST catalog research/1.0" },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error(`${url}: ${(lastError as Error)?.message ?? String(lastError)}`);
}

async function mapConcurrent<T, U>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<U>
) {
  const results = new Array<U>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

function productJsonLd(html: string) {
  const $ = load(html);
  for (const element of $("script[type='application/ld+json']").get()) {
    try {
      const value = JSON.parse($(element).html() ?? "null") as JsonLdProduct;
      if (value?.["@type"] === "Product") return value;
    } catch {
      // Ignore unrelated invalid JSON-LD blocks and continue to the Product block.
    }
  }
  return null;
}

async function loadOfficialProducts() {
  const sitemap = await fetchText(MST_SITEMAP);
  const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1])
    .filter((url) => url.includes("/products/"))
    .map((url) => url.replace(/&amp;/g, "&"));
  const candidateUrls = urls.filter((url) => {
    const handle = new URL(url).pathname.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";
    return (handle.startsWith("bw-") || handle.startsWith("ty-sup")) && !handle.endsWith("dp");
  });
  const parsed = await mapConcurrent(candidateUrls, 6, async (officialUrl) => {
    const handle = new URL(officialUrl).pathname.split("/").filter(Boolean).at(-1)!.toLowerCase();
    const product = productJsonLd(await fetchText(officialUrl));
    if (!product?.name) throw new Error(`MST Product JSON-LD is missing for ${officialUrl}`);
    const images = Array.isArray(product.image)
      ? product.image
      : product.image
        ? [product.image]
        : [];
    return {
      handle,
      officialUrl,
      titleEn: product.name.replace(/\s+/g, " ").trim(),
      images,
      manufacturerAvailability: product.offers?.availability ?? null,
    } satisfies MstOfficialProduct;
  });
  return {
    sitemapProductCount: urls.length,
    candidateCount: candidateUrls.length,
    products: parsed.filter((product) => isRequestedMstProduct(product.handle, product.titleEn)),
    excluded: parsed
      .filter((product) => !isRequestedMstProduct(product.handle, product.titleEn))
      .map((product) => ({ handle: product.handle, title: product.titleEn })),
  };
}

function parseSearchCards(html: string): SenditSearchCard[] {
  const $ = load(html);
  return $("article.card")
    .map((_, element) => {
      const card = $(element);
      const link = card.find(".card-title a").first();
      return {
        sku: card
          .find(".card-text--sku")
          .text()
          .replace(/^\s*SKU:\s*/i, "")
          .trim()
          .toUpperCase(),
        title: link.text().replace(/\s+/g, " ").trim(),
        url: link.attr("href")?.trim() ?? "",
      };
    })
    .get()
    .filter((card) => card.sku && /^https:\/\//i.test(card.url));
}

async function findSenditCard(sku: string) {
  const candidates = senditSkuCandidates(sku);
  const query = candidates.at(-1) ?? sku;
  const searchUrl = `${SENDIT_SEARCH}?search_query=${encodeURIComponent(query)}&section=product`;
  const cards = parseSearchCards(await fetchText(searchUrl));
  const matches = cards.filter((card) => candidates.includes(card.sku));
  if (matches.length > 1) {
    const identities = new Set(matches.map((match) => `${match.sku}|${match.url}`));
    if (identities.size > 1) throw new Error(`Ambiguous Sendit SKU match for ${sku}`);
  }
  return matches[0] ?? null;
}

async function loadSenditPrice(card: SenditSearchCard): Promise<MstSenditPrice> {
  const html = await fetchText(card.url);
  const $ = load(html);
  const pageSku = $("[data-product-sku]").first().text().trim().toUpperCase();
  if (pageSku && pageSku !== card.sku) {
    throw new Error(`Sendit page SKU mismatch: expected ${card.sku}, received ${pageSku}`);
  }
  const incVatGbp = money(
    $(".productView-price [data-product-price-with-tax]").first().text().trim()
  );
  if (!incVatGbp) throw new Error(`Sendit inc. VAT price missing for ${card.sku}`);
  const exVatGbp = money(
    $(".productView-price [data-product-price-without-tax]").first().text().trim()
  );
  const jsonLd = productJsonLd(html);
  const offerPrice = Number(jsonLd?.offers?.price);
  if (Number.isFinite(offerPrice) && Math.abs(offerPrice - incVatGbp) > 0.011) {
    throw new Error(`Sendit visible/JSON-LD price mismatch for ${card.sku}`);
  }
  return {
    matchedSku: card.sku,
    url: card.url,
    title: card.title,
    incVatGbp,
    exVatGbp,
    availability: jsonLd?.offers?.availability ?? null,
  };
}

async function main() {
  if (process.argv.includes("--refresh-derived")) {
    const existing = JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as {
      products: MstCatalogProduct[];
      [key: string]: unknown;
    };
    const products = existing.products
      .filter((product) => product.pricing.status === "matched" && product.source.senditUrl)
      .map((product) =>
        buildMstCatalogProduct(
          {
            handle: product.handle,
            officialUrl: product.source.officialUrl,
            titleEn: product.titleEn,
            images: product.images,
            manufacturerAvailability: product.source.manufacturerAvailability,
          },
          {
            matchedSku: product.source.senditMatchedSku ?? product.sku,
            url: product.source.senditUrl!,
            title: product.titleEn,
            incVatGbp: product.pricing.sourceIncVatGbp!,
            exVatGbp: product.pricing.sourceExVatGbp,
            availability: product.source.senditAvailability,
          }
        )
      );
    const generatedAt = new Date().toISOString();
    const refreshed = {
      ...existing,
      generatedAt,
      pricingFormula: PRICING_FORMULA,
      products,
    };
    const existingReport = await readFile(REPORT_PATH, "utf8")
      .then((value) => JSON.parse(value) as Record<string, unknown>)
      .catch(() => null);
    const refreshedReport = existingReport
      ? {
          ...existingReport,
          generatedAt,
          catalogProducts: products.length,
          pricedProducts: products.length,
          categories: {
            intake: products.filter((product) => product.categoryKey === "intake").length,
            turboPipes: products.filter((product) => product.categoryKey === "turbo-pipes").length,
          },
          formulaExample: products.find((product) => product.sku === "BW-M3401")?.pricing ?? null,
        }
      : null;
    await Promise.all([
      writeFile(OUTPUT_PATH, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8"),
      ...(refreshedReport
        ? [writeFile(REPORT_PATH, `${JSON.stringify(refreshedReport, null, 2)}\n`, "utf8")]
        : []),
    ]);
    process.stdout.write(
      `${JSON.stringify({
        outputPath: OUTPUT_PATH,
        products: products.length,
        pricedProducts: products.filter((product) => product.pricing.status === "matched").length,
        productsWithImages: products.filter((product) => product.images.length > 0).length,
      })}\n`
    );
    return;
  }
  const official = await loadOfficialProducts();
  const results = await mapConcurrent(official.products, 5, async (product) => {
    try {
      const card = await findSenditCard(canonicalMstSku(product.handle));
      return { product, sendit: card ? await loadSenditPrice(card) : null, error: null };
    } catch (error) {
      return { product, sendit: null, error: (error as Error).message };
    }
  });
  const allProducts = results
    .map(({ product, sendit }) => buildMstCatalogProduct(product, sendit))
    .sort((left, right) => left.sku.localeCompare(right.sku));
  const missingPricing = allProducts
    .filter((product) => product.pricing.status === "missing")
    .map((product) => ({
      sku: product.sku,
      title: product.titleEn,
      officialUrl: product.source.officialUrl,
      scrapeError:
        results.find((result) => result.product.handle === product.handle)?.error ?? null,
    }));
  const products = allProducts.filter((product) => product.pricing.status === "matched");
  const generatedAt = new Date().toISOString();
  const output = {
    schemaVersion: 1,
    generatedAt,
    requestScope:
      "MST intake systems plus turbo inlet and boost pipes for BMW and Toyota Supra A90/A91",
    pricingFormula: PRICING_FORMULA,
    sources: {
      assortment: MST_SITEMAP,
      pricing: "https://sendit.parts/",
    },
    products,
  };
  const report = {
    generatedAt,
    officialSitemapProducts: official.sitemapProductCount,
    officialBmwSupraCandidates: official.candidateCount,
    requestedProducts: allProducts.length,
    catalogProducts: products.length,
    pricedProducts: products.length,
    missingPricing,
    categories: {
      intake: products.filter((product) => product.categoryKey === "intake").length,
      turboPipes: products.filter((product) => product.categoryKey === "turbo-pipes").length,
    },
    excluded: official.excluded,
    formulaExample: products.find((product) => product.sku === "BW-M3401")?.pricing ?? null,
  };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await Promise.all([
    writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);
  process.stdout.write(
    `${JSON.stringify({ outputPath: OUTPUT_PATH, reportPath: REPORT_PATH, ...report }, null, 2)}\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
