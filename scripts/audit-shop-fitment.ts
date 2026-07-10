import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractProductFitment } from "../src/lib/crossShopFitment";
import {
  classifyProductFitment,
  type NormalizedFitmentStatus,
} from "../src/lib/shopFitmentQuality";
import { getShopProductsServer } from "../src/lib/shopCatalogServer";

type Coverage = {
  total: number;
  make: number;
  model: number;
  chassis: number;
  year: number;
  unknown: number;
  high: number;
  medium: number;
  low: number;
};

type ClassificationCounts = Record<NormalizedFitmentStatus, number>;

const emptyClassificationCounts = (): ClassificationCounts => ({
  inferred: 0,
  verified: 0,
  universal: 0,
  needs_review: 0,
});

const emptyCoverage = (): Coverage => ({
  total: 0,
  make: 0,
  model: 0,
  chassis: 0,
  year: 0,
  unknown: 0,
  high: 0,
  medium: 0,
  low: 0,
});

function addCoverage(coverage: Coverage, fitment: ReturnType<typeof extractProductFitment>) {
  coverage.total += 1;
  if (fitment.make) coverage.make += 1;
  if (fitment.models.length > 0) coverage.model += 1;
  if (fitment.chassisCodes.length > 0) coverage.chassis += 1;
  if (fitment.yearRanges.length > 0) coverage.year += 1;
  coverage[fitment.confidence] += 1;
}

const percentage = (count: number, total: number) =>
  total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%";

async function main() {
  const products = await getShopProductsServer();
  const overall = emptyCoverage();
  const classifications = emptyClassificationCounts();
  const byBrand = new Map<string, Coverage>();
  const reviewByBrand = new Map<string, number>();
  const unknownSamples: Array<{ brand: string; sku: string; title: string }> = [];

  for (const product of products) {
    const fitment = extractProductFitment(product);
    const classification = classifyProductFitment(product, fitment);
    addCoverage(overall, fitment);
    classifications[classification.status] += 1;

    const brand = String(product.brand || product.vendor || "Unknown").trim() || "Unknown";
    const brandCoverage = byBrand.get(brand) ?? emptyCoverage();
    addCoverage(brandCoverage, fitment);
    byBrand.set(brand, brandCoverage);
    if (classification.status === "needs_review") {
      reviewByBrand.set(brand, (reviewByBrand.get(brand) ?? 0) + 1);
    }

    if (fitment.confidence === "unknown" && unknownSamples.length < 250) {
      unknownSamples.push({
        brand,
        sku: String(product.sku || ""),
        title: String(product.title?.ua || product.title?.en || ""),
      });
    }
  }

  const brands = Array.from(byBrand, ([brand, coverage]) => ({ brand, ...coverage })).sort(
    (left, right) => right.total - left.total
  );
  const report = {
    generatedAt: new Date().toISOString(),
    overall,
    classifications,
    brands,
    reviewByBrand: Array.from(reviewByBrand, ([brand, count]) => ({ brand, count })).sort(
      (left, right) => right.count - left.count
    ),
    unknownSamples,
  };

  const outputDirectory = path.join(process.cwd(), "artifacts", "stock-fitment-audit");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "fitment-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  const lines = [
    "# Stock Fitment Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Overall coverage",
    "",
    "| Signal | Products | Coverage |",
    "| --- | ---: | ---: |",
    `| Make | ${overall.make} | ${percentage(overall.make, overall.total)} |`,
    `| Model | ${overall.model} | ${percentage(overall.model, overall.total)} |`,
    `| Chassis | ${overall.chassis} | ${percentage(overall.chassis, overall.total)} |`,
    `| Year | ${overall.year} | ${percentage(overall.year, overall.total)} |`,
    `| High confidence | ${overall.high} | ${percentage(overall.high, overall.total)} |`,
    `| Medium confidence | ${overall.medium} | ${percentage(overall.medium, overall.total)} |`,
    `| Low confidence | ${overall.low} | ${percentage(overall.low, overall.total)} |`,
    `| Unknown | ${overall.unknown} | ${percentage(overall.unknown, overall.total)} |`,
    "",
    "## Workflow classification",
    "",
    "| Status | Products | Share |",
    "| --- | ---: | ---: |",
    `| Inferred | ${classifications.inferred} | ${percentage(classifications.inferred, overall.total)} |`,
    `| Universal | ${classifications.universal} | ${percentage(classifications.universal, overall.total)} |`,
    `| Needs review | ${classifications.needs_review} | ${percentage(classifications.needs_review, overall.total)} |`,
    `| Verified | ${classifications.verified} | ${percentage(classifications.verified, overall.total)} |`,
    "",
    "## Coverage by brand",
    "",
    "| Brand | Total | Make | Model | Chassis | Year | Unknown |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...brands.map(
      (brand) =>
        `| ${brand.brand} | ${brand.total} | ${brand.make} | ${brand.model} | ${brand.chassis} | ${brand.year} | ${brand.unknown} |`
    ),
    "",
    "Unknown product samples are available in `fitment-audit.json`.",
    "",
  ];
  await writeFile(path.join(outputDirectory, "fitment-audit.md"), lines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        outputDirectory,
        total: overall.total,
        make: `${overall.make} (${percentage(overall.make, overall.total)})`,
        model: `${overall.model} (${percentage(overall.model, overall.total)})`,
        chassis: `${overall.chassis} (${percentage(overall.chassis, overall.total)})`,
        year: `${overall.year} (${percentage(overall.year, overall.total)})`,
        unknown: `${overall.unknown} (${percentage(overall.unknown, overall.total)})`,
        classifications,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
