import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import https from 'https';

const prisma = new PrismaClient();

function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Handle protocol-relative URLs
    const fullUrl = url.startsWith('//') ? `https:${url}` : url;
    
    const file = fs.createWriteStream(dest);
    https.get(fullUrl, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        file.close();
        fs.unlink(dest, () => reject(new Error(`Status Code: ${response.statusCode}`)));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => reject(err));
    });
  });
}

export async function GET() {
  try {
    const allProducts = await prisma.shopProduct.findMany({});
    const products = allProducts.filter(p => {
      const isMainImageCDN = typeof p.image === 'string' && p.image.includes('cdn.shopify.com');
      const galleryArr = Array.isArray(p.gallery) ? p.gallery as string[] : [];
      const hasGalleryCDN = galleryArr.some(g => typeof g === 'string' && g.includes('cdn.shopify.com'));
      return isMainImageCDN || hasGalleryCDN;
    });

    if (products.length === 0) {
      return NextResponse.json({ message: "No CDN images found in database." });
    }

    const dir = path.join(process.cwd(), 'public', 'images', 'shop', 'urban', 'products', 'urus-se');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const results = [];

    for (const p of products) {
      let updatedImage = p.image;
      
      // Fix main image
      if (p.image && p.image.includes('cdn.shopify.com')) {
        const filename = path.basename(p.image.split('?')[0]);
        const dest = path.join(dir, filename);
        await downloadImage(p.image, dest);
        updatedImage = `/images/shop/urban/products/urus-se/${filename}`;
      }

      // Fix gallery images
      const galleryArr = Array.isArray(p.gallery) ? p.gallery as string[] : [];
      const updatedGallery = [];
      for (const g of galleryArr) {
        if (typeof g === 'string' && g.includes('cdn.shopify.com')) {
          const filename = path.basename(g.split('?')[0]);
          const dest = path.join(dir, filename);
          await downloadImage(g, dest);
          updatedGallery.push(`/images/shop/urban/products/urus-se/${filename}`);
        } else {
          updatedGallery.push(g);
        }
      }

      await prisma.shopProduct.update({
        where: { id: p.id },
        data: {
          image: updatedImage,
          gallery: updatedGallery
        }
      });

      results.push(`Fixed ${p.slug}: ${updatedImage}`);
    }

    return NextResponse.json({ success: true, fixed: results });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
