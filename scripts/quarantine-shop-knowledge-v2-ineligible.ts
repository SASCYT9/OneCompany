import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import { indexShopKnowledgeProduct } from "../src/lib/shopKnowledgeV2/indexer";
import { createPrismaShopKnowledgeV2Repository } from "../src/lib/shopKnowledgeV2/prismaRepository";
import { resolveShopKnowledgeWorkerDatabaseUrl } from "../src/lib/shopKnowledgeV2/embeddings";
import { SHOP_KNOWLEDGE_V2_SCHEMA_VERSION } from "../src/lib/shopKnowledgeV2/types";

config({ path: ".env.local", override: false, quiet: true });

const prisma = new PrismaClient({
  datasourceUrl: resolveShopKnowledgeWorkerDatabaseUrl(process.env),
});

type Candidate = {
  productId: string;
  knowledgeId: string;
  revision: number;
  slug: string;
  sku: string | null;
  isPublished: boolean;
  productStatus: string;
};

function parseMaxRecords(argv: string[]) {
  const argument = argv.find((value) => value.startsWith("--max-records="));
  if (!argument) return 1_000;
  const value = Number(argument.slice("--max-records=".length));
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    throw new Error("--max-records must be an integer between 1 and 10000");
  }
  return value;
}

function assertKnownArguments(argv: string[]) {
  const unknown = argv.filter(
    (argument) => argument !== "--commit" && !argument.startsWith("--max-records=")
  );
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
}

function assertSafeCommitEnvironment() {
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production") {
    throw new Error("Knowledge V2 eligibility quarantine cannot run inside Vercel production");
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SHOP_KNOWLEDGE_ALLOW_NON_VERCEL_COMMIT !== "1"
  ) {
    throw new Error(
      "Production Knowledge V2 eligibility quarantine requires SHOP_KNOWLEDGE_ALLOW_NON_VERCEL_COMMIT=1 in a controlled external worker"
    );
  }
}

async function listCandidates() {
  return prisma.$queryRaw<Candidate[]>(Prisma.sql`
    SELECT
      product."id" AS "productId",
      knowledge."id" AS "knowledgeId",
      knowledge."revision" AS "revision",
      product."slug" AS "slug",
      product."sku" AS "sku",
      product."isPublished" AS "isPublished",
      product."status"::text AS "productStatus"
    FROM "ShopProductKnowledge" knowledge
    JOIN "ShopProduct" product ON product."id" = knowledge."productId"
    WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
      AND (product."isPublished" = false OR product."status"::text <> 'ACTIVE')
    ORDER BY product."id" ASC
  `);
}

async function main() {
  const argv = process.argv.slice(2);
  assertKnownArguments(argv);
  const commit = argv.includes("--commit");
  const maxRecords = parseMaxRecords(argv);
  const before = await listCandidates();
  const preview = { count: before.length, samples: before.slice(0, 50) };

  if (!commit) {
    console.log(JSON.stringify({ mode: "dry-run", maxRecords, before: preview }, null, 2));
    return;
  }
  assertSafeCommitEnvironment();
  if (before.length > maxRecords) {
    throw new Error(
      `Knowledge V2 eligibility quarantine refused ${before.length} records; maxRecords is ${maxRecords}`
    );
  }

  const repository = createPrismaShopKnowledgeV2Repository(prisma);
  let excluded = 0;
  for (const candidate of before) {
    const product = await repository.loadSourceProduct(candidate.productId);
    if (!product) throw new Error(`Catalog product disappeared: ${candidate.productId}`);
    const outcome = await indexShopKnowledgeProduct(repository, product);
    if (outcome.result !== "excluded") {
      throw new Error(
        `Catalog eligibility changed while quarantining ${candidate.productId}: ${outcome.result}`
      );
    }
    excluded += 1;
  }

  const after = await listCandidates();
  if (after.length !== 0) {
    throw new Error(`Knowledge V2 eligibility quarantine left ${after.length} current records`);
  }
  console.log(
    JSON.stringify(
      { mode: "commit", before: preview, result: { excluded }, after: { count: after.length } },
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
