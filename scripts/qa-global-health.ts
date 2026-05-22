/**
 * QA: global catalog health snapshot (read-only).
 * Output: artifacts/qa-2026-05-13/data/global-health.json
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/qa-2026-05-13/data/global-health.json");

(async () => {
  const where = { status: "ACTIVE" as const, isPublished: true };

  const totalActive = await prisma.shopProduct.count({ where });

  const missingUaTitle = await prisma.shopProduct.count({
    where: { ...where, OR: [{ titleUa: "" }, { titleUa: { equals: "" } }] },
  });
  const missingEnTitle = await prisma.shopProduct.count({
    where: { ...where, OR: [{ titleEn: "" }, { titleEn: { equals: "" } }] },
  });

  // products without any UA description (short, long, body all null/empty)
  const noUaDescAgg = await prisma.shopProduct.count({
    where: {
      ...where,
      AND: [
        { OR: [{ shortDescUa: null }, { shortDescUa: "" }] },
        { OR: [{ longDescUa: null }, { longDescUa: "" }] },
        { OR: [{ bodyHtmlUa: null }, { bodyHtmlUa: "" }] },
      ],
    },
  });
  const noEnDescAgg = await prisma.shopProduct.count({
    where: {
      ...where,
      AND: [
        { OR: [{ shortDescEn: null }, { shortDescEn: "" }] },
        { OR: [{ longDescEn: null }, { longDescEn: "" }] },
        { OR: [{ bodyHtmlEn: null }, { bodyHtmlEn: "" }] },
      ],
    },
  });

  // no media records AND no image field
  const noImage = await prisma.shopProduct.count({
    where: { ...where, image: null, media: { none: {} } },
  });

  // no positive price in any of the 3 currencies on product OR any variant
  const allActive = await prisma.shopProduct.findMany({
    where,
    select: {
      id: true,
      sku: true,
      brand: true,
      priceEur: true,
      priceUah: true,
      priceUsd: true,
      variants: { select: { priceEur: true, priceUah: true, priceUsd: true } },
    },
  });
  const noPrice = allActive.filter((p) => {
    const has = (v: any) => v !== null && v !== undefined && Number(v) > 0;
    if (has(p.priceEur) || has(p.priceUah) || has(p.priceUsd)) return false;
    return !p.variants.some((v) => has(v.priceEur) || has(v.priceUah) || has(v.priceUsd));
  });

  // duplicate SKUs (group by sku, count > 1, only ACTIVE)
  const dupSkuAgg = await prisma.shopProduct.groupBy({
    by: ["sku"],
    where: { ...where, sku: { not: null } },
    _count: { _all: true },
    having: { sku: { _count: { gt: 1 } } },
  });

  // duplicate slugs — should be impossible since slug is @unique, but check anyway
  // slug is unique at DB level, so this is a structural sanity → skip

  // breakdown by brand
  const byBrand = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where,
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
  });

  const noUaTitleSample = await prisma.shopProduct.findMany({
    where: { ...where, OR: [{ titleUa: "" }] },
    select: { id: true, sku: true, brand: true, slug: true },
    take: 10,
  });
  const noEnTitleSample = await prisma.shopProduct.findMany({
    where: { ...where, OR: [{ titleEn: "" }] },
    select: { id: true, sku: true, brand: true, slug: true },
    take: 10,
  });
  const noImageSample = await prisma.shopProduct.findMany({
    where: { ...where, image: null, media: { none: {} } },
    select: { id: true, sku: true, brand: true, slug: true },
    take: 10,
  });

  // noUaDesc / noEnDesc breakdown by brand
  const noUaDescByBrand: Record<string, number> = {};
  const noEnDescByBrand: Record<string, number> = {};
  const noUaDescList = await prisma.shopProduct.findMany({
    where: {
      ...where,
      AND: [
        { OR: [{ shortDescUa: null }, { shortDescUa: "" }] },
        { OR: [{ longDescUa: null }, { longDescUa: "" }] },
        { OR: [{ bodyHtmlUa: null }, { bodyHtmlUa: "" }] },
      ],
    },
    select: { brand: true },
  });
  for (const p of noUaDescList) {
    const b = p.brand ?? "(no brand)";
    noUaDescByBrand[b] = (noUaDescByBrand[b] ?? 0) + 1;
  }
  const noEnDescList = await prisma.shopProduct.findMany({
    where: {
      ...where,
      AND: [
        { OR: [{ shortDescEn: null }, { shortDescEn: "" }] },
        { OR: [{ longDescEn: null }, { longDescEn: "" }] },
        { OR: [{ bodyHtmlEn: null }, { bodyHtmlEn: "" }] },
      ],
    },
    select: { brand: true },
  });
  for (const p of noEnDescList) {
    const b = p.brand ?? "(no brand)";
    noEnDescByBrand[b] = (noEnDescByBrand[b] ?? 0) + 1;
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    totalActivePublished: totalActive,
    missingUaTitle,
    missingEnTitle,
    noUaDescription: noUaDescAgg,
    noEnDescription: noEnDescAgg,
    noImage,
    noPositivePrice: noPrice.length,
    duplicateSkuGroups: dupSkuAgg.length,
    duplicateSkuTotal: dupSkuAgg.reduce((sum, g) => sum + g._count._all, 0),
    byBrand: byBrand.map((b) => ({ brand: b.brand, count: b._count._all })),
    noUaDescByBrand,
    noEnDescByBrand,
    samples: {
      missingUaTitle: noUaTitleSample,
      missingEnTitle: noEnTitleSample,
      noImage: noImageSample,
      noPrice: noPrice.slice(0, 10).map((p) => ({ id: p.id, sku: p.sku, brand: p.brand })),
      duplicateSkus: dupSkuAgg.slice(0, 10).map((g) => ({ sku: g.sku, count: g._count._all })),
    },
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(snapshot, null, 2), "utf8");

  console.log("=== Global Catalog Health ===");
  console.log(`Total ACTIVE+published: ${totalActive}`);
  console.log(`No UA title:            ${missingUaTitle}`);
  console.log(`No EN title:            ${missingEnTitle}`);
  console.log(`No UA description:      ${noUaDescAgg}`);
  console.log(`No EN description:      ${noEnDescAgg}`);
  console.log(`No image:               ${noImage}`);
  console.log(`No positive price:      ${noPrice.length}`);
  console.log(
    `Duplicate-SKU groups:   ${dupSkuAgg.length}  (${dupSkuAgg.reduce((s, g) => s + g._count._all, 0)} affected)`
  );
  console.log(`Saved: ${OUT}`);

  await prisma.$disconnect();
})();
