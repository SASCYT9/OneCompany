import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  buildRaceChipSourceRecordDraft,
  type RaceChipSnapshotProduct,
} from "../src/lib/shopCatalogRaceChipNormalization";

const PAGE_SIZE = 250;
const dimensions = [
  "SCOPE", "MAKE", "MODEL", "GENERATION", "CHASSIS", "YEAR", "ENGINE", "FUEL",
  "BODY_STYLE", "DRIVETRAIN", "TRANSMISSION", "MARKET", "OPF_GPF",
] as const;

function assertAuthorized() {
  if (!process.argv.includes("--commit") || process.env.CATALOG_V2_PRODUCTION_PROJECTION_ACK !== "1") {
    throw new Error("Pass --commit and CATALOG_V2_PRODUCTION_PROJECTION_ACK=1");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const target = new URL(raw);
  if (target.hostname !== "db.prisma.io" || target.pathname !== "/postgres") {
    throw new Error("Target must be the approved Prisma production database");
  }
}

async function loadDrafts() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const descriptor = manifest.stores?.racechip;
  if (!descriptor?.file || !descriptor.count) throw new Error("RaceChip fallback shard is missing");
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("RaceChip shard hash mismatch");
  const products = JSON.parse(raw) as RaceChipSnapshotProduct[];
  if (products.length !== descriptor.count) throw new Error("RaceChip shard count mismatch");
  return products.map((product) => buildRaceChipSourceRecordDraft({ product, sourceRevision: hash }));
}

async function main() {
  assertAuthorized();
  const drafts = await loadDrafts();
  const client = new PrismaClient();
  let applied = 0;
  try {
    for (let offset = 0; offset < drafts.length; offset += PAGE_SIZE) {
      const page = drafts.slice(offset, offset + PAGE_SIZE);
      const productIds = page.map((draft) => draft.normalization.productId);
      const products = await client.shopProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, catalogVersion: true, variants: { select: { id: true } } },
      });
      const productById = new Map(products.map((product) => [product.id, product]));
      if (products.length !== page.length) throw new Error("RaceChip projection page references missing products");

      const policies = page.map((draft) => {
        const n = draft.normalization;
        const product = productById.get(n.productId)!;
        if (!product.variants.some((variant) => variant.id === n.variantId)) {
          throw new Error(`Invalid RaceChip variant ownership: ${n.variantId}`);
        }
        return {
          targetKey: `variant:${n.variantId}`,
          productId: n.productId,
          variantId: n.variantId,
          mode: "VEHICLE_SPECIFIC" as const,
          sourceVersion: product.catalogVersion,
          requiredDimensions: ["SCOPE", "MAKE", "MODEL", "YEAR", "ENGINE", "FUEL"] as const,
          dimensionDefaults: {},
          clauseCount: 1,
        };
      });
      const clauses = page.map((draft) => {
        const n = draft.normalization;
        const product = productById.get(n.productId)!;
        return {
          targetKey: `variant:${n.variantId}`,
          productId: n.productId,
          variantId: n.variantId,
          sourceVersion: product.catalogVersion,
          clauseKey: `racechip:${n.productId}`,
          // Direct projection intentionally keeps unresolved taxonomy text visible
          // while the slower canonical provenance backfill completes.
          verification: "NEEDS_REVIEW" as const,
          sourceRef: n.recordKey,
        };
      });
      const constraints = page.flatMap((draft) => {
        const n = draft.normalization;
        const product = productById.get(n.productId)!;
        const base = {
          targetKey: `variant:${n.variantId}`,
          productId: n.productId,
          variantId: n.variantId,
          sourceVersion: product.catalogVersion,
          clauseKey: `racechip:${n.productId}`,
          valueOrdinal: 0,
        };
        const exactText = (dimension: typeof dimensions[number], textValue: string) => ({
          ...base, dimension, state: "EXACT" as const, valueKind: "text", textValue,
        });
        return [
          exactText("SCOPE", "auto"),
          exactText("MAKE", n.make),
          exactText("MODEL", n.model),
          n.generation ? exactText("GENERATION", n.generation) : { ...base, dimension: "GENERATION" as const, state: "ANY" as const },
          { ...base, dimension: "CHASSIS" as const, state: "NOT_APPLICABLE" as const },
          { ...base, dimension: "YEAR" as const, state: "EXACT" as const, valueKind: "year_range", yearFrom: n.yearFrom, yearTo: n.yearTo },
          exactText("ENGINE", n.engineDescriptor),
          n.fuel ? exactText("FUEL", n.fuel) : { ...base, dimension: "FUEL" as const, state: "UNKNOWN" as const },
          ...(["BODY_STYLE", "DRIVETRAIN", "TRANSMISSION", "MARKET", "OPF_GPF"] as const).map((dimension) => ({
            ...base, dimension, state: "NOT_APPLICABLE" as const,
          })),
        ];
      });

      await client.$transaction(async (tx) => {
        await tx.shopCatalogProjectionPolicy.deleteMany({ where: { targetKey: { in: policies.map((row) => row.targetKey) } } });
        await tx.shopCatalogProjectionPolicy.createMany({ data: policies as never[] });
        await tx.shopCatalogProjectionClause.createMany({ data: clauses as never[] });
        await tx.shopCatalogProjectionConstraint.createMany({ data: constraints as never[] });
      });
      applied += page.length;
      process.stdout.write(`[racechip-projection] ${applied}/${drafts.length}\n`);
    }
    const makes = await client.shopCatalogProjectionConstraint.count({
      where: { productId: { in: drafts.map((draft) => draft.normalization.productId) }, dimension: "MAKE", state: "EXACT" },
    });
    if (makes !== drafts.length) throw new Error(`RaceChip MAKE parity failed: ${makes}/${drafts.length}`);
    console.log(JSON.stringify({ products: drafts.length, makeConstraints: makes }));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
