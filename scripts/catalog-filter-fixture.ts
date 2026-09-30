import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { adminProductInclude } from "../src/lib/shopAdminCatalog";
import { buildShopCatalogProjectionSourceFromAdminRecord } from "../src/lib/shopCatalogAdminSnapshot.server";
import { buildShopCatalogProjection } from "../src/lib/shopCatalogProjection.server";
import { persistShopCatalogProjectionBuild } from "../src/lib/shopCatalogProjectionPersistence.server";
import { SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS } from "../src/lib/shopCatalogV2Compatibility";

async function main() {
  const stateFile = process.argv.find((arg) => arg.startsWith("--state="))?.slice(8);
  if (!stateFile) throw new Error("An owned in-memory database state file is required");
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  if (state.host !== "127.0.0.1" || state.kind !== "in-memory-pglite" || state.stopped !== false)
    throw new Error("Only the owned ephemeral database is allowed");
  const expected = `postgresql://postgres:postgres@127.0.0.1:${state.port}/postgres?schema=public&connection_limit=1&statement_cache_size=0&connect_timeout=10`;
  if (process.env.DATABASE_URL !== expected)
    throw new Error("Database target differs from the owned fixture state");
  const client = new PrismaClient({ datasources: { db: { url: expected } } });
  try {
    for (const [suffix, scope, price] of [
      ["A", "auto", 10],
      ["B", "SHOP", 20],
      ["Moto", "moto", 30],
    ] as const) {
      const id = `catalog-filter-fixture-${suffix.toLowerCase()}`;
      const sourceRef = `https://fixture.invalid/${id}`;
      const moto = scope === "moto";
      const supplier = {
        version: 2,
        mode: "vehicle_specific",
        scope: moto ? "moto" : "auto",
        parentSku: null,
        source: {
          supplier: "Catalog fixture",
          sourceKey: "fixture",
          sourceRef,
          sourceRecordKey: id,
          sourceUpdatedAt: null,
          sourceRevision: "1",
          payloadHash: null,
          mapperVersion: "fixture/1",
        },
        policy: {
          requiredDimensions: ["make", "model", "chassis"],
          clauses: [
            {
              id,
              verification: "VERIFIED",
              constraints: SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension) => {
                const values: Record<string, string[]> = {
                  scope: [moto ? "moto" : "auto"],
                  make: ["BMW"],
                  model: [moto ? "S 1000 RR" : "M3"],
                  chassis: [moto ? "K67" : "G80"],
                };
                return values[dimension]
                  ? { dimension, state: "EXACT", values: values[dimension] }
                  : dimension === "year"
                    ? { dimension, state: "ANY" }
                    : { dimension, state: "UNKNOWN" };
              }),
              provenance: {
                sourceRef,
                sourceRecordKey: id,
                rawPaths: ["fixture"],
                evidenceRefs: [sourceRef],
              },
            },
          ],
        },
        note: "Local test fixture only",
      };
      const product = await client.shopProduct.create({
        data: {
          id,
          slug: id,
          sku: `CATALOG-TEST-${suffix}`,
          scope,
          brand: `Catalog test ${suffix}`,
          vendor: `Catalog test ${suffix}`,
          titleUa: `Тестовий впуск ${suffix}`,
          titleEn: `Test intake ${suffix}`,
          priceUsd: price,
          priceEur: price,
          isPublished: true,
          status: "ACTIVE",
          catalogVersion: BigInt(1),
          productType: "Intake",
          metafields: {
            create: [
              { namespace: "onecompany", key: "supplier_fitment", value: JSON.stringify(supplier) },
            ],
          },
        },
        include: adminProductInclude,
      });
      const source = buildShopCatalogProjectionSourceFromAdminRecord(product, "1", 0);
      await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source));
    }
    console.log("Created three isolated catalog fixtures");
  } finally {
    await client.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
