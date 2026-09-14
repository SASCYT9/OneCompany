import fs from "node:fs";
import path from "node:path";
import {
  SHOP_SEARCH_QUERY_MAX_LENGTH,
  canonicalizeShopSearchQuery,
  matchesShopSearchQuery,
  matchesShopSearchToken,
  tokenizeShopSearchQuery,
} from "../src/lib/shopSearch";
import {
  compactShopCode,
  expandVehicleAliases,
  parseVehicleSearchQuery,
} from "../src/lib/shopVehicleSearch";
import {
  computeRelevanceScoreWithReasons,
  narrowVehicleSearchResults,
  filterShopStockSearchCandidates,
} from "../src/lib/shopStockSearchMatching";
import { shouldIncludeStockSuggestionMatch } from "../src/lib/shopStockSuggestion";
import { getKwCardTitle } from "../src/lib/shopKwCardPresentation";

// Read-only self-retrieval audit of the public local snapshot. These checks
// measure matching eligibility, not live database coverage or ranking.
process.env.NODE_ENV = "development";
process.env.SHOP_LOCAL_CATALOG_SNAPSHOT = "1";
process.env.DATABASE_URL = "";
process.env.DIRECT_URL = "";
async function main() {
  const { getShopProductsWithFitments } = await import("../src/lib/shopStockSearch.server");
  const items = await getShopProductsWithFitments();
  const failures: Array<Record<string, unknown>> = [];
  const totals: Record<string, number> = {};
  let cardTitleChecks = 0;
  let skuChecks = 0;
  for (const item of items) {
    for (const locale of ["ua", "en"] as const) {
      const title = item.product.title?.[locale];
      if (!title) continue;
      const query = canonicalizeShopSearchQuery(title);
      const tokens = [...new Set(tokenizeShopSearchQuery(query))];
      const expansion = expandVehicleAliases(query);
      const scored = computeRelevanceScoreWithReasons(item, tokens, query, expansion);
      const intent = parseVehicleSearchQuery(title);
      const reasons: string[] = [];
      if (!matchesShopSearchQuery(item.searchText, title)) reasons.push("own_title_token_mismatch");
      if (
        !shouldIncludeStockSuggestionMatch({
          strictSkuQuery: intent === "sku",
          tokenCount: tokens.length,
          tokenMatches: tokens.filter((token) => matchesShopSearchToken(item.searchText, token))
            .length,
          compactQuery: compactShopCode(query),
          compactSku: item.compactSkuText,
          allowCompactSkuMatch: intent !== "vehicle" && intent !== "mixed",
        })
      )
        reasons.push("suggestion_excludes_own_title");
      if (narrowVehicleSearchResults([{ ...item, score: scored.score }], expansion).length === 0)
        reasons.push("alias_filter_excludes_own_title_before_catalog_enrichment");
      if (title.length > SHOP_SEARCH_QUERY_MAX_LENGTH)
        reasons.push("projection_suggest_query_over_limit");
      const cardTitle = getKwCardTitle({ title, brand: item.product.brand, locale });
      if (cardTitle !== title) {
        cardTitleChecks++;
        if (!matchesShopSearchQuery(item.searchText, cardTitle))
          reasons.push("displayed_card_title_mismatch");
      }
      for (const reason of reasons) totals[reason] = (totals[reason] ?? 0) + 1;
      if (reasons.length)
        failures.push({
          sku: item.product.sku,
          slug: item.product.slug,
          scope: item.vehicleScope,
          locale,
          title,
          reasons,
          intent,
          aliases: expansion.aliasIds,
        });
    }
    for (const sku of new Set<string>(
      [
        item.product.sku,
        ...(item.product.variants ?? []).map((variant: { sku?: string }) => variant.sku),
      ].filter(Boolean)
    )) {
      skuChecks++;
      const expansion = expandVehicleAliases(sku);
      if (!filterShopStockSearchCandidates([{ ...item, score: 1 }], expansion).length) {
        totals.sku_excludes_own_product = (totals.sku_excludes_own_product ?? 0) + 1;
        failures.push({ sku, slug: item.product.slug, reasons: ["sku_excludes_own_product"] });
      }
    }
  }
  const output = process.argv[2] ?? "artifacts/search-audit.json";
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    snapshotProducts: items.length,
    titleChecks: items.reduce(
      (n, item) =>
        n + Number(Boolean(item.product.title?.ua)) + Number(Boolean(item.product.title?.en)),
      0
    ),
    cardTitleChecks,
    skuChecks,
    totals,
    failures,
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, failures: failures.slice(0, 8) }, null, 2));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
