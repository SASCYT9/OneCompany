import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'burger-products.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'data/burger-products.json not found. Run scraper first.' }, { status: 400 });
    }

    const products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of products) {
      try {
        const slug = `burger-${p.slug}`;
        const sku = p.sku || `BURGER-${p.shopifyProductId}`;

        const existing = await prisma.shopProduct.findFirst({
          where: { OR: [{ slug }, { sku }] },
        });

        const priceEur = Math.round(p.priceUsd * 0.92 * 100) / 100;

        const data = {
          titleEn: p.title,
          titleUa: p.title,
          slug,
          sku,
          brand: 'Burger Motorsports',
          bodyHtmlEn: p.descriptionEn || '',
          bodyHtmlUa: p.descriptionUa || '',
          priceEur,
          priceUsd: p.priceUsd,
          tags: p.tags,
          isPublished: true,
          image: p.media?.[0]?.url || null,
          gallery: p.media?.map((m: any) => m.url) || [],
          productType: p.productType || null,
          vendor: p.vendor || 'Burger Motorsports Inc',
        };

        let productId: string;

        if (existing) {
          await prisma.shopProduct.update({
            where: { id: existing.id },
            data,
          });
          productId = existing.id;
          updated++;
        } else {
          const product = await prisma.shopProduct.create({ data });
          productId = product.id;
          created++;
        }

        // ── Always upsert media (delete old + create new) ──
        await prisma.shopProductMedia.deleteMany({ where: { productId } });
        if (p.media && p.media.length > 0) {
          await prisma.shopProductMedia.createMany({
            data: p.media.map((m: any, i: number) => ({
              productId,
              src: m.url,
              altText: m.alt || p.title,
              position: i,
              mediaType: 'IMAGE',
            })),
          });
        }

        // ── Always upsert default variant (delete old + create new) ──
        await prisma.shopProductVariant.deleteMany({ where: { productId } });
        await prisma.shopProductVariant.create({
          data: {
            productId,
            title: p.selectedVariant || 'Default',
            sku,
            priceEur,
            priceUsd: p.priceUsd,
            inventoryQty: 999,
            position: 0,
          },
        });
      } catch (err: any) {
        const msg = err.message || String(err);
        const unknownArg = msg.match(/Unknown argument `(\w+)`/);
        const missing = msg.match(/Argument `(\w+)` is missing/);
        const unique = msg.match(/Unique constraint.*`(\w+)`/);
        const detail = unknownArg ? `Unknown arg: ${unknownArg[1]}` 
          : missing ? `Missing arg: ${missing[1]}` 
          : unique ? `Duplicate: ${unique[1]}`
          : msg.slice(0, 300);
        errors.push(`[${p.slug}] ${p.title}: ${detail}`);
        skipped++;
        if (skipped <= 5) console.error(`IMPORT ERROR [${p.slug}]: ${detail}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: products.length,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
