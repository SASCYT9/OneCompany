import { config } from "dotenv";

import { prisma } from "../src/lib/prisma";
import {
  isShopKnowledgeBackfillAllowed,
  parseShopKnowledgeBackfillCategories,
} from "../src/lib/shopKnowledgeV2/backfillPolicy";
import { buildShopKnowledgeV2 } from "../src/lib/shopKnowledgeV2/builders";
import {
  indexShopKnowledgeProduct,
  previewShopKnowledgeProduct,
} from "../src/lib/shopKnowledgeV2/indexer";
import { listShopKnowledgeSourceProducts } from "../src/lib/shopKnowledgeV2/source";

config({ path: ".env.local", override: false, quiet: true });

type BackfillStats = {
  scanned: number;
  created: number;
  updated: number;
  unchanged: number;
  blocked: number;
  ready: number;
  needsReview: number;
  chunks: number;
  applications: number;
  variants: number;
  categorySkipped: number;
  excludedOther: number;
  correctedProducts: number;
  deactivatedApplications: number;
  suspiciousProducts: number;
};

type CleanupExample = {
  productId: string;
  slug: string;
  removed: string[];
  added: string[];
  qualityFlags: string[];
};

const applicationSignature = (application: {
  make?: string | null;
  model?: string | null;
  chassisCode?: string | null;
}) =>
  [application.make, application.model, application.chassisCode]
    .map((value) => value?.trim().toLowerCase() ?? "")
    .join("|");

function parsePositiveInteger(
  argv: string[],
  name: string,
  fallback: number | null
): number | null {
  const raw = argv.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function assertSafeCommitEnvironment() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Knowledge V2 backfill commit is blocked in Vercel production");
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview" &&
    process.env.SHOP_KNOWLEDGE_ALLOW_NON_VERCEL_COMMIT !== "1"
  ) {
    throw new Error(
      "Knowledge V2 backfill commit is blocked in NODE_ENV=production; use staging or an explicit controlled environment"
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const commit = argv.includes("--commit");
  const includeBlocked = argv.includes("--include-blocked");
  const categories = parseShopKnowledgeBackfillCategories(argv);
  const limit = parsePositiveInteger(argv, "--limit", null);
  const batchSize = parsePositiveInteger(argv, "--batch", 100) ?? 100;
  if (batchSize > 500) throw new Error("--batch must not exceed 500");
  if (commit && categories.size === 0) {
    throw new Error(
      "Knowledge V2 commit requires at least one explicit --category=<id> rollout gate"
    );
  }
  if (commit) assertSafeCommitEnvironment();

  const repository = commit
    ? (
        await import("../src/lib/shopKnowledgeV2/prismaRepository")
      ).createPrismaShopKnowledgeV2Repository(prisma)
    : null;
  const stats: BackfillStats = {
    scanned: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    blocked: 0,
    ready: 0,
    needsReview: 0,
    chunks: 0,
    applications: 0,
    variants: 0,
    categorySkipped: 0,
    excludedOther: 0,
    correctedProducts: 0,
    deactivatedApplications: 0,
    suspiciousProducts: 0,
  };
  const cleanupExamples: CleanupExample[] = [];
  let cursor: string | undefined;

  while (limit === null || stats.scanned < limit) {
    const remaining = limit === null ? batchSize : Math.min(batchSize, limit - stats.scanned);
    const products = await listShopKnowledgeSourceProducts({
      cursor,
      take: remaining,
      includeBlocked,
    });
    if (products.length === 0) break;
    const activeApplications = await prisma.shopVehicleApplication.findMany({
      where: {
        productId: { in: products.map((product) => product.id) },
        isActive: true,
      },
      select: {
        productId: true,
        make: true,
        model: true,
        chassisCode: true,
      },
    });
    const activeByProduct = new Map<
      string,
      Array<{ make: string | null; model: string | null; chassisCode: string | null }>
    >();
    for (const application of activeApplications) {
      const list = activeByProduct.get(application.productId) ?? [];
      list.push(application);
      activeByProduct.set(application.productId, list);
    }

    for (const product of products) {
      const build = buildShopKnowledgeV2(product);
      if (!isShopKnowledgeBackfillAllowed(build.categoryGroup, categories)) {
        const category = build.categoryGroup;
        if (category === "other") stats.excludedOther += 1;
        else stats.categorySkipped += 1;
        continue;
      }
      const currentSignatures = new Set(
        (activeByProduct.get(product.id) ?? []).map(applicationSignature)
      );
      const nextSignatures = new Set(build.applications.map(applicationSignature));
      const removed = [...currentSignatures].filter((value) => !nextSignatures.has(value));
      const added = [...nextSignatures].filter((value) => !currentSignatures.has(value));
      if (removed.length > 0 || added.length > 0) stats.correctedProducts += 1;
      stats.deactivatedApplications += removed.length;
      if (build.status === "NEEDS_REVIEW" || build.status === "BLOCKED") {
        stats.suspiciousProducts += 1;
      }
      if (
        cleanupExamples.length < 20 &&
        (removed.length > 0 || added.length > 0 || build.qualityFlags.length > 0)
      ) {
        cleanupExamples.push({
          productId: product.id,
          slug: product.slug,
          removed,
          added,
          qualityFlags: build.qualityFlags,
        });
      }
      const preview = previewShopKnowledgeProduct(product);
      const outcome = repository ? await indexShopKnowledgeProduct(repository, product) : preview;
      stats.scanned += 1;
      stats[outcome.result === "blocked" ? "blocked" : outcome.result] += 1;
      if (outcome.status === "READY") stats.ready += 1;
      if (outcome.status === "NEEDS_REVIEW") stats.needsReview += 1;
      stats.chunks += outcome.chunks;
      stats.applications += outcome.applications;
      stats.variants += outcome.variants;
    }

    cursor = products.at(-1)?.id;
    if (stats.scanned % 500 === 0) {
      console.log(
        JSON.stringify({
          progress: stats.scanned,
          mode: commit ? "commit" : "dry-run",
          cursor,
        })
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: commit ? "commit" : "dry-run",
        includeBlocked,
        categories: Array.from(categories),
        limit,
        batchSize,
        ...stats,
        cleanupExamples,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
