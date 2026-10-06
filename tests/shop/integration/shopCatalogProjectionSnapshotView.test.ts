import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { shopCatalogProjectionSnapshotSql } from "../../../src/lib/shopCatalogProjectionSource.server";
import { encodeShopCatalogRevisionCanonical, decodeShopCatalogRevisionCanonical } from "../../../src/lib/shopCatalogRevisionCanonical";
const url = process.env.MONOBANK_TEST_DATABASE_URL;
test("publication view omits huge raw archives, keeps compressed integrity and missing-payload detection", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.startsWith("/monobank_test"));
  const db = new PrismaClient({ datasources: { db: { url } } });
  const source = { productId: "synthetic", sourceVersion: "1" };
  const canonical = { product: { id: "synthetic", metadata: "Synthetic metadata; ".repeat(100000) } };
  const view = async (snapshot: unknown) => (await db.$queryRaw<Array<{ snapshot: Record<string, unknown> }>>(Prisma.sql`
    SELECT ${shopCatalogProjectionSnapshotSql(Prisma.sql`${JSON.stringify(snapshot)}::jsonb`)} AS snapshot
  `))[0].snapshot;
  try {
    const raw = await view({ schemaVersion: 1, canonical, projectionSource: source });
    assert.equal(raw.canonical, true);
    assert.deepEqual(raw.projectionSource, source);
    assert.ok(JSON.stringify(raw).length < 1000);
    const encoded = encodeShopCatalogRevisionCanonical(canonical);
    const compressed = await view({ schemaVersion: 1, canonical: encoded.canonical, projectionSource: source });
    assert.deepEqual(decodeShopCatalogRevisionCanonical(compressed.canonical, encoded.contentHash), canonical);
    const missing = await view({ schemaVersion: 1, projectionSource: source });
    assert.equal("canonical" in missing, false);
  } finally { await db.$disconnect(); }
});
