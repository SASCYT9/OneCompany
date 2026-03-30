import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

export async function GET() {
  try {
    const products = await prisma.shopProduct.findMany({
      where: { vendor: 'Brabus' },
    });

    let updatedCount = 0;
    let totalChanges = 0;
    const changedSkus: string[] = [];

    const fieldsToClean = [
      'seoDescriptionEn', 'seoDescriptionUa',
      'bodyHtmlEn', 'bodyHtmlUa',
      'longDescEn', 'longDescUa',
      'shortDescEn', 'shortDescUa',
    ];

    for (const p of products) {
      let updated = false;
      const updateData: any = {};

      for (const field of fieldsToClean) {
        const val = (p as any)[field];
        if (val) {
          const cleaned = cleanHtml(val as string);
          if (cleaned !== val) {
            updateData[field] = cleaned;
            updated = true;
            totalChanges++;
          }
        }
      }

      if (updated) {
        await prisma.shopProduct.update({
          where: { id: p.id },
          data: updateData,
        });
        updatedCount++;
        changedSkus.push(p.sku || p.id);
      }
    }

    return NextResponse.json({
      success: true,
      totalProducts: products.length,
      updatedProducts: updatedCount,
      totalFieldChanges: totalChanges,
      sampleSkus: changedSkus.slice(0, 20),
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
