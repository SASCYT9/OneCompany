import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { Prisma, PrismaClient } from "@prisma/client";

import { getShopCatalogCardPricingByIds } from "../../../src/lib/shopCatalogCardPricing.server";
import { buildShopCatalogEffectivePriceContext } from "../../../src/lib/shopCatalogEffectivePrice.server";
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
    "Effective-price scale integration requires the same explicitly disposable localhost database"
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

function fixtureSize() {
  const raw = process.env.CATALOG_EFFECTIVE_PRICE_SCALE_SIZE ?? "1000";
  if (raw === "1000" || raw === "10000") return Number(raw);
  throw new TypeError("CATALOG_EFFECTIVE_PRICE_SCALE_SIZE must be 1000 or 10000");
}

type PlanNode = Record<string, unknown>;

function summarizePlan(plan: PlanNode) {
  const nodeTypes = new Map<string, number>();
  const relations = new Map<string, { nodes: number; loops: number }>();
  const visit = (node: PlanNode) => {
    const type = String(node["Node Type"] ?? "unknown");
    nodeTypes.set(type, (nodeTypes.get(type) ?? 0) + 1);
    const relation = node["Relation Name"];
    if (typeof relation === "string") {
      const current = relations.get(relation) ?? { nodes: 0, loops: 0 };
      current.nodes += 1;
      current.loops += Number(node["Actual Loops"] ?? 0);
      relations.set(relation, current);
    }
    for (const child of (node.Plans ?? []) as PlanNode[]) visit(child);
  };
  visit(plan);
  return {
    root: String(plan["Node Type"] ?? "unknown"),
    actualRows: Number(plan["Actual Rows"] ?? 0),
    actualLoops: Number(plan["Actual Loops"] ?? 0),
    sharedHitBlocks: Number(plan["Shared Hit Blocks"] ?? 0),
    sharedReadBlocks: Number(plan["Shared Read Blocks"] ?? 0),
    nodeTypes: Object.fromEntries(nodeTypes),
    relations: Object.fromEntries(relations),
  };
}

function chunk<T>(values: readonly T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}

test(
  "effective-price projection scale harness measures real ordered, facet, and summary reads",
  { skip: !url },
  async (t) => {
    if (!url) return;
    const size = fixtureSize();
    const client = new PrismaClient({ datasources: { db: { url } } });
    const {
      buildShopCatalogProjectionFacetQuerySql,
      buildShopCatalogProjectionOrderedQuerySql,
      countShopCatalogProjection,
      queryShopCatalogProjection,
      queryShopCatalogProjectionFacets,
      queryShopCatalogProjectionStockSummary,
    } = await import("../../../src/lib/shopCatalogProjectionQuery.server");
    const run = `effective-price-scale-${process.pid}-${randomUUID().slice(0, 12)}`;
    const ids = Array.from(
      { length: size },
      (_, index) => `${run}-${String(index).padStart(5, "0")}`
    );
    const projectionBrand = `${run}-projection-brand`;
    const marker = `scale-marker-${run}`;
    const categories = ["Intake", "Exhaust", "Suspension", "Electronics"] as const;
    const viewer = buildShopViewerPricingContext(
      settings,
      "B2B_APPROVED",
      true,
      8,
      {
        customerBrandDiscountMap: new Map([["scale alpha", 7]]),
        systemBrandDiscountMap: new Map([["scale beta", 12]]),
      },
      { priceCountry: "Germany" }
    );
    const effectivePriceContext = buildShopCatalogEffectivePriceContext({
      viewer,
      currency: "UAH",
      currencyRates: rates,
    });
    let primaryError: unknown;
    try {
      const products = ids.map((id, index) => {
        const variantBacked = index % 4 === 0;
        const unpriced = index % 97 === 0;
        const base = unpriced ? 0 : 50 + (index % 500);
        return {
          id,
          slug: id,
          titleUa: id,
          titleEn: id,
          brand: index % 3 === 0 ? "Scale Alpha" : index % 3 === 1 ? "Scale Beta" : "Scale Gamma",
          priceEur: variantBacked ? null : base,
          priceEurEurope: variantBacked || index % 5 !== 0 ? null : Math.max(base - 5, 0),
          priceUsd: null,
          priceUah: null,
          priceEurB2b: index % 11 === 0 && !variantBacked ? Math.max(base - 12, 0) : null,
          isPublished: true,
          status: "ACTIVE" as const,
        };
      });
      const variants = products
        .map((product, index) => {
          if (index % 4 !== 0) return null;
          const base = index % 97 === 0 ? 0 : 50 + (index % 500);
          return {
            id: `${product.id}-variant`,
            productId: product.id,
            position: 1,
            isDefault: true,
            priceEur: base,
            priceEurEurope: index % 5 === 0 ? Math.max(base - 5, 0) : null,
            priceUsd: null,
            priceUah: null,
            priceEurB2b: index % 11 === 0 ? Math.max(base - 12, 0) : null,
          };
        })
        .filter((value): value is NonNullable<typeof value> => value != null);
      const projections = ids.map((id, index) => ({
        productId: id,
        locale: "en",
        sourceVersion: BigInt(1),
        catalogVersion: BigInt(1),
        projectionVersion: BigInt(1),
        sourceContentHash: "a".repeat(64),
        canonicalRelationHash: "b".repeat(64),
        compatibilityHash: "c".repeat(64),
        slug: id,
        scopeKey: "auto",
        statusKey: "ACTIVE",
        stockKey: index % 3 === 0 ? "PRE_ORDER" : "IN_STOCK",
        isPublished: true,
        stableRank: index + 1,
        normalizedSku: id,
        brandKey: projectionBrand,
        brandLabel: projectionBrand,
        categoryKey: categories[index % categories.length],
        categoryLabel: categories[index % categories.length],
        title: id,
        searchText: `${marker} ${id}`,
        minPriceEur: 9_999,
        minPriceEurEurope: 9_999,
        minPriceUsd: 9_999,
        minPriceUah: 9_999,
        contentHash: "d".repeat(64),
      }));
      await client.shopProduct.createMany({ data: products });
      if (variants.length) await client.shopProductVariant.createMany({ data: variants });
      await client.shopCatalogProjection.createMany({ data: projections });
      await client.$executeRaw`ANALYZE "ShopProduct"`;
      await client.$executeRaw`ANALYZE "ShopProductVariant"`;
      await client.$executeRaw`ANALYZE "ShopCatalogProjection"`;

      const cards = [] as Awaited<ReturnType<typeof getShopCatalogCardPricingByIds>>;
      for (const group of chunk(ids, 100))
        cards.push(...(await getShopCatalogCardPricingByIds(group)));
      const priced = cards.map((card) => {
        const prices = expandShopPrices(
          resolveShopProductPricing(card as never, viewer).effectivePrice,
          rates
        );
        return {
          productId: card.productId,
          category: categories[Number(card.productId.slice(-5)) % categories.length],
          amount: prices.uah > 0 ? prices.uah : null,
        };
      });
      const expected = priced
        .filter(
          (entry): entry is (typeof priced)[number] & { amount: number } => entry.amount != null
        )
        .sort(
          (left, right) =>
            left.amount - right.amount || left.productId.localeCompare(right.productId)
        );
      assert.ok(
        expected.length > size / 2,
        "fixture must retain a broad positive-price population"
      );
      const minPrice = expected[Math.floor(expected.length / 4)]!.amount;
      const maxPrice = expected[Math.floor((expected.length * 3) / 4)]!.amount;
      const filtered = expected.filter(
        (entry) => entry.amount >= minPrice && entry.amount <= maxPrice
      );
      const query = {
        locale: "en" as const,
        text: marker,
        effectivePriceContext,
        minPrice,
        maxPrice,
        priceCurrency: "UAH" as const,
        limit: 100,
      };
      const orderedSql = buildShopCatalogProjectionOrderedQuerySql({
        ...query,
        order: "price_asc",
      });
      assert.ok(orderedSql, "priced order must use the exported actual SQL builder");
      const facetSql = buildShopCatalogProjectionFacetQuerySql(query);
      const explainStart = performance.now();
      const [orderedExplain, facetExplain] = await Promise.all([
        client.$queryRaw<
          Array<{
            "QUERY PLAN": Array<{
              Plan: PlanNode;
              "Planning Time": number;
              "Execution Time": number;
            }>;
          }>
        >(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${orderedSql}`),
        client.$queryRaw<
          Array<{
            "QUERY PLAN": Array<{
              Plan: PlanNode;
              "Planning Time": number;
              "Execution Time": number;
            }>;
          }>
        >(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${facetSql}`),
      ]);
      const explainDurationMs = performance.now() - explainStart;
      const orderedPlan = orderedExplain[0]?.["QUERY PLAN"][0];
      const facetPlan = facetExplain[0]?.["QUERY PLAN"][0];
      assert.ok(orderedPlan?.Plan, "ordered EXPLAIN must return a real execution plan");
      assert.ok(facetPlan?.Plan, "facet EXPLAIN must return a real execution plan");

      const timings: Record<string, number> = {};
      const measure = async <T>(name: string, operation: () => Promise<T>) => {
        const start = performance.now();
        const value = await operation();
        timings[name] = Number((performance.now() - start).toFixed(2));
        return value;
      };
      const count = await measure("count", () => countShopCatalogProjection(query));
      const ordered = await measure("ordered", () =>
        queryShopCatalogProjection({ ...query, order: "price_asc" })
      );
      const facets = await measure("facets", () => queryShopCatalogProjectionFacets(query));
      const inStockIds = filtered
        .filter((entry) => Number(entry.productId.slice(-5)) % 3 !== 0)
        .map((entry) => entry.productId);
      const summary = await measure("summary", () =>
        queryShopCatalogProjectionStockSummary({ ...query, offset: 1 }, inStockIds)
      );

      assert.equal(count, filtered.length);
      assert.deepEqual(
        ordered.items.map((item) => item.productId),
        filtered.slice(0, 100).map((entry) => entry.productId)
      );
      assert.equal(summary.totalItems, filtered.length);
      assert.equal(summary.inStock, inStockIds.length);
      assert.equal(summary.preOrder, filtered.length - inStockIds.length);
      assert.deepEqual(summary.price, {
        min: Math.floor(Math.min(...filtered.map((entry) => entry.amount))),
        max: Math.ceil(Math.max(...filtered.map((entry) => entry.amount))),
        currency: "UAH",
      });
      assert.deepEqual(
        new Map(facets.facets.category.map((facet) => [facet.label, facet.count])),
        new Map(
          categories.map((category) => [
            category,
            filtered.filter((entry) => entry.category === category).length,
          ])
        )
      );
      assert.deepEqual(
        new Map(facets.facets.brand.map((facet) => [facet.label, facet.count])),
        new Map([[projectionBrand, filtered.length]])
      );

      const target = new URL(url);
      t.diagnostic(
        JSON.stringify({
          fixtureProducts: size,
          fixtureVariants: variants.length,
          target: { host: target.host, database: target.pathname.replace(/^\//, "") },
          readerOperations: 4,
          sampleCount: 1,
          cacheState: "warm after fixture setup, reference card reads and EXPLAIN",
          workload:
            "synthetic B2B Europe UAH price range; no vehicle clauses or publication pipeline",
          durationsMs: { ...timings, explain: Number(explainDurationMs.toFixed(2)) },
          orderedExplain: {
            planningMs: orderedPlan!["Planning Time"],
            executionMs: orderedPlan!["Execution Time"],
            plan: summarizePlan(orderedPlan!.Plan),
          },
          facetExplain: {
            planningMs: facetPlan!["Planning Time"],
            executionMs: facetPlan!["Execution Time"],
            plan: summarizePlan(facetPlan!.Plan),
          },
        })
      );
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        await client.shopProductVariant.deleteMany({ where: { productId: { in: ids } } });
        await client.shopKnowledgeOutbox.deleteMany({ where: { productId: { in: ids } } });
        await client.shopCatalogProjection.deleteMany({ where: { productId: { in: ids } } });
        await client.shopProduct.deleteMany({ where: { id: { in: ids } } });
      } catch (cleanupError) {
        if (primaryError == null) throw cleanupError;
      } finally {
        await client.$disconnect();
      }
    }
  }
);
