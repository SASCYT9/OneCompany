import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { Prisma, PrismaClient } from "@prisma/client";

import { getShopCatalogCardPricingByIds } from "../../../src/lib/shopCatalogCardPricing.server";
import { buildShopCatalogEffectivePriceContext } from "../../../src/lib/shopCatalogEffectivePrice.server";
import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "../../../src/lib/shopPricingAudience";

const url =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)
) {
  throw new Error(
    "Effective projection-price integration requires the same explicitly disposable localhost database"
  );
}

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const rates = { EUR: 1, USD: 2, UAH: 40 } as const;
const settings = buildShopSettingsRuntimeFromPayload({
  b2bVisibilityMode: "approved_only",
  defaultB2bDiscountPercent: 10,
  defaultCurrency: "EUR",
  enabledCurrencies: ["EUR", "USD", "UAH"],
  currencyRates: rates,
  shippingZones: [],
  taxRegions: [],
  orderNotificationEmail: null,
  b2bNotes: null,
} as never);

type Card = Awaited<ReturnType<typeof getShopCatalogCardPricingByIds>>[number];

function amount(
  card: Card,
  viewer: ReturnType<typeof buildShopViewerPricingContext>,
  currency: "EUR" | "USD" | "UAH"
) {
  const expanded = expandShopPrices(
    resolveShopProductPricing(card as never, viewer).effectivePrice,
    rates
  );
  const value =
    currency === "EUR" ? expanded.eur : currency === "UAH" ? expanded.uah : expanded.usd;
  return value > 0 ? value : null;
}

test(
  "projection query price filters, ordering, facets, counts, and summary use effective card prices",
  { skip: !url },
  async (t) => {
    const client = new PrismaClient({ datasources: { db: { url } } });
    const { buildShopCatalogProjection } =
      await import("../../../src/lib/shopCatalogProjection.server");
    const { persistShopCatalogProjectionBuild } =
      await import("../../../src/lib/shopCatalogProjectionPersistence.server");
    const {
      countShopCatalogProjection,
      queryShopCatalogProjection,
      queryShopCatalogProjectionFacets,
      queryShopCatalogProjectionStockSummary,
      buildShopCatalogProjectionOrderedQuerySql,
      buildShopCatalogProjectionFacetQuerySql,
    } = await import("../../../src/lib/shopCatalogProjectionQuery.server");
    const run = `effective-projection-price-${Date.now()}`;
    const ids = ["alpha", "bravo", "charlie", "unpriced"].map((name) => `${run}-${name}`);
    const sources: ShopCatalogProjectionSource[] = [];
    let primaryError: unknown;
    try {
      const fixtures = [
        {
          id: ids[0],
          brand: "Alpha",
          category: "Intake",
          eur: 100,
          europe: 60,
          b2b: null,
          rank: 1,
        },
        {
          id: ids[1],
          brand: "Bravo",
          category: "Exhaust",
          eur: 200,
          europe: null,
          b2b: null,
          rank: 2,
        },
        {
          id: ids[2],
          brand: "Charlie",
          category: "Intake",
          eur: 50,
          europe: null,
          b2b: 25,
          rank: 3,
        },
        {
          id: ids[3],
          brand: "No Price",
          category: "Intake",
          eur: 0,
          europe: null,
          b2b: null,
          rank: 4,
        },
      ];
      for (const fixture of fixtures) {
        await client.shopProduct.create({
          data: {
            id: fixture.id,
            slug: fixture.id,
            titleUa: fixture.id,
            titleEn: fixture.id,
            brand: fixture.brand,
            priceEur: fixture.eur,
            priceEurEurope: fixture.europe,
            priceEurB2b: fixture.b2b,
            isPublished: true,
            status: "ACTIVE",
          },
        });
        const source: ShopCatalogProjectionSource = {
          productId: fixture.id,
          sourceVersion: "1",
          catalogVersion: "1",
          canonicalContentHash: "b".repeat(64),
          canonicalRelationCounts: { variants: 0, applications: 0 },
          slug: fixture.id,
          sku: fixture.id,
          scopeKey: "auto",
          statusKey: "ACTIVE",
          stockKey: "IN_STOCK",
          isPublished: true,
          stableRank: fixture.rank,
          brand: { key: fixture.brand, labelUa: fixture.brand, labelEn: fixture.brand },
          category: { key: fixture.category, labelUa: fixture.category, labelEn: fixture.category },
          locales: { ua: { title: fixture.id }, en: { title: fixture.id } },
        };
        sources.push(source);
        await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source));
      }
      // The projection is intentionally stale. Every assertion below must be
      // driven by canonical card pricing, never these denormalized minima.
      await client.shopCatalogProjection.updateMany({
        where: { productId: { in: ids } },
        data: {
          minPriceEur: 9_999,
          minPriceEurEurope: 9_999,
          minPriceUsd: 9_999,
          minPriceUah: 9_999,
        },
      });

      const cards = await getShopCatalogCardPricingByIds(ids);
      const cases = [
        {
          viewer: buildShopViewerPricingContext(settings, null, false, null, undefined, {
            priceCountry: "Ukraine",
          }),
          currency: "USD" as const,
          minPrice: 150,
          maxPrice: 450,
        },
        {
          viewer: buildShopViewerPricingContext(settings, null, false, null, undefined, {
            priceCountry: "Germany",
          }),
          currency: "UAH" as const,
          minPrice: 2_100,
          maxPrice: 8_100,
        },
        {
          viewer: buildShopViewerPricingContext(settings, "B2B_APPROVED", true, null, undefined, {
            priceCountry: "Germany",
          }),
          currency: "EUR" as const,
          minPrice: 30,
          maxPrice: 190,
        },
      ];

      for (const current of cases) {
        const context = buildShopCatalogEffectivePriceContext({
          viewer: current.viewer,
          currency: current.currency,
          currencyRates: rates,
        });
        const expected = cards
          .map((card) => ({ card, amount: amount(card, current.viewer, current.currency) }))
          .filter(
            (entry): entry is { card: Card; amount: number } =>
              entry.amount != null &&
              entry.amount >= current.minPrice &&
              entry.amount <= current.maxPrice
          )
          .sort(
            (left, right) =>
              left.amount - right.amount || left.card.productId.localeCompare(right.card.productId)
          );
        const query = {
          locale: "en" as const,
          productIds: ids,
          effectivePriceContext: context,
          minPrice: current.minPrice,
          maxPrice: current.maxPrice,
          priceCurrency: current.currency,
          limit: 100,
        };
        const orderedSql = buildShopCatalogProjectionOrderedQuerySql({
          ...query,
          order: "price_asc",
        });
        assert.ok(orderedSql);
        const explain = await client.$queryRaw<
          Array<{ "QUERY PLAN": Array<{ Plan: Record<string, unknown> }> }>
        >(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${orderedSql}`);
        const nodes: Record<string, unknown>[] = [];
        const visit = (node: Record<string, unknown>) => {
          nodes.push(node);
          for (const child of (node.Plans ?? []) as Record<string, unknown>[]) visit(child);
        };
        visit(explain[0]["QUERY PLAN"][0].Plan);
        const priceReads = nodes.filter((node) => node["Relation Name"] === "ShopProduct");
        assert.equal(
          priceReads.length,
          1,
          "bounds and ordering must share one canonical price subplan"
        );
        assert.ok(
          priceReads.reduce((sum, node) => sum + Number(node["Actual Loops"] ?? 0), 0) <=
            ids.length,
          "canonical price must be evaluated at most once per selected projection candidate"
        );
        t.diagnostic(
          JSON.stringify({
            currency: current.currency,
            canonicalPricePlanNodes: priceReads.length,
            canonicalPriceReadLoops: priceReads.reduce(
              (sum, node) => sum + Number(node["Actual Loops"] ?? 0),
              0
            ),
            fixtureProducts: ids.length,
          })
        );
        assert.equal(await countShopCatalogProjection(query), expected.length);
        const asc = await queryShopCatalogProjection({ ...query, order: "price_asc" });
        assert.deepEqual(
          asc.items.map((item) => item.productId),
          expected.map((entry) => entry.card.productId)
        );
        const desc = await queryShopCatalogProjection({ ...query, order: "price_desc" });
        assert.deepEqual(
          desc.items.map((item) => item.productId),
          expected.map((entry) => entry.card.productId).reverse()
        );
        const interleaved = await queryShopCatalogProjection({
          ...query,
          order: "brand_interleave",
        });
        assert.deepEqual(
          new Set(interleaved.items.map((item) => item.productId)),
          new Set(expected.map((entry) => entry.card.productId))
        );

        const facetExplain = await client.$queryRaw<
          Array<{ "QUERY PLAN": Array<{ Plan: Record<string, unknown> }> }>
        >(
          Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${buildShopCatalogProjectionFacetQuerySql(query)}`
        );
        nodes.length = 0;
        visit(facetExplain[0]["QUERY PLAN"][0].Plan);
        const facetPriceReads = nodes.filter((node) => node["Relation Name"] === "ShopProduct");
        assert.equal(
          facetPriceReads.length,
          1,
          "all facets must share one canonical price subplan"
        );
        assert.ok(
          facetPriceReads.reduce((sum, node) => sum + Number(node["Actual Loops"] ?? 0), 0) <=
            ids.length
        );
        t.diagnostic(
          JSON.stringify({
            currency: current.currency,
            facetPricePlanNodes: facetPriceReads.length,
            facetPriceReadLoops: facetPriceReads.reduce(
              (sum, node) => sum + Number(node["Actual Loops"] ?? 0),
              0
            ),
            fixtureProducts: ids.length,
          })
        );
        const facets = await queryShopCatalogProjectionFacets(query);
        const expectedBrands = new Map<string, number>();
        const expectedCategories = new Map<string, number>();
        for (const { card } of expected) {
          expectedBrands.set(card.brand ?? "", (expectedBrands.get(card.brand ?? "") ?? 0) + 1);
          const category =
            fixtures.find((fixture) => fixture.id === card.productId)?.category ?? "";
          expectedCategories.set(category, (expectedCategories.get(category) ?? 0) + 1);
        }
        assert.deepEqual(
          new Map(facets.facets.brand.map((facet) => [facet.label, facet.count])),
          expectedBrands
        );
        assert.deepEqual(
          new Map(facets.facets.category.map((facet) => [facet.label, facet.count])),
          expectedCategories
        );
        const disjoint = await queryShopCatalogProjectionFacets({
          ...query,
          brand: "Alpha",
          category: "Exhaust",
        });
        assert.deepEqual(
          new Map(disjoint.facets.brand.map((facet) => [facet.label, facet.count])),
          new Map([["Bravo", 1]])
        );
        assert.deepEqual(
          new Map(disjoint.facets.category.map((facet) => [facet.label, facet.count])),
          new Map([["Intake", 1]])
        );
        const excluded = await queryShopCatalogProjectionFacets({
          ...query,
          excludeProductIds: [ids[0]],
        });
        assert.deepEqual(
          new Map(excluded.facets.brand.map((facet) => [facet.label, facet.count])),
          new Map([["Bravo", 1]])
        );
        const noTextMatch = await queryShopCatalogProjectionFacets({
          ...query,
          text: "no-matching-fixture-text",
        });
        assert.ok(Object.values(noTextMatch.facets).every((items) => items.length === 0));

        const summary = await queryShopCatalogProjectionStockSummary(
          { ...query, limit: 1, offset: 1 },
          [ids[0], ids[2]]
        );
        assert.equal(summary.totalItems, expected.length);
        assert.equal(
          summary.inStock,
          expected.filter(
            (entry) => entry.card.productId === ids[0] || entry.card.productId === ids[2]
          ).length
        );
        assert.equal(summary.preOrder, summary.totalItems - summary.inStock);
        assert.deepEqual(summary.price, {
          min: Math.floor(Math.min(...expected.map((entry) => entry.amount))),
          max: Math.ceil(Math.max(...expected.map((entry) => entry.amount))),
          currency: current.currency,
        });
      }
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        for (const source of sources) {
          await persistShopCatalogProjectionBuild(
            buildShopCatalogProjection({
              ...source,
              sourceVersion: "2",
              catalogVersion: "2",
              isPublished: false,
            })
          );
        }
        await client.shopProductVariant.deleteMany({ where: { productId: { in: ids } } });
        await client.shopKnowledgeOutbox.deleteMany({ where: { productId: { in: ids } } });
        await client.shopProduct.deleteMany({ where: { id: { in: ids } } });
      } catch (cleanupError) {
        if (primaryError == null) throw cleanupError;
      } finally {
        try {
          await client.$disconnect();
        } catch (disconnectError) {
          if (primaryError == null) throw disconnectError;
        }
      }
    }
  }
);
