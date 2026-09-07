import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  buildIlmbergerSourceRecordDraft,
  type IlmbergerSnapshotProduct,
} from "../../../src/lib/shopCatalogIlmbergerNormalization";
const databaseUrl =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  databaseUrl &&
  (!["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) ||
    process.env.DATABASE_URL !== databaseUrl)
) {
  throw new Error(
    "Ilmberger backfill integration requires the same explicitly disposable localhost database"
  );
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only")
      return {
        url: pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href,
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const backfillModule = import("../../../src/lib/shopCatalogIlmbergerBackfill.server");
function snapshot(
  productId: string,
  sku: string,
  title: string,
  category: string,
  tags: string[]
): IlmbergerSnapshotProduct {
  return {
    id: productId,
    slug: productId,
    sku,
    scope: "SHOP",
    title: { ua: title, en: title },
    category: { ua: category, en: category },
    tags,
    variants: [],
  };
}
test(
  "Ilmberger persists product-level moto model/year policies",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }),
      suffix = Date.now().toString(),
      productId = `ilm-${suffix}`,
      { persistIlmbergerSourceRecordPageWithClient } = await backfillModule;
    try {
      await client.shopProduct.create({
        data: { id: productId, slug: productId, titleUa: productId, titleEn: productId },
      });
      const draft = buildIlmbergerSourceRecordDraft({
        product: snapshot(
          productId,
          `CG-${suffix}`,
          "Passenger cover BMW S 1000 R MY from 2021 / M 1000 R MY from 2023",
          "BMW S 1000 R (MY 2021)",
          ["Ilmberger", "BMW", "BMW Motorrad", "S 1000 R", "M 1000 R", "seats"]
        ),
        sourceRevision: "ilm-v1",
      });
      await persistIlmbergerSourceRecordPageWithClient(client, {
        sourceKey: `ilm-${suffix}`,
        drafts: [draft],
      });
      const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `product:${productId}` },
        include: { clauses: { include: { constraints: { include: { values: true } } } } },
      });
      assert.equal(policy.variantId, null);
      assert.equal(policy.mode, "VEHICLE_SPECIFIC");
      assert.equal(policy.clauses.length, 2);
      assert.deepEqual(
        policy.clauses.map(
          (clause) =>
            clause.constraints.find((entry) => entry.dimension === "SCOPE")?.values[0]?.textValue
        ),
        ["moto", "moto"]
      );
      assert.deepEqual(
        policy.clauses.map(
          (clause) =>
            clause.constraints.find((entry) => entry.dimension === "YEAR")?.values[0]?.yearFrom
        ),
        [2021, 2023]
      );
      assert.ok(
        policy.clauses.every(
          (clause) =>
            clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state ===
            "NOT_APPLICABLE"
        )
      );
    } finally {
      await client.$disconnect();
    }
  }
);

test(
  "Ilmberger keeps an unresolved empty application quarantined as moto",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = Date.now().toString();
    const productId = `ilm-unresolved-${suffix}`;
    const { persistIlmbergerSourceRecordPageWithClient } = await backfillModule;
    try {
      await client.shopProduct.create({
        data: { id: productId, slug: productId, titleUa: productId, titleEn: productId },
      });
      const draft = buildIlmbergerSourceRecordDraft({
        product: snapshot(productId, `CG-${suffix}`, "Carbon cover", "Carbon parts", ["Ilmberger"]),
        sourceRevision: "ilm-v1",
      });
      assert.equal(draft.normalization.verification, "NEEDS_REVIEW");
      assert.deepEqual(draft.normalization.applications, []);
      await persistIlmbergerSourceRecordPageWithClient(client, {
        sourceKey: `ilm-unresolved-${suffix}`,
        drafts: [draft],
      });
      const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `product:${productId}` },
        include: { clauses: { include: { constraints: { include: { values: true } } } } },
      });
      assert.equal(policy.mode, "NEEDS_REVIEW");
      assert.equal(policy.clauses.length, 1);
      const constraints = policy.clauses[0]!.constraints;
      const scope = constraints.find((entry) => entry.dimension === "SCOPE")!;
      assert.equal(scope.state, "EXACT");
      assert.equal(scope.values[0]?.textValue, "moto");
      for (const dimension of ["MAKE", "MODEL"] as const) {
        const constraint = constraints.find((entry) => entry.dimension === dimension)!;
        assert.equal(constraint.state, "UNKNOWN");
        assert.deepEqual(constraint.values, []);
      }
      assert.deepEqual(
        constraints
          .filter((constraint) => constraint.state === "EXACT")
          .map((constraint) => constraint.dimension),
        ["SCOPE"]
      );
    } finally {
      await client.$disconnect();
    }
  }
);
