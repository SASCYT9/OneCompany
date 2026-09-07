import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Prisma, PrismaClient, type ShopCatalogConstraintState } from "@prisma/client";

const url =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)
) {
  throw new Error("Fitment-year test requires the same explicitly disposable localhost database");
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
  "selected year narrows engines within one clause while preserving year choices",
  { skip: !url },
  async () => {
    const previous = process.env.SHOP_LOCAL_CATALOG_SNAPSHOT;
    process.env.SHOP_LOCAL_CATALOG_SNAPSHOT = "0";
    const client = new PrismaClient({
      datasources: { db: { url } },
      log: [{ emit: "event", level: "query" }],
    });
    const previousPrisma = global.__onecompany_prisma;
    const selectorSql: string[] = [];
    let recordSelectorSql = false;
    client.$on("query", ({ query }) => {
      if (recordSelectorSql) selectorSql.push(query);
    });
    const id = `fitment-year-${randomUUID()}`;
    const targetKey = `product:${id}`;
    const fixtures: Array<{
      engine: string;
      yearState: ShopCatalogConstraintState | null;
      from?: number;
      to?: number;
      chassis?: string;
    }> = [
      { engine: "early", yearState: "EXACT", from: 2020, to: 2022 },
      { engine: "late", yearState: "EXACT", from: 2024, to: 2026 },
      { engine: "all-years", yearState: "ANY" },
      { engine: "year-irrelevant", yearState: "NOT_APPLICABLE" },
      { engine: "unknown-year", yearState: "UNKNOWN" },
      { engine: "missing-year", yearState: null },
      { engine: "other-chassis", yearState: "EXACT", from: 2020, to: 2026, chassis: "B8" },
    ];
    try {
      await client.shopProduct.create({
        data: {
          id,
          slug: id,
          brand: id,
          titleUa: id,
          titleEn: id,
          isPublished: true,
          status: "ACTIVE",
        },
      });
      await client.shopCatalogProjectionPolicy.create({
        data: {
          targetKey,
          productId: id,
          sourceVersion: BigInt(1),
          requiredDimensions: [],
          dimensionDefaults: {},
          clauseCount: fixtures.length,
        },
      });
      for (const fixture of fixtures) {
        const clauseKey = fixture.engine;
        const base = { targetKey, productId: id, sourceVersion: BigInt(1), clauseKey };
        // Text engine labels are explicitly review evidence, as required by the
        // DB guard. This test isolates year correlation, not powertrain promotion.
        await client.shopCatalogProjectionClause.create({
          data: { ...base, verification: "NEEDS_REVIEW" },
        });
        const constraints: Prisma.ShopCatalogProjectionConstraintCreateManyInput[] = [
          { dimension: "SCOPE", textValue: "auto" },
          { dimension: "MAKE", textValue: "Audi" },
          { dimension: "MODEL", textValue: "A4" },
          { dimension: "CHASSIS", textValue: fixture.chassis ?? "B9" },
          { dimension: "ENGINE", textValue: fixture.engine },
        ].map((item) => ({
          ...base,
          ...item,
          dimension:
            item.dimension as Prisma.ShopCatalogProjectionConstraintCreateManyInput["dimension"],
          state: "EXACT",
          valueKind: "text",
        }));
        if (fixture.yearState)
          constraints.push({
            ...base,
            dimension: "YEAR",
            state: fixture.yearState,
            ...(fixture.yearState === "EXACT"
              ? { valueKind: "year_range", yearFrom: fixture.from, yearTo: fixture.to }
              : {}),
          });
        await client.shopCatalogProjectionConstraint.createMany({ data: constraints });
      }
      global.__onecompany_prisma = client;
      recordSelectorSql = true;
      const { getCanonicalFitmentOptions } =
        await import("../../../src/lib/shopCanonicalFitmentOptions.server");
      const base = {
        make: "Audi",
        model: "A4",
        chassis: "B9",
        brand: id,
        scope: "auto" as const,
        details: true,
      };
      const fullYears = [2026, 2025, 2024, 2022, 2021, 2020];
      for (const [year, expected] of [
        [2021, ["all-years", "early", "year-irrelevant"]],
        [2025, ["all-years", "late", "year-irrelevant"]],
        [2023, ["all-years", "year-irrelevant"]],
      ] as const) {
        const details = await getCanonicalFitmentOptions({ ...base, year });
        assert.equal(details?.type, "details");
        if (details?.type !== "details") throw new Error("missing details response");
        assert.deepEqual(details.data.engines, [...expected]);
        assert.deepEqual(details.data.years, fullYears);
        const engines = await getCanonicalFitmentOptions({ ...base, year, details: false });
        assert.equal(engines?.type, "engines");
        assert.deepEqual(engines?.data, [...expected]);
      }
      const noYear = await getCanonicalFitmentOptions({ ...base, year: null });
      if (noYear?.type !== "details") throw new Error("missing unfiltered details");
      assert.deepEqual(noYear.data.engines, [
        "all-years",
        "early",
        "late",
        "missing-year",
        "unknown-year",
        "year-irrelevant",
      ]);
      const optionReads = selectorSql.filter(
        (sql) => sql.startsWith("SELECT") && sql.includes('"ShopCatalogProjectionConstraint"')
      );
      assert.ok(optionReads.length > 0, "the actual selector must issue observable option reads");
      for (const sql of optionReads) {
        assert.match(
          sql,
          /GROUP BY/,
          "PostgreSQL must deduplicate options before transferring rows"
        );
        assert.doesNotMatch(
          sql,
          /\bLIMIT\b/,
          "existing option sets must not be silently truncated"
        );
      }
    } finally {
      recordSelectorSql = false;
      try {
        await client.shopProduct.deleteMany({ where: { id } });
      } finally {
        await client.$disconnect();
        global.__onecompany_prisma = previousPrisma;
        if (previous === undefined) delete process.env.SHOP_LOCAL_CATALOG_SNAPSHOT;
        else process.env.SHOP_LOCAL_CATALOG_SNAPSHOT = previous;
      }
    }
  }
);
