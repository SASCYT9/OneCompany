#!/usr/bin/env tsx
/**
 * Tag each iPE product's gallery images with the material they depict, so
 * the PDP can show only "titanium" shots when the user picks the Titanium
 * variant (and vice versa).
 *
 * Why a metafield: at import time iPE's gallery URLs get rebased to Vercel
 * Blob with sequential names (01.png, 02.png …) — the original filename
 * tokens (`*-titanium*`, `sscatback`) that hint material are lost. So we
 * reclassify against the original snapshot URLs once, store the result on
 * the product, and let the runtime UI read it.
 *
 * Stores `gallery_image_materials` in the `ipe` namespace, value is a
 * comma-separated list aligned with the gallery order: e.g.
 * "null,ss,ss,ti,ss,ss,null,null,ti".
 *
 * Usage:
 *   pnpm tsx scripts/repair-ipe-gallery-materials.ts          # dry-run
 *   pnpm tsx scripts/repair-ipe-gallery-materials.ts --apply  # writes
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const IPE_IMPORT_DIR = path.join(process.cwd(), 'artifacts', 'ipe-import');

type Material = 'ti' | 'ss' | null;

function classify(url: string): Material {
  const file = (url.split('/').pop() ?? url).split('?')[0].toLowerCase();
  if (/stainless\s*steel|stainlesssteel|stainless/.test(file)) return 'ss';
  if (/titanium/.test(file)) return 'ti';
  if (/(?:^|[^a-z])ti(?:[^a-z]|$)/.test(file)) return 'ti';
  if (/(?:^|[^a-z])ss(?:[^a-z]|$)/.test(file)) return 'ss';
  if (/^ti(adapter|catback|tip)/.test(file)) return 'ti';
  if (/^ss(adapter|catback|tip)/.test(file)) return 'ss';
  return null;
}

// Fallback classifier for iPE products whose Shopify CDN filenames have no
// material hint (most of the catalog post-2023). We walk the variants and look
// at which ones point to each gallery image via `featured_image`. If only
// Titanium variants reference image X, it's a Ti shot; if only Stainless do,
// it's SS. Mixed or unreferenced → null (ambiguous, leave unfiltered).
function classifyByVariantBinding(
  imageUrl: string,
  variants: ReadonlyArray<{ optionValues?: string[]; featuredImage?: string | null }>
): Material {
  const refs = variants.filter((v) => (v.featuredImage ?? '').trim() === imageUrl.trim());
  if (refs.length === 0) return null;
  let ti = 0;
  let ss = 0;
  for (const v of refs) {
    const joined = (v.optionValues ?? []).join(' | ').toLowerCase();
    if (/\btitanium\b/.test(joined)) ti += 1;
    else if (/\bstainless\b/.test(joined)) ss += 1;
  }
  if (ti > 0 && ss === 0) return 'ti';
  if (ss > 0 && ti === 0) return 'ss';
  return null;
}

async function findLatestSnapshot() {
  const dirs = (await fs.readdir(IPE_IMPORT_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const dir of dirs) {
    try {
      const raw = await fs.readFile(path.join(IPE_IMPORT_DIR, dir, 'official-snapshot.json'), 'utf-8');
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

(async () => {
  const snapshot = await findLatestSnapshot();
  if (!snapshot) {
    console.error('No iPE snapshot found.');
    process.exit(1);
  }

  const products = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { brand: { contains: 'iPE', mode: 'insensitive' } },
        { brand: { contains: 'innotech', mode: 'insensitive' } },
      ],
    },
    include: {
      metafields: { where: { OR: [{ key: 'official_handle' }, { namespace: 'ipe' }] } },
      media: { orderBy: { position: 'asc' } },
    },
  });

  let touched = 0;
  let skipped = 0;

  for (const product of products) {
    const officialHandle = product.metafields.find((m) => m.key === 'official_handle')?.value;
    if (!officialHandle) {
      skipped += 1;
      continue;
    }
    const official = snapshot.products.find((p: any) => p.handle === officialHandle);
    if (!official) {
      skipped += 1;
      continue;
    }

    const originalUrls: string[] = official.images ?? [];
    if (originalUrls.length === 0) {
      skipped += 1;
      continue;
    }

    // Try the filename-based classifier first; for any image that comes back
    // null, fall back to looking at which variant(s) bind it as their featured
    // image. iPE's modern Shopify CDN dumps images with random UUID names that
    // carry no material hint, so the variant binding is the only signal left.
    const variants = (official.variants ?? []) as Array<{
      optionValues?: string[];
      featuredImage?: string | null;
    }>;
    const tags = originalUrls.map((url) => {
      const fromUrl = classify(url);
      if (fromUrl) return fromUrl;
      return classifyByVariantBinding(url, variants);
    });
    const hasTi = tags.includes('ti');
    const hasSs = tags.includes('ss');
    if (!hasTi || !hasSs) {
      // Only meaningful when the gallery actually carries both materials.
      skipped += 1;
      continue;
    }

    // Align tag count to the DB-side gallery length: truncate when the
    // import dropped some originals (e.g. duplicates), or pad with null when
    // it added a fallback. Without this the runtime guard
    // `tags.length === gallery.length` fails and the metafield is ignored.
    const dbGalleryLength = product.media.length || originalUrls.length;
    const alignedTags: Material[] =
      dbGalleryLength === tags.length
        ? tags
        : dbGalleryLength < tags.length
          ? tags.slice(0, dbGalleryLength)
          : [...tags, ...new Array(dbGalleryLength - tags.length).fill(null as Material)];

    const hasTiAfter = alignedTags.includes('ti');
    const hasSsAfter = alignedTags.includes('ss');
    if (!hasTiAfter || !hasSsAfter) {
      skipped += 1;
      continue;
    }

    const value = alignedTags.map((t) => t ?? 'null').join(',');
    const existing = product.metafields.find(
      (m) => m.namespace === 'ipe' && m.key === 'gallery_image_materials'
    );

    if (existing && existing.value === value) {
      skipped += 1;
      continue;
    }

    console.log(product.slug);
    console.log(`  → ${value}`);
    console.log(`  (${product.media.length} blob images aligned to ${originalUrls.length} original URLs)`);
    touched += 1;

    if (!APPLY) continue;

    if (existing) {
      await prisma.shopProductMetafield.update({
        where: { id: existing.id },
        data: { value, valueType: 'string' },
      });
    } else {
      await prisma.shopProductMetafield.create({
        data: {
          productId: product.id,
          namespace: 'ipe',
          key: 'gallery_image_materials',
          valueType: 'string',
          value,
        },
      });
    }
  }

  console.log(`\nTouched: ${touched}  Skipped: ${skipped}  ${APPLY ? '(applied)' : '(dry-run — pass --apply)'}`);
  await prisma.$disconnect();
})();
