import { config } from "dotenv";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/prisma";
import { getShopFitmentCatalogProducts } from "../src/lib/shopFitmentCatalogServer";
import { extractProductFitment } from "../src/lib/crossShopFitment";
import {
  classifyProductFitment,
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
} from "../src/lib/shopFitmentQuality";

config({ path: ".env.local", override: false, quiet: true });

const DEFAULT_CHECKPOINT_DIR = path.join(
  process.cwd(),
  "artifacts",
  "fitment-description-backfill"
);
const DEFAULT_BATCH_SIZE = 250;

function option(name: string) {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length)
      .trim() || null
  );
}

function assertSafeCommitEnvironment() {
  if (process.env.VERCEL_ENV?.toLowerCase() === "production") {
    throw new Error("Description fitment backfill is blocked in Vercel production");
  }
  const environment = option("environment")?.toLowerCase();
  if (
    !environment ||
    !["local", "development", "test", "preview", "staging"].includes(environment)
  ) {
    throw new Error("Commit requires an explicit non-production --environment");
  }
  if (process.env.FITMENT_DESCRIPTION_BACKFILL_ALLOW_WRITE !== "1") {
    throw new Error("Set FITMENT_DESCRIPTION_BACKFILL_ALLOW_WRITE=1 to authorize the write");
  }
}

function sourceFingerprint(product: {
  title?: { ua?: string; en?: string };
  shortDescription?: { ua?: string; en?: string };
  longDescription?: { ua?: string; en?: string };
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: product.title,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
      })
    )
    .digest("hex");
}

async function loadCheckpoint(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as { lastId?: string; mode?: string };
  } catch {
    return {};
  }
}

async function main() {
  const commit = process.argv.includes("--commit");
  if (commit) assertSafeCommitEnvironment();

  const mode = commit ? "commit" : "dry-run";
  const checkpointFile = path.resolve(
    option("checkpoint") ?? path.join(DEFAULT_CHECKPOINT_DIR, `${mode}.json`)
  );
  const rollbackFile = path.resolve(
    option("rollback") ?? path.join(DEFAULT_CHECKPOINT_DIR, "commit-rollback.jsonl")
  );
  const previewFile = path.resolve(
    option("preview") ?? path.join(DEFAULT_CHECKPOINT_DIR, "dry-run-preview.jsonl")
  );
  if (!commit && !process.argv.includes("--resume")) {
    await mkdir(path.dirname(previewFile), { recursive: true });
    await writeFile(previewFile, "", "utf8");
  }
  const checkpoint = process.argv.includes("--resume") ? await loadCheckpoint(checkpointFile) : {};
  if (checkpoint.mode && checkpoint.mode !== mode) {
    throw new Error(`Checkpoint belongs to ${checkpoint.mode}; use a separate ${mode} checkpoint`);
  }
  const after = option("after") ?? checkpoint.lastId ?? null;
  const requestedLimit = Number(option("limit") ?? "0");
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : null;

  const requestedBatchSize = Number(option("batch-size") ?? String(DEFAULT_BATCH_SIZE));
  const batchSize =
    Number.isInteger(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(requestedBatchSize, 1_000)
      : DEFAULT_BATCH_SIZE;
  // These modules intentionally import `server-only`. Keep them out of the
  // dry-run module graph so the audit can run directly through `tsx`.
  const commitRuntime = commit
    ? await Promise.all([
        import("../src/lib/shopCatalogAdminSnapshot.server"),
        import("../src/lib/shopCatalogMutationCoordinator.server"),
        import("../src/lib/shopCatalogOutboxRuntime.server"),
      ]).then(([snapshot, coordinator, outbox]) => ({
        buildShopCatalogAdminSnapshot: snapshot.buildShopCatalogAdminSnapshot,
        coordinateShopCatalogProductMutation: coordinator.coordinateShopCatalogProductMutation,
        runShopCatalogOutboxRuntime: outbox.runShopCatalogOutboxRuntime,
      }))
    : null;
  const activeIds = await prisma.shopProduct.findMany({
    where: { isPublished: true, status: "ACTIVE" },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  const candidates = activeIds
    .map((product) => product.id)
    .filter((id) => !after || id.localeCompare(after) > 0);
  const selectedIds = limit ? candidates.slice(0, limit) : candidates;

  const summary = {
    mode: commit ? "commit" : "dry-run",
    scanned: 0,
    eligible: 0,
    skippedManual: 0,
    skippedAmbiguous: 0,
    unchanged: 0,
    committed: 0,
    protectedDuringCommit: 0,
    nextId: after,
    complete: selectedIds.length === candidates.length,
    checkpoint: checkpointFile,
    ...(commit ? { rollback: rollbackFile } : {}),
    ...(!commit ? { preview: previewFile } : {}),
  };

  for (let start = 0; start < selectedIds.length; start += batchSize) {
    const batchIds = selectedIds.slice(start, start + batchSize);
    const [products, persisted] = await Promise.all([
      getShopFitmentCatalogProducts({
        evidenceOnly: true,
        includeDescriptions: true,
        productIds: batchIds,
      }),
      prisma.shopProductMetafield.findMany({
        where: {
          productId: { in: batchIds },
          namespace: NORMALIZED_FITMENT_NAMESPACE,
          key: NORMALIZED_FITMENT_KEY,
        },
        select: { productId: true, value: true },
      }),
    ]);
    const persistedByProduct = new Map(persisted.map((item) => [item.productId, item.value]));
    const updates: Array<{ productId: string; value: string }> = [];

    for (const product of products) {
      if (!product.id) continue;
      summary.scanned += 1;
      const existing = persistedByProduct.get(product.id);
      if (existing) {
        try {
          const parsed = JSON.parse(existing) as {
            source?: string;
            evidence?: { sourceFingerprint?: string; processorVersion?: string };
          };
          if (parsed.source === "manual" || parsed.source === "import") {
            summary.skippedManual += 1;
            continue;
          }
        } catch {
          // Invalid legacy values are eligible for replacement by a safe result.
        }
      }
      const fingerprint = sourceFingerprint(product);
      try {
        const parsed = existing
          ? (JSON.parse(existing) as { evidence?: { sourceFingerprint?: string } })
          : null;
        if (parsed?.evidence?.sourceFingerprint === fingerprint) {
          summary.unchanged += 1;
          continue;
        }
      } catch {
        // Invalid legacy values are handled by the normalizer below.
      }
      const fitment = extractProductFitment(product);
      const normalized = classifyProductFitment(product, fitment);
      if (
        fitment.evidence?.source !== "description" ||
        !["inferred", "needs_review"].includes(normalized.status)
      ) {
        summary.skippedAmbiguous += 1;
        continue;
      }
      const value = JSON.stringify({
        ...normalized,
        evidence: normalized.evidence
          ? { ...normalized.evidence, sourceFingerprint: fingerprint }
          : normalized.evidence,
      });
      if (existing === value) {
        summary.unchanged += 1;
        continue;
      }
      summary.eligible += 1;
      updates.push({ productId: product.id, value });
    }

    if (commit && updates.length) {
      if (!commitRuntime) throw new Error("Missing commit runtime");
      const versions = await prisma.shopProduct.findMany({
        where: { id: { in: updates.map((update) => update.productId) } },
        select: { id: true, catalogVersion: true },
      });
      const versionByProduct = new Map(versions.map((row) => [row.id, row.catalogVersion]));
      for (const update of updates) {
        const expected = versionByProduct.get(update.productId);
        if (expected === undefined) continue;
        let previousValue: string | null = null;
        let committedVersion: string | null = null;
        try {
          await commitRuntime.coordinateShopCatalogProductMutation({
            productId: update.productId,
            expectedCatalogVersion: expected.toString(),
            changeDomains: ["FITMENT"],
            async mutateAndSnapshot(tx, nextCatalogVersion) {
              const current = await tx.shopProductMetafield.findUnique({
                where: {
                  productId_namespace_key: {
                    productId: update.productId,
                    namespace: NORMALIZED_FITMENT_NAMESPACE,
                    key: NORMALIZED_FITMENT_KEY,
                  },
                },
                select: { value: true },
              });
              previousValue = current?.value ?? null;
              try {
                const currentSource = current
                  ? (JSON.parse(current.value) as { source?: string })
                  : null;
                if (currentSource?.source === "manual" || currentSource?.source === "import") {
                  throw new Error("FITMENT_BACKFILL_PROTECTED");
                }
              } catch (error) {
                if ((error as Error).message === "FITMENT_BACKFILL_PROTECTED") throw error;
              }
              await tx.shopProductMetafield.upsert({
                where: {
                  productId_namespace_key: {
                    productId: update.productId,
                    namespace: NORMALIZED_FITMENT_NAMESPACE,
                    key: NORMALIZED_FITMENT_KEY,
                  },
                },
                update: { value: update.value, valueType: "json" },
                create: {
                  productId: update.productId,
                  namespace: NORMALIZED_FITMENT_NAMESPACE,
                  key: NORMALIZED_FITMENT_KEY,
                  value: update.value,
                  valueType: "json",
                },
              });
              committedVersion = nextCatalogVersion.toString();
              return commitRuntime.buildShopCatalogAdminSnapshot(
                tx,
                update.productId,
                nextCatalogVersion,
                {
                  type: "SYSTEM",
                  id: "fitment-description-backfill",
                  reason: "fitment.description.backfill",
                }
              );
            },
          });
          await mkdir(path.dirname(rollbackFile), { recursive: true });
          await appendFile(
            rollbackFile,
            `${JSON.stringify({
              productId: update.productId,
              previousValue,
              nextValue: update.value,
              catalogVersion: committedVersion,
              committedAt: new Date().toISOString(),
            })}\n`,
            "utf8"
          );
          summary.committed += 1;
        } catch (error) {
          if ((error as Error).message === "FITMENT_BACKFILL_PROTECTED") {
            summary.protectedDuringCommit += 1;
            continue;
          }
          throw error;
        }
      }
      await commitRuntime.runShopCatalogOutboxRuntime({
        workerId: `fitment-description-backfill:${process.env.VERCEL_REGION || "local"}`,
        limit: Math.min(100, updates.length),
      });
    } else if (!commit && updates.length) {
      await appendFile(
        previewFile,
        `${updates
          .map(({ productId, value }) =>
            JSON.stringify({ productId, value, generatedAt: new Date().toISOString() })
          )
          .join("\n")}\n`,
        "utf8"
      );
    }

    summary.nextId = batchIds.at(-1) ?? summary.nextId;
    await mkdir(path.dirname(checkpointFile), { recursive: true });
    await writeFile(
      checkpointFile,
      `${JSON.stringify({ mode, lastId: summary.nextId, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8"
    );
    console.log(
      JSON.stringify(
        {
          mode: summary.mode,
          batch: { start: start + 1, end: start + batchIds.length, total: selectedIds.length },
          nextId: summary.nextId,
          batchUpdates: updates.length,
        },
        null,
        2
      )
    );
  }

  console.log(JSON.stringify({ ...summary, updates: summary.eligible }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
