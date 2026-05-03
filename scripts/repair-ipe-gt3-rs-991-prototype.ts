/**
 * PROTOTYPE: rebuild variants for `ipe-porsche-911-gt3-rs-991-991-2-exhaust`
 * from scratch using Excel pricelist (V2.0 April 2026) + iPE official bodyHtml.
 *
 * Demonstrates the correct approach for "default-title-only" iPE products
 * (where iPE's official feed gives no SKU breakdown — current import logic
 * fabricates wrong variants from neighbouring pricelist rows).
 *
 * Data sources:
 *   - Pricelist Excel rows 1879-1895 (911 GT3/RS section)
 *   - bodyHtml from artifacts/ipe-import/2026-04-22T13-30-12-979Z snapshot
 *
 * Pass --apply to write changes; default is dry-run.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const SLUG = 'ipe-porsche-911-gt3-rs-991-991-2-exhaust';

// MSRP markup: shop USD = pricelist MSRP + ~$1500-1600 shipping/customs.
// Use $1500 for items < $4000 wholesale, $1600 above.
const markup = (msrp: number) => msrp + (msrp >= 4000 ? 1600 : 1500);

const SS_CATBACK_MSRP = 3700;
const TI_CATBACK_MSRP = 4800;

const SS_RETAIL = markup(SS_CATBACK_MSRP); // 5200
const TI_RETAIL = markup(TI_CATBACK_MSRP); // 6400

const SLUG_FOR_SKU = 'porsche-911-gt3-rs-991-991-2';
function syntheticSku(suffix: string) {
  const digest = createHash('sha1')
    .update(`${SLUG_FOR_SKU}::${suffix}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `IPE-911-GT3RS-991-${digest}`;
}

const newVariants = [
  {
    title: 'Cat-back System · Stainless Steel',
    sku: syntheticSku('catback-ss'),
    option1Value: 'Cat-back System · Stainless Steel',
    priceUsd: new Prisma.Decimal(SS_RETAIL),
    isDefault: true,
    position: 1,
  },
  {
    title: 'Cat-back System · Titanium',
    sku: syntheticSku('catback-ti'),
    option1Value: 'Cat-back System · Titanium',
    priceUsd: new Prisma.Decimal(TI_RETAIL),
    isDefault: false,
    position: 2,
  },
];

// Upgrade options copy that goes into longDescUa (appended). Lets the customer
// see what's available without polluting the variant picker with 24 combos.
const UPGRADE_NOTE_UA = `
\n\n---
\nДОСТУПНІ АПГРЕЙДИ (за запитом — менеджер додасть до замовлення):
\n• Header з 200-cell каталізатором (SS) — +$4 500
\n• Header без каталізатора, прямоточний (SS) — +$4 200
\n• Насадки Titanium Blue (SS) — +$140 / для Ti — безкоштовно
\n• Насадки Chrome Black (SS) — +$200 / для Ti — безкоштовно
\n• Насадки Carbon Fiber (SS) — +$410 / для Ti — +$180
\n• Насадки Gold (тільки Ti) — безкоштовно
\n• Bluetooth Remote Control — +$280
\n• OBDII Hand Gesture Sensor — +$570
\n
\nДля точного підбору комплектації надішліть VIN — наш спеціаліст підтвердить сумісність (OPF/Non-OPF) та порахує фінальну ціну.
`.trim();

async function main() {
  const apply = process.argv.includes('--apply');

  const product = await prisma.shopProduct.findFirst({
    where: { slug: SLUG },
    include: {
      variants: { select: { id: true, sku: true, title: true, priceUsd: true, isDefault: true } },
      options: { select: { id: true, name: true, position: true, values: true } },
    },
  });
  if (!product) throw new Error(`Product not found: ${SLUG}`);

  console.log(`\n=== Product ${SLUG} ===`);
  console.log(`Title: ${product.titleUa}`);
  console.log(`Top-level price USD: ${product.priceUsd}`);
  console.log(`Existing variants (${product.variants.length}):`);
  for (const v of product.variants) {
    console.log(`  - ${v.sku} | ${v.title} | $${v.priceUsd}${v.isDefault ? ' [DEFAULT]' : ''}`);
  }

  console.log(`\n=== New variants (${newVariants.length}) ===`);
  for (const v of newVariants) {
    console.log(`  - ${v.sku} | ${v.title} | $${v.priceUsd}${v.isDefault ? ' [DEFAULT]' : ''}`);
  }

  // Cross-check FK refs before deleting (orders, carts, bundles, inventory)
  const oldIds = product.variants.map((v) => v.id);
  if (oldIds.length) {
    const [orderRefs, cartRefs, bundleRefs, invRefs] = await Promise.all([
      prisma.shopOrderItem.count({ where: { variantId: { in: oldIds } } }),
      prisma.shopCartItem.count({ where: { variantId: { in: oldIds } } }),
      prisma.shopBundleItem.count({ where: { componentVariantId: { in: oldIds } } }),
      prisma.shopInventoryLevel.count({ where: { variantId: { in: oldIds } } }),
    ]);
    console.log(
      `\nFK refs to existing variants: orders=${orderRefs} carts=${cartRefs} bundles=${bundleRefs} inventory=${invRefs}`
    );
    if (orderRefs + cartRefs + bundleRefs + invRefs > 0) {
      throw new Error('FK references exist — refusing to delete.');
    }
  }

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to write.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Drop existing options + variants for this product
    await tx.shopProductOption.deleteMany({ where: { productId: product.id } });
    await tx.shopProductVariant.deleteMany({ where: { productId: product.id } });

    // Recreate option (single axis: System)
    await tx.shopProductOption.create({
      data: {
        productId: product.id,
        name: 'Система',
        position: 1,
        values: newVariants.map((v) => v.option1Value),
      },
    });

    // Create new variants
    for (const v of newVariants) {
      await tx.shopProductVariant.create({
        data: {
          productId: product.id,
          title: v.title,
          sku: v.sku,
          position: v.position,
          option1Value: v.option1Value,
          inventoryQty: 0,
          inventoryPolicy: 'CONTINUE',
          priceUsd: v.priceUsd,
          requiresShipping: true,
          taxable: true,
          isDefault: v.isDefault,
        },
      });
    }

    // Update product top-level pricing + sku to match the default variant
    const defaultVariant = newVariants.find((v) => v.isDefault) ?? newVariants[0];
    const existingLong = product.longDescUa ?? '';
    const longDescUa = existingLong.includes('ДОСТУПНІ АПГРЕЙДИ')
      ? existingLong
      : `${existingLong}${UPGRADE_NOTE_UA}`;

    await tx.shopProduct.update({
      where: { id: product.id },
      data: {
        priceUsd: defaultVariant.priceUsd,
        sku: defaultVariant.sku,
        longDescUa,
      },
    });
  });

  console.log('\nDone. Variants rebuilt.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
