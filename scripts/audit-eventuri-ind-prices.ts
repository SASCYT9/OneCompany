import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildProductsFromShopifyCsv } from "../src/lib/shopAdminCsv";

type IndProduct = {
  title?: string;
  handle?: string;
  variants?: Array<{ sku?: string; price?: string }>;
};

const prisma = new PrismaClient();
const source = path.resolve(process.argv[2] ?? "D:\\products_export_EVENTURI.csv");
const outputDir = path.resolve(process.argv[3] ?? "artifacts/eventuri-import");

function number(value: unknown) {
  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(parsed) ? parsed : null;
}

async function main() {
  const parsed = buildProductsFromShopifyCsv(await readFile(source, "utf8"));
  const response = await fetch(
    "https://ind-distribution.com/collections/eventuri/products.json?limit=250"
  );
  if (!response.ok) throw new Error(`IND Distribution HTTP ${response.status}`);
  const payload = (await response.json()) as { products?: IndProduct[] };
  const indProducts = payload.products ?? [];
  const indBySku = new Map<string, { usd: number; title: string; handle: string }>();
  for (const product of indProducts) {
    for (const variant of product.variants ?? []) {
      const sku = String(variant.sku ?? "")
        .trim()
        .toUpperCase();
      const usd = number(variant.price);
      if (sku && usd !== null)
        indBySku.set(sku, { usd, title: product.title ?? "", handle: product.handle ?? "" });
    }
  }
  const settings = await prisma.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  const rates = (settings?.currencyRates ?? {}) as Record<string, unknown>;
  const uahPerUsd =
    number(rates.UAH) && number(rates.USD) ? Number(rates.UAH) / Number(rates.USD) : 46;
  const usdRate = number(rates.USD) || 1.152174;
  const markup = 1.1;
  const rows = parsed.products.flatMap((product) =>
    product.variants.map((variant) => ({
      slug: product.slug,
      sku: String(variant.sku ?? "")
        .trim()
        .toUpperCase(),
      csvUah: number(variant.priceUah),
    }))
  );
  const matches = rows.flatMap((row) => {
    const ind = indBySku.get(row.sku);
    if (!ind) return [];
    const convertedUah = ind.usd * uahPerUsd;
    return [
      {
        ...row,
        indUsd: ind.usd,
        proposedUsd: Number((ind.usd * markup).toFixed(2)),
        proposedEur: Number(((ind.usd * markup) / usdRate).toFixed(2)),
        proposedUah: Number((ind.usd * markup * uahPerUsd).toFixed(2)),
        convertedUah: Number(convertedUah.toFixed(2)),
        deltaPct:
          row.csvUah && convertedUah
            ? Number(((row.csvUah / convertedUah - 1) * 100).toFixed(2))
            : null,
        indTitle: ind.title,
        indHandle: ind.handle,
      },
    ];
  });
  const missing = rows.filter((row) => !indBySku.has(row.sku));
  const nonZero = matches.filter(
    (row) => row.csvUah !== null && row.csvUah > 0 && row.indUsd > 0 && row.deltaPct !== null
  );
  const averageDeltaPct = nonZero.length
    ? Number(
        (nonZero.reduce((sum, row) => sum + (row.deltaPct ?? 0), 0) / nonZero.length).toFixed(2)
      )
    : null;
  const report = {
    generatedAt: new Date().toISOString(),
    source,
    indSource: "https://ind-distribution.com/collections/eventuri/products.json?limit=250",
    indCollection: "https://ind-distribution.com/collections/eventuri",
    rates: { ...rates, uahPerUsd },
    counts: {
      csvRows: parsed.totalRows,
      csvProducts: parsed.products.length,
      csvVariants: parsed.variantsCount,
      indProducts: indProducts.length,
      indVariants: indBySku.size,
      matchedRows: matches.length,
      matchedUniqueSkus: new Set(matches.map((row) => row.sku)).size,
      missingRows: missing.length,
      missingUniqueSkus: new Set(missing.map((row) => row.sku)).size,
    },
    pricing: {
      nonZeroMatchedRows: nonZero.length,
      markupPct: 10,
      averageCsvMarkupPctOverIndConverted: averageDeltaPct,
      minDeltaPct: nonZero.length ? Math.min(...nonZero.map((row) => row.deltaPct ?? 0)) : null,
      maxDeltaPct: nonZero.length ? Math.max(...nonZero.map((row) => row.deltaPct ?? 0)) : null,
    },
    matches,
    missing,
  };
  await mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, "ind-distribution-price-audit.json");
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ file, counts: report.counts, pricing: report.pricing }, null, 2));
}

main().finally(() => prisma.$disconnect());
