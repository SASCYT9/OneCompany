import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { buildShopCatalogAdminSnapshots } from "./shopCatalogAdminSnapshot.server";
import { encodeShopCatalogRevisionCanonical } from "./shopCatalogRevisionCanonical";
import { buildShopCatalogProjection } from "./shopCatalogProjection.server";
import { buildShopCatalogPublicationPlan } from "./shopCatalogPublication";
import { SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION } from "./shopCatalogProjectionSource.server";
import { shopPriceSourceReadiness } from "./shopPriceSourceReadiness.server";

export type ShopPriceRecordChange = {
  id: string;
  sku: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};
export type ShopPriceBatchEntry = {
  product: ShopPriceRecordChange;
  variants: ShopPriceRecordChange[];
  catalogVersion: string;
};
export const SHOP_PRICE_BATCH_FIELDS = [
  "priceSourceCurrency", "compareAtSourceCurrency", "b2bPriceSourceCurrency", "b2bCompareAtSourceCurrency",
  "priceEur", "priceUsd", "priceUah", "compareAtEur", "compareAtUsd", "compareAtUah",
  "priceEurB2b", "priceUsdB2b", "priceUahB2b", "compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b",
] as const;
const allowed = new Set<string>(SHOP_PRICE_BATCH_FIELDS);
const priceSelect = Object.fromEntries(SHOP_PRICE_BATCH_FIELDS.map(field => [field, true])) as Record<typeof SHOP_PRICE_BATCH_FIELDS[number], true>;
const MAX_VERSION = BigInt("9223372036854775807");

function assertInput(current: Record<string, unknown>, expected: ShopPriceRecordChange) {
  if (current.sku !== expected.sku) throw new Error(`SKU changed: ${expected.id}`);
  for (const [field, value] of Object.entries(expected.before)) {
    if (!allowed.has(field)) throw new Error(`Unexpected price input: ${field}`);
    const actual = current[field];
    if (field.endsWith("Currency") ? (actual ?? null) !== (value ?? null) : value == null ? actual != null : Number(actual) !== Number(value))
      throw new Error(`Price input changed: ${expected.id}/${field}`);
  }
}

async function updatePrices(tx: Prisma.TransactionClient, table: "ShopProduct" | "ShopProductVariant", rows: ShopPriceRecordChange[]) {
  if (!rows.length) return;
  const assignments = SHOP_PRICE_BATCH_FIELDS.map(field => {
    const column = Prisma.raw(`"${field}"`);
    const cast = Prisma.raw(field.endsWith("Currency") ? "text" : "numeric");
    return Prisma.sql`${column}=CASE WHEN input.values ? ${field} THEN (input.values->>${field})::${cast} ELSE target.${column} END`;
  });
  const advance = table === "ShopProduct" ? Prisma.sql`, "catalogVersion"=target."catalogVersion"+1` : Prisma.empty;
  const changed = await tx.$executeRaw(Prisma.sql`
    UPDATE ${Prisma.raw(`"${table}"`)} target SET ${Prisma.join(assignments)}, "updatedAt"=NOW() ${advance}
    FROM jsonb_to_recordset(${JSON.stringify(rows.map(row => ({ id: row.id, values: row.after })))}::jsonb) input(id text, values jsonb)
    WHERE target.id=input.id
  `);
  if (changed !== rows.length) throw new Error("Price update target count changed");
}

/** Price-only batching retains the same immutable revision/outbox contract as admin edits. */
export async function coordinateShopCatalogPriceBatchInTransaction(
  tx: Prisma.TransactionClient,
  entries: readonly ShopPriceBatchEntry[],
  actor: { type: string; id: string; reason: string }
) {
  if (!entries.length || entries.length > 10) throw new Error("Price batch must contain 1..10 products");
  const ids = entries.map(entry => entry.product.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate price aggregate");
  const variantIds = entries.flatMap(entry => entry.variants.map(row => row.id));
  if (new Set(variantIds).size !== variantIds.length) throw new Error("Duplicate price variant");
  for (const entry of entries) for (const row of [entry.product, ...entry.variants])
    for (const [field, value] of Object.entries(row.after)) {
      if (!allowed.has(field)) throw new Error(`Unexpected price write: ${field}`);
      if (field.endsWith("Currency") ? value != null && !["EUR", "USD", "UAH"].includes(String(value)) : value != null && (!Number.isFinite(Number(value)) || Number(value) < 0))
        throw new Error(`Invalid price value: ${row.id}/${field}`);
    }
  await tx.$executeRawUnsafe("SET LOCAL idle_in_transaction_session_timeout = '60s'");
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopProduct" WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`);
  if (variantIds.length)
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopProductVariant" WHERE id IN (${Prisma.join([...variantIds].sort())}) ORDER BY id FOR UPDATE`);
  const current = await tx.shopProduct.findMany({ where: { id: { in: ids } }, select: {
    id: true, sku: true, slug: true, catalogVersion: true, ...priceSelect,
    variants: { select: { id: true, sku: true, ...priceSelect } },
  } });
  const byId = new Map(current.map(row => [row.id, row]));
  for (const entry of entries) {
    const row = byId.get(entry.product.id);
    if (!row || row.catalogVersion.toString() !== entry.catalogVersion) throw new Error(`Catalog version changed: ${entry.product.id}`);
    if (row.catalogVersion >= MAX_VERSION) throw new Error("Catalog version overflow");
    assertInput(row, entry.product);
    if (row.variants.length !== entry.variants.length) throw new Error(`Variants changed: ${row.id}`);
    const variants = new Map(row.variants.map(variant => [variant.id, variant]));
    for (const expected of entry.variants) {
      const variant = variants.get(expected.id);
      if (!variant) throw new Error(`Variant missing: ${expected.id}`);
      assertInput(variant, expected);
    }
  }
  await updatePrices(tx, "ShopProduct", entries.map(entry => entry.product));
  await updatePrices(tx, "ShopProductVariant", entries.flatMap(entry => entry.variants.filter(row => Object.keys(row.after).length)));
  const versions = entries.map(entry => ({ productId: entry.product.id, nextCatalogVersion: (BigInt(entry.catalogVersion) + BigInt(1)).toString() }));
  const snapshots = await buildShopCatalogAdminSnapshots(tx, versions, actor);
  const settings = await tx.shopSettings.findUnique({ where: { key: "shop" }, select: { currencyRates: true } });
  if ((settings?.currencyRates as Record<string, unknown> | undefined)?._uahReserve === 1)
    for (const id of ids) if (!(await shopPriceSourceReadiness(tx, id)).ready) throw new Error(`SHOP_PRICE_SOURCE_REQUIRED:${id}`);
  const prepared = versions.map(version => {
    const snapshot = snapshots.get(version.productId)!;
    const { contentHash, canonical } = encodeShopCatalogRevisionCanonical(snapshot.canonical);
    const projectionSource = { ...snapshot.projectionSource, canonicalContentHash: contentHash };
    buildShopCatalogProjection(projectionSource);
    const row = byId.get(version.productId)!;
    const plan = buildShopCatalogPublicationPlan({ entityType: "PRODUCT", entityId: row.id, canonicalVersion: version.nextCatalogVersion, changeDomains: ["PRICE"], oldSlug: row.slug, newSlug: row.slug });
    return { ...version, revisionId: randomUUID(), outboxId: randomUUID(), contentHash, plan,
      snapshot: JSON.parse(JSON.stringify({ schemaVersion: SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION, canonical, projectionSource })) as Prisma.InputJsonValue };
  });
  await tx.shopCatalogProductRevision.createMany({ data: prepared.map(row => ({ id: row.revisionId, productId: row.productId, version: BigInt(row.nextCatalogVersion), schemaVersion: SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION, changeDomains: ["PRICE"], snapshot: row.snapshot, contentHash: row.contentHash, actorType: actor.type, actorId: actor.id, reason: actor.reason })) });
  await tx.shopCatalogOutbox.createMany({ data: prepared.map(row => ({ id: row.outboxId, dedupeKey: row.plan.dedupeKey, entityType: "PRODUCT", entityId: row.productId, productId: row.productId, revisionId: row.revisionId, canonicalVersion: BigInt(row.nextCatalogVersion), changeDomains: ["PRICE"], payload: row.plan as unknown as Prisma.InputJsonValue })) });
  const receipts = prepared.flatMap(row => row.plan.projectionTargets.map(target => ({ id: randomUUID(), productId: row.productId, target })));
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "ShopCatalogPublicationReceipt" ("id","entityType","entityId","target","productId","status","updatedAt")
    SELECT input.id,'PRODUCT'::"ShopCatalogPublicationEntityType",input."productId",input.target::"ShopCatalogProjectionTarget",input."productId",'SAVED'::"ShopCatalogPublicationReceiptStatus",NOW()
    FROM jsonb_to_recordset(${JSON.stringify(receipts)}::jsonb) input(id text,"productId" text,target text)
    ON CONFLICT ("entityType","entityId","target") DO UPDATE SET "productId"=EXCLUDED."productId","processingVersion"=NULL,"failedVersion"=NULL,"status"='SAVED',"lastError"=NULL,"updatedAt"=NOW()
  `);
  return prepared.map(row => ({ id: row.productId, version: row.nextCatalogVersion, outboxId: row.outboxId }));
}
