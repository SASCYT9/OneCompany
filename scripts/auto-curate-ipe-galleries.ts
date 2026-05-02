/**
 * Auto-curate iPE gallery↔variant bindings for the entire catalog.
 *
 * For each iPE product with multiple variants:
 *   1. Pull the original Shopify URLs from the latest snapshot.
 *   2. Classify each gallery slot from its filename:
 *      - material: ti | ss | null
 *      - kind: 'system-catback' | 'system-full' | 'component' | 'general'
 *   3. For each variant, score every gallery slot against the variant's
 *      attributes (catback vs full, material) and pick the best non-component
 *      match. Component slots (tips/adapter/x-pipe/midpipe close-ups) are
 *      never bound to a variant — they belong in the gallery for browsing,
 *      not as the snap-to image when a variant is picked.
 *   4. Write `ipe.gallery_image_materials` so the PDP filter can hide
 *      unmatched-material slots when the user toggles Ti/SS.
 *
 * Skips any product that already has a hand-curated entry in
 * curate-ipe-galleries.ts — those are authoritative.
 *
 * Usage:
 *   npx tsx scripts/auto-curate-ipe-galleries.ts          # dry-run
 *   npx tsx scripts/auto-curate-ipe-galleries.ts --apply  # writes
 *   npx tsx scripts/auto-curate-ipe-galleries.ts --slug=ipe-foo  # one product
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SLUG_ARG = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];

// Hand-curated slugs that the manual script (curate-ipe-galleries.ts)
// already handles — auto-curator should not touch these.
const MANUAL_SLUGS = new Set([
  'ipe-ferrari-296-gtb-exhaust-system',
  'ipe-porsche-992-gt3-full-exhaust-system',
  'ipe-porsche-911-gt3-992-catback-system',
  'ipe-mercedes-benz-amg-g63-w465-exhaust-system',
]);

type Material = 'ti' | 'ss' | null;
type Kind = 'system-catback' | 'system-full' | 'component-tip' | 'component-pipe' | 'component-header' | 'general';

interface SlotInfo {
  position: number;
  material: Material;
  kind: Kind;
  filename: string;
}

function classifyFilename(filename: string): { material: Material; kind: Kind } {
  const lower = filename.toLowerCase();
  // Material from filename tokens. "stainless" alone, "titanium", or
  // standalone "ti"/"ss" with non-letter neighbours.
  let material: Material = null;
  if (/stainless\s*steel|stainlesssteel|stainless|sscatback|ssadapter|sstip/.test(lower)) material = 'ss';
  else if (/titanium|ticatback|tiadapter|titip/.test(lower)) material = 'ti';
  else if (/(?:^|[^a-z])ti(?:[^a-z]|$)/.test(lower)) material = 'ti';
  else if (/(?:^|[^a-z])ss(?:[^a-z]|$)/.test(lower)) material = 'ss';

  // Kind. Order matters: components first (so we don't mistake a component
  // photo for a system shot when filename mentions both).
  let kind: Kind = 'general';
  if (/tips?\b|tip[._-]|carbontips|chromeblack|chromesilver|chromsliver|chrome[-_]black|chrome[-_]silver|s-tip|carbon-?fiber-?tips?|golden-?tips?|chromtips/.test(lower)) {
    kind = 'component-tip';
  } else if (/midpipe|mid-pipe|mid_pipe|x-?pipe|x_pipe|front_?mid|front-mid|adapter|resonator|heatshield|\bdownpipe\b|down-?pipe[-_]?\d/.test(lower)) {
    kind = 'component-pipe';
  } else if (/\bheaders?\b/.test(lower) && !/with-?headers?|w-?headers?/.test(lower)) {
    kind = 'component-header';
  } else if (/catback|cat-back/.test(lower)) {
    kind = 'system-catback';
  } else if (/fullsystem|full-system|full_system|exhaustsystem|exhaust-system/.test(lower)) {
    kind = 'system-full';
  } else if (/system/.test(lower)) {
    kind = 'system-full'; // "system" alone usually = full system shot
  }

  return { material, kind };
}

interface VariantProfile {
  isCatback: boolean;
  isFull: boolean;
  material: Material;
}

function profileVariant(o1: string | null, o2: string | null, o3: string | null): VariantProfile {
  const joined = `${o1 ?? ''} ${o2 ?? ''} ${o3 ?? ''}`.toLowerCase();
  const isFull = /\bfull\s*system\b|\bfull[- ]?exhaust\b/.test(joined);
  const isCatback = !isFull && /\bcat[- ]?back\b/.test(joined);
  let material: Material = null;
  if (/titanium/.test(joined)) material = 'ti';
  else if (/stainless/.test(joined)) material = 'ss';
  return { isCatback, isFull, material };
}

function scoreSlotForVariant(slot: SlotInfo, profile: VariantProfile): number {
  // Components are never bound to variants — the user picks "Catless DP",
  // they should not see an x-pipe close-up.
  if (slot.kind === 'component-tip' || slot.kind === 'component-pipe' || slot.kind === 'component-header') {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  // System type alignment.
  if (profile.isCatback && slot.kind === 'system-catback') score += 30;
  else if (profile.isFull && slot.kind === 'system-full') score += 30;
  else if (profile.isCatback && slot.kind === 'system-full') score -= 5;
  else if (profile.isFull && slot.kind === 'system-catback') score -= 10;
  else if (slot.kind === 'general') score += 3;

  // Material alignment.
  if (profile.material && slot.material) {
    if (profile.material === slot.material) score += 25;
    else score -= 40;
  } else if (profile.material && !slot.material) {
    score += 1; // ambiguous but acceptable
  }

  // Position bias: earlier = more likely "hero" shot.
  score += Math.max(0, 5 - slot.position);

  return score;
}

async function findLatestSnapshot() {
  const dir = path.join(process.cwd(), 'artifacts', 'ipe-import');
  const dirs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const d of dirs) {
    try {
      const data = JSON.parse(readFileSync(path.join(dir, d, 'official-snapshot.json'), 'utf-8'));
      return { path: path.join(dir, d), data };
    } catch {}
  }
  throw new Error('no snapshot');
}

(async () => {
  const { path: snapPath, data: snap } = await findLatestSnapshot();
  console.log(`Snapshot: ${snapPath}`);

  const products = await prisma.shopProduct.findMany({
    where: SLUG_ARG ? { slug: SLUG_ARG } : { brand: { contains: 'iPE', mode: 'insensitive' } },
    include: {
      variants: { orderBy: { position: 'asc' } },
      media: { orderBy: { position: 'asc' } },
      metafields: { where: { OR: [{ key: 'official_handle' }, { namespace: 'ipe' }] } },
    },
  });

  let touchedProducts = 0;
  let touchedVariants = 0;
  let touchedMetafields = 0;
  let skipped = 0;

  for (const product of products) {
    if (MANUAL_SLUGS.has(product.slug)) {
      skipped += 1;
      continue;
    }
    if (product.variants.length < 2) {
      skipped += 1;
      continue;
    }
    const officialHandle = product.metafields.find((m) => m.key === 'official_handle')?.value;
    if (!officialHandle) {
      skipped += 1;
      continue;
    }
    const official = snap.products.find((p: any) => p.handle === officialHandle);
    if (!official) {
      skipped += 1;
      continue;
    }
    const originalUrls: string[] = official.images ?? [];
    if (originalUrls.length === 0) {
      skipped += 1;
      continue;
    }

    // Build slot annotations. Align to DB gallery length.
    const dbLen = product.media.length;
    const slots: SlotInfo[] = [];
    for (let i = 0; i < Math.min(dbLen, originalUrls.length); i += 1) {
      const file = (originalUrls[i].split('/').pop() ?? originalUrls[i]).split('?')[0];
      const { material, kind } = classifyFilename(file);
      slots.push({ position: i + 1, material, kind, filename: file });
    }
    while (slots.length < dbLen) {
      slots.push({ position: slots.length + 1, material: null, kind: 'general', filename: '(unknown)' });
    }

    const log: string[] = [];
    log.push(`\n[${product.slug}]  gallery=${dbLen}  variants=${product.variants.length}`);
    for (const s of slots) {
      log.push(`  ${s.position.toString().padStart(2, '0')}: ${s.kind.padEnd(18)} ${s.material ?? '-'}  ${s.filename}`);
    }

    // Per-variant binding.
    const variantUpdates: Array<{ id: string; image: string; current: string | null; o: string }> = [];
    for (const v of product.variants) {
      const profile = profileVariant(v.option1Value, v.option2Value, v.option3Value);
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestSlot: SlotInfo | null = null;
      for (const s of slots) {
        const sc = scoreSlotForVariant(s, profile);
        if (sc > bestScore) {
          bestScore = sc;
          bestSlot = s;
        }
      }
      // If every slot is a component (extreme edge case), fall back to
      // position 1 — at least it's not random.
      if (!bestSlot || bestScore === Number.NEGATIVE_INFINITY) {
        bestSlot = slots[0];
      }
      const target = product.media[bestSlot.position - 1];
      if (!target) continue;
      const currentFile = v.image?.split('/').pop()?.split('?')[0] ?? null;
      const targetFile = target.src.split('/').pop()?.split('?')[0] ?? '';
      const profileStr = `${profile.isCatback ? 'CB' : profile.isFull ? 'FULL' : '-'}/${profile.material ?? '-'}`;
      const tag = currentFile === targetFile ? '   ' : 'CHG';
      log.push(
        `    [${tag}] ${profileStr.padEnd(8)} ${(v.option1Value ?? '?').slice(0, 18).padEnd(18)} | ${(v.option2Value ?? '').slice(0, 18).padEnd(18)} | ${(v.option3Value ?? '').slice(0, 18).padEnd(18)}  ${currentFile ?? '?'} -> ${targetFile}  (${bestScore})`
      );
      if (currentFile !== targetFile) {
        variantUpdates.push({ id: v.id, image: target.src, current: currentFile, o: profileStr });
      }
    }

    // Materials metafield. Only meaningful when at least 1 ti AND 1 ss.
    const tags = slots.map((s) => s.material);
    const hasTi = tags.includes('ti');
    const hasSs = tags.includes('ss');
    let mfChange: 'unchanged' | 'updated' | 'created' | 'skip' = 'skip';
    let newMfValue: string | null = null;
    if (hasTi && hasSs) {
      newMfValue = tags.map((t) => t ?? 'null').join(',');
      const existing = product.metafields.find((m) => m.namespace === 'ipe' && m.key === 'gallery_image_materials');
      if (!existing) mfChange = 'created';
      else if (existing.value !== newMfValue) mfChange = 'updated';
      else mfChange = 'unchanged';
    }
    if (mfChange !== 'skip' && mfChange !== 'unchanged') {
      log.push(`  metafield ${mfChange}: ${newMfValue}`);
    }

    if (variantUpdates.length === 0 && mfChange !== 'updated' && mfChange !== 'created') {
      // Nothing to do.
      continue;
    }

    console.log(log.join('\n'));
    touchedProducts += 1;
    touchedVariants += variantUpdates.length;
    if (mfChange === 'updated' || mfChange === 'created') touchedMetafields += 1;

    if (!APPLY) continue;

    // Apply.
    if (variantUpdates.length) {
      await prisma.$transaction(
        variantUpdates.map((u) =>
          prisma.shopProductVariant.update({
            where: { id: u.id },
            data: { image: u.image },
          })
        )
      );
    }
    if (newMfValue && (mfChange === 'updated' || mfChange === 'created')) {
      const existing = product.metafields.find((m) => m.namespace === 'ipe' && m.key === 'gallery_image_materials');
      if (existing) {
        await prisma.shopProductMetafield.update({
          where: { id: existing.id },
          data: { value: newMfValue, valueType: 'string' },
        });
      } else {
        await prisma.shopProductMetafield.create({
          data: { productId: product.id, namespace: 'ipe', key: 'gallery_image_materials', valueType: 'string', value: newMfValue },
        });
      }
    }
  }

  console.log(`\n=== summary ===`);
  console.log(`Touched products: ${touchedProducts}`);
  console.log(`Variant rebinds: ${touchedVariants}`);
  console.log(`Metafields: ${touchedMetafields}`);
  console.log(`Skipped: ${skipped}`);
  console.log(APPLY ? '(applied)' : '(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
