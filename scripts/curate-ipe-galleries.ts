/**
 * Hand-curated photo↔variant assignments for the iPE products where iPE's
 * Shopify gallery doesn't carry per-variant featuredImage and the filename-
 * based material classifier in repair-ipe-gallery-materials.ts misfires.
 *
 * For each product we encode:
 *   - galleryMaterials (one tag per gallery slot, comma-separated for the
 *     `ipe.gallery_image_materials` metafield) — drives the PDP gallery
 *     filter on Ti/SS toggle.
 *   - variantImage — picks which gallery image to snap to when a specific
 *     variant is selected (via ShopProductVariant.image).
 *
 * The values come from visually inspecting each gallery image's iPE caption
 * (e.g. "iPE Full System (Stainless Steel) (OPF)" → ss).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

type Mat = 'ti' | 'ss' | null;

type ProductCuration = {
  slug: string;
  galleryMaterials: Mat[];
  /** Returns the gallery position (1-based) to bind the variant to,
   *  given its option1/2/3 values. */
  variantImage: (
    o: { option1Value: string | null; option2Value: string | null; option3Value: string | null }
  ) => number | null;
};

const lower = (v: string | null) => (v ?? '').toLowerCase();
const isTi = (v: { option1Value: string | null; option2Value: string | null; option3Value: string | null }) =>
  /titanium/.test(`${lower(v.option1Value)} ${lower(v.option2Value)} ${lower(v.option3Value)}`);
const isCatback = (v: { option1Value: string | null; option2Value: string | null; option3Value: string | null }) =>
  /cat[- ]?back|catback/.test(`${lower(v.option1Value)} ${lower(v.option2Value)} ${lower(v.option3Value)}`) &&
  !/full\s*system/.test(`${lower(v.option1Value)} ${lower(v.option2Value)} ${lower(v.option3Value)}`);
const isCatless = (v: { option1Value: string | null; option2Value: string | null; option3Value: string | null }) =>
  /catless/.test(`${lower(v.option1Value)} ${lower(v.option2Value)} ${lower(v.option3Value)}`);
const has200Cell = (v: { option1Value: string | null; option2Value: string | null; option3Value: string | null }) =>
  /200\s*cell|catted/.test(`${lower(v.option1Value)} ${lower(v.option2Value)} ${lower(v.option3Value)}`);

const CURATIONS: ProductCuration[] = [
  {
    // Gallery (4): 01=Ti Full, 02=Ti Cat Pipe, 03=Ti Catback, 04=red 296 GTB
    // No SS shots from iPE, so splitActive can't fire. Ti variants land on
    // the matching system shot; SS variants reuse the same Ti shot (better
    // than the car photo for showing the exhaust component).
    slug: 'ipe-ferrari-296-gtb-exhaust-system',
    galleryMaterials: ['ti', 'ti', 'ti', null],
    variantImage: (v) => {
      // Catback systems → image 3, Full systems → image 1
      return isCatback(v) ? 3 : 1;
    },
  },
  {
    // Gallery (11):
    //   01=Full System SS OPF (Equal Length)  02=installed (blue tips=Ti)
    //   03=installed                          04=Header w/Catless Straight SS
    //   05=Full System SS OPF                 06=Full System Ti OPF
    //   07=Full System Ti (no headers)        08=Tips Misty Gold (CF)
    //   09=Tips Matte Black (CF, SS)          10=blue 992 GT3 rear
    //   11=purple 992 GT3 on lift
    slug: 'ipe-porsche-992-gt3-full-exhaust-system',
    galleryMaterials: ['ss', 'ti', 'ss', 'ss', 'ss', 'ti', 'ti', null, null, null, null],
    variantImage: (v) => {
      const ti = isTi(v);
      const catless = isCatless(v) || /catless/.test(lower(v.option3Value));
      // Ti / Equal Length Headers / 200 Cell — show Ti Full System (06)
      // Ti / Equal Length Headers / Catless — Ti Full (06)
      // Ti / 200 Cell / OPF or Non-OPF — Ti Full (06)
      // Ti / Catless / OPF or Non-OPF — Ti without headers (07)
      // SS / Equal Length / 200 Cell — SS Full (01)
      // SS / Equal Length / Catless — Header w/Catless Straight (04)
      // SS / 200 Cell — SS Full (05 or 01)
      // SS / Catless — Header w/Catless (04)
      if (ti) return catless ? 7 : 6;
      if (/equal\s*length/.test(lower(v.option2Value))) return catless ? 4 : 1;
      return catless ? 4 : 5;
    },
  },
  {
    // Gallery (9):
    //   01=Catback Ti OPF (blue tips)  02=Catback SS OPF
    //   03=Resonator SS                04=Adapter Ti OPF
    //   05=Adapter SS Non-OPF          06=Adapter SS OPF
    //   07=Tips Misty Gold (CF)        08=Tips Matte Black (CF, SS)
    //   09=red 992 GT3 underside
    // Variants: Ti+OPF, Ti+Non-OPF, SS+OPF, SS+Non-OPF.
    slug: 'ipe-porsche-911-gt3-992-catback-system',
    galleryMaterials: ['ti', 'ss', 'ss', 'ti', 'ss', 'ss', null, null, null],
    variantImage: (v) => (isTi(v) ? 1 : 2),
  },
];

async function setMetafield(productId: string, key: string, value: string) {
  const existing = await prisma.shopProductMetafield.findFirst({
    where: { productId, namespace: 'ipe', key },
  });
  if (existing && existing.value === value) return 'unchanged';
  if (existing) {
    if (APPLY) {
      await prisma.shopProductMetafield.update({
        where: { id: existing.id },
        data: { value, valueType: 'string' },
      });
    }
    return 'updated';
  }
  if (APPLY) {
    await prisma.shopProductMetafield.create({
      data: { productId, namespace: 'ipe', key, valueType: 'string', value },
    });
  }
  return 'created';
}

(async () => {
  for (const c of CURATIONS) {
    const product = await prisma.shopProduct.findFirst({
      where: { slug: c.slug },
      include: { variants: true, media: { orderBy: { position: 'asc' } } },
    });
    if (!product) {
      console.log(`SKIP ${c.slug} — not in DB`);
      continue;
    }
    if (product.media.length !== c.galleryMaterials.length) {
      console.log(
        `WARN ${c.slug}: gallery has ${product.media.length} media items but curation has ${c.galleryMaterials.length} tags`
      );
    }
    console.log(`\n[${c.slug}]`);

    // Metafield: gallery_image_materials
    const value = c.galleryMaterials
      .slice(0, product.media.length)
      .map((t) => t ?? 'null')
      .join(',');
    const action = await setMetafield(product.id, 'gallery_image_materials', value);
    console.log(`  metafield ${action}: ${value}`);

    // Per-variant image
    for (const v of product.variants) {
      const targetPos = c.variantImage({
        option1Value: v.option1Value,
        option2Value: v.option2Value,
        option3Value: v.option3Value,
      });
      if (targetPos == null) {
        console.log(`    skip variant ${v.option1Value} / ${v.option2Value}`);
        continue;
      }
      const targetMedia = product.media[targetPos - 1];
      if (!targetMedia) continue;
      const current = v.image?.split('/').pop()?.split('?')[0];
      const targetFile = targetMedia.src.split('/').pop()?.split('?')[0];
      const tag = current === targetFile ? 'unchanged' : 'CHANGE';
      console.log(
        `    [${tag}] ${v.option1Value} / ${v.option2Value} / ${v.option3Value ?? '-'}  ${current ?? '?'} -> ${targetFile}`
      );
      if (APPLY && current !== targetFile) {
        await prisma.shopProductVariant.update({
          where: { id: v.id },
          data: { image: targetMedia.src },
        });
      }
    }
  }
  console.log(APPLY ? '\n(applied)' : '\n(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
