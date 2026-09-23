import assert from "node:assert/strict";
import { registerHooks } from "../unit/testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const url =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)
) {
  throw new Error(
    "Canonical fuel integration requires the same explicitly disposable localhost database"
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
  "canonical resolver keeps fuel correlated with vehicle dimensions",
  { skip: !url },
  async () => {
    const previous = process.env.SHOP_LOCAL_CATALOG_SNAPSHOT;
    process.env.SHOP_LOCAL_CATALOG_SNAPSHOT = "0";
    const client = new PrismaClient({ datasources: { db: { url } } });
    const run = `fuel-${Date.now()}`;
    const ids = [`${run}-m5`, `${run}-m3`, `${run}-review-app`, `${run}-review-policy`];
    try {
      for (const [index, id] of ids.entries()) {
        await client.shopProduct.create({
          data: { id, slug: id, titleUa: id, titleEn: id, isPublished: true, status: "ACTIVE" },
        });
        await client.shopProductKnowledge.create({
          data: { productId: id, searchText: id, contentHash: `${index}`.padStart(64, "0") },
        });
      }
      await client.shopVehicleApplication.createMany({
        data: [
          {
            applicationKey: `${run}-m5`,
            knowledgeId: (
              await client.shopProductKnowledge.findUniqueOrThrow({ where: { productId: ids[0] } })
            ).id,
            productId: ids[0],
            make: "BMW",
            model: "M5",
            chassisCode: "G90",
            yearFrom: 2024,
            yearTo: 2026,
            engine: "S68",
            fuel: "petrol",
            opfGpf: "with",
            verificationStatus: "VERIFIED",
          },
          {
            applicationKey: `${run}-m3`,
            knowledgeId: (
              await client.shopProductKnowledge.findUniqueOrThrow({ where: { productId: ids[1] } })
            ).id,
            productId: ids[1],
            make: "BMW",
            model: "M3",
            chassisCode: "G80",
            yearFrom: 2020,
            yearTo: 2026,
            engine: "S58",
            fuel: "diesel",
            opfGpf: "without",
            verificationStatus: "VERIFIED",
          },
        ],
      });
      // A second application on the SAME product must not supply diesel to M5.
      await client.shopVehicleApplication.create({
        data: {
          applicationKey: `${run}-m5-other`,
          knowledgeId: (
            await client.shopProductKnowledge.findUniqueOrThrow({ where: { productId: ids[0] } })
          ).id,
          productId: ids[0],
          make: "BMW",
          model: "M3",
          chassisCode: "G80",
          yearFrom: 2020,
          yearTo: 2026,
          engine: "S58",
          fuel: "diesel",
          opfGpf: "without",
          verificationStatus: "VERIFIED",
        },
      });
      const reviewKnowledge = await client.shopProductKnowledge.findUniqueOrThrow({
        where: { productId: ids[2] },
      });
      await client.shopVehicleApplication.create({
        data: {
          applicationKey: `${run}-m5-review`,
          knowledgeId: reviewKnowledge.id,
          productId: ids[2],
          make: "BMW",
          model: "M5",
          chassisCode: "G90",
          yearFrom: 2024,
          yearTo: 2026,
          engine: "S68",
          fuel: "petrol",
          opfGpf: "with",
          verificationStatus: "NEEDS_REVIEW",
        },
      });
      const reviewTarget = `product:${ids[3]}`;
      await client.shopCatalogProjectionPolicy.create({
        data: {
          targetKey: reviewTarget,
          productId: ids[3],
          sourceVersion: BigInt(1),
          requiredDimensions: [],
          dimensionDefaults: {},
          clauseCount: 1,
        },
      });
      const reviewClause = {
        targetKey: reviewTarget,
        productId: ids[3],
        sourceVersion: BigInt(1),
        clauseKey: "reviewed-fitment",
      };
      await client.shopCatalogProjectionClause.create({
        data: { ...reviewClause, verification: "NEEDS_REVIEW" },
      });
      await client.shopCatalogProjectionConstraint.createMany({
        data: [
          {
            ...reviewClause,
            dimension: "SCOPE",
            state: "EXACT",
            valueKind: "text",
            textValue: "auto",
          },
          {
            ...reviewClause,
            dimension: "MAKE",
            state: "EXACT",
            valueKind: "text",
            textValue: "BMW",
          },
          {
            ...reviewClause,
            dimension: "MODEL",
            state: "EXACT",
            valueKind: "text",
            textValue: "M5",
          },
          {
            ...reviewClause,
            dimension: "GENERATION",
            state: "EXACT",
            valueKind: "text",
            textValue: "G90",
          },
          {
            ...reviewClause,
            dimension: "YEAR",
            state: "EXACT",
            valueKind: "year_range",
            yearFrom: 2024,
            yearTo: 2026,
          },
          {
            ...reviewClause,
            dimension: "ENGINE",
            state: "EXACT",
            valueKind: "text",
            textValue: "S68",
          },
          {
            ...reviewClause,
            dimension: "FUEL",
            state: "EXACT",
            valueKind: "text",
            textValue: "petrol",
          },
          {
            ...reviewClause,
            dimension: "OPF_GPF",
            state: "EXACT",
            valueKind: "text",
            textValue: "with",
          },
        ],
      });
      const { resolveCanonicalVehicleProductIds } =
        await import("../../../src/lib/shopStockCanonicalVehicleIds.server");
      const base = {
        make: "BMW",
        model: "M5",
        chassis: "G90",
        year: 2025,
        engine: "S68",
        fuel: "petrol",
        opfGpf: "with",
        scope: "auto" as const,
      };
      assert.deepEqual(await resolveCanonicalVehicleProductIds(base), [ids[0]]);
      assert.deepEqual(await resolveCanonicalVehicleProductIds({ ...base, fuel: "diesel" }), []);
      assert.deepEqual(
        await resolveCanonicalVehicleProductIds({ ...base, fuel: "unknown-fuel" }),
        []
      );
      assert.deepEqual(await resolveCanonicalVehicleProductIds({ ...base, engine: "wrong" }), []);
      assert.deepEqual(
        await resolveCanonicalVehicleProductIds({
          make: "",
          model: "",
          chassis: "",
          year: null,
          engine: null,
          fuel: "petrol",
          opfGpf: null,
          scope: null,
        }),
        [ids[0]]
      );
    } finally {
      await client.shopProduct.deleteMany({ where: { id: { in: ids } } });
      await client.$disconnect();
      if (previous === undefined) delete process.env.SHOP_LOCAL_CATALOG_SNAPSHOT;
      else process.env.SHOP_LOCAL_CATALOG_SNAPSHOT = previous;
    }
  }
);
