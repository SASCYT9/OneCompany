import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import { buildKwCanonicalProductDraft } from "../src/lib/shopCatalogKwDraft";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import {
  buildKwVehicleMakeEvidence,
  normalizeKwShopifyProduct,
} from "../src/lib/shopCatalogKwNormalization";
import {
  parseShopifyProductJsonl,
  parseShopifyProductTranslationMap,
  selectKwShopifyProducts,
} from "../src/lib/shopifyCatalogSnapshot";

const snapshotDir = resolve("backups/shopify/kw-suspensions/2026-09-02");
const commit = process.argv.includes("--commit");

async function retry<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (!new Set(["P1017", "P2024", "P2028", "P2034"]).has(code) || attempt === 5) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 250));
    }
  }
  throw new Error("KW translation update retry loop exhausted");
}

async function main() {
  const products = selectKwShopifyProducts(
    parseShopifyProductJsonl(await readFile(resolve(snapshotDir, "products.jsonl"), "utf8"))
  );
  const translations = parseShopifyProductTranslationMap(
    await readFile(resolve(snapshotDir, "translations-en.jsonl"), "utf8")
  );
  const evidence = buildKwVehicleMakeEvidence(products);
  const drafts = new Map(
    products.map((product) => {
      const draft = buildKwCanonicalProductDraft({
        product,
        normalization: normalizeKwShopifyProduct(product, evidence),
        enTranslations: translations.get(product.id),
      });
      return [product.id, draft];
    })
  );

  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({
      where: { key: "shopify-kw-suspensions" },
      select: { id: true },
    });
    const heads = await prisma.shopCatalogSourceBindingHead.findMany({
      where: { sourceId: source.id, entityType: "PRODUCT" },
      select: {
        externalKey: true,
        currentBinding: {
          select: {
            sourceRecordId: true,
            productId: true,
            product: {
              select: { catalogVersion: true, titleEn: true, bodyHtmlEn: true, isPublished: true },
            },
          },
        },
      },
    });
    const missingBindings = [...drafts.keys()].filter(
      (id) => !heads.some((head) => head.externalKey === id && head.currentBinding.productId)
    );
    if (missingBindings.length)
      throw new Error(`Missing ${missingBindings.length} KW product bindings`);
    const pending = heads.flatMap((head) => {
      const draft = drafts.get(head.externalKey);
      const binding = head.currentBinding;
      if (!draft || !binding.productId || !binding.product || !binding.sourceRecordId) return [];
      if (
        binding.product.titleEn === draft.product.titleEn &&
        binding.product.bodyHtmlEn === draft.product.bodyHtmlEn
      )
        return [];
      return [
        {
          draft,
          productId: binding.productId,
          sourceRecordId: binding.sourceRecordId,
          version: binding.product.catalogVersion.toString(),
          published: binding.product.isPublished,
        },
      ];
    });
    const [staleTitleIssues, staleBodyIssues] = await Promise.all([
      prisma.shopCatalogNormalizationIssue.count({
        where: { code: "TITLE_EN_MISSING", sourceRecord: { sourceId: source.id } },
      }),
      prisma.shopCatalogNormalizationIssue.count({
        where: {
          code: "BODY_HTML_EN_MISSING",
          sourceRecord: { sourceId: source.id },
          product: { bodyHtmlEn: { not: null } },
        },
      }),
    ]);
    const summary = {
      mode: commit ? "commit" : "dry-run",
      sourceProducts: drafts.size,
      bindings: heads.length,
      changed: pending.length,
      unchanged: drafts.size - pending.length,
      publishedChanged: pending.filter((entry) => entry.published).length,
      staleTranslationIssues: staleTitleIssues + staleBodyIssues,
    };
    if (!commit) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      let updated = 0;
      for (let offset = 0; offset < pending.length; offset += 4) {
        await Promise.all(
          pending.slice(offset, offset + 4).map((entry) =>
            retry(() =>
              prisma.$transaction(
                (tx) =>
                  coordinateShopCatalogProductMutationInTransaction(tx, {
                    productId: entry.productId,
                    expectedCatalogVersion: entry.version,
                    changeDomains: ["CONTENT"],
                    async mutateAndSnapshot(innerTx, nextCatalogVersion) {
                      await innerTx.shopProduct.update({
                        where: { id: entry.productId },
                        data: {
                          titleEn: entry.draft.product.titleEn,
                          bodyHtmlEn: entry.draft.product.bodyHtmlEn,
                        },
                      });
                      const snapshot = await buildShopCatalogAdminSnapshot(
                        innerTx,
                        entry.productId,
                        nextCatalogVersion,
                        {
                          type: "IMPORT",
                          id: "kw-shopify-import@system.local",
                          reason: "kw.english-translation-refresh",
                        }
                      );
                      return { ...snapshot, sourceRecordId: entry.sourceRecordId };
                    },
                  }),
                { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }
              )
            )
          )
        );
        updated += Math.min(4, pending.length - offset);
        if (updated % 100 === 0 || updated === pending.length)
          process.stdout.write(`${JSON.stringify({ updated, total: pending.length })}\n`);
      }
      const [deletedTitleIssues, deletedBodyIssues] = await prisma.$transaction([
        prisma.shopCatalogNormalizationIssue.deleteMany({
          where: { code: "TITLE_EN_MISSING", sourceRecord: { sourceId: source.id } },
        }),
        prisma.shopCatalogNormalizationIssue.deleteMany({
          where: {
            code: "BODY_HTML_EN_MISSING",
            sourceRecord: { sourceId: source.id },
            product: { bodyHtmlEn: { not: null } },
          },
        }),
      ]);
      process.stdout.write(
        `${JSON.stringify({ ...summary, updated, deletedStaleTranslationIssues: deletedTitleIssues.count + deletedBodyIssues.count }, null, 2)}\n`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
