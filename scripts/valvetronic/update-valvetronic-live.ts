/**
 * Brings Valvetronic products that are already on the site in line with the reviewed
 * data: UA/EN texts and SEO fields, USD prices, shipping weights and the pricing record.
 * Photos (already on Vercel Blob), options, fitment and publication are never touched.
 *
 *   npx tsx --conditions=react-server scripts/valvetronic/update-valvetronic-live.ts            # report
 *   npx tsx --conditions=react-server scripts/valvetronic/update-valvetronic-live.ts --commit   # apply
 *
 * Run it after editing copy.json / overrides.json / weights.json, then drain the catalog
 * outbox (the activation script does it: it skips products that are already active).
 */
import { Prisma, PrismaClient } from "@prisma/client";

import { buildShopCatalogAdminSnapshot } from "../../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../../src/lib/shopCatalogMutationCoordinator.server";
import { VALVETRONIC_BRAND } from "../../src/lib/valvetronicCatalog";
import { loadValvetronicImport } from "../import-valvetronic-catalog-drafts";

const TEXT_FIELDS = [
  "titleUa",
  "titleEn",
  "shortDescUa",
  "shortDescEn",
  "longDescUa",
  "longDescEn",
  "bodyHtmlUa",
  "bodyHtmlEn",
  "seoTitleUa",
  "seoTitleEn",
  "seoDescriptionUa",
  "seoDescriptionEn",
] as const;

const money = (value: unknown) => Number(value ?? 0).toFixed(2);
const kg = (value: unknown) =>
  value === null || value === undefined ? "" : Number(value).toFixed(3);

async function main() {
  const commit = process.argv.includes("--commit");
  const { payloads } = await loadValvetronicImport();
  const bySku = new Map(payloads.map((payload) => [payload.sku, payload]));
  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: VALVETRONIC_BRAND },
      select: {
        id: true,
        sku: true,
        catalogVersion: true,
        priceUsd: true,
        weight: true,
        highlights: true,
        ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, true])),
        variants: { select: { id: true, sku: true, priceUsd: true, weight: true, grams: true } },
        metafields: {
          where: { namespace: "valvetronic_import", key: "pricing" },
          select: { id: true, value: true },
        },
      },
    });
    const changes = [];
    for (const product of products) {
      const payload = bySku.get(product.sku ?? "");
      if (!payload) continue;
      const productData: Record<string, unknown> = {};
      for (const field of TEXT_FIELDS) {
        const next = payload[field] ?? null;
        if ((product as Record<string, unknown>)[field] !== next) productData[field] = next;
      }
      // Stored JSON may list the locales in another order: compare the content.
      const sameLocales = (value: unknown) => {
        const record = (value ?? {}) as { ua?: unknown; en?: unknown };
        return JSON.stringify([record.ua ?? null, record.en ?? null]);
      };
      if (sameLocales(product.highlights) !== sameLocales(payload.highlights)) {
        productData.highlights = payload.highlights as Prisma.InputJsonValue;
      }
      if (money(product.priceUsd) !== money(payload.priceUsd))
        productData.priceUsd = payload.priceUsd;
      if (kg(product.weight) !== kg(payload.weight)) productData.weight = payload.weight;
      const variantChanges = product.variants.flatMap((variant) => {
        const next = payload.variants.find((item) => item.sku === variant.sku);
        if (!next) return [];
        const data: Record<string, unknown> = {};
        if (money(variant.priceUsd) !== money(next.priceUsd)) data.priceUsd = next.priceUsd;
        if (kg(variant.weight) !== kg(next.weight)) data.weight = next.weight;
        if (Number(variant.grams ?? 0) !== Number(next.grams ?? 0)) data.grams = next.grams;
        return Object.keys(data).length
          ? [{ id: variant.id, sku: variant.sku, data, from: money(variant.priceUsd) }]
          : [];
      });
      const pricing = payload.metafields.find((item) => item.key === "pricing")?.value;
      const pricingMetafield = product.metafields[0];
      const pricingChanged = Boolean(
        pricing && pricingMetafield && pricingMetafield.value !== pricing
      );
      if (!Object.keys(productData).length && !variantChanges.length && !pricingChanged) continue;
      changes.push({
        product,
        productData,
        variantChanges,
        pricing,
        pricingMetafield,
        pricingChanged,
      });
    }

    const report = {
      mode: commit ? "commit" : "report",
      productsOnSite: products.length,
      productsToUpdate: changes.length,
      fieldsSample: changes.slice(0, 3).map((change) => ({
        sku: change.product.sku,
        fields: Object.keys(change.productData),
        variants: change.variantChanges.slice(0, 2).map((variant) => [variant.sku, variant.data]),
        pricing: change.pricingChanged,
      })),
      textUpdates: changes.filter((change) =>
        TEXT_FIELDS.some((field) => field in change.productData)
      ).length,
      priceChanges: changes.flatMap((change) =>
        change.variantChanges
          .filter((variant) => "priceUsd" in variant.data)
          .map((variant) => `${variant.sku}: $${variant.from} → $${variant.data.priceUsd}`)
      ),
    };
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    for (const change of changes) {
      await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: change.product.id,
        expectedCatalogVersion: change.product.catalogVersion.toString(),
        changeDomains: ["CONTENT", "SEO", "PRICE"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          if (Object.keys(change.productData).length) {
            await tx.shopProduct.update({
              where: { id: change.product.id },
              data: change.productData as Prisma.ShopProductUpdateInput,
            });
          }
          for (const variant of change.variantChanges) {
            await tx.shopProductVariant.update({ where: { id: variant.id }, data: variant.data });
          }
          if (change.pricingChanged && change.pricingMetafield && change.pricing) {
            await tx.shopProductMetafield.update({
              where: { id: change.pricingMetafield.id },
              data: { value: change.pricing },
            });
          }
          return buildShopCatalogAdminSnapshot(tx, change.product.id, nextCatalogVersion, {
            type: "IMPORT",
            id: "valvetronic-import@system.local",
            reason: "valvetronic.live-update",
          });
        },
      });
    }
    process.stdout.write(`${JSON.stringify({ ...report, updated: changes.length }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
