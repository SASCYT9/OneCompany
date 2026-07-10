import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractProductFitment, isExpectedChassisForMakeModel } from "../src/lib/crossShopFitment";
import { getShopProductsServer } from "../src/lib/shopCatalogServer";
import { buildShopSearchText, normalizeShopSearchText } from "../src/lib/shopSearch";
import {
  enrichVehicleSearchFromCatalog,
  expandVehicleAliases,
  scoreVehicleSearchItem,
  type ShopVehicleSearchItem,
} from "../src/lib/shopVehicleSearch";
import { vehicleYearRangeContains } from "../src/lib/shopVehicleYears";

const TARGET_CASES = 120;
const SUCCESS_RANK = 10;

type IndexedProduct = ShopVehicleSearchItem & {
  slug: string;
  title: string;
  fitment: ReturnType<typeof extractProductFitment>;
};

type BenchmarkCandidate = {
  query: string;
  make: string;
  model: string;
  year: number;
};

function representativeYear(from: number, to: number | null) {
  if (to === null) return Math.max(from, new Date().getFullYear() - 2);
  return Math.floor((from + to) / 2);
}

function buildIndex() {
  return getShopProductsServer().then((products) =>
    products.map((product): IndexedProduct => {
      const fitment = extractProductFitment(product);
      const title = product.title.ua || product.title.en || product.slug;
      const titleText = buildShopSearchText([product.title.en, product.title.ua]);
      const searchText = buildShopSearchText([
        product.title.en,
        product.title.ua,
        product.sku,
        product.slug,
        product.brand,
        product.vendor,
        product.productType,
        product.category.ua,
        product.category.en,
        product.collection.ua,
        product.collection.en,
        ...(product.tags ?? []),
        fitment.make,
        ...fitment.models,
        ...fitment.chassisCodes,
      ]);
      const fitmentText = buildShopSearchText([
        fitment.make,
        ...fitment.models,
        ...fitment.chassisCodes,
        ...fitment.yearRanges.map((range) => `${range.from}-${range.to ?? "+"}`),
      ]);
      return {
        slug: product.slug,
        title,
        fitment,
        searchText,
        titleText,
        skuText: buildShopSearchText([product.sku]),
        compactSkuText: "",
        fitmentText,
        yearRanges: fitment.yearRanges,
        fitmentMake: fitment.make,
      };
    })
  );
}

function selectCases(index: IndexedProduct[]) {
  const byMake = new Map<string, BenchmarkCandidate[]>();
  const seen = new Set<string>();
  for (const item of index) {
    if (!item.fitment.make || !item.fitment.models.length || !item.fitment.yearRanges.length)
      continue;
    for (const model of item.fitment.models) {
      for (const range of item.fitment.yearRanges) {
        const year = representativeYear(range.from, range.to);
        const query = `${item.fitment.make} ${model} ${year}`;
        const key = normalizeShopSearchText(query);
        if (seen.has(key)) continue;
        seen.add(key);
        const candidates = byMake.get(item.fitment.make) ?? [];
        candidates.push({ query, make: item.fitment.make, model, year });
        byMake.set(item.fitment.make, candidates);
      }
    }
  }

  const selected: BenchmarkCandidate[] = [];
  const groups = Array.from(byMake.values()).sort((left, right) => right.length - left.length);
  for (let round = 0; selected.length < TARGET_CASES; round += 1) {
    let added = false;
    for (const group of groups) {
      if (!group[round]) continue;
      selected.push(group[round]);
      added = true;
      if (selected.length >= TARGET_CASES) break;
    }
    if (!added) break;
  }
  return selected;
}

function isRelevant(item: IndexedProduct, candidate: BenchmarkCandidate) {
  return (
    normalizeShopSearchText(item.fitment.make) === normalizeShopSearchText(candidate.make) &&
    item.fitment.models.some(
      (model) => normalizeShopSearchText(model) === normalizeShopSearchText(candidate.model)
    ) &&
    item.fitment.yearRanges.some((range) => vehicleYearRangeContains(range, candidate.year))
  );
}

async function main() {
  const index = await buildIndex();
  const cases = selectCases(index);
  const results = cases.map((candidate) => {
    const expanded = enrichVehicleSearchFromCatalog(expandVehicleAliases(candidate.query), index, {
      isExpectedChassis: isExpectedChassisForMakeModel,
    });
    const ranked = index
      .map((item) => ({ item, score: scoreVehicleSearchItem(item, expanded).score }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
    const relevantIndex = ranked.findIndex((entry) => isRelevant(entry.item, candidate));
    const rank = relevantIndex >= 0 ? relevantIndex + 1 : null;
    return {
      ...candidate,
      pass: rank !== null && rank <= SUCCESS_RANK,
      firstRelevantRank: rank,
      resultCount: ranked.length,
      topResult: ranked[0]
        ? { slug: ranked[0].item.slug, title: ranked[0].item.title, score: ranked[0].score }
        : null,
    };
  });

  const passed = results.filter((result) => result.pass).length;
  const report = {
    generatedAt: new Date().toISOString(),
    targetRank: SUCCESS_RANK,
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? Number(((passed / results.length) * 100).toFixed(1)) : 0,
    results,
  };
  const outputDirectory = path.join(process.cwd(), "artifacts", "stock-search-benchmark");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "vehicle-search-benchmark.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  const failedRows = results
    .filter((result) => !result.pass)
    .map(
      (result) =>
        `| ${result.query} | ${result.firstRelevantRank ?? "none"} | ${result.topResult?.title ?? "no results"} |`
    );
  await writeFile(
    path.join(outputDirectory, "vehicle-search-benchmark.md"),
    [
      "# Vehicle Search Benchmark",
      "",
      `Generated: ${report.generatedAt}`,
      `Pass rate: ${report.passed}/${report.total} (${report.passRate}%) within top ${SUCCESS_RANK}.`,
      "",
      "## Failed cases",
      "",
      "| Query | First relevant rank | Top result |",
      "| --- | ---: | --- |",
      ...failedRows,
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(
    JSON.stringify(
      {
        outputDirectory,
        total: report.total,
        passed: report.passed,
        failed: report.failed,
        passRate: `${report.passRate}%`,
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
