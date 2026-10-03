import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";

async function main() {
  const envPath = process.argv.find((arg) => arg.startsWith("--env-path="))?.slice(11);
  if (!envPath) throw new Error("Explicit env-path required");
  const env = parse(readFileSync(envPath));
  const url = env.DIRECT_URL || env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const sku = "OC-CHECKOUT-TEST-10USD";
  const slug = "onecompany-checkout-test-10usd";
  try {
    const existing = await prisma.shopProduct.findMany({ where: { OR: [{ sku }, { slug }] }, select: { id: true, sku: true, slug: true, isPublished: true, priceUsd: true } });
    if (existing.length) {
      if (existing.length !== 1 || existing[0].sku !== sku || existing[0].slug !== slug || Number(existing[0].priceUsd) !== 10) throw new Error("Test SKU collision; review existing card");
      console.log(JSON.stringify({ existing: true, ...existing[0], priceUsd: Number(existing[0].priceUsd) }));
      return;
    }
    const data = { sku, slug, scope: "auto", brand: "OneCompany", vendor: "OneCompany", productType: "checkout-test", titleUa: "Тестовий товар — перевірка оформлення замовлення", titleEn: "Test product — checkout verification", shortDescUa: "Тестовий товар за $10. Доставку та фінальну суму погоджує менеджер.", shortDescEn: "A $10 test product. Shipping and the final total are agreed with a manager.", priceUsd: 10, priceEur: null, priceUah: null, isPublished: false, stock: "preOrder", tags: ["internal-test", "checkout-test"], status: "ACTIVE" as const };
    writeFileSync(resolve("outputs/site-commerce-2026-10-03/test-product-plan.json"), JSON.stringify({ createdAt: new Date().toISOString(), data }, null, 2));
    console.log(JSON.stringify({ dryRun: !process.argv.includes("--commit-draft"), sku, slug, priceUsd: 10, isPublished: false }));
    if (!process.argv.includes("--commit-draft")) return;
    const { coordinateShopCatalogProductCreationWithClient } = await import("../src/lib/shopCatalogMutationCoordinator.server");
    const { buildShopCatalogAdminSnapshot } = await import("../src/lib/shopCatalogAdminSnapshot.server");
    const result = await coordinateShopCatalogProductCreationWithClient(prisma, { changeDomains: ["CONTENT", "PRICE", "VISIBILITY"], async create(tx) {
      const product = await tx.shopProduct.create({ data: { ...data, variants: { create: { sku, title: "Default", isDefault: true, priceUsd: 10, inventoryQty: 0 } } } });
      return product.id;
    }, snapshot: (tx, id, version) => buildShopCatalogAdminSnapshot(tx, id, version, { type: "IMPORT", id: "owner-requested-checkout-test-2026-10-03", reason: "Prepare separate unpublished USD 10 test product; publish only after international checkout rollout" }) });
    writeFileSync(resolve("outputs/site-commerce-2026-10-03/test-product-result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ created: true, productId: result.productId, sku, isPublished: false }));
  } finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Test product preparation failed"); process.exitCode = 1; });
