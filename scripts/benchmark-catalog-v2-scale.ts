import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  CATALOG_SCALE_GATE_LIMITS,
  assertCatalogScaleMeasurement,
  buildCatalogScaleMeasurement,
  type CatalogExplainResult,
  type CatalogScaleMeasurement,
} from "../src/lib/shopCatalogScaleGate";

const DEFAULT_SIZES = [100_000, 500_000] as const;
const LARGE_RELATIONS = new Set([
  "scale_projection",
  "scale_policy",
  "scale_clause",
  "scale_constraint",
]);

function parseSizes() {
  const value = process.argv.find((argument) => argument.startsWith("--sizes="))?.slice(8);
  const sizes = (value ? value.split(",") : DEFAULT_SIZES).map(Number);
  if (
    sizes.length === 0 ||
    sizes.some((size) => !Number.isSafeInteger(size) || size < 10_000 || size > 500_000)
  ) {
    throw new TypeError("--sizes must contain integers between 10000 and 500000");
  }
  return [...new Set(sizes)];
}

function assertDisposableTarget(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const explicitlyDisposable = url.searchParams.get("application_name") === "catalog-scale-gate";
  if (!local || !explicitlyDisposable) {
    throw new Error(
      "CATALOG_SCALE_DATABASE_URL must target localhost and include application_name=catalog-scale-gate"
    );
  }
}

function parseExplain(rows: unknown): CatalogExplainResult {
  const row = (rows as Array<Record<string, unknown>>)[0];
  const payload = row?.["QUERY PLAN"];
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!result || typeof result !== "object" || !("Plan" in result)) {
    throw new Error("PostgreSQL returned an invalid JSON query plan");
  }
  return result as CatalogExplainResult;
}

async function createFixture(tx: any, size: number) {
  const tableStatements = [
    `CREATE TEMP TABLE scale_projection (
      product_id text NOT NULL,
      locale text NOT NULL,
      is_published boolean NOT NULL,
      status_key text NOT NULL,
      scope_key text NOT NULL,
      stable_rank numeric(20,8) NOT NULL,
      brand_key text NOT NULL,
      search_text text NOT NULL,
      PRIMARY KEY (product_id, locale)
    ) ON COMMIT DROP`,
    `CREATE TEMP TABLE scale_policy (
      target_key text PRIMARY KEY,
      product_id text NOT NULL,
      mode text NOT NULL
    ) ON COMMIT DROP`,
    `CREATE TEMP TABLE scale_clause (
      target_key text NOT NULL,
      clause_key text NOT NULL,
      product_id text NOT NULL,
      verification text NOT NULL,
      PRIMARY KEY (target_key, clause_key)
    ) ON COMMIT DROP`,
    `CREATE TEMP TABLE scale_constraint (
      target_key text NOT NULL,
      clause_key text NOT NULL,
      product_id text NOT NULL,
      dimension text NOT NULL,
      state text NOT NULL,
      text_value text,
      year_from integer,
      year_to integer
    ) ON COMMIT DROP`,
  ];
  for (const statement of tableStatements) await tx.$executeRawUnsafe(statement);

  await tx.$executeRawUnsafe(
    `INSERT INTO scale_projection
      (product_id, locale, is_published, status_key, scope_key, stable_rank, brand_key, search_text)
     SELECT
       'scale-' || lpad(value::text, 7, '0'), locale, true, 'ACTIVE',
       CASE WHEN value % 10 = 0 THEN 'moto' ELSE 'auto' END,
       value::numeric, 'brand-' || (value % 20),
       CASE WHEN value % 100 = 0 THEN 'eventuri bmw m2 f87 n55 intake scale ' || value
            ELSE 'catalog product brand ' || (value % 20) || ' scale ' || value END
     FROM generate_series(1, $1) value
     CROSS JOIN (VALUES ('ua'), ('en')) language(locale)`,
    size
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO scale_policy (target_key, product_id, mode)
     SELECT 'product:scale-' || lpad(value::text, 7, '0'),
            'scale-' || lpad(value::text, 7, '0'), 'VEHICLE_SPECIFIC'
     FROM generate_series(1, $1) value`,
    size
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO scale_clause (target_key, clause_key, product_id, verification)
     SELECT 'product:scale-' || lpad(value::text, 7, '0'), 'clause:0',
            'scale-' || lpad(value::text, 7, '0'), 'VERIFIED'
     FROM generate_series(1, $1) value`,
    size
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO scale_constraint
      (target_key, clause_key, product_id, dimension, state, text_value, year_from, year_to)
     SELECT 'product:scale-' || lpad(value::text, 7, '0'), 'clause:0',
            'scale-' || lpad(value::text, 7, '0'), dimension, 'EXACT', text_value, year_from, year_to
     FROM generate_series(1, $1) value
     CROSS JOIN LATERAL (VALUES
       ('MAKE', CASE WHEN value % 50 = 0 THEN 'BMW' ELSE 'MAKE-' || (value % 50) END, NULL::integer, NULL::integer),
       ('MODEL', CASE WHEN value % 200 = 0 THEN 'M2' ELSE 'MODEL-' || (value % 200) END, NULL::integer, NULL::integer),
       ('ENGINE', CASE WHEN value % 100 = 0 THEN 'N55' ELSE 'ENGINE-' || (value % 100) END, NULL::integer, NULL::integer),
       ('YEAR', NULL::text, 2015 + (value % 8)::integer, 2025)
     ) constraint_value(dimension, text_value, year_from, year_to)`,
    size
  );

  const indexStatements = [
    `CREATE INDEX scale_projection_listing_idx
      ON scale_projection (locale, is_published, status_key, stable_rank, product_id)`,
    `CREATE INDEX scale_projection_scope_idx
      ON scale_projection (locale, scope_key, stable_rank, product_id)`,
    `CREATE INDEX scale_projection_brand_idx
      ON scale_projection (locale, brand_key, stable_rank, product_id)`,
    `CREATE INDEX scale_projection_search_trgm_idx
      ON scale_projection USING gin (search_text gin_trgm_ops)`,
    `CREATE INDEX scale_policy_product_idx ON scale_policy (product_id)`,
    `CREATE INDEX scale_clause_product_verified_idx
      ON scale_clause (product_id, verification, clause_key)`,
    `CREATE INDEX scale_constraint_text_idx
      ON scale_constraint (dimension, state, text_value, product_id)`,
    `CREATE INDEX scale_constraint_year_idx
      ON scale_constraint (dimension, state, year_from, year_to, product_id)`,
    `CREATE INDEX scale_constraint_clause_text_idx
      ON scale_constraint (target_key, clause_key, dimension, state, text_value)`,
    `CREATE INDEX scale_constraint_clause_year_idx
      ON scale_constraint (target_key, clause_key, dimension, state, year_from, year_to)`,
    `CREATE INDEX scale_constraint_exact_text_idx
      ON scale_constraint (dimension, state, lower(text_value), target_key, clause_key, product_id)`,
    `CREATE INDEX scale_constraint_product_exact_text_idx
      ON scale_constraint (product_id, dimension, state, lower(text_value), target_key, clause_key)`,
  ];
  for (const statement of indexStatements) await tx.$executeRawUnsafe(statement);
  for (const table of LARGE_RELATIONS) await tx.$executeRawUnsafe(`ANALYZE ${table}`);
}

function scenarios(size: number) {
  const deepRank = Math.floor(size * 0.9);
  return [
    {
      name: "listing_first_page",
      sql: `SELECT product_id FROM scale_projection
          WHERE locale = 'ua' AND is_published = true AND status_key = 'ACTIVE'
          ORDER BY stable_rank, product_id LIMIT 25`,
    },
    {
      name: "listing_deep_keyset",
      sql: `SELECT product_id FROM scale_projection
          WHERE locale = 'ua' AND is_published = true AND status_key = 'ACTIVE'
            AND (stable_rank > ${deepRank} OR (stable_rank = ${deepRank} AND product_id > 'scale-${String(deepRank).padStart(7, "0")}'))
          ORDER BY stable_rank, product_id LIMIT 25`,
    },
    {
      name: "brand_page",
      sql: `SELECT product_id FROM scale_projection
          WHERE locale = 'ua' AND is_published = true AND status_key = 'ACTIVE'
            AND brand_key = 'brand-7'
          ORDER BY stable_rank, product_id LIMIT 25`,
    },
    {
      name: "text_search",
      sql: `SELECT product_id FROM scale_projection
          WHERE locale = 'ua' AND is_published = true AND status_key = 'ACTIVE'
            AND search_text ILIKE '%eventuri bmw m2%'
          ORDER BY stable_rank, product_id LIMIT 25`,
    },
    {
      name: "make_only_fitment",
      sql: `SELECT projection.product_id FROM scale_projection projection
          WHERE projection.locale = 'ua' AND projection.is_published = true
            AND projection.status_key = 'ACTIVE'
            AND EXISTS (
              SELECT 1 FROM scale_constraint make_constraint
              WHERE make_constraint.product_id = projection.product_id
                AND make_constraint.dimension = 'MAKE'
                AND make_constraint.state = 'EXACT'
                AND lower(make_constraint.text_value) = 'bmw'
                AND EXISTS (
                  SELECT 1 FROM scale_clause clause
                  WHERE clause.target_key = make_constraint.target_key
                    AND clause.clause_key = make_constraint.clause_key
                    AND clause.product_id = projection.product_id
                    AND clause.verification = 'VERIFIED'
                )
              OFFSET 0
            )
          ORDER BY projection.stable_rank, projection.product_id LIMIT 25`,
    },
    {
      name: "correlated_fitment",
      sql: `SELECT projection.product_id FROM scale_projection projection
          WHERE projection.locale = 'ua' AND projection.is_published = true
            AND projection.status_key = 'ACTIVE'
            AND EXISTS (
              SELECT 1 FROM scale_constraint make_constraint
              WHERE make_constraint.product_id = projection.product_id
                AND make_constraint.dimension = 'MAKE'
                AND make_constraint.state = 'EXACT'
                AND lower(make_constraint.text_value) = 'bmw'
                AND EXISTS (SELECT 1 FROM scale_clause clause WHERE clause.target_key = make_constraint.target_key AND clause.clause_key = make_constraint.clause_key AND clause.product_id = projection.product_id AND clause.verification = 'VERIFIED')
                AND EXISTS (SELECT 1 FROM scale_constraint c WHERE c.target_key = make_constraint.target_key AND c.clause_key = make_constraint.clause_key AND c.dimension = 'MODEL' AND c.state = 'EXACT' AND lower(c.text_value) = 'm2')
                AND EXISTS (SELECT 1 FROM scale_constraint c WHERE c.target_key = make_constraint.target_key AND c.clause_key = make_constraint.clause_key AND c.dimension = 'ENGINE' AND c.state = 'EXACT' AND lower(c.text_value) = 'n55')
                AND EXISTS (SELECT 1 FROM scale_constraint c WHERE c.target_key = make_constraint.target_key AND c.clause_key = make_constraint.clause_key AND c.dimension = 'YEAR' AND c.state = 'EXACT' AND (c.year_from IS NULL OR c.year_from <= 2019) AND (c.year_to IS NULL OR c.year_to >= 2019))
              OFFSET 0
            )
          ORDER BY projection.stable_rank, projection.product_id LIMIT 25`,
    },
  ] as const;
}

async function explain(tx: any, sql: string) {
  return parseExplain(await tx.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`));
}

async function runSize(prisma: PrismaClient, size: number) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await createFixture(tx, size);
      const measurements: CatalogScaleMeasurement[] = [];
      for (const scenario of scenarios(size)) {
        const cold = await explain(tx, scenario.sql);
        const warm: CatalogExplainResult[] = [];
        for (let run = 0; run < CATALOG_SCALE_GATE_LIMITS.warmRuns; run += 1) {
          warm.push(await explain(tx, scenario.sql));
        }
        const measurement = buildCatalogScaleMeasurement({
          scenario: scenario.name,
          cold,
          warm,
        });
        console.log(
          `[catalog-scale] ${size.toLocaleString("en-US")} ${scenario.name} cold=${measurement.coldMs.toFixed(2)}ms warmP95=${measurement.warmP95Ms.toFixed(2)}ms`
        );
        if (scenario.name === "correlated_fitment" && process.argv.includes("--debug-plan")) {
          console.log(JSON.stringify(cold.Plan, null, 2));
        }
        assertCatalogScaleMeasurement(measurement, LARGE_RELATIONS);
        measurements.push(measurement);
      }
      return measurements;
    },
    { maxWait: 10_000, timeout: 30 * 60_000 }
  );
}

async function main() {
  const databaseUrl = process.env.CATALOG_SCALE_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("CATALOG_SCALE_DATABASE_URL is required");
  assertDisposableTarget(databaseUrl);
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const sizes = parseSizes();
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    limits: CATALOG_SCALE_GATE_LIMITS,
    sizes: [] as Array<{
      products: number;
      projectionRows: number;
      measurements: CatalogScaleMeasurement[];
    }>,
  };
  try {
    for (const size of sizes) {
      console.log(`[catalog-scale] building ${size.toLocaleString("en-US")} products`);
      const measurements = await runSize(prisma, size);
      report.sizes.push({ products: size, projectionRows: size * 2, measurements });
    }
  } finally {
    await prisma.$disconnect();
  }
  const outputDirectory = path.join(process.cwd(), "artifacts", "catalog-v2-scale");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, "catalog-v2-scale-gate.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[catalog-scale] PASS ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
