/**
 * Builds data/<brand>/source.json for Dinan or APR from:
 *   data/<brand>/price-list.json   (scripts/supplier-price-list/price-list-to-json.py)
 *   data/<brand>/pages.json        (official product pages collected in a browser session)
 *   data/<brand>/competitor-*.json (Ukrainian competitors' prices, by manufacturer part number)
 *
 *   npx tsx scripts/holley/build-holley-source.ts --brand=dinan --usd-uah=45.986
 *
 * Only Active, priced SKUs are imported; merchandise and dealer tools are left out.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  decideHolleyPriceUsd,
  groupHolleyVariants,
  type HolleyBrandKey,
  type HolleyCollectedPage,
  type HolleyCompetitorPrice,
  type HolleyPriceListItem,
  type HolleyProductGroup,
} from "../../src/lib/holleyBrandCatalog";

const EXCLUDED_CATEGORIES = new Set(["Apparel/Merchandise", "Badges", "Dealer Tools", "Tools"]);

function arg(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
}

type CompetitorFile = {
  source: string;
  products: Array<{
    url: string;
    mpn?: string | null;
    price?: number | null;
    currency?: string | null;
    availability?: string | null;
  }>;
};

async function main() {
  const brand = (arg("brand") ?? "") as HolleyBrandKey;
  if (brand !== "dinan" && brand !== "apr") throw new Error("--brand=dinan|apr is required");
  const usdUah = Number(arg("usd-uah"));
  if (!Number.isFinite(usdUah) || usdUah <= 0) {
    throw new Error("--usd-uah=<storefront UAH per USD> is required to compare competitor prices");
  }
  const dir = path.resolve("data", brand);
  const priceList = JSON.parse(await readFile(path.join(dir, "price-list.json"), "utf8")) as {
    sourceFile: string;
    items: HolleyPriceListItem[];
  };
  const pageList = JSON.parse(await readFile(path.join(dir, "pages.json"), "utf8")) as Array<
    HolleyCollectedPage & { missing?: boolean; error?: string; status?: number }
  >;
  const pages = new Map(
    pageList.filter((page) => !page.missing && !page.error).map((page) => [page.sku, page])
  );
  // The collector asks for vehicle applications once per SKU family (D290-0011-B, -BD, -R…).
  // Versions of one product (same name) share them; differently named parts keep their own
  // "Fits …" line instead (APR CI100038-H fits an RS Q3, not the RS3 of CI100038).
  for (const page of pages.values()) {
    if (page.apps || !page.appsFrom) continue;
    const from = pages.get(page.appsFrom);
    if (from?.apps && from.name.trim() === page.name.trim()) page.apps = from.apps;
  }

  const competitors = new Map<string, HolleyCompetitorPrice[]>();
  for (const file of (await readdir(dir)).filter((name) => name.startsWith("competitor-"))) {
    const data = JSON.parse(await readFile(path.join(dir, file), "utf8")) as CompetitorFile;
    const shop = file.replace(/^competitor-|\.json$/g, "");
    for (const product of data.products) {
      const mpn = String(product.mpn ?? "")
        .trim()
        .toUpperCase();
      if (!mpn || !product.price || product.currency !== "UAH") continue;
      competitors.set(mpn, [
        ...(competitors.get(mpn) ?? []),
        {
          shop,
          url: product.url,
          priceUah: product.price,
          priceUsd: Math.round((product.price / usdUah) * 100) / 100,
          availability: product.availability ?? null,
        },
      ]);
    }
  }

  const items = priceList.items.filter(
    (item) =>
      item.status === "Active" &&
      item.retailUsd &&
      item.retailUsd > 0 &&
      !EXCLUDED_CATEGORIES.has(item.category ?? "")
  );
  const bySku = new Map(items.map((item) => [item.sku, item]));
  const skus = items.map((item) => item.sku);
  const priceListText = new Map(items.map((item) => [item.sku, item.description ?? ""]));
  const groups: HolleyProductGroup[] = groupHolleyVariants(brand, skus, pages, priceListText).map(
    (group) => ({
      id: group.id,
      brand,
      primarySku: group.primarySku,
      optionNames: group.optionNames,
      variants: group.members.map(({ sku, optionValues }) => {
        const item = bySku.get(sku)!;
        const offers = competitors.get(sku.toUpperCase()) ?? [];
        const cheapest = offers.reduce<HolleyCompetitorPrice | null>(
          (best, offer) => (!best || offer.priceUsd < best.priceUsd ? offer : best),
          null
        );
        return {
          sku,
          optionValues,
          priceList: item,
          page: pages.get(sku) ?? null,
          competitor: cheapest,
          price: decideHolleyPriceUsd({
            retailUsd: item.retailUsd!,
            mapUsd: item.mapUsd,
            weightLb: item.weightLb ?? 0,
            competitorUsd: offers.map((offer) => offer.priceUsd),
          }),
        };
      }),
    })
  );

  const withoutPage = groups.filter((group) => !group.variants.some((variant) => variant.page));
  const rules = groups
    .flatMap((group) => group.variants)
    .reduce<Record<string, number>>((acc, variant) => {
      acc[variant.price.rule] = (acc[variant.price.rule] ?? 0) + 1;
      return acc;
    }, {});
  await writeFile(
    path.join(dir, "source.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        brand,
        priceListFile: priceList.sourceFile,
        usdUah,
        groups,
      },
      null,
      1
    )}\n`
  );
  console.log(
    JSON.stringify(
      {
        brand,
        skus: skus.length,
        pages: pages.size,
        groups: groups.length,
        withVariants: groups.filter((group) => group.variants.length > 1).length,
        groupsWithoutPage: withoutPage.map((group) => group.primarySku),
        priceRules: rules,
        competitorMatches: groups
          .flatMap((group) => group.variants)
          .filter((variant) => variant.competitor).length,
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
