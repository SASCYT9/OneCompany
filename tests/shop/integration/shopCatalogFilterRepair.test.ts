import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { registerHooks } from "../unit/testHooks.mjs";
import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";

const url =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)
) {
  throw new Error("Catalog filter repair requires an explicitly disposable localhost database");
}
registerHooks({
  resolve(specifier, context, next) {
    return specifier === "server-only"
      ? {
          url: pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href,
          shortCircuit: true,
        }
      : next(specifier, context);
  },
});

test(
  "real SQL preserves OR brands, scope, clause revision and CHASSIS-only evidence",
  { skip: !url },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url } } });
    const { buildShopCatalogProjection } = await import(
      "../../../src/lib/shopCatalogProjection.server"
    );
    const { persistShopCatalogProjectionBuild } = await import(
      "../../../src/lib/shopCatalogProjectionPersistence.server"
    );
    const {
      queryShopCatalogProjection,
      queryShopCatalogProjectionFacets,
      countShopCatalogProjection,
    } = await import("../../../src/lib/shopCatalogProjectionQuery.server");
    const { buildShopCatalogVehicleSearchPlan } = await import(
      "../../../src/lib/shopCatalogVehicleSearchPlan"
    );
    const run = `filter-repair-${Date.now()}`;
    const ids: string[] = [];
    try {
      for (const [index, scope] of ["auto", "SHOP", "moto"].entries()) {
        const id = `${run}-${index}`;
        ids.push(id);
        await client.shopProduct.create({
          data: {
            id,
            slug: id,
            titleUa: id,
            titleEn: id,
            priceUsd: index === 1 ? 20 : 10,
            isPublished: true,
            status: "ACTIVE",
            catalogVersion: BigInt(1),
          },
        });
        const source: ShopCatalogProjectionSource = {
          productId: id,
          sourceVersion: "1",
          catalogVersion: "1",
          canonicalContentHash: "a".repeat(64),
          canonicalRelationCounts: { variants: 0 },
          slug: id,
          scopeKey: scope,
          statusKey: "ACTIVE",
          stockKey: "PRE_ORDER",
          isPublished: true,
          stableRank: index,
          brand: {
            key: `${run}-brand-${index}`,
            labelUa: `${run}-brand-${index}`,
            labelEn: `${run}-brand-${index}`,
          },
          category: { key: "intake", labelUa: "Впуск", labelEn: "Intake" },
          locales: { ua: { title: "Система впуску" }, en: { title: "Intake system" } },
          compatibilityPolicies: [
            {
              version: 2,
              mode: "VEHICLE_SPECIFIC",
              target: { productId: id },
              requiredDimensions: ["make", "model", "chassis"],
              clauses: [
                {
                  id: "verified",
                  verification: "VERIFIED",
                  constraints: [
                    {
                      dimension: "scope",
                      state: "EXACT",
                      values: [scope === "moto" ? "moto" : "auto"],
                    },
                    { dimension: "make", state: "EXACT", values: ["BMW"] },
                    {
                      dimension: "model",
                      state: "EXACT",
                      values: [scope === "moto" ? "S 1000 RR" : "M3"],
                    },
                    {
                      dimension: "chassis",
                      state: "EXACT",
                      values: [scope === "moto" ? "K67" : "G80"],
                    },
                    { dimension: "generation", state: "UNKNOWN" },
                    { dimension: "year", state: "ANY" },
                    { dimension: "engine", state: "UNKNOWN" },
                  ],
                },
              ],
            },
          ],
        };
        await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source));
      }
      for (const locale of ["ua", "en"] as const) {
        const base = {
          locale,
          productIds: ids,
          scope: "auto",
          brands: [`${run}-brand-0`, `${run}-brand-1`],
        };
        assert.equal(await countShopCatalogProjection(base), 2);
        const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams({ q: "BMW M3 G80" }), {
          readerMode: "projection",
        });
        const selected = { ...base, ...plan.constraints, text: plan.textQuery || null, year: 2025 };
        assert.deepEqual(
          new Set((await queryShopCatalogProjection(selected)).items.map((item) => item.productId)),
          new Set(ids.slice(0, 2))
        );
        const facets = await queryShopCatalogProjectionFacets({
          ...base,
          make: "BMW",
          model: "M3",
        });
        assert.ok(facets.facets.generation.some((facet) => facet.label.toUpperCase() === "G80"));
        assert.equal(await countShopCatalogProjection({ ...selected, engine: "S58" }), 0);
        assert.equal(await countShopCatalogProjection({ ...selected, generation: "F80" }), 0);
        assert.equal(await countShopCatalogProjection({ ...selected, scope: "moto" }), 0);
        const priced = {
          ...selected,
          maxPrice: 15,
          effectivePriceContext: {
            audience: "b2c" as const,
            useEuropeBase: false,
            currency: "USD" as const,
            currencyRates: { EUR: 1, USD: 1, UAH: 40 },
            customerB2BDiscountPercent: null,
            defaultB2BDiscountPercent: null,
            customerBrandDiscounts: {},
            systemBrandDiscounts: {},
          },
        };
        assert.equal(await countShopCatalogProjection(priced), 1);
        assert.deepEqual(
          (await queryShopCatalogProjection(priced)).items.map((item) => item.productId),
          [ids[0]]
        );
        assert.equal((await queryShopCatalogProjectionFacets(priced)).facets.category[0].count, 1);
      }
      // A stale policy cannot be reused against a new product projection revision.
      await client.shopCatalogProjection.updateMany({
        where: { productId: ids[0] },
        data: { sourceVersion: BigInt(2) },
      });
      assert.equal(
        await countShopCatalogProjection({
          locale: "ua",
          productIds: ids,
          scope: "auto",
          make: "BMW",
          model: "M3",
          generation: "G80",
        }),
        1
      );
    } finally {
      if (ids.length) await client.shopProduct.deleteMany({ where: { id: { in: ids } } });
      await client.shopCatalogProjectionFacetCount.deleteMany({
        where: {
          OR: [
            { valueKey: { startsWith: `${run}-brand-` } },
            { prefixKey: { contains: `brand:${run}-brand-` } },
          ],
        },
      });
      await client.$disconnect();
    }
  }
);
