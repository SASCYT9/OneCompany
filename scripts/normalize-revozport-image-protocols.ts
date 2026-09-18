import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";

function toAbsoluteImageUrl(value: string | null, normalizeRevozportCdn = false): string | null {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (normalizeRevozportCdn && /^https:\/\/(?:www\.)?revozport\.com\/cdn\/shop\//i.test(trimmed)) {
    return trimmed.replace(
      /^https:\/\/(?:www\.)?revozport\.com\/cdn\/shop\//i,
      "https://cdn.shopify.com/s/files/1/0723/2802/0188/"
    );
  }
  return value;
}

function json(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? String(item) : item), 2);
}

async function main() {
  if (!process.argv.includes("--target=onecompany.global")) {
    throw new Error("Explicit target required: --target=onecompany.global");
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({
      where: { brand: "Revozport" },
      include: { media: true, variants: true },
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(`.tmp/revozport-enrichment/${stamp}-protocol-before.json`, json(rows));

    const completed: Array<{ sku: string; productId: string }> = [];
    for (const row of rows) {
      const nextImage = toAbsoluteImageUrl(row.image, true);
      const nextGallery = Array.isArray(row.gallery)
        ? row.gallery.map((value) => (typeof value === "string" ? toAbsoluteImageUrl(value) : value))
        : row.gallery;
      const mediaUpdates = row.media
        .map((media) => ({ id: media.id, src: toAbsoluteImageUrl(media.src) }))
        .filter((media) => media.src !== row.media.find((current) => current.id === media.id)?.src);
      const variantUpdates = row.variants
        .map((variant) => ({ id: variant.id, image: toAbsoluteImageUrl(variant.image, true) }))
        .filter((variant) => variant.image !== row.variants.find((current) => current.id === variant.id)?.image);
      const galleryChanged = JSON.stringify(nextGallery) !== JSON.stringify(row.gallery);

      if (nextImage === row.image && !galleryChanged && !mediaUpdates.length && !variantUpdates.length) {
        continue;
      }

      await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: row.id,
        expectedCatalogVersion: row.catalogVersion.toString(),
        changeDomains: ["MEDIA"],
        async mutateAndSnapshot(tx, version) {
          await tx.shopProduct.update({
            where: { id: row.id },
            data: {
              ...(nextImage !== row.image ? { image: nextImage } : {}),
              ...(galleryChanged ? { gallery: nextGallery } : {}),
              ...(mediaUpdates.length
                ? { media: { update: mediaUpdates.map((media) => ({ where: { id: media.id }, data: { src: media.src! } })) } }
                : {}),
              ...(variantUpdates.length
                ? { variants: { update: variantUpdates.map((variant) => ({ where: { id: variant.id }, data: { image: variant.image } })) } }
                : {}),
            },
          });
          return buildShopCatalogAdminSnapshot(tx, row.id, version, {
            type: "IMPORT",
            id: "revozport-content@system.local",
            reason: "revozport.normalize-protocol-relative-image-urls",
          });
        },
      });
      completed.push({ sku: row.sku, productId: row.id });
    }

    console.log(JSON.stringify({ scanned: rows.length, saved: completed.length, completed }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
