/**
 * PROTOTYPE step 2 — merge iPE's separate Titanium product into the
 * Stainless Steel one for Porsche 911 GT3 / RS (991/991.2):
 *   - download 5 Ti photos from iPE CDN, upload to Vercel Blob
 *   - add as ShopProductMedia rows (positions 6-10) on the SS product
 *   - extend the SS product's gallery JSON
 *   - tag images via `ipe.gallery_image_materials` metafield so the
 *     PDP swaps the gallery when the user toggles SS/Ti variant
 *
 * Pass --apply to write; default is dry-run.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // .env fallback
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { isBlobStorageConfigured, putPublicBlob } from '@/lib/runtimeBlobStorage';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const SS_SLUG = 'ipe-porsche-911-gt3-rs-991-991-2-exhaust';
const HANDLE = 'porsche-911-gt3-rs-991-991-2-exhaust'; // image folder name (no `ipe-` prefix)

// Pulled from artifacts/ipe-import/2026-04-22T13-30-12-979Z/official-snapshot.json
// (handle = porsche-911-gt3-rs-991-991-2-titanium-exhaust-system).
const TI_IMAGE_URLS = [
  'https://cdn.shopify.com/s/files/1/0606/7683/3510/files/22.jpg?v=1',
  'https://cdn.shopify.com/s/files/1/0606/7683/3510/files/33.jpg?v=1',
  'https://cdn.shopify.com/s/files/1/0606/7683/3510/files/11_e3f82621-3f71-46a2-b641-8a965a97fb3e.jpg?v=1',
  'https://cdn.shopify.com/s/files/1/0606/7683/3510/files/326131462_1225632428363349_211603225663448440_n.jpg?v=1',
  'https://cdn.shopify.com/s/files/1/0606/7683/3510/files/279218559_5005514452836009_8240477654034203936_n.jpg?v=1',
];

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function fetchAsBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'OneCompany-IpeImporter/1.0' },
  });
  if (!r.ok) throw new Error(`Fetch ${url} → HTTP ${r.status}`);
  const ab = await r.arrayBuffer();
  const contentType = r.headers.get('content-type') || 'image/jpeg';
  return { buffer: Buffer.from(ab), contentType };
}

async function main() {
  const product = await prisma.shopProduct.findFirst({
    where: { slug: SS_SLUG },
    include: {
      media: { orderBy: { position: 'asc' } },
      metafields: true,
    },
  });
  if (!product) throw new Error(`Product not found: ${SS_SLUG}`);

  console.log(`\n=== ${SS_SLUG} ===`);
  console.log(`Existing media: ${product.media.length}`);
  console.log(`Gallery items: ${Array.isArray(product.gallery) ? product.gallery.length : 0}`);

  // Plan upload paths
  const startPos = product.media.length + 1;
  const plannedUploads = TI_IMAGE_URLS.map((url, i) => {
    const num = String(startPos + i).padStart(2, '0');
    const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    return {
      sourceUrl: url,
      blobPathname: `media/library/shop/ipe/${HANDLE}/${num}.${ext}`,
      relPath: `/media/shop/ipe/${HANDLE}/${num}.${ext}`,
      position: startPos + i,
      altText: `${product.titleEn} ${startPos + i}`,
      contentType: contentTypeFor(`x.${ext}`),
    };
  });

  console.log('\nPlanned uploads:');
  for (const p of plannedUploads) {
    console.log(`  pos ${p.position} | ${p.blobPathname} ← ${p.sourceUrl}`);
  }

  // Materials: aligned with full new gallery (existing 5 + new 5)
  const newGallery = [
    ...((Array.isArray(product.gallery) ? (product.gallery as string[]) : []).map((g) => g)),
    ...plannedUploads.map((p) => p.relPath),
  ];
  const materials = [
    ...new Array(product.media.length).fill('ss'),
    ...plannedUploads.map(() => 'ti'),
  ];
  const materialsValue = materials.join(',');

  console.log('\nNew gallery (', newGallery.length, 'items):');
  newGallery.forEach((g, i) => console.log(`  [${i}] ${materials[i]} | ${g}`));

  if (!APPLY) {
    console.log('\nDry-run. Re-run with --apply to upload + write.');
    return;
  }

  if (!isBlobStorageConfigured()) {
    throw new Error('BLOB storage env not configured — cannot upload.');
  }

  // Upload Ti images to Blob
  const blobUrls: { plan: typeof plannedUploads[0]; blobUrl: string }[] = [];
  for (const p of plannedUploads) {
    console.log(`Uploading ${p.blobPathname}...`);
    const { buffer, contentType } = await fetchAsBuffer(p.sourceUrl);
    let blobUrl: string;
    try {
      const result = await putPublicBlob(p.blobPathname, buffer, contentType || p.contentType);
      blobUrl = result.url;
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        console.log(`  exists already in Blob, reusing public URL`);
        blobUrl = `https://rfip333zgtfizdii.public.blob.vercel-storage.com/${p.blobPathname}`;
      } else {
        throw err;
      }
    }
    blobUrls.push({ plan: p, blobUrl });
    console.log(`  → ${blobUrl} (${buffer.byteLength} bytes)`);
  }

  // Persist DB changes in a transaction
  await prisma.$transaction(async (tx) => {
    // Add 5 new ShopProductMedia rows
    for (const { plan, blobUrl } of blobUrls) {
      await tx.shopProductMedia.create({
        data: {
          productId: product.id,
          src: blobUrl,
          altText: plan.altText,
          position: plan.position,
          mediaType: 'IMAGE',
        },
      });
    }

    // Update gallery
    await tx.shopProduct.update({
      where: { id: product.id },
      data: {
        gallery: newGallery as Prisma.InputJsonValue,
      },
    });

    // Upsert metafield ipe.gallery_image_materials
    const existing = product.metafields.find(
      (m) => m.namespace === 'ipe' && m.key === 'gallery_image_materials'
    );
    if (existing) {
      await tx.shopProductMetafield.update({
        where: { id: existing.id },
        data: { value: materialsValue, valueType: 'string' },
      });
    } else {
      await tx.shopProductMetafield.create({
        data: {
          productId: product.id,
          namespace: 'ipe',
          key: 'gallery_image_materials',
          valueType: 'string',
          value: materialsValue,
        },
      });
    }
  });

  console.log('\nDone. Merged Ti gallery into SS product.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
