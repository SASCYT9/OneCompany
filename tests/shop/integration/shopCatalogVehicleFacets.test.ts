import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { normalizeLegacyApplicationsToShopCatalogV2Policy } from "../../../src/lib/shopCatalogV2Compatibility";
import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";

const url =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)
) {
  throw new Error(
    "Vehicle facet integration requires the same explicitly disposable localhost database"
  );
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return {
        url: pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href,
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});

test(
  "vehicle facets work across manufacturers and keep year/engine evidence in one clause",
  { skip: !url },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url } } });
    const { buildShopCatalogProjection } =
      await import("../../../src/lib/shopCatalogProjection.server");
    const { persistShopCatalogProjectionBuild } =
      await import("../../../src/lib/shopCatalogProjectionPersistence.server");
    const {
      queryShopCatalogProjectionFacets,
      queryShopCatalogProjection,
      countShopCatalogProjection,
      queryShopCatalogProjectionStockSummary,
    } = await import("../../../src/lib/shopCatalogProjectionQuery.server");
    const run = `vehicle-facet-${Date.now()}`;
    const ids: string[] = [];
    const sources: ShopCatalogProjectionSource[] = [];
    const fixtures = [
      {
        brand: "fixture-a",
        scope: "auto",
        model: "M5",
        generation: "G90",
        engine: "S68",
        opfGpf: "with",
        yearFrom: 2024,
        yearTo: 2026,
      },
      {
        brand: "fixture-b",
        scope: "auto",
        model: "M3",
        generation: "G80",
        engine: "S58",
        opfGpf: "without",
        yearFrom: 2020,
        yearTo: 2026,
      },
      {
        brand: "fixture-c",
        scope: "moto",
        model: "S 1000 RR",
        generation: "K67",
        engine: "999cc",
        opfGpf: "without",
        yearFrom: 2019,
        yearTo: 2026,
      },
    ];
    try {
      for (const [index, fixture] of fixtures.entries()) {
        const id = `${run}-${index}`;
        ids.push(id);
        await client.shopProduct.create({
          data: { id, slug: id, titleUa: id, titleEn: id, isPublished: true, status: "ACTIVE" },
        });
        const source: ShopCatalogProjectionSource = {
          productId: id,
          sourceVersion: "1",
          catalogVersion: "1",
          canonicalContentHash: "a".repeat(64),
          canonicalRelationCounts: { variants: 0, applications: 0 },
          slug: id,
          sku: id,
          scopeKey: fixture.scope,
          statusKey: "ACTIVE",
          stockKey: "IN_STOCK",
          isPublished: true,
          stableRank: index + 1,
          brand: { key: fixture.brand, labelUa: fixture.brand, labelEn: fixture.brand },
          category: { key: fixture.model, labelUa: fixture.model, labelEn: fixture.model },
          locales: { ua: { title: id }, en: { title: id } },
          compatibilityPolicies: [
            normalizeLegacyApplicationsToShopCatalogV2Policy({
              target: { productId: id },
              requiredDimensions: ["make", "model", "generation", "engine"], // Text-only engine fixtures remain review candidates, as required by DB guards.
              verification: "NEEDS_REVIEW",
              applications: [
                { id: `${id}-application`, make: "BMW", ...fixture },
                // The same product has a second application. S58 must never be
                // borrowed from it to satisfy an M5/G90 selection.
                ...(index === 0
                  ? [{ id: `${id}-other-application`, make: "BMW", ...fixtures[1] }]
                  : []),
              ],
            }),
          ],
        };
        sources.push(source);
        await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source));
      }
      for (const locale of ["ua", "en"] as const) {
        const entry = await queryShopCatalogProjectionFacets({ locale, scope: "auto" });
        assert.ok(entry.facets.make.some((item) => item.key === "bmw"));
        const models = await queryShopCatalogProjectionFacets({
          locale,
          scope: "auto",
          make: "BMW",
          productIds: ids,
        });
        assert.deepEqual(models.facets.model.map((item) => item.label).sort(), ["M3", "M5"]);
        const selected = await queryShopCatalogProjectionFacets({
          locale,
          scope: "auto",
          make: "BMW",
          model: "M5",
          productIds: ids,
        });
        assert.deepEqual(
          selected.facets.generation.map((item) => item.label),
          ["g90"]
        );
        assert.deepEqual(
          selected.facets.engine.map((item) => item.label),
          ["s68"]
        );
        assert.deepEqual(
          selected.facets.brand.map((item) => item.key),
          ["fixture-a"]
        );
        assert.deepEqual(
          selected.facets.category.map((item) => item.key),
          ["M5"]
        );
        const selection = { locale, scope: "auto", make: "BMW", model: "M5", productIds: ids };
        assert.equal(await countShopCatalogProjection(selection), 1);
        assert.deepEqual(
          await queryShopCatalogProjectionStockSummary({ ...selection, offset: 999, limit: 1 }, [
            ids[1],
            ids[2],
          ]),
          { totalItems: 1, inStock: 0, preOrder: 1 }
        );
        assert.deepEqual(
          await queryShopCatalogProjectionStockSummary(selection, [ids[0], ids[0], ids[1]]),
          { totalItems: 1, inStock: 1, preOrder: 0 }
        );
        assert.deepEqual(
          await queryShopCatalogProjectionStockSummary(
            { ...selection, excludeProductIds: [ids[0]] },
            ids
          ),
          { totalItems: 0, inStock: 0, preOrder: 0 }
        );
        assert.deepEqual(
          (await queryShopCatalogProjection(selection)).items.map((item) => item.productId),
          [ids[0]]
        );
        for (const restriction of [
          { productIds: [] },
          { excludeProductIds: [ids[0]] },
          { minPrice: 100 },
        ]) {
          const excluded = { ...selection, ...restriction };
          assert.equal(await countShopCatalogProjection(excluded), 0);
          for (const order of ["default", "price_asc"] as const) {
            assert.deepEqual((await queryShopCatalogProjection({ ...excluded, order })).items, []);
          }
        }
        const wrongYear = await queryShopCatalogProjectionFacets({
          locale,
          make: "BMW",
          model: "M5",
          year: 2020,
          productIds: ids,
        });
        assert.deepEqual(wrongYear.facets.engine, []);
        const wrongEngine = await queryShopCatalogProjection({
          locale,
          make: "BMW",
          model: "M5",
          engine: "S58",
          productIds: ids,
        });
        assert.equal(wrongEngine.items.length, 0);
        const opfSelected = await queryShopCatalogProjectionFacets({
          locale,
          scope: "auto",
          make: "BMW",
          opfGpf: "with",
          productIds: ids,
        });
        // OPF/GPF is terminal (there is no output facet for it), but it still
        // restricts the visible model candidates to its exact source clause.
        assert.deepEqual(
          opfSelected.facets.model.map((item) => item.label),
          ["M5"]
        );
        // Without a product-ID restriction this must still query live clauses;
        // precomputed make counters do not contain OPF-specific evidence.
        const unavailableOpfMake = await queryShopCatalogProjectionFacets({
          locale,
          brand: "fixture-b",
          opfGpf: "with",
        });
        assert.deepEqual(unavailableOpfMake.facets.make, []);
        const wrongOpf = await queryShopCatalogProjection({
          locale,
          scope: "auto",
          make: "BMW",
          model: "M5",
          opfGpf: "without",
          productIds: ids,
        });
        assert.equal(wrongOpf.items.length, 0);
        assert.equal(
          await countShopCatalogProjection({
            locale,
            scope: "auto",
            make: "BMW",
            model: "M5",
            opfGpf: "without",
            productIds: ids,
          }),
          0
        );
        const scopedBrand = await queryShopCatalogProjectionFacets({
          locale,
          scope: "auto",
          brand: "fixture-b",
          make: "BMW",
          productIds: ids,
        });
        assert.deepEqual(
          scopedBrand.facets.model.map((item) => item.label),
          ["M3"]
        );
        const moto = await queryShopCatalogProjectionFacets({
          locale,
          scope: "moto",
          make: "BMW",
          productIds: ids,
        });
        assert.deepEqual(
          moto.facets.model.map((item) => item.label),
          ["S 1000 RR"]
        );
      }
    } finally {
      // Only rows created by this test, in its explicitly disposable database.
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
      await client.shopProduct.deleteMany({ where: { id: { in: ids } } });
      await client.$disconnect();
    }
  }
);
