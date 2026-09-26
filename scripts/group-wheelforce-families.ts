#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient, type Prisma } from "@prisma/client";
import { config } from "dotenv";

import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { type NormalizedFitment } from "../src/lib/shopFitmentQuality";
import {
  parseWheelForceFamily,
  WHEELFORCE_FAMILY_CHILD_TAG,
  WHEELFORCE_FAMILY_PARENT_TAG,
} from "../src/lib/wheelforceFamily";

type SourceWheel = { sku: string; title: string; sourcePriceEurGross: number | null };
type SourceCatalog = { products: SourceWheel[] };
type FamilyMember = SourceWheel & {
  identity: NonNullable<ReturnType<typeof parseWheelForceFamily>>;
  slug?: string;
};
type Family = { key: string; members: FamilyMember[] };

const SOURCE_PATH = path.resolve("data/wheelforce/source-catalog.json");
const COMMIT = process.argv.includes("--commit");
const PARENTS_ONLY = process.argv.includes("--parents-only");
const FROM_FAMILY = process.argv.find((arg) => arg.startsWith("--from="))?.slice("--from=".length) || null;
const PRODUCT_SELECT = {
  id: true,
  sku: true,
  slug: true,
  brand: true,
  tags: true,
  catalogVersion: true,
  titleUa: true,
  titleEn: true,
  shortDescUa: true,
  shortDescEn: true,
  longDescUa: true,
  longDescEn: true,
  bodyHtmlUa: true,
  bodyHtmlEn: true,
  seoTitleUa: true,
  seoTitleEn: true,
  seoDescriptionUa: true,
  seoDescriptionEn: true,
  highlights: true,
  priceEur: true,
  priceEurEurope: true,
  priceUsd: true,
  priceUah: true,
  image: true,
  gallery: true,
  metafields: {
    where: {
      OR: [
        { namespace: "onecompany", key: "normalized_fitment" },
        { namespace: "wheelforce_import", key: { in: ["family_key", "family_parent_slug", "family_members"] } },
      ],
    },
    select: { namespace: true, key: true, value: true, valueType: true },
  },
} satisfies Prisma.ShopProductSelect;
type ProductRow = Prisma.ShopProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

function safeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function planFamilies(products: SourceWheel[]): Family[] {
  const byKey = new Map<string, FamilyMember[]>();
  for (const product of products) {
    const identity = parseWheelForceFamily(product.title);
    if (!identity) continue;
    const members = byKey.get(identity.key) ?? [];
    members.push({ ...product, identity });
    byKey.set(identity.key, members);
  }
  return [...byKey.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({
      key,
      members: members.sort((left, right) =>
        (left.sourcePriceEurGross ?? Number.POSITIVE_INFINITY) -
          (right.sourcePriceEurGross ?? Number.POSITIVE_INFINITY) ||
        left.sku.localeCompare(right.sku)
      ),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function mergedFitment(products: ProductRow[]): NormalizedFitment | null {
  const records = products.flatMap((product) => {
    const raw = product.metafields.find((item) => item.namespace === "onecompany" && item.key === "normalized_fitment")?.value;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as NormalizedFitment;
      return Array.isArray(parsed.applications) ? [parsed] : [];
    } catch {
      return [];
    }
  });
  if (!records.length) return null;
  const applications = [...new Map(
    records.flatMap((record) => record.applications).map((application) =>
      [JSON.stringify(application).toLowerCase(), application] as const
    )
  ).values()];
  if (!applications.length) return null;
  const makes = [...new Set(applications.map((application) => application.make))];
  const models = [...new Set(applications.flatMap((application) => application.models))];
  const chassisCodes = [...new Set(applications.flatMap((application) => application.chassisCodes))];
  const yearRanges = [...new Map(
    applications.flatMap((application) => application.yearRanges).map((range) =>
      [`${range.from ?? ""}:${range.to ?? ""}`, range] as const
    )
  ).values()];
  return {
    ...records[0],
    make: makes.length === 1 ? makes[0] : null,
    models,
    chassisCodes,
    yearRanges,
    applications,
    note: "WheelForce wheel family: each size retains its own manufacturer vehicle applications.",
  };
}

function familyCopy(family: Family) {
  const { model, finish } = family.members[0].identity;
  const sizes = [...new Set(family.members.map((member) => member.identity.sizeSpec))];
  const listedSizes = sizes.map((size) => `<li>${safeHtml(size)}</li>`).join("");
  const titleEn = `WheelForce ${model} — ${finish}`;
  const titleUa = `Диск WheelForce ${model} — ${finish}`;
  return {
    titleEn,
    titleUa,
    shortDescEn: `${titleEn}. Choose the wheel size, offset and bolt pattern for your vehicle, then add compatible accessories in the configurator.`,
    shortDescUa: `${titleUa}. Оберіть розмір, виліт і розболтовку для свого авто та додайте сумісні аксесуари в конфігураторі.`,
    longDescEn: `<p>${safeHtml(titleEn)} is available in several fitment specifications. Select the exact wheel size for your vehicle; its price, SKU and compatible accessories appear in the configurator.</p><h3>Available specifications</h3><ul>${listedSizes}</ul><p>Check wheel fitment and brake clearance for your vehicle before ordering.</p>`,
    longDescUa: `<p>${safeHtml(titleUa)} доступний у кількох посадкових параметрах. Оберіть точний розмір для свого авто — конфігуратор покаже його ціну, артикул і сумісні аксесуари.</p><h3>Доступні параметри</h3><ul>${listedSizes}</ul><p>Перед замовленням перевірте сумісність диска й зазори для гальм вашого авто.</p>`,
    seoDescriptionEn: `Shop ${titleEn}. Choose from ${sizes.length} size and fitment options, compare prices and add compatible accessories.`,
    seoDescriptionUa: `Купити ${titleUa}. Оберіть один із ${sizes.length} варіантів розміру й посадки, порівняйте ціни та додайте сумісні аксесуари.`,
    highlights: {
      en: [titleEn, `${family.members.length} wheel specifications`, "Vehicle-specific fitment"],
      ua: [titleUa, `${family.members.length} посадкових варіантів`, "Сумісність за авто"],
    },
  };
}

function tagsFor(product: ProductRow, role: "parent" | "child", family: Family) {
  const withoutFamily = product.tags.filter((tag) =>
    tag !== WHEELFORCE_FAMILY_PARENT_TAG && tag !== WHEELFORCE_FAMILY_CHILD_TAG && !tag.startsWith("family-sku:")
  );
  return [...new Set([
    ...withoutFamily,
    role === "parent" ? WHEELFORCE_FAMILY_PARENT_TAG : WHEELFORCE_FAMILY_CHILD_TAG,
    ...(role === "parent" ? family.members.map((member) => `family-sku:${member.sku}`) : []),
  ])];
}

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return ["P1017", "P2024", "P2028", "P2034"].includes(code) ||
    /40001|could not serialize|Catalog version conflict|write conflict|deadlock|Unable to start a transaction in the given time/u.test(message);
}

async function upsertFamilyMetafield(
  tx: Prisma.TransactionClient,
  productId: string,
  key: string,
  value: string,
  valueType = "single_line_text_field"
) {
  await tx.shopProductMetafield.upsert({
    where: { productId_namespace_key: { productId, namespace: "wheelforce_import", key } },
    create: { productId, namespace: "wheelforce_import", key, value, valueType },
    update: { value, valueType },
  });
}

async function updateFamilyProduct(
  prisma: PrismaClient,
  product: ProductRow,
  family: Family,
  role: "parent" | "child",
  parentSlug: string,
  merged: NormalizedFitment | null
) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const current = await prisma.shopProduct.findUnique({
      where: { id: product.id },
      select: { catalogVersion: true },
    });
    if (!current) throw new Error(`WheelForce product disappeared: ${product.id}`);
    try {
      return await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: product.id,
        expectedCatalogVersion: current.catalogVersion.toString(),
        timeoutMs: 120_000,
        changeDomains: role === "parent"
          ? ["CONTENT", "SEO", "TAXONOMY", "FITMENT", "MEDIA"]
          : ["TAXONOMY", "VISIBILITY"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          if (role === "parent") {
            const copy = familyCopy(family);
            await tx.shopProduct.update({
              where: { id: product.id },
              data: {
                tags: tagsFor(product, role, family),
                titleEn: copy.titleEn,
                titleUa: copy.titleUa,
                shortDescEn: copy.shortDescEn,
                shortDescUa: copy.shortDescUa,
                longDescEn: copy.longDescEn,
                longDescUa: copy.longDescUa,
                bodyHtmlEn: copy.longDescEn,
                bodyHtmlUa: copy.longDescUa,
                seoTitleEn: copy.titleEn,
                seoTitleUa: copy.titleUa,
                seoDescriptionEn: copy.seoDescriptionEn,
                seoDescriptionUa: copy.seoDescriptionUa,
                highlights: copy.highlights,
              },
            });
            await upsertFamilyMetafield(tx, product.id, "family_members", JSON.stringify(
              family.members.map((member) => ({
                sku: member.sku,
                slug: member.slug ?? "",
                sizeSpec: member.identity.sizeSpec,
              }))
            ), "json");
            if (merged) {
              await tx.shopProductMetafield.upsert({
                where: { productId_namespace_key: { productId: product.id, namespace: "onecompany", key: "normalized_fitment" } },
                create: { productId: product.id, namespace: "onecompany", key: "normalized_fitment", value: JSON.stringify(merged), valueType: "json" },
                update: { value: JSON.stringify(merged), valueType: "json" },
              });
            }
          } else {
            await tx.shopProduct.update({ where: { id: product.id }, data: { tags: tagsFor(product, role, family) } });
          }
          await upsertFamilyMetafield(tx, product.id, "family_key", family.key);
          await upsertFamilyMetafield(tx, product.id, "family_parent_slug", parentSlug);
          return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
            type: "IMPORT", id: "wheelforce-family@system.local", reason: "wheelforce.family-configurator",
          });
        },
      });
    } catch (error) {
      if (!retryable(error) || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw new Error(`WheelForce family update retries exhausted for ${product.sku}`);
}

async function main() {
  const source = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as SourceCatalog;
  const allFamilies = planFamilies(source.products);
  const start = FROM_FAMILY ? allFamilies.findIndex((family) => family.key === FROM_FAMILY) : 0;
  if (start < 0) throw new Error(`Unknown WheelForce family: ${FROM_FAMILY}`);
  const families = allFamilies.slice(start);
  const skus = [...new Set(families.flatMap((family) => family.members.map((member) => member.sku)))];
  config({ path: ".env.local" });
  config({ path: ".env" });
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({
      where: { brand: { equals: "WheelForce", mode: "insensitive" }, sku: { in: skus } },
      select: PRODUCT_SELECT,
    });
    const bySku = new Map(rows.map((row) => [row.sku?.toUpperCase() ?? "", row]));
    const missing = skus.filter((sku) => !bySku.has(sku.toUpperCase()));
    if (missing.length) throw new Error(`Missing WheelForce product SKUs: ${missing.slice(0, 10).join(", ")}`);
    if (rows.length !== skus.length) throw new Error("WheelForce SKU identities are not one-to-one");
    const planned = families.map((family) => {
      const parent = bySku.get(family.members[0].sku.toUpperCase())!;
      const memberRows = family.members.map((member) => bySku.get(member.sku.toUpperCase())!);
      return { family, parent, memberRows, merged: mergedFitment(memberRows) };
    });
    const summary = {
      mode: COMMIT ? "commit" : "dry-run",
      parentsOnly: PARENTS_ONLY,
      resumeFrom: FROM_FAMILY,
      families: planned.length,
      wheelSkus: skus.length,
      duplicateCardsToCollapse: skus.length - planned.length,
      familyExamples: planned.slice(0, 5).map(({ family, parent }) => ({ key: family.key, parentSku: parent.sku, sizes: family.members.length })),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (!COMMIT) return;
    const backupPath = path.resolve("artifacts", `wheelforce-family-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, JSON.stringify(rows, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value, 2
    ), "utf8");
    console.log(`Backup: ${backupPath}`);
    let updated = 0;
    for (const { family, parent, memberRows, merged } of planned) {
      const membersWithSlugs = family.members.map((member) => ({
        ...member,
        slug: bySku.get(member.sku.toUpperCase())!.slug,
      }));
      const resolvedFamily = { ...family, members: membersWithSlugs };
      if (PARENTS_ONLY) {
        const currentMembers = parent.metafields.find((item) =>
          item.namespace === "wheelforce_import" && item.key === "family_members"
        )?.value;
        const desiredMembers = JSON.stringify(membersWithSlugs.map((member) => ({
          sku: member.sku,
          slug: member.slug,
          sizeSpec: member.identity.sizeSpec,
        })));
        if (currentMembers === desiredMembers) {
          console.log(`${family.key}: display already normalized`);
          continue;
        }
      }
      await updateFamilyProduct(prisma, parent, resolvedFamily, "parent", parent.slug, merged);
      updated += 1;
      if (PARENTS_ONLY) {
        console.log(`${family.key}: display updated`);
        continue;
      }
      for (const child of memberRows) {
        if (child.id === parent.id) continue;
        await updateFamilyProduct(prisma, child, resolvedFamily, "child", parent.slug, null);
        updated += 1;
      }
      console.log(`${family.key}: ${family.members.length} sizes grouped`);
    }
    console.log(JSON.stringify({ mode: "committed", updated, families: planned.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
