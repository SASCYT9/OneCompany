import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import { resolveShopKnowledgeWorkerDatabaseUrl } from "../src/lib/shopKnowledgeV2/embeddings";
import {
  collectShopKnowledgeV2OtherQuarantinePreview,
  quarantineShopKnowledgeV2OtherRecords,
} from "../src/lib/shopKnowledgeV2/quarantine";

config({ path: ".env.local", override: false, quiet: true });

const prisma = new PrismaClient({
  datasourceUrl: resolveShopKnowledgeWorkerDatabaseUrl(process.env),
});

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
    throw new Error("Knowledge V2 quarantine cannot run inside Vercel production");
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SHOP_KNOWLEDGE_ALLOW_NON_VERCEL_COMMIT !== "1"
  ) {
    throw new Error(
      "Production Knowledge V2 quarantine requires SHOP_KNOWLEDGE_ALLOW_NON_VERCEL_COMMIT=1 in a controlled external worker"
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  assertKnownArguments(argv);
  const commit = argv.includes("--commit");
  const maxRecords = parseMaxRecords(argv);
  const before = await collectShopKnowledgeV2OtherQuarantinePreview(prisma);

  if (!commit) {
    console.log(JSON.stringify({ mode: "dry-run", maxRecords, before }, null, 2));
    return;
  }
  assertSafeCommitEnvironment();
  const result = await quarantineShopKnowledgeV2OtherRecords(prisma, {
    expectedCount: before.counts.knowledge,
    maxRecords,
  });
  const after = await collectShopKnowledgeV2OtherQuarantinePreview(prisma);
  if (after.counts.knowledge !== 0) {
    throw new Error(
      `Knowledge V2 quarantine verification failed: ${after.counts.knowledge} remain`
    );
  }
  console.log(JSON.stringify({ mode: "commit", before, result, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
