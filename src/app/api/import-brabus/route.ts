import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function determineCollections(product: any): { collectionEn: string; collectionUa: string; handle: string } {
  const t = (product.titleEn || '').toLowerCase();
  const c = (product.category || '').toLowerCase();
  const url = (product.sourceUrlDe || '').toLowerCase();

  if (t.includes('g-class') || t.includes('w 46') || url.includes('g-klasse')) {
    return { collectionEn: 'G-Class Tuning', collectionUa: 'Тюнінг G-Class', handle: 'g-class' };
  }
  if (t.includes('s-class') || t.includes('w 22') || url.includes('s-klasse')) {
    return { collectionEn: 'S-Class Executive', collectionUa: 'S-Class Executive', handle: 's-class' };
  }
  if (t.includes('porsche') || url.includes('porsche')) {
    return { collectionEn: 'Supercar Programme', collectionUa: 'Програма Суперкарів', handle: 'porsche' };
  }
  if (t.includes('rolls-royce') || url.includes('rolls')) {
    return { collectionEn: 'Brabus Supercars', collectionUa: 'Суперкари Brabus', handle: 'rolls-royce' };
  }
  if (t.includes('monoblock') || t.includes('wheel') || c.includes('wheel') || url.includes('raeder')) {
    return { collectionEn: 'Forged Wheels', collectionUa: 'Ковані Диски', handle: 'wheels' };
  }

  return { collectionEn: 'Brabus Accessories', collectionUa: 'Аксесуари Brabus', handle: 'accessories' };
}

function generateSlug(sku: string): string {
  return `brabus-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

export async function POST(req: Request) {
  try {
    const products = await req.json();
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const slug = generateSlug(p.sku);

      try {
        const colls = determineCollections(p);
        const priceEur = p.priceEUR_final;
        const mainImage = p.images && p.images.length > 0 ? p.images[0] : null;

        const tags = ['Brabus', 'Tuning', colls.handle];
        if (p.category) tags.push(p.category);

        const data = {
          slug,
          sku: p.sku,
          scope: 'auto',
          brand: 'Brabus',
          vendor: 'Brabus',
          productType: 'Premium Tuning',
          productCategory: p.category,
          status: 'ACTIVE' as const,
          titleUa: p.titleUk || p.titleEn || p.title,
          titleEn: p.titleEn || p.title,
          bodyHtmlUa: p.descriptionUk || null,
          bodyHtmlEn: p.descriptionEn || null,
          stock: 'inStock',
          collectionUa: colls.collectionUa,
          collectionEn: colls.collectionEn,
          priceEur: priceEur,
          image: mainImage,
          isPublished: true,
          tags,
        };

        const existing = await prisma.shopProduct.findUnique({ where: { slug } });

        if (existing) {
          await prisma.shopProduct.update({
            where: { slug },
            data: {
              ...data,
              variants: {
                deleteMany: {},
                create: [{
                  title: 'Default Title',
                  sku: p.sku,
                  position: 1,
                  inventoryQty: 0,
                  priceEur: priceEur,
                  requiresShipping: true,
                  image: mainImage,
                  isDefault: true,
                }],
              },
            },
          });
          updated++;
        } else {
          await prisma.shopProduct.create({
            data: {
              ...data,
              variants: {
                create: [{
                  title: 'Default Title',
                  sku: p.sku,
                  position: 1,
                  inventoryQty: 0,
                  priceEur: priceEur,
                  requiresShipping: true,
                  image: mainImage,
                  isDefault: true,
                }],
              },
              media: mainImage ? {
                create: p.images.map((img: string, idx: number) => ({
                  src: img,
                  altText: p.titleEn || p.title,
                  position: idx + 1,
                  mediaType: 'IMAGE',
                })),
              } : undefined,
            },
          });
          created++;
        }
      } catch (err: any) {
        errors++;
        console.error(`Error on sku ${p.sku}:`, err);
      }
    }

    return NextResponse.json({ success: true, created, updated, errors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
