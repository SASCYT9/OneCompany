import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { shopPriceSourceReadiness } from "../../../src/lib/shopPriceSourceReadiness.server";

const url = process.env.MONOBANK_TEST_DATABASE_URL;
test(
  "managed price activation checks every independent product and variant price band",
  { skip: !url },
  async () => {
    const target = new URL(url!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname) &&
        target.pathname.startsWith("/monobank_test")
    );
    const db = new PrismaClient({ datasources: { db: { url } } });
    const id = randomUUID();
    try {
      const product = await db.shopProduct.create({
        data: {
          id,
          slug: id,
          titleUa: "Synthetic",
          titleEn: "Synthetic",
          status: "ACTIVE",
          isPublished: true,
          priceEur: 100,
          priceUsd: 120,
          priceUah: 5300,
          priceEurB2b: 90,
          priceUsdB2b: 108,
          variants: { create: [{ position: 1, priceEur: 110, priceUsd: 132, isDefault: true }] },
        },
        include: { variants: true },
      });
      let report = await shopPriceSourceReadiness(db, id);
      assert.equal(report.ready, false);
      assert.equal(report.unresolvedBands, 3);
      await db.shopProduct.update({
        where: { id },
        data: { priceSourceCurrency: "EUR", b2bPriceSourceCurrency: "EUR" },
      });
      report = await shopPriceSourceReadiness(db, id);
      assert.equal(report.unresolvedBands, 1);
      await db.shopProductVariant.update({
        where: { id: product.variants[0].id },
        data: { priceSourceCurrency: "EUR" },
      });
      assert.equal((await shopPriceSourceReadiness(db, id)).ready, true);
      await db.shopProduct.update({
        where: { id },
        data: { priceSourceCurrency: "USD", priceUsd: null },
      });
      assert.equal((await shopPriceSourceReadiness(db, id)).ready, false);
    } finally {
      await db.shopProduct.updateMany({ where: { id }, data: { isPublished: false } });
      await db.$disconnect();
    }
  }
);
