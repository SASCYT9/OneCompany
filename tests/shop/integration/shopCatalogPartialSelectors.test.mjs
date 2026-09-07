import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { registerHooks } from "../unit/testHooks.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return {
        url: new URL("../unit/fixtures/server-only-stub.cjs", import.meta.url).href,
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});

const url = process.env.CATALOG_SELECTOR_TEST_DATABASE_URL;
test(
  "partial selectors retain older current products and ignore unknown unselected engines",
  { skip: !url },
  async () => {
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    try {
      await db.query("BEGIN");
      // Temporary tables shadow application tables only inside this connection.
      await db.query(`
      CREATE TEMP TABLE "ShopProduct" (id text, "catalogVersion" bigint, "isPublished" boolean, status text, brand text, vendor text) ON COMMIT DROP;
      CREATE TEMP TABLE "ShopCatalogProjection" ("productId" text, "projectionVersion" bigint, "catalogVersion" bigint, "sourceVersion" bigint, "schemaVersion" int, locale text, "isPublished" boolean, "statusKey" text) ON COMMIT DROP;
      CREATE TEMP TABLE "ShopCatalogProjectionPolicy" ("targetKey" text, "productId" text, "sourceVersion" bigint) ON COMMIT DROP;
      CREATE TEMP TABLE "ShopCatalogProjectionClause" ("targetKey" text, "clauseKey" text, "productId" text, "sourceVersion" bigint, verification text) ON COMMIT DROP;
      CREATE TEMP TABLE "ShopCatalogProjectionConstraint" ("targetKey" text, "clauseKey" text, "productId" text, "sourceVersion" bigint, dimension "ShopCatalogCompatibilityDimension", state "ShopCatalogConstraintState", "textValue" text, "yearFrom" int, "yearTo" int) ON COMMIT DROP;
      INSERT INTO "ShopProduct" VALUES ('current', 7, true, 'ACTIVE', 'Fixture', 'Fixture'), ('stale', 9, true, 'ACTIVE', 'Fixture', 'Fixture');
      INSERT INTO "ShopCatalogProjection" VALUES ('current', 7, 7, 3, 1, 'en', true, 'ACTIVE'), ('stale', 8, 8, 4, 1, 'en', true, 'ACTIVE');
      INSERT INTO "ShopCatalogProjectionPolicy" VALUES ('current', 'current', 3), ('stale', 'stale', 4);
      INSERT INTO "ShopCatalogProjectionClause" VALUES ('current', 'a', 'current', 3, 'VERIFIED'), ('stale', 'a', 'stale', 4, 'VERIFIED');
      INSERT INTO "ShopCatalogProjectionConstraint" VALUES
        ('current','a','current',3,'MAKE','EXACT','BMW',null,null),
        ('current','a','current',3,'MODEL','EXACT','M5',null,null),
        ('current','a','current',3,'CHASSIS','EXACT','G90',null,null),
        ('current','a','current',3,'ENGINE','UNKNOWN',null,null,null),
        ('stale','a','stale',4,'MAKE','EXACT','Audi',null,null);
    `);
      const { getBoundedPublishedFitmentOptions } =
        await import("../../../src/lib/shopCanonicalFitmentOptions.server.ts");
      const client = {
        // Prisma binds JS strings as PostgreSQL text; pg otherwise leaves their
        // type unknown and would miss enum-versus-text production failures.
        $queryRaw: async (query) =>
          (
            await db.query(
              query.text.replace(/\$(\d+)/g, (placeholder, index) =>
                typeof query.values[Number(index) - 1] === "string"
                  ? `${placeholder}::text`
                  : placeholder
              ),
              query.values
            )
          ).rows,
      };
      const input = {
        make: null,
        model: null,
        chassis: null,
        year: null,
        brand: null,
        scope: null,
        details: false,
      };
      const makes = await getBoundedPublishedFitmentOptions(input, client);
      assert.deepEqual(makes.data, ["BMW"]);
      assert.equal(makes.meta.coverage, "partial");
      const models = await getBoundedPublishedFitmentOptions({ ...input, make: "BMW" }, client);
      assert.deepEqual(models.data, ["M5"]);
      const engines = await getBoundedPublishedFitmentOptions(
        { ...input, make: "BMW", model: "M5", chassis: "G90" },
        client
      );
      assert.deepEqual(engines.data, []);
    } finally {
      await db.query("ROLLBACK");
      await db.end();
    }
  }
);
