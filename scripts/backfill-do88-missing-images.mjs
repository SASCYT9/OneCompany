import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const INPUT_FILE = path.join(process.cwd(), 'do88-products-v4.json');
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function absoluteUrl(url, baseUrl) {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractPageImage(html, sourceUrl) {
  const ogImage =
    html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1] ??
    null;

  if (ogImage) {
    return absoluteUrl(ogImage, sourceUrl);
  }

  const jsonLdImage = html.match(/"image"\s*:\s*"([^"]+)"/i)?.[1] ?? null;
  if (jsonLdImage) {
    return absoluteUrl(jsonLdImage, sourceUrl);
  }

  const contentImage =
    html.match(/<img[^>]+src=["']([^"']*bilder\/artiklar[^"']+)["']/i)?.[1] ??
    html.match(/<img[^>]+src=["']([^"']*img\/bilder\/artiklar[^"']+)["']/i)?.[1] ??
    null;

  return absoluteUrl(contentImage, sourceUrl);
}

async function fetchPage(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': USER_AGENT,
      'accept-language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function verifyImage(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  const imported = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const bySku = new Map(imported.map((item) => [normalizeKey(item.sku), item]));
  const bySlug = new Map(
    imported.map((item) => [
      normalizeKey(`do88-${String(item.sku || '').replace(/[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`),
      item,
    ])
  );
  const pageCache = new Map();

  const products = await prisma.shopProduct.findMany({
    where: {
      brand: { equals: 'DO88', mode: 'insensitive' },
      isPublished: true,
      OR: [{ image: null }, { image: '' }],
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      variants: { select: { id: true, sku: true, image: true }, orderBy: { position: 'asc' } },
      media: { select: { id: true, src: true }, orderBy: { position: 'asc' } },
    },
  });

  console.log(`Found ${products.length} DO88 products without main image.`);

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const importedRow =
      bySku.get(normalizeKey(product.sku)) ??
      bySlug.get(normalizeKey(product.slug)) ??
      null;

    if (!importedRow) {
      skipped++;
      continue;
    }

    let imageUrl = importedRow.imageUrl ? absoluteUrl(importedRow.imageUrl, importedRow.sourceUrl) : null;

    if (!imageUrl && importedRow.sourceUrl) {
      if (!pageCache.has(importedRow.sourceUrl)) {
        try {
          const html = await fetchPage(importedRow.sourceUrl);
          pageCache.set(importedRow.sourceUrl, extractPageImage(html, importedRow.sourceUrl));
        } catch {
          pageCache.set(importedRow.sourceUrl, null);
        }
      }
      imageUrl = pageCache.get(importedRow.sourceUrl) ?? null;
    }

    if (!imageUrl) {
      skipped++;
      continue;
    }

    const verified = await verifyImage(imageUrl);
    if (!verified) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.shopProduct.update({
        where: { id: product.id },
        data: { image: imageUrl },
      });

      if (product.media.length > 0) {
        const firstMedia = product.media[0];
        if (!firstMedia.src) {
          await tx.shopProductMedia.update({
            where: { id: firstMedia.id },
            data: { src: imageUrl, altText: product.titleEn || importedRow.titleEn || null },
          });
        }
      } else {
        await tx.shopProductMedia.create({
          data: {
            productId: product.id,
            src: imageUrl,
            altText: product.titleEn || importedRow.titleEn || null,
            position: 1,
            mediaType: 'IMAGE',
          },
        });
      }

      const defaultVariant = product.variants[0] ?? null;
      if (defaultVariant && !defaultVariant.image) {
        await tx.shopProductVariant.update({
          where: { id: defaultVariant.id },
          data: { image: imageUrl },
        });
      }
    });

    updated++;
    if (updated % 25 === 0) {
      console.log(`  updated ${updated}/${products.length}`);
    }
  }

  console.log(`Done. Updated: ${updated}. Skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
