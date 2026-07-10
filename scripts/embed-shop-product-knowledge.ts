import { GoogleGenAI } from "@google/genai";

import { prisma } from "../src/lib/prisma";

const model = process.env.SHOP_AI_EMBEDDING_MODEL || "gemini-embedding-2";
const dimensions = 768;
const batchSize = 20;

function parseLimit() {
  const raw = process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1];
  const value = raw ? Number(raw) : 100;
  if (!Number.isInteger(value) || value <= 0 || value > 10_000) {
    throw new Error("--limit must be an integer between 1 and 10000");
  }
  return value;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const limit = parseLimit();
  const rows = await prisma.shopProductKnowledge.findMany({
    where: { OR: [{ embeddingModel: null }, { embeddingModel: { not: model } }] },
    select: { productId: true, searchText: true },
    orderBy: { indexedAt: "asc" },
    take: limit,
  });
  console.log(
    JSON.stringify({
      mode: commit ? "commit" : "dry-run",
      model,
      dimensions,
      candidates: rows.length,
    })
  );
  if (!commit || !rows.length) return;

  const apiKey = (process.env.SHOP_AI_API_KEY || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) throw new Error("SHOP_AI_API_KEY or GEMINI_API_KEY is required");
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  let embedded = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const response = await client.models.embedContent({
      model,
      contents: batch.map((row) => row.searchText.slice(0, 12_000)),
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: dimensions,
        httpOptions: { timeout: 30_000 },
      },
    });
    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: expected ${batch.length}, received ${embeddings.length}`
      );
    }
    for (let index = 0; index < batch.length; index += 1) {
      const values = embeddings[index]?.values;
      if (!values || values.length !== dimensions) {
        throw new Error(`Invalid embedding dimensions for ${batch[index].productId}`);
      }
      const vector = `[${values.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "ShopProductKnowledge"
        SET "embedding" = CAST(${vector} AS vector),
            "embeddingModel" = ${model},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "productId" = ${batch[index].productId}
      `;
      embedded += 1;
    }
    console.log(`Embedded ${embedded}/${rows.length}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
