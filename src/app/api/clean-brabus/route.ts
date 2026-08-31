import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminRequest, type AdminSession } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { buildShopCatalogAdminSnapshot } from '@/lib/shopCatalogAdminSnapshot.server';
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from '@/lib/shopCatalogMutationCoordinator.server';
import { runShopCatalogOutboxRuntime } from '@/lib/shopCatalogOutboxRuntime.server';

// Trigger phrases — when any of these is found, everything from that point onward gets cut
const triggerPhrases = [
  // EN: factory installation disclaimers
  '<p>This item will be installed',
  'This item will be installed',
  '<p>This item requires extensive consultation',
  'This item requires extensive consultation',
  '<p>Please note: The purchase and installation',
  'Please note: The purchase and installation',
  '<p>Please note: The installation must be performed',
  'Please note: The installation must be performed',
  '<p>After internal verification',
  'After internal verification',

  // UA: factory installation disclaimers
  '<p>Цей товар буде встановлено',
  'Цей товар буде встановлено',
  '<p>Цей товар вимагає детальної консультації',
  'Цей товар вимагає детальної консультації',
  '<p>Зверніть увагу: придбання та встановлення',
  'Зверніть увагу: придбання та встановлення',
  '<p>Зверніть увагу: монтаж повинен виконуватися',
  'Зверніть увагу: монтаж повинен виконуватися',
  '<p>Після внутрішньої перевірки',
  'Після внутрішньої перевірки',

  // EN/UA: consultant / inquiry disclaimers 
  'added to the shopping basket as an "inquiry item"',
  'added to the shopping basket as an &quot;inquiry item&quot;',
  'a BRABUS consultant will then contact you',
  'BRABUS consultant will then contact you',
  'консультант BRABUS зв\'яжеться',
  'з вами зв\'яжеться консультант BRABUS',
  
  // EN/UA: cookies / tracking / legal
  '<p>We use cookies',
  'We use cookies',
  '<p>Ми використовуємо файли cookie',
  'Ми використовуємо файли cookie',
  '<p>YouTube videos',
  'YouTube videos',
  '<p>BRABUS GmbH',
  'BRABUS GmbH',

  // UA: "currently not available for direct purchase" disclaimer
  '<p>Цей товар наразі недоступний для безпосередньої купівлі',
  'Цей товар наразі недоступний для безпосередньої купівлі',
  '<p>Цей товар наразі недоступний',
  'Цей товар наразі недоступний',

  // EN: "currently not available for direct purchase" disclaimer
  '<p>This item is currently not available for direct purchase',
  'This item is currently not available for direct purchase',
  '<p>This product is currently not available',
  'This product is currently not available',

  // EN/UA: Brabus self-promo paragraph
  '<p>We create modern, individual luxury',
  'We create modern, individual luxury',
  '<p>Ми створюємо сучасний, індивідуальний розкіш',
  'Ми створюємо сучасний, індивідуальний розкіш',
  '<p>Ми створюємо сучасний',
  'Ми створюємо сучасний',

  // Catch broader "inquiry item" pattern
  '"inquiry item"',
  '&quot;inquiry item&quot;',
  '«товар за запитом»',
  '"товар за запитом"',
  'замовити його через кошик',
  'order it via the basket',
  'added to your basket as an inquiry',
  
  // Catch "Bottrop" and address references
  'Bottrop',
  'Боттроп',
  'Karl-Legien-Stra',
  '46238',
  
  // Extra EN/UA patterns  
  'data protection',
  'privacy policy',
  'Google Analytics',
  'Google Tag Manager',
  'Facebook Pixel',
  'захисту даних',
  'політики конфіденційності',
  'info@brabus',
  'www.brabus',
  'brabus.com',
  '+49 (0)',
  '+49(0)',
];

function cleanHtml(html: string): string {
  if (!html) return html;

  let earliestIndex = html.length;
  let matchedPhrase = '';

  for (const phrase of triggerPhrases) {
    const idx = html.indexOf(phrase);
    if (idx !== -1 && idx < earliestIndex) {
      earliestIndex = idx;
      matchedPhrase = phrase;
    }
  }

  if (earliestIndex === html.length) return html;

  let cleaned = html.substring(0, earliestIndex).trim();

  // If we cut mid-tag (e.g. inside <p>), strip any trailing incomplete <p> start
  // Also remove trailing empty <p></p> tags
  cleaned = cleaned.replace(/<p>\s*$/, '');
  cleaned = cleaned.replace(/<p>\s*<\/p>\s*$/, '');
  // If trailing with unclosed tags, try to close them
  // Simple: just remove trailing opening tags without content
  cleaned = cleaned.replace(/<(p|div|span|ul|li)>\s*$/, '');
  
  return cleaned;
}

const fieldsToClean = [
  'seoDescriptionEn', 'seoDescriptionUa',
  'bodyHtmlEn', 'bodyHtmlUa',
  'longDescEn', 'longDescUa',
  'shortDescEn', 'shortDescUa',
] as const;

async function buildCleanupPlan() {
  const products = await prisma.shopProduct.findMany({
    where: { vendor: 'Brabus' },
    select: {
      id: true,
      sku: true,
      catalogVersion: true,
      seoDescriptionEn: true,
      seoDescriptionUa: true,
      bodyHtmlEn: true,
      bodyHtmlUa: true,
      longDescEn: true,
      longDescUa: true,
      shortDescEn: true,
      shortDescUa: true,
    },
  });
  const changes: Array<{
    id: string;
    sku: string | null;
    catalogVersion: bigint;
    updateData: Record<string, string>;
    fieldCount: number;
  }> = [];

  for (const product of products) {
    const updateData: Record<string, string> = {};
    for (const field of fieldsToClean) {
      const value = product[field];
      if (!value) continue;
      const cleaned = cleanHtml(value);
      if (cleaned !== value) updateData[field] = cleaned;
    }
    const fieldCount = Object.keys(updateData).length;
    if (fieldCount) {
      changes.push({
        id: product.id,
        sku: product.sku,
        catalogVersion: product.catalogVersion,
        updateData,
        fieldCount,
      });
    }
  }
  return { totalProducts: products.length, changes };
}

async function authorize(permission: string) {
  try {
    return await assertAdminRequest(await cookies(), permission);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to authorize request' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await authorize(ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
  if (auth instanceof NextResponse) return auth;
  try {
    const plan = await buildCleanupPlan();
    return NextResponse.json({
      success: true,
      dryRun: true,
      totalProducts: plan.totalProducts,
      updatedProducts: plan.changes.length,
      totalFieldChanges: plan.changes.reduce((sum, change) => sum + change.fieldCount, 0),
      sampleSkus: plan.changes.slice(0, 20).map((change) => change.sku || change.id),
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  const auth = await authorize(ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
  if (auth instanceof NextResponse) return auth;
  const session = auth as AdminSession;
  try {
    const plan = await buildCleanupPlan();
    const catalogMutations: ShopCatalogCoordinatedMutationResult[] = [];
    for (const change of plan.changes) {
      catalogMutations.push(
        await coordinateShopCatalogProductMutation({
          productId: change.id,
          expectedCatalogVersion: change.catalogVersion.toString(),
          changeDomains: ['CONTENT', 'SEO'],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({ where: { id: change.id }, data: change.updateData });
            await writeAdminAuditLog(tx, session, {
              scope: 'shop',
              action: 'brabus.content.clean',
              entityType: 'shop.product',
              entityId: change.id,
              metadata: { fields: Object.keys(change.updateData), catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, change.id, nextCatalogVersion, {
              type: 'ADMIN',
              id: session.email,
              reason: 'brabus.content.clean',
            });
          },
        })
      );
    }

    if (catalogMutations.length) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-clean-brabus:${process.env.VERCEL_REGION || 'local'}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, catalogMutations.length)),
          });
        } catch (error) {
          console.error('[shop-catalog.clean-brabus] immediate publish failed; cron recovery remains active', {
            outboxIds: catalogMutations.map((mutation) => mutation.outboxId),
            error,
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      totalProducts: plan.totalProducts,
      updatedProducts: catalogMutations.length,
      totalFieldChanges: plan.changes.reduce((sum, change) => sum + change.fieldCount, 0),
      sampleSkus: plan.changes.slice(0, 20).map((change) => change.sku || change.id),
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
