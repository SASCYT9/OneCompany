import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../src/lib/prisma";
import { getShopCatalogCardPricingByIds } from "../../../src/lib/shopCatalogCardPricing.server";
import { getShopFitmentCatalogProducts } from "../../../src/lib/shopFitmentCatalogServer";
import { resolveShopProductPricing } from "../../../src/lib/shopPricingAudience";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";

const url = process.env.MONOBANK_TEST_DATABASE_URL;
test(
  "both catalog readers retain each native price band through NBU pricing and variant inheritance",
  { skip: !url },
  async () => {
    const target = new URL(url!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname) &&
        target.pathname.startsWith("/monobank_test")
    );
    assert.equal(process.env.DATABASE_URL, url);
    const ids = [randomUUID(), randomUUID()];
    const rates = {
      EUR: 1,
      USD: 51.483 / 46.0564,
      UAH: 50.483,
      _rawUsdToUah: 45.0564,
      _uahReserve: 1,
    };
    const viewer = {
      customerGroup: null,
      customerB2BDiscountPercent: null,
      isAuthenticated: false,
      defaultB2BDiscountPercent: 0,
      b2bVisibilityMode: "request_quote" as const,
      priceCountry: "Ukraine",
      currencyRates: rates,
    };
    try {
      await prisma.shopProduct.create({
        data: {
          id: ids[0],
          slug: ids[0],
          sku: ids[0],
          titleUa: "Synthetic",
          titleEn: "Synthetic",
          status: "ACTIVE",
          isPublished: true,
          priceEur: 100,
          priceUsd: 112,
          priceUah: 5150,
          priceSourceCurrency: "EUR",
          priceEurEurope: 125,
          priceEurB2b: 71,
          priceUsdB2b: 80,
          priceUahB2b: 3600,
          b2bPriceSourceCurrency: "USD",
          compareAtEur: 120,
          compareAtUsd: 134,
          compareAtUah: 6100,
          compareAtSourceCurrency: "EUR",
          compareAtEurB2b: 90,
          compareAtUsdB2b: 100,
          compareAtUahB2b: 5000,
          b2bCompareAtSourceCurrency: "UAH",
          variants: { create: { sku: ids[0] + "-inherited", isDefault: true } },
        },
      });
      await prisma.shopProduct.create({
        data: {
          id: ids[1],
          slug: ids[1],
          sku: ids[1],
          titleUa: "Synthetic variant",
          titleEn: "Synthetic variant",
          status: "ACTIVE",
          isPublished: true,
          variants: {
            create: {
              sku: ids[1] + "-USD",
              isDefault: true,
              priceEur: 63,
              priceUsd: 70,
              priceUah: 3300,
              priceSourceCurrency: "USD",
            },
          },
        },
      });
      const cards = await getShopCatalogCardPricingByIds(ids);
      const legacy = await getShopFitmentCatalogProducts({
        productIds: ids,
        includeVariants: true,
      });
      for (const product of [
        cards.find((row) => row.productId === ids[0])!,
        legacy.find((row) => row.id === ids[0])!,
      ]) {
        assert.equal(product.price.sourceCurrency, "EUR");
        assert.equal(product.b2bPrice?.sourceCurrency, "USD");
        assert.equal(product.compareAt?.sourceCurrency, "EUR");
        assert.equal(product.b2bCompareAt?.sourceCurrency, "UAH");
        const price = resolveShopProductPricing(product as never, viewer).effectivePrice;
        assert.deepEqual([price.eur, price.usd, price.uah], [100, 111.78, 5148.3]);
        assert.equal(expandShopPrices(product.europePrice!, rates).uah, 6435.38);
        const wholesale = resolveShopProductPricing(product as never, {
          ...viewer,
          customerGroup: "B2B_APPROVED",
        }).effectivePrice;
        assert.equal(wholesale.usd, 80);
        assert.equal(wholesale.uah, 3684.51);
      }
      const inherited = cards.find((row) => row.productId === ids[1])!;
      assert.equal(inherited.price.sourceCurrency, "USD");
      assert.equal(
        resolveShopProductPricing(inherited as never, viewer).effectivePrice.uah,
        3223.95
      );
      const variant = legacy.find((row) => row.id === ids[1])!.variants![0];
      assert.equal(variant.price.sourceCurrency, "USD");
      assert.equal(expandShopPrices(variant.price, rates).uah, 3223.95);
      const manual = {
        EUR: 1,
        USD: 1.14,
        UAH: 51.5,
        _rawUsdToUah: 45.5,
        _uahReserve: 0,
        _manualCross: 1,
      };
      for (const product of [
        cards.find((row) => row.productId === ids[0])!,
        legacy.find((row) => row.id === ids[0])!,
      ]) {
        const price = resolveShopProductPricing(product as never, {
          ...viewer,
          currencyRates: manual,
        }).effectivePrice;
        assert.deepEqual([price.eur, price.usd, price.uah], [100, 114, 5150]);
        assert.equal(
          resolveShopProductPricing(product as never, {
            ...viewer,
            currencyRates: manual,
            customerGroup: "B2B_APPROVED",
          }).effectivePrice.uah,
          3640
        );
      }
      assert.equal(
        resolveShopProductPricing(inherited as never, { ...viewer, currencyRates: manual })
          .effectivePrice.uah,
        3185
      );
    } finally {
      await prisma.shopProduct.updateMany({
        where: { id: { in: ids } },
        data: { isPublished: false },
      });
      await prisma.$disconnect();
    }
  }
);
