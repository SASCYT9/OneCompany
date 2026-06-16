import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

const COMMIT = process.argv.includes("--commit");
const MULTIPLIER = new Decimal("1.10");
const SAMPLE_LIMIT = 12;

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

type MoneyField =
  | "priceEur"
  | "priceUsd"
  | "priceUah"
  | "compareAtEur"
  | "compareAtUsd"
  | "compareAtUah";

const MONEY_FIELDS: MoneyField[] = [
  "priceEur",
  "priceUsd",
  "priceUah",
  "compareAtEur",
  "compareAtUsd",
  "compareAtUah",
];

type PriceValue = Decimal | number | string | null;

type ProductRow = {
  id: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  vendor: string | null;
  titleEn: string;
  tags: string[];
  priceEur: PriceValue;
  priceUsd: PriceValue;
  priceUah: PriceValue;
  compareAtEur: PriceValue;
  compareAtUsd: PriceValue;
  compareAtUah: PriceValue;
  variants: Array<{
    id: string;
    sku: string | null;
    title: string | null;
    priceEur: PriceValue;
    priceUsd: PriceValue;
    priceUah: PriceValue;
    compareAtEur: PriceValue;
    compareAtUsd: PriceValue;
    compareAtUah: PriceValue;
  }>;
  collections: Array<{
    collection: {
      isUrban: boolean;
    };
  }>;
};

type BrandBucket = "Brabus" | "Urban";

type Change = {
  field: MoneyField;
  before: Decimal;
  after: Decimal;
};

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isPositiveMoney(value: PriceValue): value is Decimal {
  if (value == null) return false;
  return new Decimal(value).greaterThan(0);
}

function uplift(value: PriceValue) {
  if (!isPositiveMoney(value)) return null;
  return new Decimal(value).mul(MULTIPLIER).toDecimalPlaces(2);
}

function collectChanges(row: Record<MoneyField, PriceValue>) {
  const changes: Change[] = [];
  for (const field of MONEY_FIELDS) {
    const after = uplift(row[field]);
    if (!after) continue;
    const before = new Decimal(row[field] as Decimal);
    if (!before.equals(after)) {
      changes.push({ field, before, after });
    }
  }
  return changes;
}

function moneyData(changes: Change[]) {
  return Object.fromEntries(changes.map((change) => [change.field, change.after]));
}

function detectBucket(product: ProductRow): BrandBucket | null {
  const brand = normalize(product.brand);
  const vendor = normalize(product.vendor);
  const slug = normalize(product.slug);
  const tags = product.tags.map((tag) => normalize(tag));

  if (brand === "brabus" || vendor === "brabus") {
    return "Brabus";
  }

  const isUrban =
    brand === "urban" ||
    brand === "urban automotive" ||
    vendor === "urban" ||
    vendor === "urban automotive" ||
    slug.startsWith("urb-") ||
    tags.some(
      (tag) =>
        tag === "urban" ||
        tag === "storefront:urban" ||
        tag === "store:urban" ||
        tag.startsWith("urban-source:")
    ) ||
    product.collections.some((entry) => entry.collection.isUrban);

  return isUrban ? "Urban" : null;
}

function summarizeDecimal(values: Decimal[]) {
  return values.reduce((sum, value) => sum.plus(value), new Decimal(0)).toDecimalPlaces(2);
}

async function main() {
  const products = (await prisma.shopProduct.findMany({
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      titleEn: true,
      tags: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      compareAtEur: true,
      compareAtUsd: true,
      compareAtUah: true,
      variants: {
        select: {
          id: true,
          sku: true,
          title: true,
          priceEur: true,
          priceUsd: true,
          priceUah: true,
          compareAtEur: true,
          compareAtUsd: true,
          compareAtUah: true,
        },
      },
      collections: {
        select: {
          collection: {
            select: {
              isUrban: true,
            },
          },
        },
      },
    },
  })) as unknown as ProductRow[];

  const targets = products
    .map((product) => ({ product, bucket: detectBucket(product) }))
    .filter((entry): entry is { product: ProductRow; bucket: BrandBucket } =>
      Boolean(entry.bucket)
    );

  const productUpdates: Array<{
    id: string;
    bucket: BrandBucket;
    slug: string;
    sku: string | null;
    title: string;
    changes: Change[];
  }> = [];
  const variantUpdates: Array<{
    id: string;
    productId: string;
    bucket: BrandBucket;
    sku: string | null;
    title: string | null;
    changes: Change[];
  }> = [];

  for (const { product, bucket } of targets) {
    const productChanges = collectChanges(product);
    if (productChanges.length > 0) {
      productUpdates.push({
        id: product.id,
        bucket,
        slug: product.slug,
        sku: product.sku,
        title: product.titleEn,
        changes: productChanges,
      });
    }

    for (const variant of product.variants) {
      const variantChanges = collectChanges(variant);
      if (variantChanges.length > 0) {
        variantUpdates.push({
          id: variant.id,
          productId: product.id,
          bucket,
          sku: variant.sku,
          title: variant.title,
          changes: variantChanges,
        });
      }
    }
  }

  const touchedProductIds = new Set([
    ...productUpdates.map((item) => item.id),
    ...variantUpdates.map((item) => item.productId),
  ]);

  console.log(COMMIT ? "Mode: COMMIT" : "Mode: DRY RUN");
  console.log(`Multiplier: ${MULTIPLIER.toString()} (+10%)`);
  console.log(`Matched products: ${targets.length}`);
  console.log(`Products with B2C changes: ${productUpdates.length}`);
  console.log(`Variants with B2C changes: ${variantUpdates.length}`);
  console.log(`Unique touched products: ${touchedProductIds.size}`);

  for (const bucket of ["Brabus", "Urban"] as BrandBucket[]) {
    const bucketProducts = productUpdates.filter((item) => item.bucket === bucket);
    const bucketVariants = variantUpdates.filter((item) => item.bucket === bucket);
    console.log(
      `${bucket}: ${bucketProducts.length} product rows, ${bucketVariants.length} variant rows`
    );
  }

  const beforeValues = [...productUpdates, ...variantUpdates].flatMap((item) =>
    item.changes.map((change) => change.before)
  );
  const afterValues = [...productUpdates, ...variantUpdates].flatMap((item) =>
    item.changes.map((change) => change.after)
  );
  console.log(`Changed field total before: ${summarizeDecimal(beforeValues).toString()}`);
  console.log(`Changed field total after:  ${summarizeDecimal(afterValues).toString()}`);

  console.log("\nSample changes:");
  for (const item of productUpdates.slice(0, SAMPLE_LIMIT)) {
    const changeText = item.changes
      .map((change) => `${change.field}: ${change.before.toString()} -> ${change.after.toString()}`)
      .join("; ");
    console.log(`  [${item.bucket}] product ${item.sku ?? item.slug}: ${changeText}`);
  }
  for (const item of variantUpdates.slice(0, SAMPLE_LIMIT)) {
    const changeText = item.changes
      .map((change) => `${change.field}: ${change.before.toString()} -> ${change.after.toString()}`)
      .join("; ");
    console.log(`  [${item.bucket}] variant ${item.sku ?? item.id}: ${changeText}`);
  }

  if (!COMMIT) {
    console.log("\nDry run only. Re-run with --commit to apply.");
    return;
  }

  await prisma.$transaction(
    [
      ...productUpdates.map((item) =>
        prisma.shopProduct.update({
          where: { id: item.id },
          data: moneyData(item.changes),
        })
      ),
      ...variantUpdates.map((item) =>
        prisma.shopProductVariant.update({
          where: { id: item.id },
          data: moneyData(item.changes),
        })
      ),
    ],
    { timeout: 60_000 }
  );

  console.log("\nApplied price uplift successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
